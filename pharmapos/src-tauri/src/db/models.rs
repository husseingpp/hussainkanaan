use rusqlite::Row;
use serde::{Deserialize, Serialize};

// Column lists are kept as constants so the SELECT order always matches the
// index-based `from_row` readers below. Field names are snake_case end-to-end
// (Rust ↔ JSON ↔ TypeScript) to avoid any mapping ambiguity.

pub const PHARMACY_COLS: &str = "id,name,license_no,phone,address,main_currency,\
    fx_rate_lbp_per_usd,fx_updated_at,default_vat_rate,updated_at,device_id,dirty";

pub const PRODUCT_COLS: &str = "id,pharmacy_id,name,generic_name,barcode,form,strength,\
    category,manufacturer,requires_rx,controlled,vat_rate,updated_at,device_id,dirty";

pub const BATCH_COLS: &str = "id,product_id,batch_no,expiry_date,currency,cost_price,\
    sell_price,qty_on_hand,supplier_id,updated_at,device_id,dirty";

#[derive(Debug, Serialize, Deserialize)]
pub struct Pharmacy {
    pub id: String,
    pub name: String,
    pub license_no: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub main_currency: String,
    pub fx_rate_lbp_per_usd: Option<f64>,
    pub fx_updated_at: Option<String>,
    pub default_vat_rate: f64,
    pub updated_at: String,
    pub device_id: String,
    pub dirty: bool,
}

impl Pharmacy {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Pharmacy {
            id: row.get(0)?,
            name: row.get(1)?,
            license_no: row.get(2)?,
            phone: row.get(3)?,
            address: row.get(4)?,
            main_currency: row.get(5)?,
            fx_rate_lbp_per_usd: row.get(6)?,
            fx_updated_at: row.get(7)?,
            default_vat_rate: row.get(8)?,
            updated_at: row.get(9)?,
            device_id: row.get(10)?,
            dirty: row.get(11)?,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub pharmacy_id: Option<String>,
    pub name: String,
    pub generic_name: Option<String>,
    pub barcode: Option<String>,
    pub form: Option<String>,
    pub strength: Option<String>,
    pub category: Option<String>,
    pub manufacturer: Option<String>,
    pub requires_rx: bool,
    pub controlled: bool,
    pub vat_rate: f64,
    pub updated_at: String,
    pub device_id: String,
    pub dirty: bool,
}

impl Product {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Product {
            id: row.get(0)?,
            pharmacy_id: row.get(1)?,
            name: row.get(2)?,
            generic_name: row.get(3)?,
            barcode: row.get(4)?,
            form: row.get(5)?,
            strength: row.get(6)?,
            category: row.get(7)?,
            manufacturer: row.get(8)?,
            requires_rx: row.get(9)?,
            controlled: row.get(10)?,
            vat_rate: row.get(11)?,
            updated_at: row.get(12)?,
            device_id: row.get(13)?,
            dirty: row.get(14)?,
        })
    }
}

/// Editable fields supplied by the frontend when creating/updating a product.
/// Server-managed fields (id, updated_at, device_id, dirty) are never accepted here.
#[derive(Debug, Deserialize)]
pub struct ProductInput {
    pub name: String,
    pub generic_name: Option<String>,
    pub barcode: Option<String>,
    pub form: Option<String>,
    pub strength: Option<String>,
    pub category: Option<String>,
    pub manufacturer: Option<String>,
    pub requires_rx: bool,
    pub controlled: bool,
    pub vat_rate: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Batch {
    pub id: String,
    pub product_id: String,
    pub batch_no: Option<String>,
    pub expiry_date: Option<String>,
    pub currency: String,
    pub cost_price: i64,
    pub sell_price: i64,
    pub qty_on_hand: i64,
    pub supplier_id: Option<String>,
    pub updated_at: String,
    pub device_id: String,
    pub dirty: bool,
}

impl Batch {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Batch {
            id: row.get(0)?,
            product_id: row.get(1)?,
            batch_no: row.get(2)?,
            expiry_date: row.get(3)?,
            currency: row.get(4)?,
            cost_price: row.get(5)?,
            sell_price: row.get(6)?,
            qty_on_hand: row.get(7)?,
            supplier_id: row.get(8)?,
            updated_at: row.get(9)?,
            device_id: row.get(10)?,
            dirty: row.get(11)?,
        })
    }
}

/// Editable fields for creating/updating a batch. Prices are INTEGER minor units
/// of `currency` (USD → cents, LBP → whole pounds); the frontend converts.
#[derive(Debug, Deserialize)]
pub struct BatchInput {
    pub product_id: String,
    pub batch_no: Option<String>,
    pub expiry_date: Option<String>,
    pub currency: String,
    pub cost_price: i64,
    pub sell_price: i64,
    pub qty_on_hand: i64,
    pub supplier_id: Option<String>,
}
