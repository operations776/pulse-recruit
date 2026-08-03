"use client";

// Lucide dropped its brand marks, so there is no LinkedIn glyph to use. Share2
// is the honest generic: this section is about the accounts posts go out from.
import { Plus, RotateCw, Share2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StatusChip, type Tone } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { disconnectLinkedIn, startLinkedInConnect } from "@/lib/actions";
import type { LinkedInAccountRow } from "@/lib/supabase/types";
import { formatDate } from "@/lib/time";

const STATUS: Record<string, { tone: Tone; word: string }> = {
  connected: { tone: "on", word: "Connected" },
  credentials: { tone: "attention", word: "Needs reconnect" },
  disconnected: { tone: "off", word: "Removed" },
};

export function ChannelsClient({
  accounts,
  meId,
  canManageAny,
  configured,
  justConnected,
  justFailed,
}: {
  accounts: LinkedInAccountRow[];
  meId: string;
  canManageAny: boolean;
  configured: boolean;
  justConnected: boolean;
  justFailed: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);

  const connect = (reconnectAccountId?: string) => {
    startTransition(async () => {
      const result = await startLinkedInConnect(reconnectAccountId);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      // Unipile's wizard is a full page flow on their domain, so this leaves
      // the app rather than opening a popup a browser would likely block.
      window.location.href = result.data;
    });
  };

  const disconnect = (account: LinkedInAccountRow) => {
    setConfirming(null);
    startTransition(async () => {
      const result = await disconnectLinkedIn(account.unipile_account_id);
      if (!result.ok) {
        notify(result.error, "danger");
        router.refresh();
        return;
      }
      notify(
        `${account.display_name || "That profile"} is disconnected and Unipile has released it, so it stops counting towards the monthly bill.`,
      );
      router.refresh();
    });
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Settings</p>
        <h1 className="display mt-2 text-[18px]">Channels</h1>
        <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
          Connect the LinkedIn profile your posts go out as. You authorise it
          once through LinkedIn itself, so there is no key to paste and no
          password for Pulse to hold.
        </p>
      </header>

      <div className="flex flex-col gap-5 px-6 py-5">
        {justConnected ? (
          <p className="rounded-control border border-teal bg-teal-bg px-3 py-2 text-[12px] text-teal-text">
            LinkedIn sent you back. The profile appears below as soon as the
            confirmation reaches us, usually within a few seconds. Reload if it
            is not here yet.
          </p>
        ) : null}

        {justFailed ? (
          <p className="rounded-control border border-red bg-red-bg px-3 py-2 text-[12px] text-red">
            The authorisation did not finish, so nothing was connected. You can
            start it again below.
          </p>
        ) : null}

        {!configured ? (
          // Never offer a control that cannot work. Say which side is missing.
          <p className="rounded-control border border-amber bg-amber-bg px-3 py-2 text-[12px] text-amber-text">
            LinkedIn posting is not switched on for this deployment yet.
            UNIPILE_API_KEY and UNIPILE_DSN have to be set before a profile can
            be connected.
          </p>
        ) : null}

        <section className="overflow-hidden rounded-shell border border-rule bg-sheet">
          <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3">
            <Share2 size={16} strokeWidth={1.5} className="text-ink-2" />
            <span className="legend flex-1 text-ink-2">LinkedIn profiles</span>
            <Button
              variant="primary"
              disabled={!configured || pending}
              onClick={() => connect()}
            >
              <Plus size={16} strokeWidth={2} />
              Connect a profile
            </Button>
          </div>

          {accounts.length === 0 ? (
            // Not the EmptyState card. DESIGN.md rule 3: sections inside a
            // shell share a 1px rule with no gap, and a bordered card floating
            // inside a bordered shell is the nested-box look that rule exists
            // to stop.
            <div className="px-4 py-10 text-center">
              <p className="display text-[15px]">No profile connected</p>
              <p className="mx-auto mt-2 max-w-[46ch] text-[12px] text-ink-2">
                Pulse can plan your posts without this. Connecting a profile is
                what will let it publish them for you.
              </p>
            </div>
          ) : (
            <ul>
              {accounts.map((account) => {
                const status = STATUS[account.status] ?? STATUS.disconnected;
                const mine = account.connected_by === meId;
                const canManage = mine || canManageAny;

                return (
                  <li
                    key={account.id}
                    className="-mt-px flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-4 py-3 first:mt-0 first:border-t-0"
                  >
                    <div className="min-w-[200px] flex-1">
                      <p className="text-[13px] font-medium">
                        {account.display_name || "LinkedIn profile"}
                      </p>
                      <p className="meta mt-0.5 text-ink-3">
                        connected {formatDate(account.connected_at)}
                        {mine ? " by you" : ""}
                      </p>
                    </div>

                    <StatusChip tone={status.tone}>{status.word}</StatusChip>

                    {account.status === "credentials" ? (
                      <Button
                        disabled={!configured || pending || !canManage}
                        onClick={() => connect(account.unipile_account_id)}
                      >
                        <RotateCw size={16} strokeWidth={1.5} />
                        Reconnect
                      </Button>
                    ) : null}

                    {canManage ? (
                      confirming === account.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-[12px] text-ink-2">
                            Disconnect it?
                          </span>
                          <Button
                            variant="danger"
                            disabled={pending}
                            onClick={() => disconnect(account)}
                          >
                            Yes, disconnect
                          </Button>
                          <Button onClick={() => setConfirming(null)}>
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <Button
                          onClick={() => setConfirming(account.id)}
                          aria-label={`Disconnect ${account.display_name || "profile"}`}
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                          Disconnect
                        </Button>
                      )
                    ) : null}

                    {account.last_error ? (
                      <p className="w-full text-[12px] text-amber-text">
                        {account.last_error}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="max-w-[62ch] text-[12px] text-ink-2">
          Pulse does not post to LinkedIn yet. Connecting a profile now is what
          makes that possible when scheduled posts start going out on their own.
        </p>
      </div>
    </main>
  );
}
