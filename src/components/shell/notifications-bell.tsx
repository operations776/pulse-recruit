"use client";

import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { markNotificationsRead } from "@/lib/actions";
import type { NotificationRow } from "@/lib/supabase/types";
import { relativeTime } from "@/lib/time";

/**
 * The bell, telling the truth. It used to render a hardcoded dot, which is a
 * promise of news with no news behind it. Now the dot is the unread count from
 * the notifications table, and the panel lists what actually happened.
 */
export function NotificationsBell({
  notifications,
}: {
  notifications: NotificationRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => n.read_at === null).length;

  // Click-away and Esc both close, matching every other layer in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const markRead = () => {
    startTransition(async () => {
      await markNotificationsRead();
      router.refresh();
    });
  };

  return (
    <div ref={panelRef} className="relative h-full">
      <button
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-full items-center border-l border-sheet/15 px-4 hover:bg-sheet/10"
      >
        <Bell size={14} strokeWidth={1.75} />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-2 flex h-4 min-w-4 items-center justify-center rounded-chip bg-vermilion px-1 font-mono text-[10px] leading-none text-sheet">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="floating absolute right-0 top-full z-50 mt-1 w-[340px] rounded-shell border border-rule text-ink">
          <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
            <span className="legend text-ink-2">Notifications</span>
            {unread > 0 ? (
              <button
                onClick={markRead}
                disabled={pending}
                className="flex items-center gap-1 text-[12px] font-medium text-ink-2 hover:text-ink disabled:opacity-40"
              >
                <Check size={13} strokeWidth={2} />
                Mark all read
              </button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-ink-3">
              Nothing yet. Being assigned a task shows up here.
            </p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className="border-b border-rule last:border-b-0">
                  <Link
                    href={n.href || "/ops/tasks"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-2.5 hover:bg-well ${
                      n.read_at === null ? "" : "opacity-60"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-medium">{n.title}</span>
                      <span className="meta shrink-0 text-ink-3">
                        {relativeTime(n.created_at)}
                      </span>
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 block truncate text-[12px] text-ink-2">
                        {n.body}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
