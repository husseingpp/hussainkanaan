use std::path::Path;

use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

/// A fresh client-generated UUIDv4 (the id for every syncable row).
pub fn uuid_v4() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Current time as an ISO-8601 / RFC-3339 UTC string, e.g. `2026-06-13T23:04:20.123456789Z`.
/// Postgres `timestamptz` ingests this unambiguously when sync arrives in Phase 4.
pub fn now_utc_iso() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .expect("formatting a UTC timestamp cannot fail")
}

/// Read the persisted device id, creating and storing one on first launch.
/// Stored as a plain file (`device_id`) next to the SQLite database.
pub fn get_or_create_device_id(data_dir: &Path) -> String {
    let path = data_dir.join("device_id");
    if let Ok(existing) = std::fs::read_to_string(&path) {
        let trimmed = existing.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }
    let id = uuid_v4();
    let _ = std::fs::write(&path, &id);
    id
}
