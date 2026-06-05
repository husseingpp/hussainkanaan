"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/components/SectionReveal";
import { TiltCard } from "@/components/TiltCard";
import { CheckIcon } from "@/components/Icons";
import { certifications, skillGroups } from "@/data/portfolio";

export function Skills() {
  const reduce = useReducedMotion();

  return (
    <section id="skills" className="section-padding relative">
      <div className="container-content">
        <SectionHeading
          eyebrow="03 / skills"
          title="Tools of the trade"
          description="A blend of development chops and real-world IT support experience."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          {skillGroups.map((group, gi) => (
            <SectionReveal key={group.category} delay={gi * 0.08}>
              <TiltCard className="h-full">
                <div className="glass h-full rounded-2xl p-6">
                  <p className="font-mono text-xs text-accent-violet">
                    {group.label}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">
                    {group.category}
                  </h3>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {group.items.map((item, i) => (
                      <motion.li
                        key={item}
                        initial={{ opacity: 0, scale: 0.85 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{
                          delay: reduce ? 0 : i * 0.04 + gi * 0.05,
                          type: "spring",
                          stiffness: 260,
                          damping: 20,
                        }}
                        className="rounded-full border border-border bg-background/50 px-3.5 py-1.5 text-sm text-foreground transition-colors hover:border-accent-violet/60 hover:text-accent-violet"
                      >
                        {item}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </TiltCard>
            </SectionReveal>
          ))}
        </div>

        {/* Certifications */}
        <SectionReveal delay={0.15} className="mt-6">
          <div className="flex flex-wrap gap-4">
            {certifications.map((cert) => (
              <div
                key={cert.name}
                className="glass flex items-center gap-4 rounded-2xl p-5"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-violet text-white">
                  <CheckIcon width={22} height={22} strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-tight">
                    {cert.name}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {cert.issuer} · {cert.year}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
