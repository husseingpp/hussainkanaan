import { Cairo, IBM_Plex_Sans_Arabic, Inter, Noto_Kufi_Arabic, Noto_Sans, Poppins, Tajawal } from "next/font/google";

// Every curated font the owner can pick (theme.font_arabic / font_latin).
// The theme selects one of each through the --font-ar / --font-latin variables;
// only the default pair is preloaded.
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});
const cairo = Cairo({ subsets: ["arabic"], variable: "--font-cairo", display: "swap", preload: false });
const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
  preload: false,
});
const notoKufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-kufi",
  display: "swap",
  preload: false,
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-poppins",
  display: "swap",
  preload: false,
});
const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-noto-sans", display: "swap", preload: false });

export const fontVariables = [ibmPlexArabic, cairo, tajawal, notoKufi, inter, poppins, notoSans]
  .map((f) => f.variable)
  .join(" ");
