import type { ReactNode, SVGProps } from "react";

type IProps = SVGProps<SVGSVGElement> & {
  d?: string;
  children?: ReactNode;
  /** when set, the icon is filled with currentColor instead of stroked */
  filled?: boolean;
};

/** Base icon — minimal stroke icons returning inline SVG. */
function I({ d, children, filled, ...p }: IProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const Icons = {
  sun: (p: P) => (
    <I {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </I>
  ),
  moon: (p: P) => <I {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  arrow: (p: P) => <I {...p} d="M5 12h14M13 6l6 6-6 6" />,
  arrowUpRight: (p: P) => <I {...p} d="M7 17 17 7M8 7h9v9" />,
  mail: (p: P) => (
    <I {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </I>
  ),
  phone: (p: P) => (
    <I
      {...p}
      d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"
    />
  ),
  pin: (p: P) => (
    <I {...p}>
      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </I>
  ),
  github: (p: P) => (
    <I {...p} filled>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.93.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </I>
  ),
  linkedin: (p: P) => (
    <I {...p} filled>
      <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5ZM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21H17.6v-5.3c0-1.27-.02-2.9-1.77-2.9s-2.04 1.38-2.04 2.8V21H9z" />
    </I>
  ),
  server: (p: P) => (
    <I {...p}>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </I>
  ),
  tools: (p: P) => (
    <I
      {...p}
      d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3Z"
    />
  ),
  database: (p: P) => (
    <I {...p}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </I>
  ),
  code: (p: P) => <I {...p} d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" />,
  spark: (p: P) => (
    <I
      {...p}
      d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 14l.7 2 .8.3-2 .7-.3 2-.7-2-.8-.3 2-.7z"
    />
  ),
  map: (p: P) => (
    <I {...p}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </I>
  ),
  external: (p: P) => (
    <I
      {...p}
      d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
    />
  ),
  close: (p: P) => <I {...p} d="M6 6l12 12M18 6 6 18" />,
  globe: (p: P) => (
    <I {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18M3 12h18" />
    </I>
  ),
  sliders: (p: P) => (
    <I {...p}>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </I>
  ),
} as const;

export type IconName = keyof typeof Icons;
