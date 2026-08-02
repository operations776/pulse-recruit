"use client";

import { ChevronsLeft, LayoutGrid, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusDot } from "@/components/ui/misc";
import { useStore } from "@/lib/store";

export function JobPanel({ activeJobId }: { activeJobId: string }) {
  const { jobs } = useStore();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const visible = jobs.filter((j) =>
    `${j.title} ${j.code}`.toLowerCase().includes(query.toLowerCase()),
  );

  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 justify-center border-r border-rule bg-paper-white py-3">
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand roles panel"
          className="rounded-sharp p-1 text-ink-mute hover:bg-paper"
        >
          <LayoutGrid size={15} strokeWidth={1.75} />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Roles"
      className="flex w-66 shrink-0 flex-col border-r border-rule bg-paper-white"
    >
      <div className="flex h-12 items-center justify-between px-3">
        <span className="flex items-center gap-2">
          <LayoutGrid size={15} strokeWidth={1.75} className="text-hue-teal" />
          <span className="text-[13px] font-semibold">Open roles</span>
        </span>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse roles panel"
          className="rounded-sharp p-1 text-ink-mute hover:bg-paper"
        >
          <ChevronsLeft size={15} strokeWidth={1.75} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <span className="relative flex items-center">
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 text-ink-mute"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles"
            aria-label="Search roles"
            className="h-8 w-full rounded-sharp border border-rule bg-paper pl-8 pr-2.5 text-[12px] placeholder:text-ink-mute focus:border-vermilion focus:outline-none"
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
              className={`flex items-center gap-2.5 rounded-sharp px-2 py-2 ${
                active ? "bg-vermilion-wash" : "hover:bg-paper"
              }`}
            >
              <StatusDot state={job.state} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[13px] ${
                    active ? "font-semibold text-vermilion-deep" : "text-ink"
                  }`}
                >
                  {job.title}
                </span>
                <span className="data-literal text-[11px] text-ink-mute">
                  {job.code}
                </span>
              </span>
            </Link>
          );
        })}

        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-ink-mute">
            No roles match that search.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
