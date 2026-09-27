"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, ExternalLink, FileText, Home, Images, Inbox, LayoutGrid, LogOut, Menu, Newspaper, Settings, Target, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { modulesState } from "@/lib/admin/requests";
import { currentStaff, signOut } from "@/lib/admin/session";
import { listLocales } from "@/lib/admin/taxonomy";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AdminContext, type AdminContextValue } from "./admin-context";
import { AdminLanguageSwitch, useAdminLocale } from "./admin-intl";
import { FirstPassword } from "./password-form";
import { Spinner } from "./ui";

type Role = AdminContextValue["staff"]["role"];
const CONTENT: Role[] = ["admin", "editor"];
const REQUESTS: Role[] = ["admin", "case_worker"];

// `module: true` items only show while the requests module is on (BLUEPRINT §7).
const NAV: { href: string; key: string; Icon: typeof Home; roles?: Role[]; module?: boolean }[] = [
  { href: "/admin", key: "dashboard", Icon: Home },
  { href: "/admin/posts", key: "posts", Icon: Newspaper, roles: CONTENT },
  { href: "/admin/sectors", key: "sectors", Icon: LayoutGrid, roles: CONTENT },
  { href: "/admin/objectives", key: "objectives", Icon: Target, roles: CONTENT },
  { href: "/admin/pages", key: "pages", Icon: FileText, roles: CONTENT },
  { href: "/admin/media", key: "media", Icon: Images, roles: CONTENT },
  { href: "/admin/requests", key: "requests", Icon: Inbox, roles: REQUESTS, module: true },
  { href: "/admin/forms", key: "forms", Icon: ClipboardList, roles: ["admin"], module: true },
  { href: "/admin/settings", key: "settings", Icon: Settings, roles: CONTENT },
  { href: "/admin/account", key: "account", Icon: UserRound },
];

/** Client-side guard + chrome. Security itself is enforced by RLS in the database. */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const pathname = usePathname().replace(/\/$/, "") || "/admin";
  const router = useRouter();
  const { locale } = useAdminLocale();
  const [ctx, setCtx] = useState<AdminContextValue | null>(null);
  const [open, setOpen] = useState(false);
  const isLogin = pathname.endsWith("/admin/login");

  useEffect(() => {
    if (isLogin) return;
    let alive = true;
    const load = async () => {
      const staff = await currentStaff();
      if (!alive) return;
      if (!staff) return router.replace("/admin/login");
      const [locales, modules] = await Promise.all([listLocales(), modulesState()]);
      const rows = locales.ok ? locales.data : [];
      setCtx({ staff, locales: rows, defaultLocale: rows.find((l) => l.is_default)?.code ?? "ar", modules });
    };
    load();
    const { data: sub } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/admin/login");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [isLogin, router]);

  useEffect(() => setOpen(false), [pathname]);

  if (isLogin) return <>{children}</>;
  if (!ctx) return <Spinner label={t("login.checking")} />;
  if (ctx.staff.mustChangePassword) {
    return <FirstPassword email={ctx.staff.email} onDone={() => setCtx({ ...ctx, staff: { ...ctx.staff, mustChangePassword: false } })} />;
  }

  const items = NAV.filter((n) => (!n.roles || n.roles.includes(ctx.staff.role)) && (!n.module || ctx.modules.requests));
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav aria-label={t("title")} className="flex flex-col gap-1">
      {items.map(({ href, key, Icon }) => (
        <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
          className={cn("flex items-center gap-3 rounded-theme px-3 py-2.5 text-sm font-medium hover:bg-foreground/5", active(href) && "bg-primary/10 text-primary")}>
          <Icon aria-hidden className="size-5" /> {t(`nav.${key}`)}
        </Link>
      ))}
      <hr className="my-2 border-foreground/10" />
      <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/${ctx.locales.some((l) => l.code === locale) ? locale : ctx.defaultLocale}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-theme px-3 py-2.5 text-sm hover:bg-foreground/5">
        <ExternalLink aria-hidden className="size-5" /> {t("nav.view_site")}
      </a>
      <AdminLanguageSwitch className="px-3 py-2" />
      <button type="button" onClick={() => signOut()} className="flex items-center gap-3 rounded-theme px-3 py-2.5 text-start text-sm hover:bg-foreground/5">
        <LogOut aria-hidden className="size-5 rtl:rotate-180" /> {t("nav.sign_out")}
      </button>
    </nav>
  );

  return (
    <AdminContext.Provider value={ctx}>
      <div className="min-h-dvh bg-foreground/[0.03] lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="hidden border-e border-foreground/10 bg-white p-4 lg:block">
          <Brand name={ctx.staff.name || ctx.staff.email} role={t(`role.${ctx.staff.role}`)} title={t("title")} />
          {nav}
        </aside>
        <header className="flex items-center justify-between border-b border-foreground/10 bg-white px-4 py-3 lg:hidden">
          <span className="font-bold">{t("title")}</span>
          <button type="button" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen((v) => !v)} className="grid size-10 place-items-center rounded-theme hover:bg-foreground/5">
            {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
            <span className="sr-only">{t("title")}</span>
          </button>
        </header>
        <div id="admin-nav" hidden={!open} className="border-b border-foreground/10 bg-white p-4 lg:hidden">{nav}</div>
        <main id="main" className="min-w-0 p-4 sm:p-8">
          {process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1" && (
            <p className="mb-6 rounded-theme bg-secondary/15 px-4 py-2 text-sm">{t("common.preview_note")}</p>
          )}
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}

function Brand({ name, role, title }: { name: string; role: string; title: string }) {
  return (
    <div className="mb-6 border-b border-foreground/10 pb-4">
      <p className="text-lg font-bold">{title}</p>
      <p className="mt-1 truncate text-sm opacity-75">{name}</p>
      <p className="text-xs opacity-60">{role}</p>
    </div>
  );
}
