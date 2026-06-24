//! PharmaPOS Tauri entry point.
//!
//! The local database is a single SQLite file managed by `tauri-plugin-sql`.
//! The schema lives in `migrations/0001_init.sql` (the same file the JS test/dev
//! path applies via sql.js), embedded here with `include_str!` so there is one
//! canonical source of truth for the schema across Rust and TypeScript.

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "init schema",
        sql: include_str!("../../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pharmapos.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running PharmaPOS");
}
