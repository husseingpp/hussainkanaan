mod commands;
mod db;
mod util;

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

/// Application state shared across all Tauri commands.
///
/// The SQLite connection is the single local source of truth. It lives behind a
/// `Mutex` because rusqlite's `Connection` is not `Sync`; every command locks it
/// for the duration of its query. `device_id` is resolved once at startup.
pub struct AppState {
    pub db: Mutex<Connection>,
    pub device_id: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Per-OS application data directory (offline, local-only).
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();

            // device_id is generated once on first launch and persisted to disk.
            let device_id = util::get_or_create_device_id(&data_dir);

            // Open DB, run migrations, then ensure a default pharmacy row exists.
            let db_path = data_dir.join("pharmapos.db");
            let conn = db::open(&db_path).expect("failed to open database");
            let mut conn = conn;
            db::migrate(&mut conn).expect("failed to run migrations");
            db::bootstrap(&conn, &device_id).expect("failed to bootstrap database");

            app.manage(AppState {
                db: Mutex::new(conn),
                device_id,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::device::get_device_id,
            commands::pharmacy::get_pharmacy,
            commands::pharmacy::update_currency_settings,
            commands::products::list_products,
            commands::products::search_products,
            commands::products::get_product,
            commands::products::find_product_by_barcode,
            commands::products::create_product,
            commands::products::update_product,
            commands::products::delete_product,
            commands::batches::list_batches,
            commands::batches::create_batch,
            commands::batches::update_batch,
            commands::batches::delete_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PharmaPOS");
}
