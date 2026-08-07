import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Inter, Newsreader } from "next/font/google";
import { ThemeScript } from "@/components/shell/theme-script";
import { brand } from "@/config/brand";
import "./globals.css";

// Three faces per DESIGN.md. Archivo carries the personality and is restricted
// to display, Inter reads, Plex Mono labels everything.
//
// PLS-101 moved display from Archivo Black (one weight, 400) to Archivo at
// 600 to 900. Archivo Black is a separate family locked to a single weight, so
// the rebrand's lighter display headings were not expressible in it at all.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

// PLS-177b. The serif, and the single change Daniyal will feel first.
//
// Scope is deliberately narrow, per DESIGN.md 4z: page titles and coach prose
// only. A serif on a data label makes a table unreadable, which is exactly how
// an editorial face gets blamed for a legibility problem it did not cause.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// Inter replaces IBM Plex Sans as the reading face, per the rebrand.
//
// 400 and 500 ONLY, per DESIGN.md 4z. Dropping 600 and 700 is a real change:
// the shipped build reaches for semibold whenever something needs emphasis,
// and emphasis now comes from size, colour and space. Loading them would let
// them creep back one component at a time.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning on <html> because ThemeScript writes data-theme
    // before React hydrates, so the server markup (no attribute) and the DOM
    // (attribute set) legitimately differ on this one element.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${inter.variable} ${plexMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        {/* Before the first paint, always. An effect would run after the
            browser has painted, which is a white flash on every navigation
            for anyone using dark mode. */}
        <ThemeScript />
      </head>
      {/* Browser extensions such as Grammarly inject attributes onto body
          before React hydrates, which reports as a hydration mismatch that is
          not ours. Suppressing here keeps real mismatches visible elsewhere. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
