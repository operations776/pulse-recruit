"use client";

import {
  CalendarCheck,
  CalendarX,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Paperclip,
  RotateCw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { StatusChip, type Tone } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlay";
import { SKILL_BY_KEY } from "@/config/content-skills";
import {
  createUploadUrl,
  recordAsset,
  removeAsset,
  updatePost,
} from "@/lib/actions";
import { Avatar } from "@/components/ui/avatar";
import { decodeEvents } from "@/lib/ai-events";
import type { SlotSuggestion } from "@/lib/slots";
import { createClient } from "@/lib/supabase/client";
import type { PostAsset, PostRow } from "@/lib/supabase/types";
import { dayKey, formatDate, timeOfDay } from "@/lib/time";

/** LinkedIn's hard cap on a post body. The counter reads against it. */
const LINKEDIN_MAX = 3000;

/**
 * The rewrite toolbar, per the editor frame. Each button is one instruction
 * to the same metered generation call: a revision of THIS text, never a new
 * draft from nowhere.
 */
const REWRITES: { key: string; label: string; instruction: string }[] = [
  {
    key: "shorter",
    label: "Shorter",
    instruction:
      "Make it shorter. Cut roughly a third without losing any concrete detail.",
  },
  {
    key: "warmer",
    label: "Warmer",
    instruction: "Make it warmer and more human. No added fluff, no emoji.",
  },
  {
    key: "hook",
    label: "Sharper hook",
    instruction:
      "Rewrite only the first line so it stops the scroll. Keep everything after it as it is.",
  },
  {
    key: "question",
    label: "Cut the question",
    instruction:
      "Remove any closing question and end on the thought instead.",
  },
  {
    key: "regenerate",
    label: "Regenerate",
    instruction:
      "Rewrite the whole post fresh in the same voice and shape, keeping exactly the same facts.",
  },
];

/** First paragraph pair where the edited body diverges from the generated one. */
function firstChange(
  generated: string,
  body: string,
): { wrote: string; yours: string } | null {
  const a = generated.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const b = body.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? "") !== (b[i] ?? "")) {
      return { wrote: a[i] ?? "", yours: b[i] ?? "" };
    }
  }
  return null;
}

// The bucket refuses anything larger, so say it here rather than letting a
// 400MB upload run for two minutes and then fail.
const MAX_BYTES = 200 * 1024 * 1024;

// DESIGN.md rule: status is colour AND icon AND word, never colour alone.
// Exhaustive over PostStatus on purpose: the Record type is what makes adding
// an enum value a compile error here rather than an `undefined` chip at
// runtime. PLS-152 added the last two.
//
// `needs_attention` is `attention`, not `danger`. Red is destruction and error
// (DESIGN.md section 3), and this state is neither: Pulse could not reach
// LinkedIn, the post is intact, and the fix is reconnecting an account. Red
// here would say the post is broken, which is the exact confusion the state was
// split out to end.
const STATUS_CHIP: Record<PostRow["status"], { tone: Tone; word: string }> = {
  idea: { tone: "off", word: "Idea" },
  drafted: { tone: "off", word: "Drafted" },
  needs_review: { tone: "attention", word: "Needs review" },
  scheduled: { tone: "attention", word: "Scheduled" },
  publishing: { tone: "attention", word: "Publishing" },
  published: { tone: "on", word: "Published" },
  needs_attention: { tone: "attention", word: "Needs attention" },
  failed: { tone: "danger", word: "Did not send" },
};

type Local = PostAsset & { pending?: boolean };

/**
 * A post, open.
 *
 * This was a 480px right drawer. A LinkedIn post is long-form copy, and in a
 * 480px column it was a scrollbar with a paragraph in it: the body scrolled
 * while the schedule controls sat below the fold, so writing and dating a post
 * were never visible at the same time. It is now a centred 900px dialog with
 * the words on the left at full width and everything you do TO the post in a
 * rail on the right.
 *
 * Every behaviour carried over unchanged, because each one was earned:
 * blur-to-save (no revalidate under an open layer), object-URL previews
 * revoked on unmount, the pending-asset refusal, and honest partial counts.
 */
export function PostDialog({
  post,
  assets,
  timezone,
  authorName,
  orgName,
  slotSuggestions,
  onClose,
  onSchedule,
  onTogglePublished,
  onDelete,
  onRetry,
  onError,
  canPublish,
}: {
  post: PostRow;
  assets: PostAsset[];
  timezone: string;
  /** The byline on the LinkedIn preview strip. */
  authorName: string;
  orgName: string;
  /** Three ranked slots from real publish history, PLS-189. */
  slotSuggestions: SlotSuggestion[];
  onClose: () => void;
  onSchedule: (postId: string, day: string, time: string) => void;
  onTogglePublished: (post: PostRow) => void;
  onDelete: (postId: string) => void;
  onRetry: (postId: string) => void;
  onError: (message: string) => void;
  /** A LinkedIn profile is connected, so a date actually means something. */
  canPublish: boolean;
}) {
  const skill = SKILL_BY_KEY[post.skill];
  const status = STATUS_CHIP[post.status];

  const [hook, setHook] = useState(post.hook);
  const [body, setBody] = useState(post.body);
  const [saved, setSaved] = useState(false);
  const [rewriting, setRewriting] = useState<string | null>(null);
  // The frame's Learn from this / One off pair. Learning is the default;
  // "One off" says this edit is circumstance, not correction, and the close
  // then skips the lesson call.
  const [learnOnClose, setLearnOnClose] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [local, setLocal] = useState<Local[]>(assets);
  const fileInput = useRef<HTMLInputElement>(null);

  const day = post.scheduled_for ? dayKey(post.scheduled_for, timezone) : "";
  const time = post.scheduled_for ? timeOfDay(post.scheduled_for, timezone) : "09:00";
  const [draftDay, setDraftDay] = useState(day);
  const [draftTime, setDraftTime] = useState(time);

  // The date fields have been touched away from what is stored, so the user is
  // mid-reschedule and the primary verb must be Move rather than Unschedule.
  const dateChanged = draftDay !== day || draftTime !== time;

  // Object URLs are held only for the life of this layer. Revoking them on
  // unmount keeps a long editing session from pinning several hundred MB of
  // video in memory.
  useEffect(() => {
    return () => {
      for (const asset of local) {
        if (asset.pending && asset.url) URL.revokeObjectURL(asset.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  // Mid-flight the words are already on their way to LinkedIn. Editing them
  // here would change the record of what was sent without changing what was
  // sent, so the fields go read-only until the publisher settles the row.
  const locked = post.status === "publishing";

  const dirty = hook !== post.hook || body !== post.body;

  const save = async () => {
    if (!dirty || locked) return;
    const result = await updatePost(post.id, { hook, body });
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 900);
  };

  /**
   * Closing is what tells the persona an edit is finished.
   *
   * The body saves on every blur, so by here the words are usually already
   * stored and `dirty` is false. The write still has to happen, with
   * `settled`, because that flag is the only signal that this version is the
   * one to learn from rather than a pause mid-sentence.
   *
   * Only for a post that came from generation. Hand-written posts have no
   * generated body to diff against, so there is nothing to learn and no reason
   * to spend the call.
   */
  const closeAndLearn = () => {
    if (!locked && post.generated_body && learnOnClose) {
      void updatePost(post.id, { hook, body }, true);
    }
    onClose();
  };

  /**
   * One rewrite instruction against the metered generation call. The revised
   * text streams straight into the editor, replacing the body live, and the
   * result is saved the way any edit is. A failure keeps the original words.
   */
  const runRewrite = async (key: string, instruction: string) => {
    if (rewriting || locked || !body.trim()) return;
    setRewriting(key);
    const original = body;

    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shape: post.shape_id ?? post.skill,
          rewrite: { body: original, instruction },
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({ error: "" }));
        onError(data.error || "The rewrite could not run. Nothing changed.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let draft = "";
      let failed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = decodeEvents(buffer);
        buffer = rest;
        for (const event of events) {
          if (event.type === "delta") {
            draft += event.text;
            setBody(draft);
          } else if (event.type === "reset") {
            draft = "";
            setBody(original);
          } else if (event.type === "error") {
            failed = true;
            onError(event.message);
          }
        }
      }

      if (failed || !draft.trim()) {
        setBody(original);
        return;
      }

      const saved = await updatePost(post.id, { hook, body: draft.trim() });
      if (!saved.ok) onError(saved.error);
    } catch {
      setBody(original);
      onError("The rewrite was interrupted. Your words are unchanged.");
    } finally {
      setRewriting(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body || hook);
    } catch {
      // Clipboard permission can be denied. The text stays selectable, so the
      // control confirms the intent rather than looking dead.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  const upload = async (files: FileList) => {
    setUploading(true);
    const supabase = createClient();
    let added = 0;

    try {
      for (const [index, file] of Array.from(files).entries()) {
        if (file.size > MAX_BYTES) {
          onError(`${file.name} is over 200MB, so it was skipped.`);
          continue;
        }

        const signed = await createUploadUrl(post.id, file.name);
        if (!signed.ok) {
          onError(signed.error);
          break;
        }

        const upload = await supabase.storage
          .from("content-media")
          .uploadToSignedUrl(signed.data.path, signed.data.token, file);
        if (upload.error) {
          onError(`${file.name} did not upload: ${upload.error.message}`);
          continue;
        }

        // Claim before the row, then the row. The blob exists first, so a row
        // never points at nothing.
        const recorded = await recordAsset({
          postId: post.id,
          path: signed.data.path,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          sort: local.length + index,
        });
        if (!recorded.ok) {
          onError(recorded.error);
          continue;
        }

        added += 1;
        setLocal((current) => [
          ...current,
          {
            id: signed.data.path,
            org_id: post.org_id,
            post_id: post.id,
            storage_path: signed.data.path,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            sort: current.length,
            created_at: new Date().toISOString(),
            url: URL.createObjectURL(file),
            pending: true,
          },
        ]);
      }
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
      // Honest count, law 9. Nothing here pretends a skipped file landed.
      if (added > 0 && added < files.length) {
        onError(`${added} of ${files.length} files were attached.`);
      }
    }
  };

  const detach = async (asset: Local) => {
    if (asset.pending) {
      // Just uploaded, so the row id is not known here yet. A refresh will show
      // it, and removing it before then would need a lookup this layer does
      // not have. Tell the truth rather than faking a removal.
      onError("Close and reopen the post to remove a file you just added.");
      return;
    }
    const result = await removeAsset(asset.id);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setLocal((current) => current.filter((a) => a.id !== asset.id));
  };

  const images = local.filter((a) => a.mime_type.startsWith("image/"));
  const others = local.filter((a) => !a.mime_type.startsWith("image/"));

  return (
    <Dialog
      open
      size="wide"
      onClose={closeAndLearn}
      title={skill.name}
      description={`${post.ref} added ${formatDate(post.created_at)}`}
      headerRight={<StatusChip tone={status.tone}>{status.word}</StatusChip>}
      footer={
        <>
          <Button onClick={copy}>
            {copied ? (
              <Check size={16} strokeWidth={2} className="text-teal" />
            ) : (
              <Copy size={16} strokeWidth={1.5} />
            )}
            {copied ? "Copied" : "Copy text"}
          </Button>

          <Button onClick={() => onTogglePublished(post)} disabled={locked}>
            {post.status === "published" ? (
              <>
                <Undo2 size={16} strokeWidth={1.5} />
                Not published
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={1.5} />
                Mark published
              </>
            )}
          </Button>

          {saved ? <span className="legend text-teal-text">Saved</span> : null}

          <span className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-[12px] text-ink-2">Delete for good?</span>
                <Button variant="danger" onClick={() => onDelete(post.id)}>
                  Yes, delete
                </Button>
                <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </>
            ) : (
              <Button
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete post"
              >
                <Trash2 size={16} strokeWidth={1.5} />
                Delete
              </Button>
            )}
          </span>
        </>
      }
    >
      {/* The words get the room. Everything you do TO the post sits in the
          rail, so writing and dating are visible at the same time. */}
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* The frame's LinkedIn preview strip: who this goes out as and
              when, exactly as the feed will show it. */}
          <div className="raised flex items-center gap-2.5 rounded-card border border-rule bg-sheet px-3.5 py-2.5">
            <Avatar name={authorName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-[1.4] text-ink">
                {authorName}
              </p>
              <p className="truncate text-[11px] leading-[1.4] text-ink-3">
                Recruitment at {orgName}
                {post.scheduled_for
                  ? ` · ${formatDate(post.scheduled_for)}, ${timeOfDay(post.scheduled_for, timezone)}`
                  : ""}
              </p>
            </div>
            <span className="meta shrink-0 text-ink-3">Preview</span>
          </div>

          <label className="flex flex-col gap-2">
            <span className="legend text-ink-2">Hook</span>
            <Input
              value={hook}
              readOnly={locked}
              placeholder="The first line. Everything else follows it."
              onChange={(event) => setHook(event.target.value)}
              onBlur={save}
            />
          </label>

          <label className="flex min-h-0 flex-1 flex-col gap-2">
            <span className="legend text-ink-2">The post</span>
            <Textarea
              value={body}
              rows={18}
              readOnly={locked || rewriting !== null}
              placeholder="Write it here. It saves when you click away."
              onChange={(event) => setBody(event.target.value)}
              onBlur={save}
              className="min-h-[22rem] w-full leading-[1.6]"
            />
          </label>

          {/* The rewrite toolbar from the frame. Each is one metered
              revision of the words above, streamed back in place. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="meta mr-1 text-ink-3">Rewrite</span>
            {REWRITES.map((r) => (
              <button
                key={r.key}
                type="button"
                disabled={rewriting !== null || locked || !body.trim()}
                onClick={() => void runRewrite(r.key, r.instruction)}
                className="settle rounded-chip border border-rule bg-sheet px-2.5 py-1 text-[11px] leading-[1.45] text-ink-2 hover:border-violet hover:text-violet disabled:opacity-40"
              >
                {rewriting === r.key ? "Writing..." : r.label}
              </button>
            ))}
            <span
              className={`meta ml-auto ${
                body.length > LINKEDIN_MAX ? "text-red" : "text-ink-3"
              }`}
            >
              {body.length.toLocaleString("en-GB")} /{" "}
              {LINKEDIN_MAX.toLocaleString("en-GB")}
            </span>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[300px]">
          <section>
            <h3 className="legend mb-2.5 text-ink-2">How it writes this</h3>
            <p className="well whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
              {skill.prompt}
            </p>
          </section>

          {/* The frame's correction capture. Only for a generated post that
              has actually been edited: a hand-written post has nothing to
              diff, and an unedited one has nothing to learn. */}
          {post.generated_body && body.trim() !== post.generated_body.trim()
            ? (() => {
                const change = firstChange(post.generated_body, body);
                if (!change) return null;
                return (
                  <section>
                    <h3 className="legend mb-2.5 text-ink-2">
                      What you changed
                    </h3>
                    <div className="well flex flex-col gap-2 rounded-control p-3 text-[12px] leading-[1.5]">
                      {change.wrote ? (
                        <p className="text-ink-3 line-through">
                          It wrote: {change.wrote}
                        </p>
                      ) : null}
                      {change.yours ? (
                        <p className="text-ink">You wrote: {change.yours}</p>
                      ) : null}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setLearnOnClose(true)}
                          aria-pressed={learnOnClose}
                          className={`settle rounded-control border px-2.5 py-1 text-[11px] leading-[1.45] ${
                            learnOnClose
                              ? "border-violet bg-sheet font-medium text-violet"
                              : "border-rule bg-sheet text-ink-2 hover:border-violet hover:text-violet"
                          }`}
                        >
                          Learn from this
                        </button>
                        <button
                          type="button"
                          onClick={() => setLearnOnClose(false)}
                          aria-pressed={!learnOnClose}
                          className={`settle rounded-control border px-2.5 py-1 text-[11px] leading-[1.45] ${
                            !learnOnClose
                              ? "border-violet bg-sheet font-medium text-violet"
                              : "border-rule bg-sheet text-ink-2 hover:border-violet hover:text-violet"
                          }`}
                        >
                          One off
                        </button>
                      </div>
                      <p className="text-[11px] leading-[1.45] text-ink-3">
                        {learnOnClose
                          ? "Kept as a correction when you close. Future drafts write it your way."
                          : "Nothing is learned from this edit."}
                      </p>
                    </div>
                  </section>
                );
              })()
            : null}

          <section>
            <h3 className="legend mb-2.5 text-ink-2">Goes out</h3>

            {/* PLS-189. The scheduled confirmation, per the frame: what will
                happen, in green, with Undo in the row. */}
            {post.scheduled_for && post.status === "scheduled" && !dateChanged ? (
              <div className="mb-2.5 flex items-center gap-2.5 rounded-control border border-teal-bg bg-teal-bg px-3 py-2">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-teal" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium leading-[1.4] text-teal-text">
                    Scheduled for {formatDate(post.scheduled_for)},{" "}
                    {timeOfDay(post.scheduled_for, timezone)}
                  </span>
                  <span className="meta block text-teal-text">
                    {canPublish && post.auto_publish
                      ? "Posts to LinkedIn automatically"
                      : "Recorded on the plan"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onSchedule(post.id, "", "")}
                  className="settle shrink-0 rounded-control border border-rule bg-sheet px-2.5 py-1 text-[11px] leading-[1.45] text-ink-2 hover:border-violet hover:text-violet disabled:opacity-50"
                >
                  Undo
                </button>
              </div>
            ) : null}

            {/* Three ranked slots, best first, each citing its evidence or
                admitting it is a default. Picking one schedules it. */}
            {!post.scheduled_for && post.status !== "published" ? (
              <div className="mb-2.5 flex flex-col gap-1.5">
                <p className="text-[12px] leading-[1.45] text-ink">
                  When should this go out?
                </p>
                {slotSuggestions.map((slot) => (
                  <button
                    key={`${slot.day}-${slot.time}`}
                    type="button"
                    disabled={locked}
                    onClick={() => onSchedule(post.id, slot.day, slot.time)}
                    className={`settle flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-left disabled:opacity-50 ${
                      slot.best
                        ? "border-violet-100 bg-violet-wash hover:border-violet"
                        : "border-rule bg-sheet hover:border-violet"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium leading-[1.4] text-ink">
                        {slot.label}
                      </span>
                      <span className="block text-[11px] leading-[1.4] text-ink-3">
                        {slot.reason}
                      </span>
                    </span>
                    {slot.best ? (
                      <span className="meta shrink-0 text-violet-deep">Best</span>
                    ) : null}
                  </button>
                ))}
                <p className="meta text-ink-3">Or pick another time</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                aria-label="Date"
                value={draftDay}
                onChange={(event) => setDraftDay(event.target.value)}
                className="w-36"
              />
              <Input
                type="time"
                aria-label="Time"
                value={draftTime}
                onChange={(event) => setDraftTime(event.target.value)}
                className="w-28"
              />
            </div>
            {/*
              One control that alternates, which is what Daniyal asked for.
              Scheduled becomes Unschedule; unscheduled becomes Schedule. The
              third state is real though: once the date fields are changed on a
              post that already has a date, the primary verb is Move, because
              unscheduling would throw away the date just typed.
            */}
            <div className="mt-2 flex flex-wrap gap-2">
              {/* A scheduled post's Undo lives in the green strip above, so
                  this button only serves dated posts in other states. */}
              {post.scheduled_for && !dateChanged && post.status !== "scheduled" ? (
                <Button
                  disabled={locked}
                  onClick={() => onSchedule(post.id, "", "")}
                >
                  <CalendarX size={16} strokeWidth={1.5} />
                  Unschedule
                </Button>
              ) : (
                <Button
                  variant={post.scheduled_for ? "secondary" : "primary"}
                  disabled={!draftDay || locked}
                  onClick={() =>
                    onSchedule(post.id, draftDay, draftTime || "09:00")
                  }
                >
                  <CalendarCheck size={16} strokeWidth={1.5} />
                  {post.scheduled_for ? "Move" : "Schedule"}
                </Button>
              )}
            </div>
            <p className="mt-2 text-[12px] text-ink-2">
              Times are {timezone.replace("_", " ")}, your workspace zone.
            </p>

            {/* What actually happens at that time. A scheduled post with
                auto_publish off is the grandfathered case: it would sit there
                looking scheduled and never go out, so it says so. */}
            {/* The happy path is the green strip above; these are the two
                cases where a date does not mean what it looks like. */}
            {post.status === "scheduled" && (!canPublish || !post.auto_publish) ? (
              <p className="mt-2 text-[12px] text-ink-2">
                {!canPublish
                  ? "No LinkedIn profile is connected, so this will not go out on its own. Connect one in Settings, Channels."
                  : "This one was scheduled before automatic publishing was switched on, so it stays put. Move it to a new time to send it."}
              </p>
            ) : null}

            {post.status === "publishing" ? (
              <p className="mt-2 rounded-control border border-amber bg-amber-bg px-3 py-2 text-[12px] text-amber-text">
                Going out to LinkedIn now. It cannot be changed until that
                finishes.
              </p>
            ) : null}

            {post.status === "failed" ? (
              <div className="mt-2 flex flex-col gap-2">
                <p className="rounded-control border border-red bg-red-bg px-3 py-2 text-[12px] text-red">
                  {post.publish_error ||
                    "LinkedIn refused this post and it did not go out."}
                </p>
                <span>
                  <Button onClick={() => onRetry(post.id)}>
                    <RotateCw size={16} strokeWidth={1.5} />
                    Try again now
                  </Button>
                </span>
              </div>
            ) : null}

            {post.status === "published" && post.post_url ? (
              <a
                href={post.post_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-ink-2 underline underline-offset-2 hover:text-ink"
              >
                <ExternalLink size={16} strokeWidth={1.5} />
                See it on LinkedIn
              </a>
            ) : null}
          </section>

          <section>
            <h3 className="legend mb-2.5 text-ink-2">
              Media {local.length > 0 ? `(${local.length})` : ""}
            </h3>

            {images.length > 0 ? (
              <div className="mb-2.5 grid grid-cols-3 gap-2">
                {images.map((asset) => (
                  <figure
                    key={asset.id}
                    className="overflow-hidden rounded-card border border-rule"
                  >
                    {asset.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a static asset */
                      <img
                        src={asset.url}
                        alt={asset.file_name}
                        className="h-16 w-full object-cover"
                      />
                    ) : (
                      <div className="well flex h-16 items-center justify-center">
                        <span className="meta text-ink-3">no preview</span>
                      </div>
                    )}
                    <figcaption className="flex items-center gap-1 border-t border-rule px-1.5 py-1">
                      <span className="meta flex-1 truncate text-ink-3">
                        {asset.file_name}
                      </span>
                      <button
                        onClick={() => detach(asset)}
                        aria-label={`Remove ${asset.file_name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-red"
                      >
                        <X size={16} strokeWidth={1.5} />
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}

            {others.map((asset) => (
              <div
                key={asset.id}
                className="-mt-px flex items-center gap-2 border-t border-rule px-1 py-2 first:mt-0 first:border-t-0"
              >
                <FileText size={16} strokeWidth={1.5} className="text-ink-3" />
                <span className="flex-1 truncate text-[12px]">
                  {asset.file_name}
                </span>
                <button
                  onClick={() => detach(asset)}
                  aria-label={`Remove ${asset.file_name}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-red"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}

            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/quicktime,video/webm,application/pdf"
              className="sr-only"
              onChange={(event) => {
                if (event.target.files?.length) void upload(event.target.files);
              }}
            />
            <Button
              className="mt-2.5"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={16} strokeWidth={1.5} />
              {uploading ? "Uploading" : "Attach files"}
            </Button>
          </section>
        </div>
      </div>
    </Dialog>
  );
}
