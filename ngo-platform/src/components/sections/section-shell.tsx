import { cn } from "@/lib/utils";

/** Standard vertical rhythm + width for a homepage section. */
export function SectionShell({ children, className, tone = "plain", labelledBy }: {
  children: React.ReactNode;
  className?: string;
  tone?: "plain" | "tinted";
  labelledBy?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className={cn(tone === "tinted" && "bg-primary/5", className)}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">{children}</div>
    </section>
  );
}
