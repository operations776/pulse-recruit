"use client";

import { BookOpen, ExternalLink, Mail, Settings } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverTitle } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { brand } from "@/config/brand";

// PLS-104. The gear menu, ported from the rebrand.
//
// The rebrand's popover holds exactly one setting, Dark mode, and a Help
// block. That is not an oversight to be improved on: every other preference in
// this product is a workspace setting that belongs on /settings, where it can
// be scoped to an org and audited. A theme is per-person, per-device and
// instant, which is why it is the one thing that belongs in a header menu.

export function SettingsMenu({
  /**
   * `bar` is the dark app chrome, `paper` is the marketing nav. The menu
   * itself is identical; only the trigger sits on a different ground, so this
   * is a tone rather than a second component.
   */
  tone = "bar",
}: {
  tone?: "bar" | "paper";
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`relative flex items-center ${
        tone === "bar" ? "h-full border-l border-on-bar/15" : ""
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          tone === "bar"
            ? `flex h-full items-center px-4 hover:bg-on-bar/10 ${open ? "bg-on-bar/10" : ""}`
            : `settle flex size-9 items-center justify-center rounded-control border border-rule bg-sheet text-ink-2 hover:border-violet hover:text-violet ${open ? "border-violet text-violet" : ""}`
        }
      >
        <Settings size={16} strokeWidth={1.75} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} label="Settings" width={230}>
        <PopoverTitle>Settings</PopoverTitle>

        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] font-medium">Dark mode</span>
          <ThemeToggle />
        </div>

        <div className="-mx-4 mt-3 border-t border-rule px-4 pt-3">
          <PopoverTitle>Help</PopoverTitle>

          <a
            href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(`${brand.name} support`)}`}
            className="settle -mx-2 flex items-start gap-2.5 rounded-control px-2 py-1.5 hover:bg-paper"
          >
            <Mail size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">Email us</span>
              <span className="block truncate text-[12px] text-ink-2">
                {brand.supportEmail}
              </span>
            </span>
          </a>

          <a
            href="/faq"
            className="settle -mx-2 flex items-start gap-2.5 rounded-control px-2 py-1.5 hover:bg-paper"
          >
            <BookOpen size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">FAQs and guides</span>
              <span className="block text-[12px] text-ink-2">
                Answers to common questions
              </span>
            </span>
          </a>

          <a
            href="https://recruitergtm.com"
            target="_blank"
            rel="noreferrer"
            className="settle -mx-2 flex items-start gap-2.5 rounded-control px-2 py-1.5 hover:bg-paper"
          >
            <ExternalLink size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{brand.company}</span>
              <span className="block text-[12px] text-ink-2">
                Product and company site
              </span>
            </span>
          </a>
        </div>
      </Popover>
    </span>
  );
}
