import { getPosts } from "@/lib/data";
import { ContentBoard } from "./content-board";

// Pillar 5. Thirty posts a quarter is the target, so the week gets planned here
// rather than invented every Monday.
export default async function ContentPlannerPage() {
  const posts = await getPosts();

  // Fix the clock once on the server and hand it down, so the relative labels
  // on the cards are the same on both renders.
  const now = new Date().toISOString();

  return <ContentBoard posts={posts} now={now} />;
}
