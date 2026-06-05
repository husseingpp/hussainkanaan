"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { useRef, type ReactNode, type MouseEvent } from "react";

type MagneticButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** visual variant */
  variant?: "primary" | "outline" | "ghost";
  download?: boolean;
  ariaLabel?: string;
  type?: "button" | "submit";
  disabled?: boolean;
};

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors duration-300 will-change-transform";

const variants = {
  primary:
    "text-white bg-gradient-to-r from-accent-blue via-accent-violet to-accent-sunset bg-300% animate-gradient-pan shadow-lg shadow-accent-violet/25 hover:shadow-accent-violet/40",
  outline:
    "border border-border bg-card/40 text-foreground backdrop-blur hover:border-accent-violet/60 hover:text-foreground",
  ghost: "text-muted hover:text-foreground",
};

/**
 * Button/link that subtly follows the cursor (magnetic). Static under reduced-motion.
 */
export function MagneticButton({
  children,
  href,
  onClick,
  className = "",
  variant = "primary",
  download,
  ariaLabel,
  type = "button",
  disabled,
}: MagneticButtonProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 250, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 250, damping: 18, mass: 0.4 });

  function handleMove(e: MouseEvent) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    x.set(relX * 0.3);
    y.set(relY * 0.3);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  const classes = `${base} ${variants[variant]} ${className}`;

  const motionProps = {
    style: { x: springX, y: springY },
    onMouseMove: handleMove,
    onMouseLeave: handleLeave,
    whileTap: reduce ? undefined : { scale: 0.96 },
  };

  if (href) {
    const external = href.startsWith("http");
    return (
      <motion.a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        download={download}
        aria-label={ariaLabel}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={classes}
        {...motionProps}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${classes} disabled:cursor-not-allowed disabled:opacity-70`}
      {...motionProps}
    >
      {children}
    </motion.button>
  );
}
