# PharmaPOS

Offline-first **Windows POS for pharmacies**. Local-first: **SQLite is the source
of truth and the app works with no internet.** Built with Tauri 2 (Rust core) +
React + TypeScript + Tailwind.

> 📘 **[CLAUDE.md](./CLAUDE.md) is the single source of truth** for schema, sync
> contract, conventions, and decisions. Read it first.

This is **Phase 1**: product catalog + batches + barcode scanning. Sales,
payments, sync, and the cloud dashboard come in later phases.

## Features (Phase 1)

- SQLite with a forward-only migration system (`rusqlite` + `rusqlite_migration`).
- Four core tables — `pharmacies`, `users`, `products`, `batches` — each carrying
  sync columns (`id` UUIDv4, `updated_at` UTC, `device_id`, `dirty`) from day one.
- Product **CRUD + search** by name, generic name, or barcode.
- **HID barcode scanner** support (keyboard-wedge capture) with a manual fallback.
- A `device_id` generated once on first launch and persisted locally.
- Dual-currency (USD / LBP) pricing with a switchable main display currency.

## Prerequisites

- **Rust** (stable) and **Node 18+**.
- **Windows** is the target OS.
- Linux dev additionally needs: `libwebkit2gtk-4.1-dev libgtk-3-dev
  libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev build-essential`.

## Run (desktop app)

```bash
npm install
npm run tauri:dev      # launches the PharmaPOS window
```

Data (SQLite DB + `device_id`) is stored in the OS app-data directory
(Windows: `%APPDATA%/com.pharmapos.app/`) and persists across restarts.

## Verify without a GUI (CI / headless)

```bash
npm run build                                   # tsc typecheck + vite build
npm test                                        # vitest — barcode ScanDetector
cargo test --manifest-path src-tauri/Cargo.toml # migrations + DB round-trips
```

## Build a Windows installer

```bash
npm run tauri:build    # run on Windows for an .msi/.exe
```
