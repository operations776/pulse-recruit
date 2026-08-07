"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { createTaskFromText } from "@/lib/actions";
import type { TaskLink } from "@/lib/data";
import type { OrgMember } from "@/lib/supabase/types";
import { parseTaskInput } from "@/lib/task-parse";
import { PRIORITY_RANK } from "@/lib/tasks";

/**
 * One line in, one task out.
 *
 * "Chase Rylee Thiel tomorrow 3pm p1 @salar" carries a title, a date, a time,
 * a priority, an owner and a link. Four dropdowns and a date picker ask for the
 * same six facts and take six interactions to answer.
 *
 * The reads-as row underneath is the load-bearing half. A parser that guesses
 * silently is a parser nobody trusts twice, so everything it concluded is on
 * screen before Enter is pressed, and anything it could not understand stays
 * visible in the title rather than being quietly dropped.
 *
 * Always mounted, never inside a layer. That is what lets the underlying action
 * keep its revalidatePath: the remount-under-an-open-layer bug bites dialogs
 * and drawers, not a row that is part of the page.
 */
export function QuickAdd({
  members,
  links,
  tz,
  todayKey,
}: {
  members: OrgMember[];
  links: TaskLink[];
  tz: string;
  todayKey: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const parsed = useMemo(
    () => parseTaskInput(text, { todayKey, tz, members, links }),
    [text, todayKey, tz, members, links],
  );

  const submit = () => {
    const raw = text.trim();
    if (!raw) return;
    if (!parsed.title) {
      notify("That is a date and an owner with no task on it.", "danger");
      return;
    }
    setText("");
    startTransition(async () => {
      // The server parses the same sentence again. This preview is a promise
      // about what will happen, not the payload.
      const result = await createTaskFromText(raw);
      if (!result.ok) {
        setText(raw);
        notify(`${result.error} The task was not added.`, "danger");
        return;
      }
      router.refresh();
    });
  };

  const chips: { key: string; label: string }[] = [];
  if (parsed.dueLabel) chips.push({ key: "due", label: parsed.dueLabel });
  if (parsed.priority) {
    chips.push({
      key: "priority",
      label: `Priority ${PRIORITY_RANK[parsed.priority]}`,
    });
  }
  for (const a of parsed.assignees) {
    chips.push({ key: `a-${a.user_id}`, label: a.display_name });
  }
  if (parsed.link) {
    chips.push({ key: "link", label: `Link: ${parsed.link.name}` });
  }

  return (
    <div
      className={`settle rounded-shell border bg-sheet ${
        focused ? "border-violet" : "border-rule"
      }`}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <Plus size={16} strokeWidth={1.75} className="shrink-0 text-ink-3" />
        <input
          value={text}
          disabled={pending}
          aria-label="Add a task"
          placeholder="Add a task. Try: chase Rylee Thiel tomorrow 3pm p1 @salar"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setText("");
          }}
          className="min-w-0 flex-1 bg-transparent text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink-3"
        />
        <span className="legend shrink-0 text-ink-3">
          {pending ? "Adding" : "Enter"}
        </span>
      </div>

      {chips.length > 0 || parsed.unknownHandles.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule px-3.5 py-2.5">
          <span className="legend mr-1 text-ink-3">Reads as</span>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="legend rounded-chip border border-rule bg-well px-2 py-1 text-ink-2"
            >
              {chip.label}
            </span>
          ))}
          {/* An @handle that matched nobody. It is lifted out of the title
              either way, so saying nothing here is how a task quietly ends up
              assigned to no one. */}
          {parsed.unknownHandles.map((h) => (
            <span
              key={`u-${h}`}
              className="legend rounded-chip border border-amber bg-amber-bg px-2 py-1 text-amber-text"
            >
              No @{h} here
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
