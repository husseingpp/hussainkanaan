import { SocialIcon } from "@/components/Icons";
import { personal, socials } from "@/data/portfolio";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border px-5 py-10">
      <div className="container-content flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <a
            href="#top"
            className="font-mono text-sm font-medium text-foreground"
          >
            {personal.name}
          </a>
          <p className="mt-1 text-xs text-muted">
            © {year} · Built with{" "}
            <a
              href="https://nextjs.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-violet hover:underline"
            >
              Next.js
            </a>{" "}
            &amp; Tailwind CSS
          </p>
        </div>

        <div className="flex gap-3">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target={s.href.startsWith("http") ? "_blank" : undefined}
              rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
              aria-label={s.label}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted transition-colors hover:border-accent-violet/60 hover:text-foreground"
            >
              <SocialIcon name={s.icon} width={17} height={17} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
