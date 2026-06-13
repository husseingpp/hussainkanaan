pub mod batches;
pub mod device;
pub mod pharmacy;
pub mod products;

/// Error type returned by every Tauri command. Serializes to a plain string so
/// the frontend receives a readable message in the rejected `invoke` promise.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error("{0}")]
    Msg(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type CmdResult<T> = Result<T, AppError>;

/// Trim a value; treat empty strings as absent (NULL) so optional text columns
/// stay clean and the partial unique barcode index behaves predictably.
pub fn normalize_opt(value: Option<String>) -> Option<String> {
    match value {
        Some(v) => {
            let trimmed = v.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        None => None,
    }
}

/// Validate a currency code against the supported set.
pub fn validate_currency(code: &str) -> CmdResult<()> {
    if code != "USD" && code != "LBP" {
        return Err(AppError::Msg("Currency must be USD or LBP".into()));
    }
    Ok(())
}
