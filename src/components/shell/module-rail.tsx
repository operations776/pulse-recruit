"use client";

import { KeyRound, Settings, Share2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, moduleForPath } from "@/config/modules";

// Settings is not one of the five pillars, so moduleForPath cannot name it and
// fell through to its TALENT default. That put "Pillar 4 / TALENT" above every
// settings screen, which is exactly the question DESIGN.md section 8 says the
// masthead exists to answer, answered wrongly.
const SETTINGS_SECTIONS = [
  { href: "/settings", label: "Workspace", icon: SlidersHorizontal },
  { href: "/settings/channels", label: "Channels", icon: Share2 },
  { href: "/settings/integrations", label: "API keys", icon: KeyRound },
];

// Two levels, always in the same place. Modules on the left rail, the sections
// of the active module beside them. DESIGN.md: nothing moves between screens.
export function ModuleRail() {
  const pathname = usePathname();
  const inSettings = pathname.startsWith("/settings");
  const active = moduleForPath(pathname);

  return (
    <>
      <nav
        aria-label="Modules"
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-rule bg-sheet py-2"
      >
        {MODULES.map((m) => {
          const isActive = !inSettings && m.key === active.key;
          const Icon = m.icon;
          return (
            <Link
              key={m.key}
              href={m.href}
              title={`${m.wordmark}, pillar ${m.pillar}`}
              aria-label={`${m.wordmark} module`}
              aria-current={isActive ? "page" : undefined}
              className={`flex size-8 items-center justify-center rounded-control ${
                isActive
                  ? "bg-ink text-sheet"
                  : "text-ink-3 hover:bg-well hover:text-ink"
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
            </Link>
          );
        })}

        <Link
          href="/settings"
          title="Settings"
          aria-label="Settings"
          className={`mt-auto flex size-8 items-center justify-center rounded-control ${
            pathname.startsWith("/settings")
              ? "bg-ink text-sheet"
              : "text-ink-3 hover:bg-well hover:text-ink"
          }`}
        >
          <Settings size={16} strokeWidth={1.75} />
        </Link>
      </nav>

      <nav
        aria-label={inSettings ? "Settings sections" : `${active.wordmark} sections`}
        className="flex w-52 shrink-0 flex-col border-r border-rule bg-sheet"
      >
        {/* Masthead: the wayfinding that colour cannot do here. */}
        <div className="border-b border-rule px-3 py-3">
          <p className="legend text-ink-3">
            {inSettings ? "Workspace" : `Pillar ${active.pillar}`}
          </p>
          <p className="display mt-1 text-[15px] leading-none">
            {inSettings ? "SETTINGS" : active.wordmark}
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.4] text-ink-2">
            {inSettings ? "Team, channels and keys" : active.pillarName}
          </p>
        </div>

        <ul className="flex flex-col gap-0.5 p-2">
          {(inSettings ? SETTINGS_SECTIONS : active.nav).map((item) => {
            // /settings is a prefix of every settings route, so it only counts
            // as active on an exact match or it would light up on all of them.
            const isActive =
              item.href === "/settings"
                ? pathname === "/settings"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-8 items-center gap-2.5 rounded-control px-2.5 text-[13px] ${
                    isActive
                      ? "bg-well font-medium text-ink"
                      : "text-ink-2 hover:bg-well hover:text-ink"
                  }`}
                >
                  <Icon size={15} strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-auto border-t border-rule p-3 text-[12px] leading-[1.4] text-ink-3">
          {inSettings
            ? "Who is in the workspace, which accounts it posts from, and the keys it runs on."
            : active.blurb}
        </p>
      </nav>
    </>
  );
}
