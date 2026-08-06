"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverTitle } from "@/components/ui/popover";

// PLS-104. The workspace chip in the top bar.
//
// The rebrand shows three workspaces (Nortech Search, Apex Talent Partners,
// Beacon Recruiting) and a "Manage workspaces" link whose handler only closes
// the menu. That is mock data: in the real database every user belongs to
// exactly one org today, and `requireSession` takes the oldest membership with
// `limit(1)`.
//
// So this lists what the caller actually has. Switching is not wired up,
// because it is not a menu: the active org would have to be stored per user,
// read by `resolveSession`, and respected by every RLS policy underneath. That
// is backend work, and inventing a dropdown that silently does nothing is
// worse than a chip that tells the truth.

export function WorkspaceMenu({
  orgName,
  orgs,
}: {
  orgName: string;
  /** Every org this user is a member of, from org_memberships. */
  orgs: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative flex h-full items-center border-r border-on-bar/15">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-full items-center gap-2 px-4 text-[12px] hover:bg-on-bar/10 ${
          open ? "bg-on-bar/10" : ""
        }`}
      >
        {orgName}
        <ChevronDown size={13} strokeWidth={2} className="opacity-60" />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        label="Workspaces"
        align="left"
        width={248}
      >
        <PopoverTitle>Workspace</PopoverTitle>

        <ul>
          {orgs.map((org) => {
            const active = org.name === orgName;
            return (
              <li key={org.id}>
                <span
                  className={`flex items-center gap-2 rounded-control px-2 py-1.5 text-[13px] ${
                    active ? "bg-paper font-medium" : "text-ink-2"
                  }`}
                >
                  {active ? (
                    <Check size={16} strokeWidth={2} className="shrink-0 text-violet" />
                  ) : (
                    <span aria-hidden className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 truncate">{org.name}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-2 border-t border-rule pt-2 text-[12px] leading-[1.5] text-ink-2">
          {orgs.length > 1
            ? "Switching workspaces is not available yet."
            : "You are in one workspace. Invite the rest of the desk from Settings."}
        </p>
      </Popover>
    </span>
  );
}
