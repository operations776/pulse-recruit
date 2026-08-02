"use client";

import { Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusChip, type Tone } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { reconnectMailbox } from "@/lib/actions";
import type { MailboxRow } from "@/lib/supabase/types";

const PROVIDER: Record<MailboxRow["provider"], string> = {
  google: "Google Workspace",
  microsoft: "Microsoft 365",
  smtp: "Custom SMTP",
};

// Status is colour plus icon plus word (DESIGN.md rule 9). The chip tones are
// on, attention and off only, so an errored mailbox takes the attention tone
// and states the problem in red underneath rather than inventing a fourth tone.
const STATUS: Record<MailboxRow["status"], { tone: Tone; word: string }> = {
  connected: { tone: "on", word: "Connected" },
  warming: { tone: "attention", word: "Warming" },
  error: { tone: "attention", word: "Needs attention" },
};

export function ConnectMailboxButton() {
  const { notify } = useToast();
  return (
    <Button
      variant="primary"
      onClick={() =>
        notify(
          "Mailbox connection is not wired up yet, so nothing was connected.",
        )
      }
    >
      <Plus size={13} strokeWidth={2.25} />
      Connect mailbox
    </Button>
  );
}

export function MailboxRows({ mailboxes }: { mailboxes: MailboxRow[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const reconnect = (mailbox: MailboxRow) => {
    startTransition(async () => {
      const result = await reconnectMailbox(mailbox.id);
      if (!result.ok) {
        notify(`${result.error} ${mailbox.address} is still down.`, "danger");
        return;
      }
      // Reconnecting puts a mailbox back into warmup rather than straight into
      // full send. Say what actually happened.
      notify(`${mailbox.address} is reconnected and warming again.`);
      router.refresh();
    });
  };

  if (mailboxes.length === 0) {
    return (
      <EmptyState
        title="No mailboxes yet"
        body="A sequence needs somewhere to send from. Connect an inbox and the outbound side of Pulse comes alive."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-shell border border-rule bg-sheet">
      {mailboxes.map((mailbox) => {
        const status = STATUS[mailbox.status];
        const pct =
          mailbox.daily_cap === 0
            ? 0
            : Math.min(
                100,
                Math.round((mailbox.sent_today / mailbox.daily_cap) * 100),
              );

        return (
          <article
            key={mailbox.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule px-4 py-3.5 last:border-b-0"
          >
            <div className="min-w-[220px] flex-1">
              <p className="truncate text-[13px] font-medium">
                {mailbox.address}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-2">
                {PROVIDER[mailbox.provider]}
              </p>
              {mailbox.status === "error" ? (
                <p className="mt-1 text-[12px] font-medium text-red">
                  Authentication failed, so this mailbox is sending nothing.
                </p>
              ) : null}
            </div>

            <StatusChip tone={status.tone}>{status.word}</StatusChip>

            <div className="w-40 shrink-0">
              <p className="meta text-ink-2">
                {mailbox.sent_today} of {mailbox.daily_cap} sent today
              </p>
              <div
                role="progressbar"
                aria-label={`Daily capacity used for ${mailbox.address}`}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="well mt-1.5 h-1.5 w-full rounded-chip"
              >
                <div
                  className="h-1.5 rounded-chip bg-ink"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <p className="meta w-24 shrink-0 text-ink-2">
              {mailbox.warmup_days} days warm
            </p>

            {mailbox.status === "error" ? (
              <Button disabled={pending} onClick={() => reconnect(mailbox)}>
                <RotateCcw size={13} strokeWidth={2} />
                Reconnect
              </Button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
