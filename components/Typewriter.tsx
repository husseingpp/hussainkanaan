"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

type TypewriterProps = {
  words: string[];
  className?: string;
};

/**
 * Cycles through `words`, typing and deleting each. Under reduced-motion it
 * simply shows the first word statically.
 */
export function Typewriter({ words, className = "" }: TypewriterProps) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const current = words[wordIndex % words.length];

    let delay = deleting ? 45 : 90;
    if (!deleting && text === current) {
      delay = 1400; // pause at full word
    } else if (deleting && text === "") {
      delay = 300;
    }

    const timer = setTimeout(() => {
      if (!deleting && text === current) {
        setDeleting(true);
      } else if (deleting && text === "") {
        setDeleting(false);
        setWordIndex((i) => (i + 1) % words.length);
      } else {
        setText((prev) =>
          deleting
            ? current.slice(0, prev.length - 1)
            : current.slice(0, prev.length + 1),
        );
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [text, deleting, wordIndex, words, reduce]);

  if (reduce) {
    return (
      <span className={className}>
        {words[0]}
      </span>
    );
  }

  return (
    <span className={className} aria-live="polite">
      {text}
      <span className="ml-0.5 inline-block w-[2px] -translate-y-0.5 animate-caret-blink bg-current align-middle h-[1em]" />
    </span>
  );
}
