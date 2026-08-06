import Link from "next/link";
import type { ReactNode } from "react";
import { SettingsMenu } from "@/components/shell/settings-menu";
import { brand } from "@/config/brand";

// PLS-107. The marketing shell: sticky nav, footer, one set of CTAs.
//
// Six pages share this. The rebrand puts the theme toggle on the marketing
// site too, behind the same gear as the app, so a visitor who prefers dark
// gets it before they ever sign in. That is the same SettingsMenu component,
// not a second copy.

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/features", label: "Features" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
] as const;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Sticky, translucent, blurred: the one place in the product where a
          blur is right, because there is no text to read through it and the
          page scrolling under it is the point. */}
      <header className="sticky top-0 z-50 border-b border-rule bg-paper/80 backdrop-blur-md backdrop-saturate-150">
        <nav className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-6">
          <Link href="/" className="flex flex-col leading-none">
            <span className="display text-[17px] tracking-tight">
              {brand.name}
            </span>
            <span className="legend mt-0.5 text-vermilion">
              by {brand.company}
            </span>
          </Link>

          <div className="ml-auto hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="settle text-[14px] font-medium text-ink-2 hover:text-vermilion"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3 md:ml-0">
            {/* The gear carries the theme toggle, exactly as it does in the
                app. Same component, different ground. */}
            <SettingsMenu tone="paper" />
            <Link
              href="/signin"
              className="settle rounded-control border border-rule bg-sheet px-4 py-2 text-[14px] font-medium hover:border-vermilion hover:text-vermilion"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="settle lift rounded-control bg-vermilion px-5 py-2 text-[14px] font-medium text-on-vermilion shadow-[0_8px_20px_rgb(124_58_237/0.22)] hover:bg-vermilion-hover"
            >
              Start your pilot
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-4 px-6 py-8">
          <span className="display text-[15px]">{brand.name}</span>
          <span className="ml-auto text-[12px] text-ink-2">
            © {new Date().getFullYear()} {brand.company}. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
