import { CandidatesTable } from "@/components/ats/candidates-table";
import { requireSession } from "@/lib/auth";
import { getCandidates, getCandidateDetail } from "@/lib/data";

// Every candidate across every role. The server owns the query and the drawer
// payload, the client child owns the filters.
export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const [session, { candidates, stages, jobs }] = await Promise.all([
    requireSession(),
    getCandidates(),
  ]);

  const open = c ? (candidates.find((row) => row.id === c) ?? null) : null;
  const detail = open
    ? await getCandidateDetail(open.id)
    : { notes: [], activity: [] };

  return (
    <CandidatesTable
      candidates={candidates}
      stages={stages}
      jobs={jobs}
      viewerId={session.userId}
      openCandidate={open}
      notes={detail.notes}
      activity={detail.activity}
    />
  );
}
