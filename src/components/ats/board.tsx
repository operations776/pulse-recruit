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
import { hueBg, hueByIndex } from "@/lib/hue";
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
      <div className="border-b border-rule-strong px-6 py-5">
        <Breadcrumb trail={["Recruitment", "Roles", job.code]} />

        <h1 className="display mt-2 text-[26px] leading-7">{job.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-[12px] text-ink-soft">
            Talent pool:{" "}
            <span className="font-medium text-ink">{job.talentPool}</span>
          </span>
          <span className="text-[12px] text-ink-soft">
            Hired:{" "}
            <span className="data-literal text-ink">
              {job.hired}/{job.target}
            </span>
          </span>
          <span className="text-[12px] text-ink-soft">
            Open:{" "}
            <span className="data-literal text-ink">
              {formatShortDate(job.opensAt)} - {formatShortDate(job.closesAt)}
            </span>
          </span>
          <span className="flex items-center gap-2 text-[12px] text-ink-soft">
            Assigned to:
            <AvatarStack
              names={job.assigneeIds.map((id) => memberById(id)?.name ?? "Unknown")}
            />
            <button
              aria-label="Assign someone"
              className="flex size-6 items-center justify-center rounded-sharp border border-dashed border-rule text-ink-mute hover:border-ink-mute hover:text-ink-soft"
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </span>
        </div>

      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-strong pr-6">
        <div className="flex items-center">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn-label -ml-px border border-y-0 border-rule-strong px-3.5 py-2.5 first:ml-0 ${
                tab === t
                  ? "bg-ink text-paper-white"
                  : "text-ink-soft hover:bg-paper-deep hover:text-ink"
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
        <div className="flex flex-1 pb-4">
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
                className={`-ml-px flex w-72 shrink-0 flex-col border-x border-rule-strong transition-colors first:ml-0 ${
                  isOver ? "bg-vermilion-wash" : ""
                }`}
              >
                <div className="flex items-center gap-2 border-b border-rule-strong bg-paper-deep px-3 py-2.5">
                  <span className={`size-2 rounded-sharp ${hueBg[hue]}`} />
                  <span className="micro-label flex-1">{stage.name}</span>
                  <span className="data-literal text-ink-soft">
                    {String(inStage.length).padStart(2, "0")}
                  </span>
                </div>

                <div className="flex flex-col gap-2 p-2">
                  {inStage.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      onOpen={() => setOpenId(c.id)}
                      onDragStart={() => setDragId(c.id)}
                    />
                  ))}

                  {inStage.length === 0 ? (
                    <p className="rounded-sharp border border-dashed border-rule px-3 py-6 text-center text-[12px] text-ink-mute">
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
          <p className="text-[13px] text-ink-soft">
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
