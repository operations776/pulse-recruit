"use client";

import { Bell, ChevronDown, CircleHelp } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { brand } from "@/config/brand";
import { useStore } from "@/lib/store";

export function TopBar() {
  const { org, currentUser } = useStore();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-rule-strong bg-ink px-0 text-paper-white">
      <div className="flex h-full items-center">
        <span className="flex h-full items-center gap-2 border-r border-paper-white/15 px-4">
          <span className="flex size-5 items-center justify-center rounded-sharp bg-vermilion">
            <span className="size-1.5 rounded-full bg-paper-white" />
          </span>
          <span className="display text-[15px] leading-none">{brand.name}</span>
        </span>
        <button className="flex h-full items-center gap-2 border-r border-paper-white/15 px-4 text-[13px] hover:bg-paper-white/10">
          {org.name}
          <ChevronDown size={13} strokeWidth={2} className="opacity-60" />
        </button>
      </div>

      <div className="flex h-full items-center">
        <button className="btn-label flex h-full items-center gap-1.5 border-l border-paper-white/15 px-4 hover:bg-paper-white/10">
          <CircleHelp size={14} strokeWidth={1.75} />
          Help
        </button>
        <button
          aria-label="Notifications"
          className="relative flex h-full items-center border-l border-paper-white/15 px-4 hover:bg-paper-white/10"
        >
          <Bell size={14} strokeWidth={1.75} />
          <span className="absolute right-2.5 top-3 size-1.5 rounded-full bg-vermilion" />
        </button>
        <span className="flex h-full items-center border-l border-paper-white/15 px-3">
          <Avatar name={currentUser.name} size="sm" />
        </span>
      </div>
    </header>
  );
}
