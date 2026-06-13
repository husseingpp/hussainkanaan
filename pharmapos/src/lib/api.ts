import { invoke } from "@tauri-apps/api/core";

import type {
  Batch,
  BatchInput,
  Currency,
  Pharmacy,
  Product,
  ProductInput,
} from "./types";

// Typed wrappers over the Rust commands. Top-level argument keys are camelCase
// (Tauri converts them to the Rust snake_case parameter names); nested payload
// objects (`input`) stay snake_case to match the serde structs.
export const api = {
  getDeviceId: () => invoke<string>("get_device_id"),

  getPharmacy: () => invoke<Pharmacy>("get_pharmacy"),
  updateCurrencySettings: (
    mainCurrency: Currency,
    fxRateLbpPerUsd: number | null,
    defaultVatRate: number | null,
  ) =>
    invoke<Pharmacy>("update_currency_settings", {
      mainCurrency,
      fxRateLbpPerUsd,
      defaultVatRate,
    }),

  listProducts: () => invoke<Product[]>("list_products"),
  searchProducts: (term: string) => invoke<Product[]>("search_products", { term }),
  getProduct: (id: string) => invoke<Product>("get_product", { id }),
  findProductByBarcode: (barcode: string) =>
    invoke<Product | null>("find_product_by_barcode", { barcode }),
  createProduct: (input: ProductInput) => invoke<Product>("create_product", { input }),
  updateProduct: (id: string, input: ProductInput) =>
    invoke<Product>("update_product", { id, input }),
  deleteProduct: (id: string) => invoke<void>("delete_product", { id }),

  listBatches: (productId: string) => invoke<Batch[]>("list_batches", { productId }),
  createBatch: (input: BatchInput) => invoke<Batch>("create_batch", { input }),
  updateBatch: (id: string, input: BatchInput) =>
    invoke<Batch>("update_batch", { id, input }),
  deleteBatch: (id: string) => invoke<void>("delete_batch", { id }),
};
