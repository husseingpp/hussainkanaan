import { useEffect, useRef } from "react";

import { t } from "../lib/i18n";

interface Props {
  onScan: (code: string) => void;
}

/**
 * Always-focused barcode field — the primary HID capture path. The scanner
 * "types" the code and sends Enter; we read the value on Enter and clear it.
 * Doubles as the manual fallback: a person can type a barcode and press Enter.
 */
export function ScannerInput({ onScan }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    el?.focus();

    // Re-grab focus when it's lost, unless the user clicked into another field.
    const refocus = () => {
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        const tag = active?.tagName;
        const inOtherField =
          tag === "INPUT" || tag === "TEXTAREA" || active?.isContentEditable === true;
        if (!inOtherField) el?.focus();
      }, 0);
    };

    el?.addEventListener("blur", refocus);
    return () => el?.removeEventListener("blur", refocus);
  }, []);

  const submit = () => {
    const value = ref.current?.value.trim() ?? "";
    if (!value) return;
    onScan(value);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2">
      <span aria-hidden className="text-lg">
        🔎
      </span>
      <input
        ref={ref}
        data-scanner="true"
        autoComplete="off"
        spellCheck={false}
        placeholder={t("scan_placeholder")}
        aria-label={t("scan_label")}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}
