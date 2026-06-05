import { SectionReveal } from "./SectionReveal";

type SectionHeadingProps = {
  /** monospace eyebrow label, e.g. "01 / about" */
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <SectionReveal className="mb-12 max-w-2xl md:mb-16">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-accent-violet">
        {eyebrow}
      </p>
      <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-balance text-base text-muted sm:text-lg">
          {description}
        </p>
      )}
    </SectionReveal>
  );
}
