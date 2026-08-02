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
import { hueBg, hueByIndex, hueTint } from "@/lib/hue";
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
    <main className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-canvas">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Recruitment", "Roles", job.title]} />

        <h1 className="mt-2 font-display text-[22px] font-semibold leading-7 tracking-[-0.01em]">
          {job.title}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-[12px] text-ink-600">
            Talent pool:{" "}
            <span className="font-medium text-ink-900">{job.talentPool}</span>
          </span>
          <span className="text-[12px] text-ink-600">
            Hired:{" "}
            <span className="data-literal text-ink-900">
              {job.hired}/{job.target}
            </span>
          </span>
          <span className="text-[12px] text-ink-600">
            Open:{" "}
            <span className="data-literal text-ink-900">
              {formatShortDate(job.opensAt)} - {formatShortDate(job.closesAt)}
            </span>
          </span>
          <span className="flex items-center gap-2 text-[12px] text-ink-600">
            Assigned to:
            <AvatarStack
              names={job.assigneeIds.map((id) => memberById(id)?.name ?? "Unknown")}
            />
            <button
              aria-label="Assign someone"
              className="flex size-6 items-center justify-center rounded-full border border-dashed border-line text-ink-400 hover:border-ink-400 hover:text-ink-600"
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-line">
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border-b-2 px-3 pb-2.5 text-[13px] ${
                  tab === t
                    ? "border-emerald-600 font-semibold text-emerald-700"
                    : "border-transparent text-ink-600 hover:text-ink-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pb-2">
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search candidates"
              aria-label="Search candidates"
              className="w-56"
            />
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={15} strokeWidth={2.25} />
              Add candidate
            </Button>
          </div>
        </div>
      </div>

      {tab === "Candidates" ? (
        <div className="flex flex-1 gap-3 px-6 pb-4 pt-4">
          {stages.map((stage, i) => {
            const hue = hueByIndex(i);
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
                className={`w-71 shrink-0 rounded-xl p-1 transition-colors ${
                  isOver ? "bg-emerald-50" : ""
                }`}
              >
                <div className="mb-2.5 flex items-center gap-2 px-1">
                  <span
                    className={`flex size-5 items-center justify-center rounded-md ${hueTint[hue]}`}
                  >
                    <span className={`size-2 rounded-[3px] ${hueBg[hue]}`} />
                  </span>
                  <span className="text-[13px] font-semibold">{stage.name}</span>
                  <span className="data-literal rounded-full bg-line-soft px-1.5 text-[11px] text-ink-600">
                    {inStage.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {inStage.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      onOpen={() => setOpenId(c.id)}
                      onDragStart={() => setDragId(c.id)}
                    />
                  ))}

                  {inStage.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-400">
                      {query ? "No matches here" : "Drop a candidate here"}
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="px-6 py-10">
          <p className="text-[13px] text-ink-600">
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
