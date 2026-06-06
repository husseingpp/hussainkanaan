import type { Metadata, Viewport } from "next";
import {
  Instrument_Serif,
  Hanken_Grotesk,
  Schibsted_Grotesk,
  Space_Grotesk,
  JetBrains_Mono,
} from "next/font/google";
import { TweaksProvider } from "@/components/TweaksProvider";
import { data } from "@/data/portfolio";
import "./globals.css";

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});
const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const fontVars = [instrument, hanken, schibsted, space, jetbrains]
  .map((f) => f.variable)
  .join(" ");

export const metadata: Metadata = {
  title: `${data.name} — ${data.roles[0]}`,
  description: data.tagline,
  keywords: [
    data.name,
    "IT Support Specialist",
    "QA Engineer",
    "Database Administrator",
    "POS",
    "ERP",
    "Beirut",
    "Lebanon",
    "Portfolio",
  ],
  authors: [{ name: data.name }],
  openGraph: {
    title: `${data.name} — Portfolio`,
    description: data.tagline,
    type: "website",
  },
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='86' font-family='Georgia,serif'%3EHK%3C/text%3E%3C/svg%3E",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#15120f" },
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
  ],
};

/**
 * Pre-paint script: applies the persisted theme/direction/anim/accent before
 * first paint to avoid a flash. Mirrors TweaksProvider's defaults & accent map.
 */
const noFlash = `
(function(){
  try {
    var DEF = { direction:"editorial", theme:"system", anim:"full", accent:"default", grain:true };
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("portfolio:tweaks")) || {}; } catch(e){}
    var t = Object.assign({}, DEF, saved);
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var resolved = t.theme === "system" ? (mq.matches ? "dark" : "light") : t.theme;
    var r = document.documentElement;
    r.setAttribute("data-theme", resolved);
    r.setAttribute("data-direction", t.direction);
    r.setAttribute("data-anim", t.anim);
    r.style.colorScheme = resolved;
    var ACC = {
      clay:["#B4543A","#C2613F","#E08A6E","#D87C5E"],
      honey:["#C8791E","#B86A12","#E8A94B","#DA9A3A"],
      indigo:["#4338CA","#4F46E5","#8B8CF9","#7B7DF5"],
      forest:["#2F7A55","#27684A","#5FBF93","#4FB083"],
      rose:["#C0436A","#AD385C","#EE7D9E","#E06B8E"]
    };
    var acc = ACC[t.accent];
    if (acc) {
      var dark = resolved === "dark";
      var a = dark ? acc[2] : acc[0], a2 = dark ? acc[3] : acc[1];
      var n = parseInt(a.slice(1),16);
      r.style.setProperty("--accent", a);
      r.style.setProperty("--accent-2", a2);
      r.style.setProperty("--accent-soft","rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+(dark?0.14:0.10)+")");
    }
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (t.anim !== "off" && !reduce) r.classList.add("anim-on");
  } catch(e){}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body>
        <TweaksProvider>{children}</TweaksProvider>
      </body>
    </html>
  );
}
