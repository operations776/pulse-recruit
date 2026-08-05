import { getCandidates, getTaskBoard } from "@/lib/data";
import { TaskList } from "./task-list";

// Pillar 2. The list the ops manager fills. A task it wrote carries the Claude
// chip, so the recruiter always knows which lines are his own.
export default async function TasksPage() {
  const [board, { candidates }] = await Promise.all([
    getTaskBoard(),
    getCandidates(),
  ]);

  // A task carries a candidate id, not a name. Resolve it here so the row can
  // stay a plain render with no second lookup.
  const linkedNames: Record<string, string> = {};
  for (const c of candidates) linkedNames[c.id] = c.name;

  return (
    <TaskList
      tasks={board.tasks}
      assigneesByTask={board.assigneesByTask}
      members={board.members}
      meId={board.session.userId}
      linkedNames={linkedNames}
      // The clock is fixed on the server so the due-date colouring agrees
      // between the server render and hydration.
      now={new Date().toISOString()}
    />
  );
}
