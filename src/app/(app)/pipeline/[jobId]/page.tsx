"use client";

import { notFound, useParams } from "next/navigation";
import { Board } from "@/components/ats/board";
import { JobPanel } from "@/components/shell/job-panel";
import { useStore } from "@/lib/store";

export default function PipelinePage() {
  const params = useParams<{ jobId: string }>();
  const { jobs } = useStore();
  const job = jobs.find((j) => j.id === params.jobId);

  if (!job) notFound();

  return (
    <>
      <JobPanel activeJobId={job.id} />
      <Board job={job} />
    </>
  );
}
