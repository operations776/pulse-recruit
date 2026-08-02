"use client";

import { Bell, ChevronDown, CircleHelp } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { brand } from "@/config/brand";
import { useStore } from "@/lib/store";

export function TopBar() {
  const { org, currentUser } = useStore();

  return (
    <header className="flex h-13 shrink-0 items-center justify-between bg-forest-900 px-3 text-white">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 px-1.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600">
            <span className="size-2 rounded-full bg-white" />
          </span>
          <span className="font-display text-[15px] font-semibold">
            {brand.name}
          </span>
        </span>
        <span className="h-5 w-px bg-white/15" />
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-white/90 hover:bg-white/10">
          {org.name}
          <ChevronDown size={14} strokeWidth={2} className="text-white/60" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-white/80 hover:bg-white/10">
          <CircleHelp size={15} strokeWidth={1.75} />
          Need help?
        </button>
        <button
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-white/80 hover:bg-white/10"
        >
          <Bell size={15} strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-hue-coral" />
        </button>
        <span className="ml-1">
          <Avatar name={currentUser.name} size="sm" />
        </span>
      </div>
    </header>
  );
}
