import { getPlanner } from "@/lib/data";
import { hasModelKey } from "@/lib/server/ai/openai";
import { dayKey } from "@/lib/time";
import { SkillsScreen } from "./skills-screen";

// PLS-188. Skills as a screen, per the frame. Each one is a kind of post the
// engine knows how to write; this is where they are read, edited, paused and
// tested. The dialog it replaces put the same reference behind a popup.
export default async function SkillsPage() {
  const month = dayKey(new Date(), "UTC").slice(0, 7);
  const planner = await getPlanner(month);

  return (
    <SkillsScreen
      posts={planner.posts}
      shapes={planner.shapes}
      metricsByPost={planner.metricsByPost}
      pausedKeys={planner.pausedKeys}
      configured={hasModelKey()}
    />
  );
}
