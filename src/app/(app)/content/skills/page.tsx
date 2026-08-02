import Link from "next/link";
import { SKILLS } from "@/config/content-skills";
import { getPosts } from "@/lib/data";
import type { ContentSkill } from "@/lib/supabase/types";

// The Button primitive renders a real button element, and this control has to
// navigate, so it carries the secondary variant's classes on a Link instead.
// Same keycap edge, same 12px sentence case label, same control radius.
const LINK_BUTTON =
  "cap inline-flex h-7 shrink-0 items-center justify-center gap-2 rounded-control border border-ink bg-transparent px-2.5 text-[12px] font-medium text-ink hover:bg-well [--edge:var(--color-ink)]";

const pad2 = (n: number) => String(n).padStart(2, "0");

export default async function ContentSkillsPage() {
  const posts = await getPosts();

  // Count once, read many. A per skill filter inside the map would walk the
  // whole list five times for no reason.
  const written = new Map<ContentSkill, number>();
  for (const post of posts) {
    written.set(post.skill, (written.get(post.skill) ?? 0) + 1);
  }
  const writtenFor = (key: ContentSkill) => written.get(key) ?? 0;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Pillar 5 / content</p>
        <h1 className="display mt-2 text-[18px]">Skills</h1>
        <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
          Every post is written through one of these. Pick the shape first, then
          fill it.
        </p>
      </header>

      <div className="flex flex-col gap-5 p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          {SKILLS.map((skill) => {
            const Icon = skill.icon;
            return (
              <article
                key={skill.key}
                className="flex flex-col rounded-card border border-rule bg-sheet p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="well flex size-9 shrink-0 items-center justify-center rounded-control">
                    <Icon size={16} strokeWidth={1.5} className="text-ink-2" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-[13px] font-medium leading-[1.5]">
                      {skill.name}
                    </h2>
                    <p className="mt-1 text-[12px] leading-[1.5] text-ink-2">
                      {skill.blurb}
                    </p>
                  </div>
                </div>

                <p className="well mt-3 whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
                  {skill.prompt}
                </p>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="meta text-ink-3">
                    {pad2(writtenFor(skill.key))} written
                  </span>
                  <Link href="/content" className={LINK_BUTTON}>
                    Write one
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <section className="overflow-hidden rounded-shell border border-rule bg-sheet">
          <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
            <span className="legend flex-1 text-ink-2">Posts per skill</span>
            <span className="meta text-ink-2">{pad2(posts.length)}</span>
          </div>

          {SKILLS.map((skill) => (
            <div
              key={skill.key}
              className="-mt-px flex items-center gap-3 border-t border-rule px-4 py-2.5 first:mt-0 first:border-t-0"
            >
              <span className="flex-1 truncate text-[13px]">{skill.name}</span>
              <span className="meta text-ink-2">
                {pad2(writtenFor(skill.key))}
              </span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
