import type { SVGProps } from "react";

// Brand glyphs (lucide dropped brand icons). Simple single-path marks.
const PATHS: Record<string, string> = {
  facebook:
    "M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1Z",
  instagram:
    "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5.5-2.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  x: "M4 4h4.5l4 5.6L17 4h3l-6.1 7.2L20.5 20H16l-4.4-6.1L6.5 20h-3l6.7-7.8Z",
  youtube:
    "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3Z",
  tiktok:
    "M16 3c.3 2.3 1.7 3.8 4 4v3.2c-1.5 0-2.8-.4-4-1.2v6.3A5.7 5.7 0 1 1 10.3 9.6v3.3a2.5 2.5 0 1 0 2.5 2.5V3Z",
  linkedin:
    "M4 9h4v11H4Zm2-6a2.2 2.2 0 1 1 0 4.4A2.2 2.2 0 0 1 6 3Zm4.5 6h3.8v1.6c.6-1 1.9-1.9 3.8-1.9 3.3 0 3.9 2.1 3.9 4.9V20h-4v-5.7c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V20h-4Z",
  whatsapp:
    "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11.4 11.4 0 0 1-4.4-3.9c-.3-.5-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z",
};

export const SOCIAL_KEYS = ["facebook", "instagram", "x", "youtube", "tiktok", "linkedin"] as const;

export function SocialIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden width="1em" height="1em" {...props}>
      <path d={d} />
    </svg>
  );
}
