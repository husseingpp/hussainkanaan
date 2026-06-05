"use client";

import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/components/SectionReveal";
import { about } from "@/data/portfolio";

export function About() {
  return (
    <section id="about" className="section-padding relative">
      <div className="container-content">
        <SectionHeading eyebrow="01 / about" title="A bit about me" />

        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-3">
            <div className="space-y-5 text-base leading-relaxed text-muted sm:text-lg">
              {about.body.map((paragraph, i) => (
                <SectionReveal as="div" key={i} delay={i * 0.08}>
                  <p>{paragraph}</p>
                </SectionReveal>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <SectionReveal delay={0.1}>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
                {about.facts.map((fact) => (
                  <div key={fact.label} className="bg-card/60 p-5 backdrop-blur">
                    <dt className="font-mono text-xs uppercase tracking-wider text-muted">
                      {fact.label}
                    </dt>
                    <dd className="mt-1.5 text-sm font-medium text-foreground">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </SectionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
