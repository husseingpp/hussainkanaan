"use client";

import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/components/SectionReveal";
import { experiences } from "@/data/portfolio";

export function Experience() {
  return (
    <section id="experience" className="section-padding relative">
      <div className="container-content">
        <SectionHeading
          eyebrow="02 / experience"
          title="Where I've worked"
          description="Hands-on technical support keeping people and systems productive."
        />

        <ol className="relative ml-3 border-l border-border pl-8">
          {experiences.map((exp, i) => (
            <SectionReveal as="li" key={exp.company + i} delay={i * 0.1}>
              <div className="relative pb-12 last:pb-0">
                {/* timeline node */}
                <span
                  aria-hidden
                  className="absolute -left-[41px] top-1.5 grid h-4 w-4 place-items-center rounded-full border border-accent-violet bg-background"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-violet" />
                </span>

                <div className="glass rounded-2xl p-6 sm:p-7">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-xl font-semibold">{exp.role}</h3>
                    <span className="font-mono text-xs text-accent-violet">
                      {exp.period}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-medium text-foreground">
                      {exp.company}
                    </span>{" "}
                    · {exp.location}
                  </p>
                  <p className="mt-4 text-sm text-muted sm:text-base">
                    {exp.summary}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {exp.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="flex gap-3 text-sm text-muted sm:text-[0.95rem]"
                      >
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet"
                        />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </SectionReveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
