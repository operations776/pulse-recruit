"use client";

import { skillColour } from "@/config/content-skills";
import { shapeForPost } from "@/lib/shapes";
import type {
  PostAsset,
  PostMetricsRow,
  PostRow,
  Shape,
} from "@/lib/supabase/types";

// PLS-186. "How your last posts did", from the planner frame.
//
// Four cards, newest published first, each carrying the numbers Unipile
// actually reported. A null is printed as a dash, never defaulted to zero:
// zero means nobody engaged, null means LinkedIn did not say, and rendering
// one as the other turns "we do not know" into a measurement (the
// never-fabricate rule applied to arithmetic).
//
// The teal highlight marks the best genuine number in each column, which is
// what the frame's green is doing: pointing at the thing worth repeating.

const COLUMNS = [
  { key: "impressions", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Replies" },
] as const;

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function PerformanceStrip({
  posts,
  metricsByPost,
  assets,
  shapes,
  tz,
  total,
  onOpen,
  onSeeAll,
}: {
  /** Published, newest first, already capped by the caller. */
  posts: PostRow[];
  metricsByPost: Record<string, PostMetricsRow>;
  assets: Record<string, PostAsset[]>;
  shapes: Shape[];
  tz: string;
  /** Every published post, for the "see all" count. */
  total: number;
  onOpen: (post: PostRow) => void;
  onSeeAll: () => void;
}) {
  if (posts.length === 0) return null;

  // The best real value per column, for the highlight. Ties highlight both:
  // two posts doing equally well is two things worth repeating.
  const best: Record<(typeof COLUMNS)[number]["key"], number> = {
    impressions: 0,
    likes: 0,
    comments: 0,
  };
  for (const post of posts) {
    const m = metricsByPost[post.id];
    if (!m) continue;
    for (const col of COLUMNS) {
      const value = m[col.key];
      if (typeof value === "number" && value > best[col.key]) {
        best[col.key] = value;
      }
    }
  }

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="flex items-baseline gap-2 text-[13px] font-medium leading-[1.45] text-ink">
          How your last posts did
          <span className="meta text-ink-3">Last 14 days</span>
        </p>
        <button
          type="button"
          onClick={onSeeAll}
          className="meta text-ink-3 hover:text-ink"
        >
          See all {total}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {posts.map((post) => {
          const shape = shapeForPost(post, shapes);
          const accent = skillColour(shape.key);
          const metrics = metricsByPost[post.id] ?? null;
          const thumb = (assets[post.id] ?? []).find((a) => a.url)?.url ?? null;
          const day = post.published_at
            ? new Intl.DateTimeFormat("en-GB", {
                timeZone: tz,
                weekday: "short",
              }).format(new Date(post.published_at))
            : "";

          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onOpen(post)}
              className="raised settle flex flex-col overflow-hidden rounded-card border border-rule bg-sheet text-left hover:border-violet"
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  className="h-20 w-full object-cover"
                />
              ) : (
                // No media on the post, so the slot carries the skill hue
                // rather than a broken-image placeholder.
                <div aria-hidden className={`h-20 w-full ${accent.tint}`} />
              )}

              <div className="flex flex-col gap-1 px-3 py-2.5">
                <p className="meta flex items-center justify-between text-ink-3">
                  <span className="truncate uppercase">{shape.name}</span>
                  {day ? <span className="shrink-0 uppercase">{day}</span> : null}
                </p>
                <p className="line-clamp-2 text-[13px] leading-[1.45] text-ink">
                  {post.hook || "Untitled"}
                </p>

                <span className="mt-1 flex items-center gap-4">
                  {COLUMNS.map((col) => {
                    const value = metrics?.[col.key] ?? null;
                    const strong =
                      typeof value === "number" &&
                      value > 0 &&
                      value === best[col.key];
                    return (
                      <span key={col.key} className="flex flex-col">
                        <span
                          className={`meta font-medium ${
                            strong ? "text-teal-text" : "text-ink"
                          }`}
                        >
                          {typeof value === "number" ? compact(value) : "--"}
                        </span>
                        <span className="meta text-[9px] uppercase text-ink-3">
                          {col.label}
                        </span>
                      </span>
                    );
                  })}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
