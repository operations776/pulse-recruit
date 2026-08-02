import { notFound } from "next/navigation";
import { Board } from "@/components/ats/board";
import { JobPanel } from "@/components/shell/job-panel";
import { getBoard, getCandidateDetail, getWorkspace } from "@/lib/data";

// The open candidate lives in the query string rather than in client state, so
// the server can load that person's real notes and activity and hand them down.
// Refreshing after a write then re-renders this page and the drawer receives
// fresh props while staying mounted.
export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { jobId } = await params;
  const { c } = await searchParams;

  const [board, workspace] = await Promise.all([
    getBoard(jobId),
    getWorkspace(),
  ]);

  if (!board.job) notFound();

  const open = c ? (board.candidates.find((row) => row.id === c) ?? null) : null;
  const detail = open
    ? await getCandidateDetail(open.id)
    : { notes: [], activity: [] };

  return (
    <>
      {/* The module rail lists the sections of TALENT. Individual roles are a
          third level, so they keep their own panel. */}
      <JobPanel jobs={workspace.jobs} activeJobId={board.job.id} />
      <Board
        job={board.job}
        stages={board.stages}
        candidates={board.candidates}
        session={board.session}
        openCandidate={open}
        notes={detail.notes}
        activity={detail.activity}
      />
    </>
  );
}
