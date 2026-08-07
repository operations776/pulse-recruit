import { getPlanner, getSuggestions } from "@/lib/data";
import { hasModelKey } from "@/lib/server/ai/openai";
import { dayKey, isMonth } from "@/lib/time";
import { ContentPlanner } from "./content-planner";

// Pillar 5. Thirty posts a quarter is the target, so the week gets planned here
// rather than invented every Monday.
export default async function ContentPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; filter?: string }>;
}) {
  const params = await searchParams;

  // The month is resolved before the fetch, because the fetch decides which
  // media to sign by it. An unparseable value falls back to the current month
  // rather than rendering an empty grid for the year 0.
  const fallback = dayKey(new Date(), "UTC").slice(0, 7);
  const [planner, suggestions] = await Promise.all([
    getPlanner(isMonth(params.month) ? params.month : fallback),
    getSuggestions(),
  ]);

  const month = isMonth(params.month)
    ? params.month
    : dayKey(new Date(), planner.timezone).slice(0, 7);

  return (
    <ContentPlanner
      posts={planner.posts}
      assets={planner.assets}
      timezone={planner.timezone}
      meId={planner.meId}
      members={planner.members}
      shapes={planner.shapes}
      // A persona with no distilled voice is not a persona yet: the intake was
      // started and never finished, and a draft from it would be generic.
      hasPersona={Boolean(
        (planner.persona?.voice_profile as { summary?: string } | null)?.summary,
      )}
      generationConfigured={hasModelKey()}
      pendingLessons={planner.pendingLessons}
      suggestions={suggestions}
      canPublish={planner.canPublish}
      metricsByPost={planner.metricsByPost}
      orgName={planner.orgName}
      pausedKeys={planner.pausedKeys}
      month={month}
      // Week is the default, per the Figma. It answers what is going out this
      // week, which is the question the planner gets opened for; the month grid
      // answers a different and rarer one.
      view={
        params.view === "board"
          ? "board"
          : params.view === "calendar"
            ? "calendar"
            : "week"
      }
      filter={
        params.filter === "needs-you" ||
        params.filter === "ideas" ||
        params.filter === "published"
          ? params.filter
          : "all"
      }
      // Today is read on the server inside the org zone and handed down. A
      // client-side clock read would disagree with the server render and move
      // the highlight after hydration.
      today={dayKey(new Date(), planner.timezone)}
    />
  );
}
