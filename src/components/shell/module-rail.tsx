"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MODULES, moduleForPath } from "@/config/modules";

// Two levels, always in the same place. Modules on the left rail, the sections
// of the active module beside them. DESIGN.md: nothing moves between screens.
//
// `aside` is whatever live data the active module wants under its nav. It is a
// node rather than data because the rail should not know what a scheduled post
// is; the layout composes it and streams it.
export function ModuleRail({ aside }: { aside?: ReactNode }) {
  const pathname = usePathname();
  const active = moduleForPath(pathname);

  return (
    <>
      <nav
        aria-label="Modules"
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-rule bg-sheet py-2"
      >
        {MODULES.map((m) => {
          const isActive = m.key === active.key;
          const Icon = m.icon;
          return (
            <Link
              key={m.key}
              href={m.href}
              // Every route here is dynamic, and Next does not prefetch those
              // by default, so a click paid the whole server round trip with
              // nothing on screen. Prefetching on hover spends the wait during
              // the moment the pointer is already travelling.
              prefetch
              title={`${m.wordmark}, pillar ${m.pillar}`}
              aria-label={`${m.wordmark} module`}
              aria-current={isActive ? "page" : undefined}
              className={`flex size-8 items-center justify-center rounded-control ${
                isActive
                  ? "bg-violet text-on-violet"
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
              ? "bg-violet text-on-violet"
              : "text-ink-3 hover:bg-well hover:text-ink"
          }`}
        >
          <Settings size={16} strokeWidth={1.75} />
        </Link>
      </nav>

      <nav
        aria-label={`${active.wordmark} sections`}
        className="flex w-52 shrink-0 flex-col border-r border-rule bg-sheet"
      >
        {/* Masthead: the wayfinding that colour cannot do here. */}
        <div className="border-b border-rule px-3 py-3">
          <p className="legend text-ink-3">
            {active.pillar === null ? "Workspace" : `Pillar ${active.pillar}`}
          </p>
          <p className="display mt-1 text-[15px] leading-none">
            {active.wordmark}
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.4] text-ink-2">
            {active.pillarName}
          </p>
        </div>

        <ul className="flex flex-col gap-0.5 p-2">
          {active.nav.map((item) => {
            // /settings is a prefix of every other settings route, so a plain
            // startsWith would light Workspace up while you are on Channels or
            // API keys. Anything that is a parent of its siblings matches
            // exactly or not at all.
            const isParentOfSiblings = active.nav.some(
              (other) =>
                other.href !== item.href && other.href.startsWith(`${item.href}/`),
            );
            const isActive = isParentOfSiblings
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
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

        {/*
          What used to live here was `active.blurb`, a static marketing
          sentence pinned to the floor with mt-auto. It never changed, it was
          read once, and the mt-auto was what actively manufactured ~700px of
          void between the nav and it. The rail now carries whatever the
          active module has that is live, and nothing when it has nothing.
        */}
        {aside ? <div className="min-h-0 flex-1 overflow-y-auto">{aside}</div> : null}
      </nav>
    </>
  );
}
