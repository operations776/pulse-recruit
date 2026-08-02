"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import type { ChatSource } from "@/lib/supabase/types";

// One assistant turn. Answer, then what it was built from, then what it cost.
// The order is deliberate: the sources are the reason to believe the answer, so
// they sit with it rather than behind a disclosure (DESIGN.md: nothing lives
// behind hover, and nothing important lives behind a click).

export function SourceList({
  sources,
  legend = "Built from",
}: {
  sources: ChatSource[];
  legend?: string;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-rule pt-2.5">
      <p className="legend text-ink-3">{legend}</p>
      <div className="mt-1.5">
        {sources.map((s, i) => (
          <div
            key={`${s.label}-${i}`}
            className={`flex items-baseline justify-between gap-4 py-1.5 ${
              i > 0 ? "border-t border-rule" : ""
            }`}
          >
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-baseline gap-1.5 text-[12px] font-medium underline-offset-2 hover:underline"
              >
                <span className="truncate">{s.label}</span>
                <ExternalLink
                  size={16}
                  strokeWidth={1.5}
                  aria-hidden
                  className="size-3.5 shrink-0 translate-y-0.5 text-ink-3"
                />
              </a>
            ) : (
              <span className="min-w-0 truncate text-[12px] font-medium">
                {s.label}
              </span>
            )}
            <span className="shrink-0 text-right text-[12px] text-ink-2">
              {s.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A failed run is shown as a failure, with the real reason and the fact that
// nothing was charged. AI.md section 4: never an empty bubble, never an
// apology standing in for an answer.
export function AnswerFailure({ reason }: { reason: string }) {
  return (
    <div className="flex max-w-[80%] items-start gap-2.5 rounded-card border border-amber bg-amber-bg px-3 py-2.5">
      <AlertTriangle
        size={16}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0 text-amber"
      />
      <div className="min-w-0">
        <p className="legend text-amber-text">Not answered</p>
        <p className="mt-1 text-[13px] leading-[1.5] text-ink">{reason}</p>
      </div>
    </div>
  );
}

export function AnswerCost({
  credits,
  meta,
}: {
  credits: number;
  meta: Record<string, unknown>;
}) {
  const searches = typeof meta.searches === "number" ? meta.searches : 0;
  const reads = typeof meta.page_reads === "number" ? meta.page_reads : 0;

  const parts: string[] = [`${credits} ${credits === 1 ? "credit" : "credits"}`];
  if (searches > 0) parts.push(`${searches} ${searches === 1 ? "search" : "searches"}`);
  if (reads > 0) parts.push(`${reads} ${reads === 1 ? "page" : "pages"} read`);

  return <p className="meta mt-1.5 text-ink-3">{parts.join(" · ")}</p>;
}
