"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { SocialIcon } from "./social-icons";

/** Share links are built from the live URL, so they're right on any host. */
export function ShareButtons({ title }: { title: string }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const open = (build: (url: string) => string) => () => {
    window.open(build(encodeURIComponent(window.location.href)), "_blank", "noopener,noreferrer");
  };
  const text = encodeURIComponent(title);
  const btn = "grid size-10 place-items-center rounded-theme border border-foreground/15 text-lg hover:bg-foreground/5";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="me-1 text-sm font-medium opacity-75">{t("post.share")}</span>
      <button type="button" className={btn} aria-label={t("share.facebook")} onClick={open((u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`)}>
        <SocialIcon name="facebook" />
      </button>
      <button type="button" className={btn} aria-label={t("share.whatsapp")} onClick={open((u) => `https://wa.me/?text=${text}%20${u}`)}>
        <SocialIcon name="whatsapp" />
      </button>
      <button type="button" className={btn} aria-label={t("share.x")} onClick={open((u) => `https://x.com/intent/post?url=${u}&text=${text}`)}>
        <SocialIcon name="x" />
      </button>
      <button
        type="button"
        className={btn}
        aria-label={copied ? t("share.copied") : t("share.copy")}
        onClick={async () => {
          await navigator.clipboard?.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check aria-hidden className="size-5" /> : <Link2 aria-hidden className="size-5" />}
      </button>
      <span aria-live="polite" className="sr-only">{copied ? t("share.copied") : ""}</span>
    </div>
  );
}
