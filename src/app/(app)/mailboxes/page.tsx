"use client";

import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusChip, type Tone } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

import { useStore } from "@/lib/store";
import type { Mailbox } from "@/lib/types";

const PROVIDER: Record<Mailbox["provider"], string> = {
  google: "Google Workspace",
  microsoft: "Microsoft 365",
  smtp: "Custom SMTP",
};

// Status is colour plus icon plus word (DESIGN.md rule 9). The chip tones are
// on, attention and off only, so an errored mailbox takes the attention tone
// and states the problem in red underneath rather than inventing a fourth tone.
const STATUS: Record<Mailbox["status"], { tone: Tone; word: string }> = {
  connected: { tone: "on", word: "Connected" },
  warming: { tone: "attention", word: "Warming" },
  error: { tone: "attention", word: "Needs attention" },
};

export default function MailboxesPage() {
  const { state, reconnectMailbox } = useStore();
  const { notify } = useToast();

  const mailboxes = state.mailboxes;
  const connected = mailboxes.filter((m) => m.status === "connected").length;
  const failing = mailboxes.filter((m) => m.status === "error").length;
  // An errored mailbox sends nothing, so it contributes no capacity.
  const capacity = mailboxes
    .filter((m) => m.status === "connected" || m.status === "warming")
    .reduce((sum, m) => sum + m.dailyCap, 0);
  const sentToday = mailboxes.reduce((sum, m) => sum + m.sentToday, 0);

  const stats: [string, string][] = [
    ["Connected", String(connected)],
    ["Daily capacity", String(capacity)],
    ["Sent today", String(sentToday)],
    ["Needs attention", String(failing)],
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="legend text-ink-3">Pillar 3 / multichannel outbound</p>
            <h1 className="display mt-2 text-[18px]">Mailboxes</h1>
            <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
              The inboxes your sequences send from. Daily caps and warmup protect
              your domain reputation.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => notify("Mailbox connection is not wired up yet")}
          >
            <Plus size={13} strokeWidth={2.25} />
            Connect mailbox
          </Button>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="legend text-ink-3">{label}</dt>
              <dd className="display text-[21px] leading-none">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="px-6 py-5">
        <div className="rounded-shell border border-rule bg-sheet overflow-hidden">
          {mailboxes.map((mailbox) => {
            const status = STATUS[mailbox.status];
            const pct =
              mailbox.dailyCap === 0
                ? 0
                : Math.min(
                    100,
                    Math.round((mailbox.sentToday / mailbox.dailyCap) * 100),
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
                    {mailbox.sentToday} of {mailbox.dailyCap} sent today
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
                  {mailbox.warmupDays} days warm
                </p>

                {mailbox.status === "error" ? (
                  <Button
                    onClick={() => {
                      reconnectMailbox(mailbox.id);
                      notify(`${mailbox.address} is connected again`);
                    }}
                  >
                    <RotateCcw size={13} strokeWidth={2} />
                    Reconnect
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
