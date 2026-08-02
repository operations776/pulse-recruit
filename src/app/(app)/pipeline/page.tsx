import { redirect } from "next/navigation";
import { JOBS } from "@/lib/mock/seed";

export default function PipelineIndex() {
  redirect(`/pipeline/${JOBS[0].id}`);
}
