pub mod migrations;
pub mod models;

use std::path::Path;

use rusqlite::Connection;

use crate::util::{now_utc_iso, uuid_v4};

/// Open the SQLite database and apply the connection-level PRAGMAs we rely on.
pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    // WAL → better read/write concurrency for a long-running POS.
    // foreign_keys → enforce referential integrity (must be set per connection).
    // busy_timeout → wait instead of failing on transient locks.
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(conn)
}

/// Run all pending migrations to bring the schema to the latest version.
pub fn migrate(conn: &mut Connection) -> Result<(), rusqlite_migration::Error> {
    migrations::migrations().to_latest(conn)
}

/// Ensure a single default pharmacy exists so products always have a home.
/// Idempotent: safe to call on every launch.
pub fn bootstrap(conn: &Connection, device_id: &str) -> rusqlite::Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM pharmacies", [], |r| r.get(0))?;
    if count == 0 {
        conn.execute(
            "INSERT INTO pharmacies (id, name, main_currency, default_vat_rate, updated_at, device_id, dirty)
             VALUES (?1, ?2, 'USD', 0.11, ?3, ?4, 1)",
            rusqlite::params![uuid_v4(), "My Pharmacy", now_utc_iso(), device_id],
        )?;
    }
    Ok(())
}

/// Id of the (single, for now) pharmacy. Stable across restarts.
pub fn default_pharmacy_id(conn: &Connection) -> rusqlite::Result<String> {
    conn.query_row(
        "SELECT id FROM pharmacies ORDER BY updated_at ASC, id ASC LIMIT 1",
        [],
        |r| r.get(0),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    /// In-memory DB with FKs on and the schema migrated to latest.
    fn test_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrate(&mut conn).unwrap();
        conn
    }

    #[test]
    fn bootstrap_is_idempotent() {
        let conn = test_conn();
        bootstrap(&conn, "dev-test").unwrap();
        bootstrap(&conn, "dev-test").unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM pharmacies", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn product_and_batch_roundtrip() {
        let conn = test_conn();
        bootstrap(&conn, "dev-test").unwrap();
        let pid = default_pharmacy_id(&conn).unwrap();
        conn.execute(
            "INSERT INTO products (id,pharmacy_id,name,barcode,requires_rx,controlled,vat_rate,updated_at,device_id,dirty)
             VALUES ('p1',?1,'Panadol','12345',0,0,0.11,'2026-01-01T00:00:00Z','dev',1)",
            params![pid],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO batches (id,product_id,currency,cost_price,sell_price,qty_on_hand,updated_at,device_id,dirty)
             VALUES ('b1','p1','USD',100,150,10,'2026-01-01T00:00:00Z','dev',1)",
            [],
        )
        .unwrap();

        let (name, dirty): (String, bool) = conn
            .query_row("SELECT name, dirty FROM products WHERE id='p1'", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!(name, "Panadol");
        assert!(dirty, "new local rows must start dirty");

        let sell: i64 = conn
            .query_row("SELECT sell_price FROM batches WHERE id='b1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(sell, 150);
    }

    #[test]
    fn duplicate_barcode_in_same_pharmacy_is_rejected() {
        let conn = test_conn();
        bootstrap(&conn, "dev-test").unwrap();
        let pid = default_pharmacy_id(&conn).unwrap();
        let insert = |id: &str| {
            conn.execute(
                "INSERT INTO products (id,pharmacy_id,name,barcode,requires_rx,controlled,vat_rate,updated_at,device_id,dirty)
                 VALUES (?1,?2,'X','999',0,0,0,'t','dev',1)",
                params![id, pid],
            )
        };
        insert("p1").unwrap();
        assert!(insert("p2").is_err());
    }

    #[test]
    fn batch_requires_existing_product() {
        let conn = test_conn();
        let res = conn.execute(
            "INSERT INTO batches (id,product_id,currency,cost_price,sell_price,qty_on_hand,updated_at,device_id,dirty)
             VALUES ('b1','missing','USD',0,0,0,'t','dev',1)",
            [],
        );
        assert!(res.is_err(), "foreign key to a missing product must fail");
    }
}
