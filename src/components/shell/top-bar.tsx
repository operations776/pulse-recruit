"use client";

import { Bell, ChevronDown, CircleHelp } from "lucide-react";
import { UserMenu } from "@/components/shell/user-menu";
import { brand } from "@/config/brand";

// The org and the signed in email come from requireSession in the layout, not
// from client state, so the bar can never show a workspace the session does not
// actually have.
export function TopBar({ orgName, email }: { orgName: string; email: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-rule bg-ink px-0 text-sheet">
      <div className="flex h-full items-center">
        <span className="flex h-full items-center gap-2 border-r border-sheet/15 px-4">
          <span className="flex size-5 items-center justify-center rounded-control bg-vermilion">
            <span className="size-1.5 rounded-full bg-sheet" />
          </span>
          <span className="display text-[12px] leading-none">{brand.name}</span>
        </span>
        <button className="flex h-full items-center gap-2 border-r border-sheet/15 px-4 text-[12px] hover:bg-sheet/10">
          {orgName}
          <ChevronDown size={13} strokeWidth={2} className="opacity-60" />
        </button>
      </div>

      <div className="flex h-full items-center">
        <button className="text-[12px] font-medium flex h-full items-center gap-1.5 border-l border-sheet/15 px-4 hover:bg-sheet/10">
          <CircleHelp size={14} strokeWidth={1.75} />
          Help
        </button>
        <button
          aria-label="Notifications"
          className="relative flex h-full items-center border-l border-sheet/15 px-4 hover:bg-sheet/10"
        >
          <Bell size={14} strokeWidth={1.75} />
          <span className="absolute right-2.5 top-3 size-1.5 rounded-full bg-vermilion" />
        </button>
        <UserMenu email={email} />
      </div>
    </header>
  );
}
