"use client";

import { Download, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AddCandidateDialog } from "@/components/ats/add-candidate-dialog";
import { BulkActionBar } from "@/components/ats/bulk-action-bar";
import { CandidateCard } from "@/components/ats/candidate-card";
import { CandidateDrawer } from "@/components/ats/candidate-drawer";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Breadcrumb } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { moveCandidate } from "@/lib/actions";
import type { Session } from "@/lib/auth";
import { buildCsv, downloadCsv } from "@/lib/csv";
import type {
  ActivityRow,
  CandidateRow,
  JobRow,
  NoteRow,
  PersonFieldDefRow,
  StageRow,
} from "@/lib/supabase/types";
import { formatShortDate } from "@/lib/time";

const TABS = ["Candidates", "Job news", "Channel", "Report"] as const;

export function Board({
  job,
  stages,
  candidates,
  session,
  openCandidate,
  notes,
  activity,
  fieldDefs,
}: {
  job: JobRow;
  stages: StageRow[];
  candidates: CandidateRow[];
  session: Session;
  openCandidate: CandidateRow | null;
  notes: NoteRow[];
  activity: ActivityRow[];
  fieldDefs: PersonFieldDefRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { notify } = useToast();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Candidates");
  const [, startTransition] = useTransition();

  // A dropped card should land in its new column before the round trip
  // finishes. Each override records the stage the row was in when it was
  // dragged, so the moment the server sends back anything else, the server
  // wins. That keeps the optimistic view self correcting with no effect and no
  // stale card left sitting in the wrong column.
  const [moved, setMoved] = useState<Record<string, { from: string; to: string }>>(
    {},
  );

  // Esc clears selection when no layer is open. The layers handle their own Esc.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !openCandidate && !addOpen) setSelection([]);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openCandidate, addOpen]);

  const stageOf = (c: CandidateRow) => {
    const pending = moved[c.id];
    return pending && pending.from === c.stage_id ? pending.to : c.stage_id;
  };

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? candidates.filter((c) =>
        `${c.name} ${c.email} ${c.title} ${c.company_name}`
          .toLowerCase()
          .includes(needle),
      )
    : candidates;

  const openDrawer = (id: string) => {
    router.push(`${pathname}?c=${id}`, { scroll: false });
  };

  const closeDrawer = () => {
    router.push(pathname, { scroll: false });
  };

  const toggle = (id: string) =>
    setSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const drop = (stage: StageRow) => {
    setOverStage(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;

    const moving = candidates.find((c) => c.id === id);
    if (!moving || stageOf(moving) === stage.id) return;

    setMoved((prev) => ({
      ...prev,
      [id]: { from: moving.stage_id, to: stage.id },
    }));
    startTransition(async () => {
      const result = await moveCandidate(id, stage.id);
      if (!result.ok) {
        setMoved((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        notify(result.error, "danger");
        return;
      }
      notify(`${moving.name} moved to ${stage.name}.`);
    });
  };

  const openWindow =
    job.opens_at && job.closes_at
      ? `${formatShortDate(job.opens_at)} to ${formatShortDate(job.closes_at)}`
      : "Not set";

  // Serialise rows the board is already holding: an export can never disagree
  // with the screen. No selection exports the whole role.
  const exportCsv = (only?: string[]) => {
    const wanted = only?.length
      ? candidates.filter((c) => only.includes(c.id))
      : candidates;
    const stageName = new Map(stages.map((s) => [s.id, s.name]));
    const csv = buildCsv(
      [
        "Ref", "Name", "Email", "Phone", "Title", "Company", "Location",
        "LinkedIn", "Salary", "Source", "Stage", "Match", "Added",
      ],
      wanted.map((c) => [
        c.ref, c.name, c.email, c.phone, c.title, c.company_name, c.location,
        c.linkedin_url, c.salary, c.source,
        stageName.get(stageOf(c)) ?? "", c.match,
        c.created_at.slice(0, 10),
      ]),
    );
    downloadCsv(
      `${job.ref}-${only?.length ? "selection" : "candidates"}.csv`,
      csv,
    );
    notify(
      `Exported ${wanted.length} ${wanted.length === 1 ? "candidate" : "candidates"} to CSV.`,
    );
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="border-b border-rule px-6 py-5">
        <Breadcrumb trail={["Talent", "Roles", job.ref]} />

        <h1 className="display mt-2 text-[18px]">{job.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-[12px] text-ink-2">
            Talent pool:{" "}
            <span className="font-medium text-ink">
              {job.talent_pool || "Not set"}
            </span>
          </span>
          <span className="text-[12px] text-ink-2">
            Hired:{" "}
            <span className="meta text-ink">
              {job.hired}/{job.target}
            </span>
          </span>
          <span className="text-[12px] text-ink-2">
            Open: <span className="meta text-ink">{openWindow}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pr-6">
        <div className="flex items-center">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`-ml-px border border-y-0 border-rule px-3.5 py-2.5 text-[12px] font-medium first:ml-0 ${
                tab === t
                  ? "bg-ink text-sheet"
                  : "text-ink-2 hover:bg-well hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidates"
            aria-label="Search candidates"
            className="w-56"
          />
          <Button
            onClick={() => exportCsv()}
            disabled={candidates.length === 0}
            aria-label="Export every candidate on this role to CSV"
          >
            <Download size={16} strokeWidth={1.5} />
            Export CSV
          </Button>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} strokeWidth={1.5} />
            Add candidate
          </Button>
        </div>
      </div>

      {tab === "Candidates" ? (
        <div className="p-5">
          <div className="overflow-hidden rounded-shell border border-rule bg-sheet">
            <div className="flex">
              {stages.map((stage) => {
                const inStage = filtered.filter(
                  (c) => stageOf(c) === stage.id,
                );
                const isOver = overStage === stage.id;

                return (
                  <section
                    key={stage.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverStage(stage.id);
                    }}
                    onDragLeave={() =>
                      setOverStage((s) => (s === stage.id ? null : s))
                    }
                    onDrop={() => drop(stage)}
                    className={`-ml-px flex w-[300px] shrink-0 flex-col border-l border-rule first:ml-0 first:border-l-0 ${
                      isOver ? "bg-well" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
                      <span className="legend flex-1 text-ink-2">
                        {stage.name}
                      </span>
                      <span className="meta text-ink-2">
                        {String(inStage.length).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="flex flex-col gap-3 p-4">
                      {inStage.map((c) => (
                        <CandidateCard
                          key={c.id}
                          candidate={c}
                          selected={selection.includes(c.id)}
                          onToggle={() => toggle(c.id)}
                          onOpen={() => openDrawer(c.id)}
                          onDragStart={() => setDragId(c.id)}
                        />
                      ))}

                      {inStage.length === 0 ? (
                        <p className="rounded-control border border-dashed border-rule px-3 py-6 text-center text-[12px] text-ink-2">
                          {query ? "No matches here" : "Drop a candidate here"}
                        </p>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-6 py-10">
          <p className="text-[12px] text-ink-2">
            {tab} is not built yet. The candidate pipeline is the focus of week
            one.
          </p>
        </div>
      )}

      <BulkActionBar
        ids={selection}
        stages={stages}
        onClear={() => setSelection([])}
        onExport={() => exportCsv(selection)}
      />

      <CandidateDrawer
        candidate={openCandidate}
        stages={stages}
        notes={notes}
        activity={activity}
        viewerId={session.userId}
        fieldDefs={fieldDefs}
        isAdmin={session.role !== "member"}
        onClose={closeDrawer}
      />

      <AddCandidateDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        jobId={job.id}
        stages={stages}
      />
    </main>
  );
}
