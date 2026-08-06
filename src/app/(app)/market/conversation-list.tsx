"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteConversation } from "@/lib/actions";
import type { ChatConversationRow } from "@/lib/supabase/types";

// PLS-106. The history panel, ported from the rebrand.
//
// Threads are grouped Today / Yesterday / then the date, which is how the
// rebrand does it and how anyone actually looks for a conversation they had:
// by roughly when, not by a title they never wrote.

function groupOf(iso: string, todayKey: string, yesterdayKey: string): string {
  const key = iso.slice(0, 10);
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function ConversationList({
  conversations,
  activeId,
  meId,
  /** Fixed on the server so grouping cannot disagree across hydration. */
  todayKey,
  yesterdayKey,
  onSelect,
  onNew,
}: {
  conversations: ChatConversationRow[];
  activeId: string | null;
  meId: string;
  todayKey: string;
  yesterdayKey: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);

  // Already sorted newest-first by the query; this only inserts the headings.
  const groups = useMemo(() => {
    const out: { label: string; rows: ChatConversationRow[] }[] = [];
    for (const row of conversations) {
      const label = groupOf(row.last_message_at, todayKey, yesterdayKey);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [conversations, todayKey, yesterdayKey]);

  const remove = (row: ChatConversationRow) => {
    setConfirming(null);
    startTransition(async () => {
      const result = await deleteConversation(row.id);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(`"${row.title}" is deleted.`);
      router.refresh();
    });
  };

  return (
    <section className="border-t border-rule">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="legend flex-1 text-ink-3">History</span>
        <Button onClick={onNew} aria-label="Start a new conversation">
          <Plus size={16} strokeWidth={2} />
          New
        </Button>
      </div>

      {conversations.length === 0 ? (
        <p className="px-4 pb-3 text-[12px] leading-[1.5] text-ink-2">
          Nothing asked yet. Your research threads collect here.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <p className="legend px-4 py-1.5 text-ink-3">{group.label}</p>
            <ul>
              {group.rows.map((row) => {
                const active = row.id === activeId;
                // Only the author can delete, matching the RLS policy. Showing
                // a control the database will refuse is worse than not showing
                // one at all.
                const mine = row.author_id === meId;

                return (
                  <li key={row.id} className="px-2">
                    <div
                      className={`settle group flex items-center gap-1.5 rounded-control px-2 py-1.5 ${
                        active ? "bg-well" : "hover:bg-paper"
                      }`}
                    >
                      <MessageSquare
                        size={16}
                        strokeWidth={1.5}
                        className={`size-3.5 shrink-0 ${
                          active ? "text-vermilion" : "text-ink-3"
                        }`}
                        aria-hidden
                      />
                      <button
                        onClick={() => onSelect(row.id)}
                        aria-current={active ? "true" : undefined}
                        className={`min-w-0 flex-1 truncate text-left text-[13px] ${
                          active ? "font-medium text-ink" : "text-ink-2"
                        }`}
                      >
                        {row.title}
                      </button>

                      {mine ? (
                        <button
                          onClick={() => setConfirming(row.id)}
                          aria-label={`Delete ${row.title}`}
                          className="flex size-6 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-red"
                        >
                          <Trash2 size={16} strokeWidth={1.5} className="size-3.5" />
                        </button>
                      ) : null}
                    </div>

                    {confirming === row.id ? (
                      <span className="flex flex-wrap items-center gap-2 px-2 pb-2 pt-1">
                        <span className="text-[12px] text-ink-2">Delete it?</span>
                        <Button
                          variant="danger"
                          disabled={pending}
                          onClick={() => remove(row)}
                        >
                          Yes, delete
                        </Button>
                        <Button onClick={() => setConfirming(null)}>Keep</Button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
