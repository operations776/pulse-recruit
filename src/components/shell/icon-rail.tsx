"use client";

import {
  BarChart3,
  Building2,
  Kanban,
  Plus,
  Radio,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hueBg, hueByIndex } from "@/lib/hue";
import { useStore } from "@/lib/store";

const nav = [
  { href: "/pipeline", icon: Kanban, label: "Pipeline" },
  { href: "/candidates", icon: Users, label: "Candidates" },
  { href: "/companies", icon: Building2, label: "Companies" },
  { href: "/signals", icon: Radio, label: "Signals" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
];

export function IconRail() {
  const pathname = usePathname();
  const { org } = useStore();
  const workspaces = [org.name, "Pulse Talent"];

  return (
    <nav
      aria-label="Primary"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3"
    >
      {workspaces.map((name, i) => (
        <button
          key={name}
          title={name}
          aria-label={name}
          className={`flex size-8 items-center justify-center rounded-lg text-[12px] font-bold text-white ${hueBg[hueByIndex(i)]} ${
            i === 0 ? "ring-2 ring-ink-900 ring-offset-2" : ""
          }`}
        >
          {name[0]}
        </button>
      ))}
      <button
        title="Add workspace"
        aria-label="Add workspace"
        className="flex size-8 items-center justify-center rounded-lg border border-dashed border-line text-ink-400 hover:border-ink-400 hover:text-ink-600"
      >
        <Plus size={15} strokeWidth={2} />
      </button>

      <span className="my-2 h-px w-6 bg-line" />

      {nav.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`flex size-8 items-center justify-center rounded-lg ${
              active
                ? "bg-emerald-50 text-emerald-700"
                : "text-ink-400 hover:bg-canvas hover:text-ink-600"
            }`}
          >
            <Icon size={17} strokeWidth={1.75} />
          </Link>
        );
      })}

      <Link
        href="/settings"
        title="Settings"
        aria-label="Settings"
        className={`mt-auto flex size-8 items-center justify-center rounded-lg ${
          pathname.startsWith("/settings")
            ? "bg-emerald-50 text-emerald-700"
            : "text-ink-400 hover:bg-canvas hover:text-ink-600"
        }`}
      >
        <Settings size={17} strokeWidth={1.75} />
      </Link>
    </nav>
  );
}
