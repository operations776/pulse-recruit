"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CandidateDrawer } from "@/components/ats/candidate-drawer";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchInput, Select } from "@/components/ui/input";

import { Badge, Breadcrumb, StatusChip, CopyField, EmptyState } from "@/components/ui/misc";
import { Activity, freshnessFor } from "@/components/ui/pulse-dot";

import { NOW } from "@/lib/mock/seed";
import { useStore } from "@/lib/store";
import { relativeTime } from "@/lib/time";

const ALL = "all";

const COLUMNS = [
  "Name",
  "Company",
  "Stage",
  "Email",
  "Owner",
  "Role",
  "Last activity",
] as const;

export default function CandidatesPage() {
  const { state, members, stages, jobs, memberById, stagesForJob } = useStore();

  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState(ALL);
  const [stageName, setStageName] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [openId, setOpenId] = useState<string | null>(null);

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

  const live = useMemo(
    () => state.candidates.filter((c) => !state.archivedIds.includes(c.id)),
    [state.candidates, state.archivedIds],
  );

  // Stage rows are per job, so the same five names repeat. The filter works on
  // the name a recruiter reads, not the per job stage id.
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
    () => [...new Set(live.map((c) => c.source).filter(Boolean))].sort(),
    [live],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return live.filter((c) => {
      if (
        needle &&
        !`${c.name} ${c.email} ${c.title} ${c.companyName}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      if (owner !== ALL && c.ownerId !== owner) return false;
      if (stageName !== ALL && stageById.get(c.stageId)?.name !== stageName) {
        return false;
      }
      if (source !== ALL && c.source !== source) return false;
      return true;
    });
  }, [live, query, owner, stageName, source, stageById]);

  const filtered = query.trim() !== "" || owner !== ALL || stageName !== ALL || source !== ALL;

  const clearFilters = () => {
    setQuery("");
    setOwner(ALL);
    setStageName(ALL);
    setSource(ALL);
  };

  const openCandidate = rows.find((c) => c.id === openId) ?? null;

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Recruitment", "Candidates"]} />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="display text-[22px] tracking-[-0.01em]">
              Candidates
            </h1>
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
            className="cap inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-control bg-vermilion px-4 text-[13px] font-medium text-on-vermilion hover:bg-vermilion-hover [--edge:var(--color-vermilion-edge)]"
          >
            <Plus size={15} strokeWidth={2.25} />
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
          <Select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            aria-label="Filter by owner"
            className="w-40"
          >
            <option value={ALL}>All owners</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
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
          {filtered ? (
            <Button onClick={clearFilters}>Clear filters</Button>
          ) : null}
        </div>
      </div>

      <div className="px-6 pb-6 pt-4">
        {rows.length === 0 ? (
          <EmptyState
            title="No candidates match these filters"
            body="Clear the search box, or set owner, stage and source back to All, to see the rest of the pipeline."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <div className="overflow-hidden rounded-control border border-rule bg-sheet ">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {COLUMNS.map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="legend sticky top-0 z-10 h-9 border-b border-rule bg-sheet px-3 text-ink-3"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const stage = stageById.get(c.stageId);
                  const ownerName = memberById(c.ownerId)?.name ?? "Unassigned";

                  return (
                    <tr
                      key={c.id}
                      onClick={(e) => {
                        // Copy buttons and links inside the row keep their own job.
                        if ((e.target as HTMLElement).closest("a, button")) return;
                        setOpenId(c.id);
                      }}
                      className="h-11 cursor-pointer border-b border-rule last:border-b-0 hover:bg-paper"
                    >
                      <td className="px-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={c.name} src={c.avatarUrl} size="md" />
                          <span className="flex min-w-0 flex-col">
                            <button
                              onClick={() => setOpenId(c.id)}
                              className="truncate rounded text-left text-[15px] font-semibold leading-[18px] hover:text-vermilion-hover"
                            >
                              {c.name}
                            </button>
                            <span className="truncate text-[15px] leading-4 text-ink-2">
                              {c.title}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 text-[15px]">{c.companyName}</td>
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
                          <Badge hue="neutral">No stage</Badge>
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
                          <Avatar
                            name={ownerName}
                            src={memberById(c.ownerId)?.avatarUrl}
                            size="sm"
                          />
                          <span className="truncate text-[15px]">{ownerName}</span>
                        </span>
                      </td>
                      {/* This list spans every role, so a single "match" number
                          had nothing to be matched against. The role a candidate
                          is actually on is the fact that belongs here. Fit is
                          scored per role and shown on the board and in the
                          drawer, where the role is unambiguous. */}
                      <td className="px-3">
                        <span className="truncate text-[13px] text-ink-2">
                          {jobById.get(c.jobId)?.title ?? "No role"}
                        </span>
                      </td>
                      <td className="px-3">
                        <Activity
                          freshness={freshnessFor(new Date(c.lastActivityAt), NOW)}
                          label={relativeTime(c.lastActivityAt)}
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
        stages={openCandidate ? stagesForJob(openCandidate.jobId) : []}
        onClose={() => setOpenId(null)}
      />
    </main>
  );
}
