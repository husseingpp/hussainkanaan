"use client";

import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/components/SectionReveal";
import { TiltCard } from "@/components/TiltCard";
import { ArrowUpRightIcon } from "@/components/Icons";
import { projects } from "@/data/portfolio";

export function Projects() {
  return (
    <section id="projects" className="section-padding relative">
      <div className="container-content">
        <SectionHeading
          eyebrow="04 / projects"
          title="Things I've built"
          description="A few projects spanning web, mobile, and data."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, i) => (
            <SectionReveal key={project.title} delay={i * 0.08} className="h-full">
              <TiltCard className="h-full" intensity={6}>
                <article className="glass relative flex h-full flex-col overflow-hidden rounded-2xl p-6">
                  {/* accent glow */}
                  <div
                    aria-hidden
                    className={`absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${project.accent} opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40`}
                  />

                  <div className="relative flex grow flex-col">
                    <h3 className="text-xl font-semibold tracking-tight">
                      {project.title}
                    </h3>
                    <p className="mt-3 grow text-sm leading-relaxed text-muted">
                      {project.description}
                    </p>

                    <ul className="mt-5 flex flex-wrap gap-2">
                      {project.tech.map((t) => (
                        <li key={t} className="pill">
                          {t}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex flex-wrap gap-4 border-t border-border pt-4">
                      {project.links.map((link) => {
                        const external = link.href.startsWith("http");
                        return (
                          <a
                            key={link.label}
                            href={link.href}
                            target={external ? "_blank" : undefined}
                            rel={external ? "noopener noreferrer" : undefined}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-accent-violet"
                          >
                            {link.label}
                            <ArrowUpRightIcon width={15} height={15} />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </article>
              </TiltCard>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
