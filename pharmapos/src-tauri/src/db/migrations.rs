use rusqlite_migration::{Migrations, M};

/// Ordered, version-tracked migrations (SQLite `user_version`).
///
/// Append-only: to change the schema, add a new `M::up(include_str!(...))`
/// entry and a new `migrations/NNNN_*.sql` file. Never edit a shipped one.
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../../migrations/0001_init.sql")),
        M::up(include_str!("../../migrations/0002_sales.sql")),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid_and_apply() {
        // rusqlite_migration ships a validator that checks every migration applies cleanly.
        assert!(migrations().validate().is_ok());
    }
}
