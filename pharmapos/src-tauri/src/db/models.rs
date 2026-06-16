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

// ---------------------------------------------------------------------------
// Phase 2 — sales / POS
// ---------------------------------------------------------------------------

pub const SALE_COLS: &str = "id,pharmacy_id,user_id,sale_no,currency,fx_rate_lbp_per_usd,\
    subtotal,vat_total,discount_total,grand_total,payment_method,amount_tendered,change_due,\
    status,note,sold_at,updated_at,device_id,dirty";

#[derive(Debug, Serialize, Deserialize)]
pub struct Sale {
    pub id: String,
    pub pharmacy_id: Option<String>,
    pub user_id: Option<String>,
    pub sale_no: i64,
    pub currency: String,
    pub fx_rate_lbp_per_usd: Option<f64>,
    pub subtotal: i64,
    pub vat_total: i64,
    pub discount_total: i64,
    pub grand_total: i64,
    pub payment_method: String,
    pub amount_tendered: i64,
    pub change_due: i64,
    pub status: String,
    pub note: Option<String>,
    pub sold_at: String,
    pub updated_at: String,
    pub device_id: String,
    pub dirty: bool,
}

impl Sale {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Sale {
            id: row.get(0)?,
            pharmacy_id: row.get(1)?,
            user_id: row.get(2)?,
            sale_no: row.get(3)?,
            currency: row.get(4)?,
            fx_rate_lbp_per_usd: row.get(5)?,
            subtotal: row.get(6)?,
            vat_total: row.get(7)?,
            discount_total: row.get(8)?,
            grand_total: row.get(9)?,
            payment_method: row.get(10)?,
            amount_tendered: row.get(11)?,
            change_due: row.get(12)?,
            status: row.get(13)?,
            note: row.get(14)?,
            sold_at: row.get(15)?,
            updated_at: row.get(16)?,
            device_id: row.get(17)?,
            dirty: row.get(18)?,
        })
    }
}

pub const SALE_ITEM_COLS: &str = "id,sale_id,product_id,batch_id,product_name,batch_no,qty,\
    unit_price,vat_rate,line_vat,line_total,updated_at,device_id,dirty";

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleItem {
    pub id: String,
    pub sale_id: String,
    pub product_id: Option<String>,
    pub batch_id: Option<String>,
    pub product_name: String,
    pub batch_no: Option<String>,
    pub qty: i64,
    pub unit_price: i64,
    pub vat_rate: f64,
    pub line_vat: i64,
    pub line_total: i64,
    pub updated_at: String,
    pub device_id: String,
    pub dirty: bool,
}

impl SaleItem {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(SaleItem {
            id: row.get(0)?,
            sale_id: row.get(1)?,
            product_id: row.get(2)?,
            batch_id: row.get(3)?,
            product_name: row.get(4)?,
            batch_no: row.get(5)?,
            qty: row.get(6)?,
            unit_price: row.get(7)?,
            vat_rate: row.get(8)?,
            line_vat: row.get(9)?,
            line_total: row.get(10)?,
            updated_at: row.get(11)?,
            device_id: row.get(12)?,
            dirty: row.get(13)?,
        })
    }
}

/// A sale plus its line items — the receipt payload.
#[derive(Debug, Serialize)]
pub struct SaleWithItems {
    #[serde(flatten)]
    pub sale: Sale,
    pub items: Vec<SaleItem>,
}

/// One requested cart line at checkout.
#[derive(Debug, Deserialize)]
pub struct CartLineInput {
    pub product_id: String,
    pub qty: i64,
}

/// Checkout payload from the frontend.
#[derive(Debug, Deserialize)]
pub struct CheckoutInput {
    pub currency: String,         // settlement currency
    pub payment_method: String,   // cash | card | other
    pub amount_tendered: i64,     // minor units of settlement currency
    pub note: Option<String>,
    pub lines: Vec<CartLineInput>,
}

/// Pricing + stock summary the cart needs when adding a product.
#[derive(Debug, Serialize)]
pub struct SellInfo {
    pub product_id: String,
    pub name: String,
    pub vat_rate: f64,
    pub requires_rx: bool,
    pub controlled: bool,
    pub total_qty: i64,
    pub best_currency: Option<String>,  // FEFO batch currency
    pub best_sell_price: Option<i64>,   // FEFO batch sell price (minor units, its currency)
}
