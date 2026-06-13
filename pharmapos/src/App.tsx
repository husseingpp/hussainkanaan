import { useCallback, useEffect, useState } from "react";

import { CurrencySettings } from "./components/CurrencySettings";
import { Badge, Button } from "./components/ui";
import { ProductsPage } from "./pages/ProductsPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { api } from "./lib/api";
import { t } from "./lib/i18n";
import type { Pharmacy } from "./lib/types";
import { errMessage } from "./lib/util";

type View = { kind: "list" } | { kind: "detail"; id: string };
type ToastKind = "success" | "error" | "info";
interface Toast {
  message: string;
  kind: ToastKind;
}

export default function App() {
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [view, setView] = useState<View>({ kind: "list" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    setToast({ message, kind });
  }, []);

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Initial load: device id + pharmacy (and surface a clear error if not in Tauri).
  useEffect(() => {
    (async () => {
      try {
        const [dev, ph] = await Promise.all([api.getDeviceId(), api.getPharmacy()]);
        setDeviceId(dev);
        setPharmacy(ph);
      } catch (e) {
        setFatal(errMessage(e));
      }
    })();
  }, []);

  if (fatal) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="font-medium text-red-700">PharmaPOS failed to start</p>
          <p className="mt-2 text-sm text-red-600">{fatal}</p>
          <p className="mt-3 text-xs text-red-400">
            This window must run inside the Tauri shell (run <code>npm run tauri:dev</code>),
            not a plain browser.
          </p>
        </div>
      </div>
    );
  }

  if (!pharmacy) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Starting PharmaPOS…
      </div>
    );
  }

  const fxLabel =
    pharmacy.fx_rate_lbp_per_usd != null
      ? `1 USD = ${pharmacy.fx_rate_lbp_per_usd.toLocaleString()} LBP`
      : "no FX rate set";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-lg font-bold text-white">
              ＋
            </div>
            <div>
              <div className="font-semibold leading-tight text-slate-800">{t("app_title")}</div>
              <div className="text-xs text-slate-400">{t("tagline")}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs text-slate-500 sm:block">
              <div>
                <Badge tone="teal">{pharmacy.main_currency}</Badge>{" "}
                <span className="text-slate-400">{fxLabel}</span>
              </div>
            </div>
            <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
              ⚙ {t("settings")}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {view.kind === "list" ? (
          <ProductsPage
            pharmacy={pharmacy}
            notify={notify}
            onOpenProduct={(id) => setView({ kind: "detail", id })}
          />
        ) : (
          <ProductDetailPage
            productId={view.id}
            pharmacy={pharmacy}
            notify={notify}
            onBack={() => setView({ kind: "list" })}
          />
        )}
      </main>

      <footer className="border-t border-slate-100 px-4 py-2 text-center text-[11px] text-slate-400">
        {t("device_id")}: <span className="font-mono">{deviceId || "…"}</span> · offline · SQLite
      </footer>

      {settingsOpen ? (
        <CurrencySettings
          pharmacy={pharmacy}
          onSaved={setPharmacy}
          onClose={() => setSettingsOpen(false)}
          notify={notify}
        />
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm shadow-lg ${
            toast.kind === "error"
              ? "bg-red-600 text-white"
              : toast.kind === "success"
                ? "bg-brand text-white"
                : "bg-slate-800 text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
