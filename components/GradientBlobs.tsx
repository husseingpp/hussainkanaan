"use client";

/**
 * Animated gradient blobs + grid for section/page backgrounds.
 * Pure CSS animation (respects reduced-motion via globals.css).
 */
export function GradientBlobs({ variant = "page" }: { variant?: "page" | "hero" }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute left-[8%] top-[12%] h-[28rem] w-[28rem] rounded-full bg-accent-blue/30 blur-[120px] animate-blob-drift" />
      <div
        className="absolute right-[10%] top-[30%] h-[26rem] w-[26rem] rounded-full bg-accent-violet/30 blur-[120px] animate-blob-drift"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute bottom-[8%] left-[35%] h-[24rem] w-[24rem] rounded-full bg-accent-sunset/25 blur-[120px] animate-blob-drift"
        style={{ animationDelay: "-12s" }}
      />
      {variant === "hero" && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgb(var(--background))_75%)]" />
      )}
      {/* faint grid */}
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(to_right,rgb(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--border))_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    </div>
  );
}
