import { getTaskWorkspace } from "@/lib/data";
import { isTaskView, type TaskViewKey } from "@/lib/tasks";
import { dayKey } from "@/lib/time";
import { TaskWorkspace } from "./task-workspace";

/**
 * Pillar 2. The tasks workspace.
 *
 * Three regions: the views on the left, the list in the middle, the open task
 * on the right. Which view, which person and which task are all in the URL, so
 * a view is linkable, the back button works, and the panel's activity stream is
 * fetched by the server for exactly one task rather than for every row on
 * screen.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; person?: string; task?: string }>;
}) {
  const params = await searchParams;
  const view: TaskViewKey = isTaskView(params.view) ? params.view : "today";
  const person = params.person ?? null;
  const selectedId = params.task ?? null;

  const workspace = await getTaskWorkspace(selectedId ?? undefined);

  // Today is resolved once, on the server, inside the org's timezone. Every
  // band on this screen is a day comparison, and a day only exists inside a
  // zone: derive it from the machine clock and the server puts a task in Today
  // while the browser puts it in Overdue for six hours out of twenty-four.
  const todayKey = dayKey(new Date(), workspace.tz);

  return (
    <TaskWorkspace
      view={view}
      person={person}
      selectedId={selectedId}
      tasks={workspace.tasks}
      assigneesByTask={workspace.assigneesByTask}
      watchersByTask={workspace.watchersByTask}
      members={workspace.members}
      meId={workspace.session.userId}
      isAdmin={
        workspace.session.role === "owner" || workspace.session.role === "admin"
      }
      noteCounts={workspace.noteCounts}
      links={workspace.links}
      activity={workspace.activity}
      tz={workspace.tz}
      todayKey={todayKey}
    />
  );
}
