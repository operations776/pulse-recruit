"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { applyLesson, buildPersona } from "@/lib/actions";
import type { PersonaLessonRow, PersonaRow, VoiceProfile } from "@/lib/supabase/types";
import { formatDate } from "@/lib/time";

const STEPS = ["You", "What worked", "What did not", "Review"] as const;

const LINK_BUTTON =
  "cap inline-flex h-7 shrink-0 items-center justify-center gap-2 rounded-control border border-ink bg-transparent px-2.5 text-[12px] font-medium text-ink hover:bg-well [--edge:var(--color-ink)]";

export function PersonaScreen({
  persona,
  lessons,
  configured,
}: {
  persona: PersonaRow | null;
  lessons: PersonaLessonRow[];
  configured: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  // Someone with a built persona lands on the summary; someone without lands
  // in the intake, because an empty screen with an Edit button is a dead end.
  const [editing, setEditing] = useState(!persona?.built_at);
  const [step, setStep] = useState(0);

  const [headline, setHeadline] = useState(persona?.headline ?? "");
  const [about, setAbout] = useState(persona?.about ?? "");
  const [proud, setProud] = useState<string[]>(() =>
    padTo(persona?.proud_posts ?? [], 3),
  );
  const [flops, setFlops] = useState<string[]>(() =>
    padTo(persona?.flop_posts ?? [], 3),
  );

  const profile = (persona?.voice_profile ?? {}) as VoiceProfile;
  const hasVoice = Boolean(profile.summary);

  const build = () => {
    startTransition(async () => {
      const result = await buildPersona({
        headline,
        about,
        proudPosts: proud,
        flopPosts: flops,
      });
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify("Persona built. Every post you generate now starts from this.");
      setEditing(false);
      setStep(0);
      router.refresh();
    });
  };

  const decide = (lesson: PersonaLessonRow, keep: boolean) => {
    startTransition(async () => {
      const result = await applyLesson(lesson.id, keep);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(keep ? "Folded into your voice." : "Discarded.");
      router.refresh();
    });
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Pillar 5 / content</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="page-title text-ink">Your voice</h1>
          {hasVoice ? <StatusChip tone="on">Built</StatusChip> : null}
        </div>
        <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
          Pulse writes your posts as you, not about you. This is where it learns
          how you sound. Nothing is scraped: what you paste here is all it
          reads.
        </p>
        <div className="mt-3">
          <Link href="/content" className={LINK_BUTTON}>
            <ArrowLeft size={16} strokeWidth={1.5} />
            Back to the planner
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-6">
        {!configured ? (
          <p className="rounded-control border border-amber bg-amber-bg px-3 py-2 text-[12px] text-amber-text">
            This deployment has no model key, so there is nothing to read your
            voice with. What you paste is still saved, and building it will
            work the moment the key is set. That is a Pulse configuration
            problem, not something you did.
          </p>
        ) : null}

        {editing ? (
          <section className="overflow-hidden rounded-shell border border-rule bg-sheet">
            <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3">
              {STEPS.map((label, index) => (
                <button
                  key={label}
                  onClick={() => setStep(index)}
                  aria-current={step === index ? "step" : undefined}
                  className={`legend flex h-7 items-center gap-1.5 rounded-control px-2.5 ${
                    step === index
                      ? "cap bg-violet text-on-violet [--edge:var(--color-violet-edge)]"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")} {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {step === 0 ? (
                <div className="flex flex-col gap-4">
                  <p className="max-w-[62ch] text-[12px] text-ink-2">
                    Straight from your LinkedIn profile. Copy and paste is
                    deliberate: reading it automatically would give us a cached,
                    truncated version and a persona built on half your words.
                  </p>
                  <label className="flex flex-col gap-2">
                    <span className="legend text-ink-2">Your headline</span>
                    <Input
                      value={headline}
                      placeholder="Recruiter for early-stage SaaS. Ex-founder."
                      onChange={(e) => setHeadline(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="legend text-ink-2">Your About section</span>
                    <Textarea
                      value={about}
                      rows={10}
                      placeholder="Paste it whole. The way you describe yourself is the clearest sample of your voice there is."
                      onChange={(e) => setAbout(e.target.value)}
                      className="w-full leading-[1.6]"
                    />
                  </label>
                </div>
              ) : null}

              {step === 1 ? (
                <PostSamples
                  legend="A post you were proud of"
                  help="Three you would happily write again. Paste them whole, exactly as they went out."
                  values={proud}
                  onChange={setProud}
                />
              ) : null}

              {step === 2 ? (
                <PostSamples
                  legend="A post that flopped"
                  help="This matters as much as the wins. What you would not write again defines your voice as sharply as what you would, and it is the difference a model can actually learn from."
                  values={flops}
                  onChange={setFlops}
                />
              ) : null}

              {step === 3 ? (
                <div className="flex flex-col gap-4">
                  <p className="max-w-[62ch] text-[12px] text-ink-2">
                    {hasVoice
                      ? "This is what Pulse currently hears. Rebuilding replaces it with a fresh read of everything above."
                      : "Nothing has been read yet. Build it, then check whether it sounds like you before you trust a draft."}
                  </p>

                  {hasVoice ? <VoiceSummary profile={profile} /> : null}

                  <div>
                    <Button
                      variant="primary"
                      onClick={build}
                      disabled={pending || !configured}
                    >
                      <Sparkles size={16} strokeWidth={1.5} />
                      {pending
                        ? "Reading your voice"
                        : hasVoice
                          ? "Rebuild from this"
                          : "Build my persona"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-rule px-4 py-3">
              <Button
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ArrowLeft size={16} strokeWidth={1.5} />
                Back
              </Button>
              <span className="flex items-center gap-2">
                {persona?.built_at ? (
                  <Button onClick={() => setEditing(false)}>Cancel</Button>
                ) : null}
                <Button
                  disabled={step === STEPS.length - 1}
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                >
                  Next
                  <ArrowRight size={16} strokeWidth={1.5} />
                </Button>
              </span>
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-shell border border-rule bg-sheet">
            <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3">
              <span className="legend flex-1 text-ink-2">How you sound</span>
              {persona?.built_at ? (
                <span className="meta text-ink-3">
                  built {formatDate(persona.built_at)}
                </span>
              ) : null}
              <Button onClick={() => setEditing(true)}>Edit intake</Button>
            </div>
            <div className="p-5">
              <VoiceSummary profile={profile} />
            </div>
          </section>
        )}

        {/* What it learned, and the chance to refuse it. A persona that
            rewrote itself silently is one nobody can trust when the drafts
            start drifting. */}
        <section className="overflow-hidden rounded-shell border border-rule bg-sheet">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-4 py-3">
            <span className="legend text-ink-2">Learned from your edits</span>
            <span className="meta text-ink-3">
              {String(lessons.length).padStart(2, "0")} waiting
            </span>
            <p className="text-[12px] text-ink-2">
              When you change a generated post before publishing it, the
              difference shows up here. Nothing is folded in until you say so.
            </p>
          </div>

          {lessons.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-ink-3">
              Nothing yet. Edit a generated post and publish it, and what
              changed will appear here.
            </p>
          ) : (
            <ul>
              {lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  className="-mt-px flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-rule px-4 py-3 first:mt-0 first:border-t-0"
                >
                  <p className="min-w-[18rem] flex-1 text-[13px]">
                    {lesson.lesson}
                  </p>
                  <span className="meta shrink-0 text-ink-3">
                    {formatDate(lesson.created_at)}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Button
                      disabled={pending}
                      onClick={() => decide(lesson, true)}
                    >
                      <Check size={16} strokeWidth={1.5} />
                      Keep
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => decide(lesson, false)}
                      aria-label="Discard this lesson"
                    >
                      <X size={16} strokeWidth={1.5} />
                      Discard
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function VoiceSummary({ profile }: { profile: VoiceProfile }) {
  if (!profile.summary) {
    return (
      <p className="text-[12px] text-ink-3">
        Nothing read yet. Run the intake and Pulse will describe your voice back
        to you here.
      </p>
    );
  }

  const rows: [string, string[] | undefined][] = [
    ["Tone", profile.tone],
    ["How you open", profile.openings],
    ["You never", profile.banned],
    ["You reach for", profile.proof],
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-[13px] leading-[1.6]">{profile.summary}</p>
      {profile.rhythm ? (
        <p className="max-w-[70ch] text-[12px] text-ink-2">{profile.rhythm}</p>
      ) : null}

      <dl className="flex flex-col gap-3">
        {rows.map(([label, values]) =>
          values?.length ? (
            <div key={label} className="flex flex-wrap items-baseline gap-x-3">
              <dt className="legend w-28 shrink-0 text-ink-3">{label}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {values.map((value) => (
                  <span
                    key={value}
                    className="rounded-chip border border-rule bg-paper px-2 py-0.5 text-[12px] text-ink-2"
                  >
                    {value}
                  </span>
                ))}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
    </div>
  );
}

function PostSamples({
  legend,
  help,
  values,
  onChange,
}: {
  legend: string;
  help: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[62ch] text-[12px] text-ink-2">{help}</p>
      {values.map((value, index) => (
        <label key={index} className="flex flex-col gap-2">
          <span className="legend text-ink-2">
            {legend} {index + 1}
          </span>
          <Textarea
            value={value}
            rows={6}
            placeholder="Paste the post here."
            onChange={(e) => {
              const next = [...values];
              next[index] = e.target.value;
              onChange(next);
            }}
            className="w-full leading-[1.6]"
          />
        </label>
      ))}
    </div>
  );
}

/** Always render three boxes, however many samples came back. */
function padTo(values: string[], length: number): string[] {
  const next = [...values];
  while (next.length < length) next.push("");
  return next.slice(0, length);
}
