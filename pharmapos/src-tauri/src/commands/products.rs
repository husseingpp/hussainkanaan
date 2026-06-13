use rusqlite::params;
use tauri::State;

use super::{normalize_opt, AppError, CmdResult};
use crate::db::{
    self,
    models::{Product, ProductInput, PRODUCT_COLS},
};
use crate::util::{now_utc_iso, uuid_v4};
use crate::AppState;

/// All products, alphabetical (case-insensitive).
#[tauri::command]
pub fn list_products(state: State<AppState>) -> CmdResult<Vec<Product>> {
    let conn = state.db.lock().unwrap();
    let sql = format!("SELECT {PRODUCT_COLS} FROM products ORDER BY name COLLATE NOCASE ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], Product::from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Search by name, generic name, or barcode (substring, case-insensitive).
#[tauri::command]
pub fn search_products(state: State<AppState>, term: String) -> CmdResult<Vec<Product>> {
    let conn = state.db.lock().unwrap();
    let like = format!("%{}%", term.trim());
    let sql = format!(
        "SELECT {PRODUCT_COLS} FROM products \
         WHERE name LIKE ?1 COLLATE NOCASE \
            OR IFNULL(generic_name,'') LIKE ?1 COLLATE NOCASE \
            OR IFNULL(barcode,'') LIKE ?1 COLLATE NOCASE \
         ORDER BY name COLLATE NOCASE ASC LIMIT 200"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![like], Product::from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// One product by id.
#[tauri::command]
pub fn get_product(state: State<AppState>, id: String) -> CmdResult<Product> {
    let conn = state.db.lock().unwrap();
    let sql = format!("SELECT {PRODUCT_COLS} FROM products WHERE id = ?1");
    Ok(conn.query_row(&sql, params![id], Product::from_row)?)
}

/// Resolve a scanned/typed barcode to a product (exact match), or `None`.
#[tauri::command]
pub fn find_product_by_barcode(
    state: State<AppState>,
    barcode: String,
) -> CmdResult<Option<Product>> {
    let code = barcode.trim();
    if code.is_empty() {
        return Ok(None);
    }
    let conn = state.db.lock().unwrap();
    let sql = format!("SELECT {PRODUCT_COLS} FROM products WHERE barcode = ?1 LIMIT 1");
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map(params![code], Product::from_row)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn create_product(state: State<AppState>, input: ProductInput) -> CmdResult<Product> {
    let conn = state.db.lock().unwrap();
    let pharmacy_id = db::default_pharmacy_id(&conn).ok();
    let id = uuid_v4();
    let now = now_utc_iso();
    conn.execute(
        "INSERT INTO products
            (id,pharmacy_id,name,generic_name,barcode,form,strength,category,manufacturer,
             requires_rx,controlled,vat_rate,updated_at,device_id,dirty)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,1)",
        params![
            id,
            pharmacy_id,
            input.name.trim(),
            normalize_opt(input.generic_name),
            normalize_opt(input.barcode),
            normalize_opt(input.form),
            normalize_opt(input.strength),
            normalize_opt(input.category),
            normalize_opt(input.manufacturer),
            input.requires_rx,
            input.controlled,
            input.vat_rate,
            now,
            state.device_id,
        ],
    )
    .map_err(map_barcode_conflict)?;

    let sql = format!("SELECT {PRODUCT_COLS} FROM products WHERE id = ?1");
    Ok(conn.query_row(&sql, params![id], Product::from_row)?)
}

#[tauri::command]
pub fn update_product(
    state: State<AppState>,
    id: String,
    input: ProductInput,
) -> CmdResult<Product> {
    let conn = state.db.lock().unwrap();
    let now = now_utc_iso();
    let changed = conn
        .execute(
            "UPDATE products SET
                name=?2, generic_name=?3, barcode=?4, form=?5, strength=?6, category=?7,
                manufacturer=?8, requires_rx=?9, controlled=?10, vat_rate=?11,
                updated_at=?12, device_id=?13, dirty=1
             WHERE id=?1",
            params![
                id,
                input.name.trim(),
                normalize_opt(input.generic_name),
                normalize_opt(input.barcode),
                normalize_opt(input.form),
                normalize_opt(input.strength),
                normalize_opt(input.category),
                normalize_opt(input.manufacturer),
                input.requires_rx,
                input.controlled,
                input.vat_rate,
                now,
                state.device_id,
            ],
        )
        .map_err(map_barcode_conflict)?;
    if changed == 0 {
        return Err(AppError::Msg("Product not found".into()));
    }
    let sql = format!("SELECT {PRODUCT_COLS} FROM products WHERE id = ?1");
    Ok(conn.query_row(&sql, params![id], Product::from_row)?)
}

#[tauri::command]
pub fn delete_product(state: State<AppState>, id: String) -> CmdResult<()> {
    let conn = state.db.lock().unwrap();
    let batch_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM batches WHERE product_id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    if batch_count > 0 {
        return Err(AppError::Msg(format!(
            "Cannot delete: this product has {batch_count} batch(es). Remove them first."
        )));
    }
    let deleted = conn.execute("DELETE FROM products WHERE id = ?1", params![id])?;
    if deleted == 0 {
        return Err(AppError::Msg("Product not found".into()));
    }
    Ok(())
}

/// Turn a UNIQUE-constraint violation on the barcode index into a friendly message.
fn map_barcode_conflict(err: rusqlite::Error) -> AppError {
    let text = err.to_string();
    if text.contains("uq_products_barcode") || (text.contains("UNIQUE") && text.contains("barcode"))
    {
        AppError::Msg("That barcode is already assigned to another product.".into())
    } else {
        AppError::Sqlite(err)
    }
}
