"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GradientBlobs } from "@/components/GradientBlobs";
import { MagneticButton } from "@/components/MagneticButton";
import { Typewriter } from "@/components/Typewriter";
import { ArrowUpRightIcon, DownloadIcon, MailIcon } from "@/components/Icons";
import { personal } from "@/data/portfolio";

export function Hero() {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] },
    },
  };

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-5 pt-28 pb-20"
    >
      <GradientBlobs variant="hero" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="container-content flex flex-col items-center text-center"
      >
        <motion.span
          variants={item}
          className="pill mb-6 gap-2"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Available for work · {personal.location}
        </motion.span>

        <motion.h1
          variants={item}
          className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
        >
          {personal.name.split(" ")[0]}{" "}
          <span className="gradient-text">{personal.name.split(" ").slice(1).join(" ")}</span>
        </motion.h1>

        <motion.div
          variants={item}
          className="mt-5 flex min-h-[2.5rem] items-center justify-center font-mono text-lg text-muted sm:text-2xl"
        >
          <span className="text-accent-blue">{"<"}</span>
          <Typewriter words={personal.roles} className="mx-2 text-foreground" />
          <span className="text-accent-blue">{"/>"}</span>
        </motion.div>

        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-balance text-base text-muted sm:text-lg"
        >
          {personal.tagline}
        </motion.p>

        <motion.div
          variants={item}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <MagneticButton href="#projects" variant="primary">
            View Work <ArrowUpRightIcon width={16} height={16} />
          </MagneticButton>
          <MagneticButton
            href={personal.cv}
            download
            variant="outline"
            ariaLabel="Download CV"
          >
            Download CV <DownloadIcon width={16} height={16} />
          </MagneticButton>
          <MagneticButton href="#contact" variant="ghost">
            Contact <MailIcon width={16} height={16} />
          </MagneticButton>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      {!reduce && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="flex h-9 w-5 items-start justify-center rounded-full border border-border p-1">
            <motion.span
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="h-2 w-1 rounded-full bg-accent-violet"
            />
          </div>
        </motion.div>
      )}
    </section>
  );
}
