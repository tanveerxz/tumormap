import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/**
 * IBM Plex: drawn for technical and clinical interfaces, and it ships a mono
 * companion that shares the sans' skeleton — so field labels and readouts sit
 * beside prose without looking bolted on.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Biopsy Sampling Simulator",
  description:
    "A research demonstration on synthetic data: how the placement of biopsy passes affects whether the collected tissue represents a heterogeneous tumour.",
};

/**
 * Applies the stored theme before first paint so the page never flashes the
 * wrong palette. Kept inline and tiny on purpose.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <div className="brand-rule" />
        {children}
      </body>
    </html>
  );
}
