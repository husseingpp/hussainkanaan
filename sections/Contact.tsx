"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/components/SectionReveal";
import { MagneticButton } from "@/components/MagneticButton";
import { CheckIcon, SocialIcon } from "@/components/Icons";
import { personal, socials } from "@/data/portfolio";

type Status = "idle" | "submitting" | "success";

export function Contact() {
  const [status, setStatus] = useState<Status>("idle");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    // Mock submit — swap for a real endpoint / email service later.
    setTimeout(() => {
      setStatus("success");
      (e.target as HTMLFormElement).reset();
      setTimeout(() => setStatus("idle"), 4000);
    }, 900);
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-foreground placeholder:text-muted/70 backdrop-blur transition-colors focus:border-accent-violet/70";

  return (
    <section id="contact" className="section-padding relative">
      <div className="container-content">
        <SectionHeading
          eyebrow="05 / contact"
          title="Let's build something"
          description="Have a role, a project, or a question? My inbox is open."
        />

        <div className="grid gap-8 md:grid-cols-5">
          {/* Contact info */}
          <SectionReveal className="md:col-span-2">
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-muted">
                  Email
                </p>
                <a
                  href={`mailto:${personal.email}`}
                  className="mt-1 inline-block text-lg font-medium text-foreground transition-colors hover:text-accent-violet"
                >
                  {personal.email}
                </a>
              </div>

              <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
                  Elsewhere
                </p>
                <div className="flex gap-3">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target={s.href.startsWith("http") ? "_blank" : undefined}
                      rel={
                        s.href.startsWith("http")
                          ? "noopener noreferrer"
                          : undefined
                      }
                      aria-label={s.label}
                      className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card/60 text-muted backdrop-blur transition-colors hover:border-accent-violet/60 hover:text-foreground"
                    >
                      <SocialIcon name={s.icon} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </SectionReveal>

          {/* Form */}
          <SectionReveal delay={0.1} className="md:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="glass rounded-2xl p-6 sm:p-8"
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block font-mono text-xs text-muted"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Your name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block font-mono text-xs text-muted"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="message"
                  className="mb-1.5 block font-mono text-xs text-muted"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell me about your project or role…"
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="mt-6 flex items-center gap-4">
                <MagneticButton
                  variant="primary"
                  type="submit"
                  disabled={status === "submitting"}
                  ariaLabel="Send message"
                >
                  {status === "submitting" ? "Sending…" : "Send message"}
                </MagneticButton>

                <AnimatePresence>
                  {status === "success" && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-1.5 text-sm text-emerald-500"
                    >
                      <CheckIcon width={16} height={16} strokeWidth={2.5} />
                      Thanks — I&apos;ll be in touch!
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <p className="mt-4 font-mono text-xs text-muted/70">
                * Demo form — submissions aren&apos;t sent yet. Reach me directly
                by email.
              </p>
            </form>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
