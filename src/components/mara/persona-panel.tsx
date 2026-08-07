"use client";

import { MaraAvatar, type MaraState } from "@/components/mara/avatar";
import type { BDAgentMemoryRow } from "@/lib/supabase/types";

import { agent } from "@/config/brand";
// PLS-111. The right panel: who the strategist is, what he is watching,
// what he knows.
//
// Three sections separated by 1px rules, exactly as the Figma has them. The
// dot on each advisory domain is colour PLUS a word in the copy beneath it,
// never colour alone: "Your offer" says "No price anchor. Weakest link right
// now", so the amber is reinforcement rather than the only signal.

export type Domain = {
  key: string;
  label: string;
  read: string;
  /** good, watch, warn or unknown. Drives the dot only. */
  tone: "good" | "watch" | "warn" | "unknown";
};

const DOT: Record<Domain["tone"], string> = {
  good: "bg-mara-good",
  watch: "bg-mara-warn",
  warn: "bg-mara-bad",
  unknown: "bg-mara-ink-3",
};

export function PersonaPanel({
  state,
  lastRead,
  domains,
  memories,
  onManage,
  onTellHer,
}: {
  state: MaraState;
  /** "read your patch 4 minutes ago", already humanised on the server. */
  lastRead: string;
  domains: Domain[];
  memories: BDAgentMemoryRow[];
  onManage: () => void;
  onTellHer: () => void;
}) {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-mara-rule bg-mara-sheet px-5 pb-5 pt-6">
      {/* Identity */}
      <div className="flex flex-col items-center gap-1.5">
        <MaraAvatar state={state} size={92} ring />
        <p className="mt-1.5 text-[16px] font-medium leading-[1.45] text-mara-ink">
          {agent.name}
        </p>
        <p className="text-[12px] leading-[1.45] text-mara-ink-2">
          {agent.role}
        </p>
        <span className="flex items-center gap-1.5 pt-0.5">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${
              state === "idle" ? "bg-mara-good" : "bg-mara-violet"
            }`}
          />
          <span className="text-[11px] leading-[1.45] text-mara-ink-2">
            {lastRead}
          </span>
        </span>
      </div>

      {/* What the strategist is watching */}
      <div className="flex flex-col border-t border-mara-rule pt-4">
        <p className="text-[11px] leading-[1.45] text-mara-ink-3">
          What {agent.name} is watching
        </p>

        {domains.map((domain, index) => (
          <div
            key={domain.key}
            className={`flex items-start gap-2.5 py-2.5 ${
              index > 0 ? "border-t border-mara-rule" : "pb-2.5 pt-3"
            }`}
          >
            <span
              aria-hidden
              className={`mt-[5px] size-[7px] shrink-0 rounded-full ${DOT[domain.tone]}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] leading-[1.45] text-mara-ink">
                {domain.label}
              </span>
              <span className="block text-[11px] leading-[1.45] text-mara-ink-3">
                {domain.read}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* What {agent.name} knows about you */}
      <div className="flex flex-col gap-2.5 border-t border-mara-rule pt-4">
        <div className="flex items-center justify-between text-[11px] leading-[1.45]">
          <span className="text-mara-ink-3">What {agent.name} knows about you</span>
          <button
            onClick={onManage}
            className="text-mara-violet hover:underline"
          >
            Manage
          </button>
        </div>

        <div className="flex flex-wrap items-start gap-1.5">
          {memories.slice(0, 6).map((memory) => (
            <span
              key={memory.id}
              title={memory.body}
              className="rounded-[20px] border border-mara-rule bg-mara-sheet px-2.5 py-1 text-[11px] leading-[1.45] text-mara-ink-2"
            >
              {memory.title}
            </span>
          ))}

          {/* The amber chip in the Figma is a GAP, not a fact: "Add your fee
              model" is something she is missing. It only shows when the gap is
              real, so it disappears once the fee model is answered. */}
          {!memories.some((m) => m.kind === "offer") ? (
            <button
              onClick={onTellHer}
              className="settle rounded-[20px] border border-mara-amber-edge bg-mara-amber-bg px-2.5 py-1 text-[11px] leading-[1.45] text-mara-amber-ink hover:brightness-95"
            >
              Add your fee model
            </button>
          ) : null}

          <button
            onClick={onTellHer}
            className="settle flex items-center gap-1.5 rounded-[20px] border border-mara-violet-edge bg-mara-violet-soft px-2.5 py-1 leading-[1.45] hover:brightness-95"
          >
            <span className="text-[12px] font-medium text-mara-violet">+</span>
            <span className="text-[11px] text-mara-violet-deep">
              Tell {agent.name} something
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
