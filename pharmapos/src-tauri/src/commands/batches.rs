use rusqlite::params;
use tauri::State;

use super::{normalize_opt, validate_currency, AppError, CmdResult};
use crate::db::models::{Batch, BatchInput, BATCH_COLS};
use crate::util::{now_utc_iso, uuid_v4};
use crate::AppState;

/// Batches for a product, soonest expiry first (NULL expiry last).
#[tauri::command]
pub fn list_batches(state: State<AppState>, product_id: String) -> CmdResult<Vec<Batch>> {
    let conn = state.db.lock().unwrap();
    let sql = format!(
        "SELECT {BATCH_COLS} FROM batches WHERE product_id = ?1 \
         ORDER BY (expiry_date IS NULL), expiry_date ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![product_id], Batch::from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

#[tauri::command]
pub fn create_batch(state: State<AppState>, input: BatchInput) -> CmdResult<Batch> {
    validate_currency(&input.currency)?;
    let conn = state.db.lock().unwrap();
    let id = uuid_v4();
    let now = now_utc_iso();
    conn.execute(
        "INSERT INTO batches
            (id,product_id,batch_no,expiry_date,currency,cost_price,sell_price,
             qty_on_hand,supplier_id,updated_at,device_id,dirty)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,1)",
        params![
            id,
            input.product_id,
            normalize_opt(input.batch_no),
            normalize_opt(input.expiry_date),
            input.currency,
            input.cost_price,
            input.sell_price,
            input.qty_on_hand,
            normalize_opt(input.supplier_id),
            now,
            state.device_id,
        ],
    )
    .map_err(map_fk_error)?;

    let sql = format!("SELECT {BATCH_COLS} FROM batches WHERE id = ?1");
    Ok(conn.query_row(&sql, params![id], Batch::from_row)?)
}

#[tauri::command]
pub fn update_batch(state: State<AppState>, id: String, input: BatchInput) -> CmdResult<Batch> {
    validate_currency(&input.currency)?;
    let conn = state.db.lock().unwrap();
    let now = now_utc_iso();
    let changed = conn.execute(
        "UPDATE batches SET
            batch_no=?2, expiry_date=?3, currency=?4, cost_price=?5, sell_price=?6,
            qty_on_hand=?7, supplier_id=?8, updated_at=?9, device_id=?10, dirty=1
         WHERE id=?1",
        params![
            id,
            normalize_opt(input.batch_no),
            normalize_opt(input.expiry_date),
            input.currency,
            input.cost_price,
            input.sell_price,
            input.qty_on_hand,
            normalize_opt(input.supplier_id),
            now,
            state.device_id,
        ],
    )?;
    if changed == 0 {
        return Err(AppError::Msg("Batch not found".into()));
    }
    let sql = format!("SELECT {BATCH_COLS} FROM batches WHERE id = ?1");
    Ok(conn.query_row(&sql, params![id], Batch::from_row)?)
}

#[tauri::command]
pub fn delete_batch(state: State<AppState>, id: String) -> CmdResult<()> {
    let conn = state.db.lock().unwrap();
    let deleted = conn.execute("DELETE FROM batches WHERE id = ?1", params![id])?;
    if deleted == 0 {
        return Err(AppError::Msg("Batch not found".into()));
    }
    Ok(())
}

/// Surface a missing-product foreign-key violation in plain language.
fn map_fk_error(err: rusqlite::Error) -> AppError {
    let text = err.to_string();
    if text.contains("FOREIGN KEY") {
        AppError::Msg("Cannot attach a batch to a product that does not exist.".into())
    } else {
        AppError::Sqlite(err)
    }
}
