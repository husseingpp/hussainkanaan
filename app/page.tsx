"use client";

import { Nav } from "@/components/Nav";
import { TweaksPanel } from "@/components/TweaksPanel";
import { useTweaks } from "@/components/TweaksProvider";
import { Hero } from "@/sections/Hero";
import { About } from "@/sections/About";
import { Skills } from "@/sections/Skills";
import { Projects } from "@/sections/Projects";
import { Experience } from "@/sections/Experience";
import { Contact } from "@/sections/Contact";
import { Footer } from "@/sections/Footer";

export default function Home() {
  const { tweaks } = useTweaks();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {tweaks.grain && <div className="grain" aria-hidden="true" />}

      <Nav />

      <main id="main">
        <Hero />
        <About />
        <Skills />
        <Projects />
        <Experience />
        <Contact />
      </main>

      <Footer />

      <TweaksPanel />
    </>
  );
}
