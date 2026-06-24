# App icons

`tauri.conf.json` references the icon files below, but they are **not** committed
(binary assets that need to be generated). Before the first desktop build, generate
them from a single source PNG (1024×1024 recommended):

```sh
npm run tauri icon path/to/source-icon.png
```

This produces every required size in this folder:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

Until then, `npm run tauri build` will fail at the bundling step with a missing-icon
error — expected, and unrelated to the Phase 0 code, which is verified via `npm test`.
