import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplyForm } from "./apply-form";

// PLS-78. The public application page. No session, no app shell: an applicant
// holds a slug and nothing else, and the only thing this page can learn from
// it is the role's title through a function built for exactly that question.
export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("job_for_application", { slug });
  const job = (data as { job_title: string; company_name: string }[] | null)?.[0];

  // A dead or revoked slug is a 404, not an explanation. Explaining would
  // confirm to a guesser which slugs exist.
  if (!job) notFound();

  return (
    <main className="flex min-h-screen items-start justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-[520px]">
        <p className="legend text-ink-3">Application</p>
        <h1 className="display mt-2 text-[18px]">{job.job_title}</h1>
        {job.company_name ? (
          <p className="mt-1 text-[13px] text-ink-2">{job.company_name}</p>
        ) : null}

        <div className="mt-6 rounded-shell border border-rule bg-sheet p-5">
          <ApplyForm slug={slug} jobTitle={job.job_title} />
        </div>

        <p className="mt-4 text-[12px] text-ink-3">
          Your details go to the recruiting team for this role and nowhere
          else.
        </p>
      </div>
    </main>
  );
}
