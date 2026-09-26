import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  subtitle?: string;
  action?: { href: string; label: string };
  className?: string;
  id?: string;
};

export function SectionHeading({ title, subtitle, action, className, id }: Props) {
  if (!title && !subtitle && !action) return null;
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {title && <h2 id={id} className="text-2xl font-bold sm:text-3xl">{title}</h2>}
        {subtitle && <p className="mt-2 leading-relaxed opacity-75">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {action.label}
          <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="border-b border-foreground/10 bg-primary/5">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-lg leading-relaxed opacity-80">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
