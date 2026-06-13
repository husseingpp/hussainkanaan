use rusqlite::{params, Connection};
use tauri::State;

use super::{validate_currency, CmdResult};
use crate::db::{
    self,
    models::{Pharmacy, PHARMACY_COLS},
};
use crate::util::now_utc_iso;
use crate::AppState;

fn fetch_pharmacy(conn: &Connection) -> rusqlite::Result<Pharmacy> {
    let sql = format!(
        "SELECT {PHARMACY_COLS} FROM pharmacies ORDER BY updated_at ASC, id ASC LIMIT 1"
    );
    conn.query_row(&sql, [], Pharmacy::from_row)
}

/// The current pharmacy (currency settings live here).
#[tauri::command]
pub fn get_pharmacy(state: State<AppState>) -> CmdResult<Pharmacy> {
    let conn = state.db.lock().unwrap();
    Ok(fetch_pharmacy(&conn)?)
}

/// Switch the main display currency and/or update the LBP-per-USD exchange rate
/// and default VAT. `fx_updated_at` is stamped whenever a rate is supplied.
#[tauri::command]
pub fn update_currency_settings(
    state: State<AppState>,
    main_currency: String,
    fx_rate_lbp_per_usd: Option<f64>,
    default_vat_rate: Option<f64>,
) -> CmdResult<Pharmacy> {
    validate_currency(&main_currency)?;
    let conn = state.db.lock().unwrap();
    let id = db::default_pharmacy_id(&conn)?;
    let now = now_utc_iso();
    conn.execute(
        "UPDATE pharmacies SET
            main_currency = ?1,
            fx_rate_lbp_per_usd = ?2,
            fx_updated_at = CASE WHEN ?2 IS NOT NULL THEN ?3 ELSE fx_updated_at END,
            default_vat_rate = COALESCE(?4, default_vat_rate),
            updated_at = ?3,
            device_id = ?5,
            dirty = 1
         WHERE id = ?6",
        params![
            main_currency,
            fx_rate_lbp_per_usd,
            now,
            default_vat_rate,
            state.device_id,
            id,
        ],
    )?;
    Ok(fetch_pharmacy(&conn)?)
}
