import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/misc";
import { getWorkspace } from "@/lib/data";

// The pipeline index is a pointer, not a screen. It sends the recruiter to the
// first real role rather than to a role id that was baked in at build time.
export default async function PipelineIndex() {
  const { jobs } = await getWorkspace();

  if (jobs.length > 0) redirect(`/pipeline/${jobs[0].id}`);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-paper p-6">
      <EmptyState
        title="No roles yet"
        body="A role is the board everything else hangs off. Once one exists here, its stages and candidates appear on this screen."
      />
    </main>
  );
}
