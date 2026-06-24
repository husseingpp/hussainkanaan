//! PharmaPOS Tauri entry point.
//!
//! The local database is a single SQLite file managed by `tauri-plugin-sql`.
//! Phase 1 will register the real schema (BLUEPRINT.md §6) as migrations in the
//! `migrations` vec below; for now it is intentionally empty so the shell builds.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Phase 1: push `tauri_plugin_sql::Migration { version, description, sql, kind }`
    // entries here, one per schema step (products, batches, sales, ...).
    let migrations: Vec<tauri_plugin_sql::Migration> = Vec::new();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pharmapos.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running PharmaPOS");
}
