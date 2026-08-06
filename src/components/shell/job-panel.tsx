"use client";

import { ChevronsLeft, LayoutGrid, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusDot } from "@/components/ui/misc";
import type { JobRow } from "@/lib/supabase/types";

// The roles come from the server. This stays a client component only because
// the search box and the collapse toggle are local interactions.
export function JobPanel({
  jobs,
  activeJobId,
}: {
  jobs: JobRow[];
  activeJobId: string;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? jobs.filter((job) =>
        `${job.title} ${job.ref}`.toLowerCase().includes(needle),
      )
    : jobs;

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 justify-center border-r border-rule bg-sheet py-3">
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand roles panel"
          className="flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-paper hover:text-ink"
        >
          <LayoutGrid size={16} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Roles"
      className="flex w-66 shrink-0 flex-col border-r border-rule bg-sheet"
    >
      <div className="flex h-12 items-center justify-between px-3">
        <span className="flex items-center gap-2">
          <LayoutGrid size={16} strokeWidth={1.5} className="text-ink-2" />
          <span className="text-[12px] font-medium">Open roles</span>
        </span>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse roles panel"
          className="flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-paper hover:text-ink"
        >
          <ChevronsLeft size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <span className="relative flex items-center">
          <Search
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-2.5 text-ink-3"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles"
            aria-label="Search roles"
            className="well h-8 w-full rounded-control pl-9 pr-2.5 text-[12px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet"
          />
        </span>
      </div>

      <div className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {visible.map((job) => {
          const active = job.id === activeJobId;
          return (
            <Link
              key={job.id}
              href={`/pipeline/${job.id}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-7 items-center gap-2.5 rounded-control px-2 py-2 ${
                active ? "bg-well" : "hover:bg-paper"
              }`}
            >
              <StatusDot state={job.state} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[12px] ${
                    active ? "font-medium text-ink" : "text-ink"
                  }`}
                >
                  {job.title}
                </span>
                <span className="record-id block text-ink-3">{job.ref}</span>
              </span>
            </Link>
          );
        })}

        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-ink-2">
            No roles match that search.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
