import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Inter } from "next/font/google";
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

// Inter replaces IBM Plex Sans as the reading face, per the rebrand.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/* Browser extensions such as Grammarly inject attributes onto body
          before React hydrates, which reports as a hydration mismatch that is
          not ours. Suppressing here keeps real mismatches visible elsewhere. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
