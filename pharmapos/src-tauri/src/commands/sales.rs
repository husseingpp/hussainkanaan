use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use super::{normalize_opt, validate_currency, AppError, CmdResult};
use crate::db::models::{
    CheckoutInput, Sale, SaleItem, SaleWithItems, SellInfo, SALE_COLS, SALE_ITEM_COLS,
};
use crate::util::{now_utc_iso, uuid_v4};
use crate::AppState;

/// Minor-unit factor for a currency: USD → cents (×100), LBP → whole pounds (×1).
fn minor_factor(currency: &str) -> f64 {
    if currency == "USD" {
        100.0
    } else {
        1.0
    }
}

/// Convert an amount in `from` minor units to `to` minor units via the LBP-per-USD
/// rate. Errors if a conversion is required but no rate is set. Mirrors the
/// frontend `convertMinor` so previews and the authoritative total agree.
fn convert_minor(minor: i64, from: &str, to: &str, fx: Option<f64>) -> CmdResult<i64> {
    if from == to {
        return Ok(minor);
    }
    let rate = fx
        .filter(|r| *r > 0.0)
        .ok_or_else(|| AppError::Msg("Set an exchange rate before selling across currencies.".into()))?;
    let from_amount = minor as f64 / minor_factor(from);
    let usd = if from == "USD" { from_amount } else { from_amount / rate };
    let to_amount = if to == "USD" { usd } else { usd * rate };
    Ok((to_amount * minor_factor(to)).round() as i64)
}

fn fetch_sale_with_items(conn: &Connection, id: &str) -> rusqlite::Result<SaleWithItems> {
    let sale = conn.query_row(
        &format!("SELECT {SALE_COLS} FROM sales WHERE id = ?1"),
        params![id],
        Sale::from_row,
    )?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {SALE_ITEM_COLS} FROM sale_items WHERE sale_id = ?1 ORDER BY rowid"
    ))?;
    let items = stmt
        .query_map(params![id], SaleItem::from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(SaleWithItems { sale, items })
}

/// Run a checkout atomically: assign a receipt number, allocate stock FEFO across
/// batches (blocking overselling), snapshot prices into the sale currency, write
/// sale + items + stock ledger, and decrement on-hand quantities.
pub fn perform_checkout(
    conn: &mut Connection,
    device_id: &str,
    input: CheckoutInput,
) -> CmdResult<SaleWithItems> {
    validate_currency(&input.currency)?;
    if !matches!(input.payment_method.as_str(), "cash" | "card" | "other") {
        return Err(AppError::Msg("Invalid payment method".into()));
    }
    if input.lines.is_empty() {
        return Err(AppError::Msg("Cart is empty".into()));
    }

    let currency = input.currency;
    let payment_method = input.payment_method;
    let note = normalize_opt(input.note);
    let now = now_utc_iso();

    let tx = conn.transaction()?;
    // Line items are written before the parent sale row; defer FK checks to
    // commit so the order within this transaction doesn't matter.
    tx.execute_batch("PRAGMA defer_foreign_keys = ON;")?;

    let (pharmacy_id, fx): (String, Option<f64>) = tx.query_row(
        "SELECT id, fx_rate_lbp_per_usd FROM pharmacies ORDER BY updated_at ASC, id ASC LIMIT 1",
        [],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;

    let sale_id = uuid_v4();
    let sale_no: i64 = tx.query_row(
        "SELECT COALESCE(MAX(sale_no), 0) + 1 FROM sales WHERE pharmacy_id = ?1",
        params![pharmacy_id],
        |r| r.get(0),
    )?;

    let mut subtotal: i64 = 0;
    let mut vat_total: i64 = 0;

    for line in &input.lines {
        if line.qty <= 0 {
            return Err(AppError::Msg("Quantity must be greater than zero".into()));
        }

        let (product_name, vat_rate): (String, f64) = tx
            .query_row(
                "SELECT name, vat_rate FROM products WHERE id = ?1",
                params![line.product_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(|_| AppError::Msg("Product not found".into()))?;

        // Candidate batches with stock, earliest expiry first (NULL expiry last).
        let mut stmt = tx.prepare(
            "SELECT id, batch_no, currency, sell_price, qty_on_hand FROM batches
             WHERE product_id = ?1 AND qty_on_hand > 0
             ORDER BY (expiry_date IS NULL), expiry_date ASC, id ASC",
        )?;
        let batches = stmt
            .query_map(params![line.product_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, i64>(4)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        drop(stmt);

        let available: i64 = batches.iter().map(|b| b.4).sum();
        if available < line.qty {
            return Err(AppError::Msg(format!(
                "Only {available} in stock for {product_name}"
            )));
        }

        // Allocate the requested quantity across batches FEFO.
        let mut remaining = line.qty;
        for (batch_id, batch_no, batch_currency, sell_price, qty_on_hand) in batches {
            if remaining == 0 {
                break;
            }
            let take = remaining.min(qty_on_hand);
            remaining -= take;

            let unit_price = convert_minor(sell_price, &batch_currency, &currency, fx)?;
            let line_sub = unit_price * take;
            let line_vat = (line_sub as f64 * vat_rate).round() as i64;
            let line_total = line_sub + line_vat;
            subtotal += line_sub;
            vat_total += line_vat;

            tx.execute(
                "INSERT INTO sale_items
                    (id,sale_id,product_id,batch_id,product_name,batch_no,qty,unit_price,vat_rate,line_vat,line_total,updated_at,device_id,dirty)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,1)",
                params![
                    uuid_v4(), sale_id, line.product_id, batch_id, product_name, batch_no,
                    take, unit_price, vat_rate, line_vat, line_total, now, device_id,
                ],
            )?;

            tx.execute(
                "UPDATE batches SET qty_on_hand = qty_on_hand - ?2, updated_at = ?3, device_id = ?4, dirty = 1 WHERE id = ?1",
                params![batch_id, take, now, device_id],
            )?;

            tx.execute(
                "INSERT INTO inventory_movements
                    (id,product_id,batch_id,qty_delta,reason,ref_type,ref_id,moved_at,updated_at,device_id,dirty)
                 VALUES (?1,?2,?3,?4,'sale','sale',?5,?6,?7,?8,1)",
                params![uuid_v4(), line.product_id, batch_id, -take, sale_id, now, now, device_id],
            )?;
        }
    }

    let discount_total: i64 = 0;
    let grand_total = subtotal + vat_total - discount_total;

    let (amount_tendered, change_due) = if payment_method == "cash" {
        if input.amount_tendered < grand_total {
            return Err(AppError::Msg("Amount tendered is less than the total".into()));
        }
        (input.amount_tendered, input.amount_tendered - grand_total)
    } else {
        (grand_total, 0)
    };

    tx.execute(
        "INSERT INTO sales
            (id,pharmacy_id,user_id,sale_no,currency,fx_rate_lbp_per_usd,subtotal,vat_total,discount_total,grand_total,payment_method,amount_tendered,change_due,status,note,sold_at,updated_at,device_id,dirty)
         VALUES (?1,?2,NULL,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'completed',?13,?14,?15,?16,1)",
        params![
            sale_id, pharmacy_id, sale_no, currency, fx, subtotal, vat_total, discount_total,
            grand_total, payment_method, amount_tendered, change_due, note, now, now, device_id,
        ],
    )?;

    tx.commit()?;
    Ok(fetch_sale_with_items(conn, &sale_id)?)
}

/// Pricing + stock info the cart needs when a product is added (FEFO batch).
#[tauri::command]
pub fn get_sell_info(state: State<AppState>, product_id: String) -> CmdResult<SellInfo> {
    let conn = state.db.lock().unwrap();
    let (name, vat_rate, requires_rx, controlled): (String, f64, bool, bool) = conn
        .query_row(
            "SELECT name, vat_rate, requires_rx, controlled FROM products WHERE id = ?1",
            params![product_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|_| AppError::Msg("Product not found".into()))?;

    let total_qty: i64 = conn.query_row(
        "SELECT COALESCE(SUM(qty_on_hand), 0) FROM batches WHERE product_id = ?1",
        params![product_id],
        |r| r.get(0),
    )?;

    let best: Option<(String, i64)> = conn
        .query_row(
            "SELECT currency, sell_price FROM batches
             WHERE product_id = ?1 AND qty_on_hand > 0
             ORDER BY (expiry_date IS NULL), expiry_date ASC, id ASC LIMIT 1",
            params![product_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;

    let (best_currency, best_sell_price) = match best {
        Some((c, p)) => (Some(c), Some(p)),
        None => (None, None),
    };

    Ok(SellInfo {
        product_id,
        name,
        vat_rate,
        requires_rx,
        controlled,
        total_qty,
        best_currency,
        best_sell_price,
    })
}

#[tauri::command]
pub fn create_sale(state: State<AppState>, input: CheckoutInput) -> CmdResult<SaleWithItems> {
    let mut guard = state.db.lock().unwrap();
    perform_checkout(&mut guard, &state.device_id, input)
}

#[tauri::command]
pub fn list_sales(state: State<AppState>, limit: Option<i64>) -> CmdResult<Vec<Sale>> {
    let conn = state.db.lock().unwrap();
    let lim = limit.unwrap_or(50);
    let mut stmt = conn.prepare(&format!(
        "SELECT {SALE_COLS} FROM sales ORDER BY sold_at DESC, sale_no DESC LIMIT ?1"
    ))?;
    let rows = stmt.query_map(params![lim], Sale::from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

#[tauri::command]
pub fn get_sale(state: State<AppState>, id: String) -> CmdResult<SaleWithItems> {
    let conn = state.db.lock().unwrap();
    Ok(fetch_sale_with_items(&conn, &id)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::db::models::CartLineInput;

    fn seed() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        db::migrate(&mut conn).unwrap();
        db::bootstrap(&conn, "dev").unwrap();
        conn
    }

    fn add_product(conn: &Connection, id: &str, name: &str, vat: f64) {
        let pid = db::default_pharmacy_id(conn).unwrap();
        conn.execute(
            "INSERT INTO products (id,pharmacy_id,name,requires_rx,controlled,vat_rate,updated_at,device_id,dirty)
             VALUES (?1,?2,?3,0,0,?4,'t','dev',1)",
            params![id, pid, name, vat],
        )
        .unwrap();
    }

    fn add_batch(conn: &Connection, id: &str, product: &str, expiry: &str, currency: &str, sell: i64, qty: i64) {
        conn.execute(
            "INSERT INTO batches (id,product_id,batch_no,expiry_date,currency,cost_price,sell_price,qty_on_hand,updated_at,device_id,dirty)
             VALUES (?1,?2,?2,?3,?4,0,?5,?6,'t','dev',1)",
            params![id, product, expiry, currency, sell, qty],
        )
        .unwrap();
    }

    fn checkout(currency: &str, method: &str, tendered: i64, product: &str, qty: i64) -> CheckoutInput {
        CheckoutInput {
            currency: currency.into(),
            payment_method: method.into(),
            amount_tendered: tendered,
            note: None,
            lines: vec![CartLineInput { product_id: product.into(), qty }],
        }
    }

    #[test]
    fn fefo_allocates_across_batches_and_decrements() {
        let mut conn = seed();
        add_product(&conn, "p1", "Panadol", 0.0);
        add_batch(&conn, "b_old", "p1", "2026-01-01", "USD", 100, 3); // earlier expiry → drawn first
        add_batch(&conn, "b_new", "p1", "2027-01-01", "USD", 100, 10);

        let res = perform_checkout(&mut conn, "dev", checkout("USD", "cash", 10_000, "p1", 5)).unwrap();
        assert_eq!(res.sale.grand_total, 500);
        assert_eq!(res.items.len(), 2, "split across two batches");

        let q_old: i64 = conn.query_row("SELECT qty_on_hand FROM batches WHERE id='b_old'", [], |r| r.get(0)).unwrap();
        let q_new: i64 = conn.query_row("SELECT qty_on_hand FROM batches WHERE id='b_new'", [], |r| r.get(0)).unwrap();
        assert_eq!(q_old, 0);
        assert_eq!(q_new, 8);

        let moved: i64 = conn.query_row("SELECT COALESCE(SUM(qty_delta),0) FROM inventory_movements", [], |r| r.get(0)).unwrap();
        assert_eq!(moved, -5);
    }

    #[test]
    fn blocks_overselling_and_rolls_back() {
        let mut conn = seed();
        add_product(&conn, "p1", "X", 0.0);
        add_batch(&conn, "b1", "p1", "2027-01-01", "USD", 100, 2);
        assert!(perform_checkout(&mut conn, "dev", checkout("USD", "cash", 10_000, "p1", 5)).is_err());
        let q: i64 = conn.query_row("SELECT qty_on_hand FROM batches WHERE id='b1'", [], |r| r.get(0)).unwrap();
        assert_eq!(q, 2, "stock unchanged after rollback");
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM sales", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn converts_to_settlement_currency() {
        let mut conn = seed();
        conn.execute("UPDATE pharmacies SET fx_rate_lbp_per_usd = 90000", []).unwrap();
        add_product(&conn, "p1", "X", 0.0);
        add_batch(&conn, "b1", "p1", "2027-01-01", "USD", 100, 5); // $1.00
        let res = perform_checkout(&mut conn, "dev", checkout("LBP", "card", 0, "p1", 2)).unwrap();
        assert_eq!(res.sale.currency, "LBP");
        assert_eq!(res.sale.grand_total, 180_000); // 2 × $1 × 90,000
    }

    #[test]
    fn cross_currency_requires_fx_rate() {
        let mut conn = seed(); // fx is NULL by default
        add_product(&conn, "p1", "X", 0.0);
        add_batch(&conn, "b1", "p1", "2027-01-01", "USD", 100, 5);
        assert!(perform_checkout(&mut conn, "dev", checkout("LBP", "cash", 10_000_000, "p1", 1)).is_err());
    }

    #[test]
    fn vat_is_applied() {
        let mut conn = seed();
        add_product(&conn, "p1", "X", 0.10);
        add_batch(&conn, "b1", "p1", "2027-01-01", "USD", 1000, 5); // $10.00
        let res = perform_checkout(&mut conn, "dev", checkout("USD", "card", 0, "p1", 1)).unwrap();
        assert_eq!(res.sale.subtotal, 1000);
        assert_eq!(res.sale.vat_total, 100);
        assert_eq!(res.sale.grand_total, 1100);
    }

    #[test]
    fn sale_numbers_increment_and_change_is_computed() {
        let mut conn = seed();
        add_product(&conn, "p1", "X", 0.0);
        add_batch(&conn, "b1", "p1", "2027-01-01", "USD", 100, 50);
        let s1 = perform_checkout(&mut conn, "dev", checkout("USD", "cash", 500, "p1", 1)).unwrap();
        let s2 = perform_checkout(&mut conn, "dev", checkout("USD", "cash", 500, "p1", 2)).unwrap();
        assert_eq!(s1.sale.sale_no, 1);
        assert_eq!(s2.sale.sale_no, 2);
        assert_eq!(s1.sale.change_due, 400); // 500 tendered − 100 total
    }
}
