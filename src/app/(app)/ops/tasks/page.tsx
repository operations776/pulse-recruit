import { getCandidates, getTasks } from "@/lib/data";
import { TaskList } from "./task-list";

// Pillar 2. The list the ops manager fills. A task it wrote carries the Claude
// chip, so the recruiter always knows which lines are his own.
export default async function TasksPage() {
  const [tasks, { candidates }] = await Promise.all([
    getTasks(),
    getCandidates(),
  ]);

  // A task carries a candidate id, not a name. Resolve it here so the row can
  // stay a plain render with no second lookup.
  const linkedNames: Record<string, string> = {};
  for (const c of candidates) linkedNames[c.id] = c.name;

  return <TaskList tasks={tasks} linkedNames={linkedNames} />;
}
