"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CandidateDrawer } from "@/components/ats/candidate-drawer";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchInput, Select } from "@/components/ui/input";
import {
  Breadcrumb,
  CopyField,
  EmptyState,
  StatusChip,
} from "@/components/ui/misc";
import { Activity, freshnessFor } from "@/components/ui/pulse-dot";
import { ownerLabel } from "@/lib/people";
import type {
  ActivityRow,
  CandidateRow,
  JobRow,
  NoteRow,
  StageRow,
} from "@/lib/supabase/types";
import { relativeTime } from "@/lib/time";

const ALL = "all";
const MINE = "mine";
const NOBODY = "nobody";

const COLUMNS = [
  "Name",
  "Company",
  "Stage",
  "Email",
  "Owner",
  "Role",
  "Last activity",
] as const;

// Filtering happens here because the rows are already loaded. The server owns
// the query, this component owns the narrowing.
export function CandidatesTable({
  candidates,
  stages,
  jobs,
  viewerId,
  openCandidate,
  notes,
  activity,
}: {
  candidates: CandidateRow[];
  stages: StageRow[];
  jobs: JobRow[];
  viewerId: string;
  openCandidate: CandidateRow | null;
  notes: NoteRow[];
  activity: ActivityRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState(ALL);
  const [stageName, setStageName] = useState(ALL);
  const [source, setSource] = useState(ALL);

  const searchRef = useRef<HTMLInputElement>(null);

  // DESIGN.md: "/" focuses search, unless the caret is already in a control.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  // Stage rows are per role, so the same five names repeat. The filter works on
  // the name a recruiter reads, not the per role stage id.
  const stageById = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages],
  );

  const stageNames = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of stages) {
      if (!seen.has(s.name)) seen.set(s.name, s.position);
    }
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  }, [stages]);

  const sources = useMemo(
    () => [...new Set(candidates.map((c) => c.source).filter(Boolean))].sort(),
    [candidates],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (
        needle &&
        !`${c.name} ${c.email} ${c.title} ${c.company_name}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      if (owner === MINE && c.owner_id !== viewerId) return false;
      if (owner === NOBODY && c.owner_id !== null) return false;
      if (stageName !== ALL && stageById.get(c.stage_id)?.name !== stageName) {
        return false;
      }
      if (source !== ALL && c.source !== source) return false;
      return true;
    });
  }, [candidates, query, owner, stageName, source, stageById, viewerId]);

  const narrowed =
    query.trim() !== "" || owner !== ALL || stageName !== ALL || source !== ALL;

  const clearFilters = () => {
    setQuery("");
    setOwner(ALL);
    setStageName(ALL);
    setSource(ALL);
  };

  const now = new Date();

  const openDrawer = (id: string) =>
    router.push(`${pathname}?c=${id}`, { scroll: false });
  const closeDrawer = () => router.push(pathname, { scroll: false });

  const drawerStages = openCandidate
    ? stages
        .filter((s) => s.job_id === openCandidate.job_id)
        .sort((a, b) => a.position - b.position)
    : [];

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Talent", "Candidates"]} />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="display text-[18px]">Candidates</h1>
            <span className="flex items-baseline gap-1.5">
              <span className="meta text-ink">{rows.length}</span>
              <span className="legend text-ink-3">
                {rows.length === 1 ? "result" : "results"}
              </span>
            </span>
          </div>

          {/* Adding happens on a board, so this is a real link with the primary
              button style. One tab stop, one focus ring, real navigation. */}
          <Link
            href="/pipeline"
            className="cap inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-control bg-violet px-3.5 text-[12px] font-medium text-on-violet hover:bg-violet-hover [--edge:var(--color-violet-edge)]"
          >
            <Plus size={16} strokeWidth={1.5} />
            Add candidate
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-rule pb-4">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, title, company"
            aria-label="Search candidates"
            className="w-72"
          />
          {/* org_memberships stores a user id and a role, not a name, so the
              owner filter offers the two facts it can state truthfully. */}
          <Select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            aria-label="Filter by owner"
            className="w-40"
          >
            <option value={ALL}>All owners</option>
            <option value={MINE}>Owned by you</option>
            <option value={NOBODY}>Unassigned</option>
          </Select>
          <Select
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            aria-label="Filter by stage"
            className="w-36"
          >
            <option value={ALL}>All stages</option>
            {stageNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Filter by source"
            className="w-40"
          >
            <option value={ALL}>All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {narrowed ? (
            <Button onClick={clearFilters}>Clear filters</Button>
          ) : null}
        </div>
      </div>

      <div className="px-6 pb-6 pt-4">
        {candidates.length === 0 ? (
          <EmptyState
            title="No candidates yet"
            body="Candidates are added on a role board. Open a role and add the first one there."
            action={
              <Link
                href="/pipeline"
                className="inline-flex h-7 items-center justify-center rounded-control border border-ink px-3 text-[12px] font-medium text-ink hover:bg-well"
              >
                Go to the pipeline
              </Link>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No candidates match these filters"
            body="Clear the search box, or set owner, stage and source back to All, to see the rest of the pipeline."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <div className="overflow-hidden rounded-shell border border-rule bg-sheet">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {COLUMNS.map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="legend sticky top-0 z-10 h-9 border-b border-rule bg-sheet px-3 text-ink-2"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const stage = stageById.get(c.stage_id);
                  const who = ownerLabel(c.owner_id, viewerId);

                  return (
                    <tr
                      key={c.id}
                      onClick={(e) => {
                        // Links inside the row keep their own job.
                        if ((e.target as HTMLElement).closest("a, button")) {
                          return;
                        }
                        openDrawer(c.id);
                      }}
                      className="h-11 cursor-pointer border-b border-rule last:border-b-0 hover:bg-paper"
                    >
                      <td className="px-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={c.name} size="md" />
                          {/* One control, 28px tall, covering both lines. The
                              row is clickable too, but the button is what the
                              keyboard lands on. */}
                          <button
                            onClick={() => openDrawer(c.id)}
                            className="flex min-h-7 min-w-0 flex-col items-start justify-center rounded-control text-left"
                          >
                            <span className="max-w-full truncate text-[13px] font-medium leading-[1.3]">
                              {c.name}
                            </span>
                            <span className="max-w-full truncate text-[12px] leading-[1.4] text-ink-2">
                              {c.title || "Title not recorded"}
                            </span>
                          </button>
                        </span>
                      </td>
                      <td className="px-3 text-[12px]">
                        {c.company_name || "Not recorded"}
                      </td>
                      <td className="px-3">
                        {stage ? (
                          <StatusChip
                            tone={
                              stage.position >= 3
                                ? "on"
                                : stage.position === 0
                                  ? "off"
                                  : "attention"
                            }
                          >
                            {stage.name}
                          </StatusChip>
                        ) : (
                          <StatusChip tone="off">No stage</StatusChip>
                        )}
                      </td>
                      <td className="max-w-[240px] px-3">
                        <CopyField
                          value={c.email}
                          label={`${c.name} email`}
                          href={`mailto:${c.email}`}
                        />
                      </td>
                      <td className="px-3">
                        <span className="flex items-center gap-2">
                          <Avatar name={who} size="sm" />
                          <span className="truncate text-[12px]">{who}</span>
                        </span>
                      </td>
                      {/* This list spans every role, so a single match number
                          had nothing to be matched against. The role a candidate
                          is actually on is the fact that belongs here. Fit is
                          scored per role and shown on the board and in the
                          drawer, where the role is unambiguous. */}
                      <td className="px-3">
                        <span className="truncate text-[12px] text-ink-2">
                          {jobById.get(c.job_id)?.title ?? "No role"}
                        </span>
                      </td>
                      <td className="px-3">
                        <Activity
                          freshness={freshnessFor(
                            new Date(c.last_activity_at),
                            now,
                          )}
                          label={relativeTime(c.last_activity_at, now)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CandidateDrawer
        candidate={openCandidate}
        stages={drawerStages}
        notes={notes}
        activity={activity}
        viewerId={viewerId}
        onClose={closeDrawer}
      />
    </main>
  );
}
