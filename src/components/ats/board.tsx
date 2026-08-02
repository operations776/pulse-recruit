"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AddCandidateDialog } from "@/components/ats/add-candidate-dialog";
import { BulkActionBar } from "@/components/ats/bulk-action-bar";
import { CandidateCard } from "@/components/ats/candidate-card";
import { CandidateDrawer } from "@/components/ats/candidate-drawer";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Breadcrumb } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

import { useStore } from "@/lib/store";
import { formatShortDate } from "@/lib/time";
import type { Job } from "@/lib/types";

const TABS = ["Candidates", "Job news", "Channel", "Report"] as const;

export function Board({ job }: { job: Job }) {
  const {
    stagesForJob,
    candidatesForJob,
    moveCandidate,
    memberById,
    selection,
    clearSelection,
  } = useStore();
  const { notify } = useToast();

  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Candidates");

  const stages = stagesForJob(job.id);
  const all = candidatesForJob(job.id);

  const filtered = query
    ? all.filter((c) =>
        `${c.name} ${c.email} ${c.title} ${c.companyName}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : all;

  // DESIGN.md: Esc clears selection when no layer is open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !openId && !addOpen) clearSelection();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openId, addOpen, clearSelection]);

  const drop = (stageId: string, stageName: string) => {
    setOverStage(null);
    if (!dragId) return;
    const moving = all.find((c) => c.id === dragId);
    setDragId(null);
    if (!moving || moving.stageId === stageId) return;
    moveCandidate(moving.id, stageId);
    notify(`${moving.name} moved to ${stageName}`);
  };

  const openCandidate = filtered.find((c) => c.id === openId) ?? null;

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="border-b border-rule px-6 py-5">
        <Breadcrumb trail={["Recruitment", "Roles", job.code]} />

        <h1 className="display mt-2 text-[22px]">{job.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-[15px] text-ink-2">
            Talent pool:{" "}
            <span className="font-medium text-ink">{job.talentPool}</span>
          </span>
          <span className="text-[15px] text-ink-2">
            Hired:{" "}
            <span className="meta text-ink">
              {job.hired}/{job.target}
            </span>
          </span>
          <span className="text-[15px] text-ink-2">
            Open:{" "}
            <span className="meta text-ink">
              {formatShortDate(job.opensAt)} - {formatShortDate(job.closesAt)}
            </span>
          </span>
          <span className="flex items-center gap-2 text-[15px] text-ink-2">
            Assigned to:
            <AvatarStack
              names={job.assigneeIds.map((id) => memberById(id)?.name ?? "Unknown")}
            />
            <button
              aria-label="Assign someone"
              className="flex size-6 items-center justify-center rounded-control border border-dashed border-rule text-ink-3 hover:border-ink-3 hover:text-ink-2"
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </span>
        </div>

      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pr-6">
        <div className="flex items-center">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-[15px] font-medium -ml-px border border-y-0 border-rule px-3.5 py-2.5 first:ml-0 ${
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
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={14} strokeWidth={2.25} />
            Add candidate
          </Button>
        </div>
      </div>

      {tab === "Candidates" ? (
        <div className="p-5">
          <div className="overflow-hidden rounded-shell border border-rule bg-sheet">
          <div className="flex">
          {stages.map((stage) => {
            const inStage = filtered.filter((c) => c.stageId === stage.id);
            const isOver = overStage === stage.id;

            return (
              <section
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage.id);
                }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={() => drop(stage.id, stage.name)}
                className={`-ml-px flex w-[300px] shrink-0 flex-col border-l border-rule first:ml-0 first:border-l-0 ${
                  isOver ? "bg-well" : ""
                }`}
              >
                <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
                  <span className="legend flex-1 text-ink-2">{stage.name}</span>
                  <span className="meta text-ink-2">
                    {String(inStage.length).padStart(2, "0")}
                  </span>
                </div>

                <div className="flex flex-col gap-3 p-4">
                  {inStage.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      onOpen={() => setOpenId(c.id)}
                      onDragStart={() => setDragId(c.id)}
                    />
                  ))}

                  {inStage.length === 0 ? (
                    <p className="rounded-control border border-dashed border-rule px-3 py-6 text-center text-[15px] text-ink-3">
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
          <p className="text-[15px] text-ink-2">
            {tab} is not built yet. The candidate pipeline is the focus of week
            one.
          </p>
        </div>
      )}

      <BulkActionBar stages={stages} />

      <CandidateDrawer
        candidate={openCandidate}
        stages={stages}
        onClose={() => setOpenId(null)}
      />

      <AddCandidateDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        jobId={job.id}
        stages={stages}
      />

      {selection.length > 0 ? <div className="h-4" /> : null}
    </main>
  );
}
