"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AdminLanguageSwitch } from "@/components/admin/admin-intl";
import { Field, Input } from "@/components/admin/ui";
import { currentStaff, sendLoginLink, signInWithPassword, signOut } from "@/lib/admin/session";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Arriving from the email link (?code=…) or with a live session: go in if staff.
  useEffect(() => {
    const db = createClient();
    const enter = async () => {
      const staff = await currentStaff();
      if (staff) router.replace("/admin");
      else if ((await db.auth.getSession()).data.session) {
        await signOut();
        setMessage({ tone: "error", text: t("login.no_access") });
      }
    };
    enter();
    const { data } = db.auth.onAuthStateChange((event) => event === "SIGNED_IN" && enter());
    return () => data.subscription.unsubscribe();
  }, [router, t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const redirect = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/admin/login/`;
    const res = mode === "link" ? await sendLoginLink(email.trim(), redirect) : await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (!res.ok) return setMessage({ tone: "error", text: t(`errors.${res.error}`) });
    if (mode === "link") setMessage({ tone: "ok", text: t("login.link_sent") });
  };

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-primary/5 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-theme bg-white p-6 shadow-md">
        <AdminLanguageSwitch className="justify-end" />
        <div>
          <h1 className="text-xl font-bold">{t("login.title")}</h1>
          {mode === "link" && <p className="mt-1 text-sm opacity-75">{t("login.subtitle")}</p>}
        </div>
        <Field label={t("login.email")} htmlFor="email">
          <Input id="email" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mode === "password" && (
          <Field label={t("login.password")} htmlFor="password">
            <Input id="password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {mode === "link" ? <Mail aria-hidden /> : <KeyRound aria-hidden />}
          {busy ? t("login.checking") : mode === "link" ? t("login.send_link") : t("login.sign_in")}
        </Button>
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-red-700" : "text-sm text-primary"}>
            {message.text}
          </p>
        )}
        <button type="button" onClick={() => { setMode(mode === "link" ? "password" : "link"); setMessage(null); }} className="text-sm text-primary underline">
          {mode === "link" ? t("login.use_password") : t("login.use_link")}
        </button>
      </form>
    </main>
  );
}
