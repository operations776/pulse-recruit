"use client";

import type { ReactNode } from "react";
import { SettingsMenu } from "@/components/shell/settings-menu";
import { UserMenu } from "@/components/shell/user-menu";
import { WorkspaceMenu } from "@/components/shell/workspace-menu";
import { brand } from "@/config/brand";

// The org and the signed in email come from requireSession in the layout, not
// from client state, so the bar can never show a workspace the session does not
// actually have.
//
// The bell arrives as a node rather than as rows, so the layout can stream it
// behind Suspense: a navigation should never wait on an unread count.
//
// PLS-104 replaced two stubs here. The workspace chip was a button with no
// handler and Help was a button that did nothing; both looked live and were
// not. Help moved into the settings menu, which is where the rebrand puts it,
// alongside the only genuinely per-person setting in the product: the theme.
export function TopBar({
  orgName,
  orgs,
  email,
  bell,
}: {
  orgName: string;
  orgs: { id: string; name: string }[];
  email: string;
  bell: ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-rule bg-bar px-0 text-on-bar">
      <div className="flex h-full items-center">
        <span className="flex h-full items-center gap-2 border-r border-on-bar/15 px-4">
          <span className="flex size-5 items-center justify-center rounded-control bg-vermilion">
            <span className="size-1.5 rounded-full bg-on-bar" />
          </span>
          <span className="display text-[12px] leading-none">{brand.name}</span>
        </span>
        <WorkspaceMenu orgName={orgName} orgs={orgs} />
      </div>

      <div className="flex h-full items-center">
        <SettingsMenu />
        {bell}
        <UserMenu email={email} />
      </div>
    </header>
  );
}
