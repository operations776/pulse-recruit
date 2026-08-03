"use client";

import {
  Check,
  Copy,
  FileText,
  Paperclip,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { StatusChip, type Tone } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlay";
import { SKILL_BY_KEY } from "@/config/content-skills";
import {
  createUploadUrl,
  recordAsset,
  removeAsset,
  updatePost,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import type { PostAsset, PostRow } from "@/lib/supabase/types";
import { dayKey, formatDate, timeOfDay } from "@/lib/time";

// The bucket refuses anything larger, so say it here rather than letting a
// 400MB upload run for two minutes and then fail.
const MAX_BYTES = 200 * 1024 * 1024;

const STATUS_CHIP: Record<PostRow["status"], { tone: Tone; word: string }> = {
  idea: { tone: "off", word: "Idea" },
  drafted: { tone: "off", word: "Drafted" },
  scheduled: { tone: "attention", word: "Scheduled" },
  published: { tone: "on", word: "Published" },
};

type Local = PostAsset & { pending?: boolean };

export function PostDrawer({
  post,
  assets,
  timezone,
  onClose,
  onSchedule,
  onTogglePublished,
  onDelete,
  onError,
}: {
  post: PostRow;
  assets: PostAsset[];
  timezone: string;
  onClose: () => void;
  onSchedule: (postId: string, day: string, time: string) => void;
  onTogglePublished: (post: PostRow) => void;
  onDelete: (postId: string) => void;
  onError: (message: string) => void;
}) {
  const skill = SKILL_BY_KEY[post.skill];
  const status = STATUS_CHIP[post.status];

  const [hook, setHook] = useState(post.hook);
  const [body, setBody] = useState(post.body);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [local, setLocal] = useState<Local[]>(assets);
  const fileInput = useRef<HTMLInputElement>(null);

  const day = post.scheduled_for ? dayKey(post.scheduled_for, timezone) : "";
  const time = post.scheduled_for ? timeOfDay(post.scheduled_for, timezone) : "09:00";
  const [draftDay, setDraftDay] = useState(day);
  const [draftTime, setDraftTime] = useState(time);

  // Object URLs are held only for the life of this drawer. Revoking them on
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

  const dirty = hook !== post.hook || body !== post.body;

  const save = async () => {
    if (!dirty) return;
    const result = await updatePost(post.id, { hook, body });
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 900);
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
      // it, and removing it before then would need a lookup this drawer does
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
    <Drawer open onClose={onClose} label={`${skill.name} post`}>
      <div className="flex items-start justify-between gap-3 border-b border-rule p-5">
        <div className="min-w-0">
          <p className="legend text-ink-2">{skill.name}</p>
          <p className="meta mt-2 text-ink-3">
            <span className="record-id">{post.ref}</span>
            {` added ${formatDate(post.created_at)}`}
          </p>
          <div className="mt-2.5">
            <StatusChip tone={status.tone}>{status.word}</StatusChip>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <section>
          <h3 className="legend mb-2.5 text-ink-2">The frame</h3>
          <p className="well whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
            {skill.prompt}
          </p>
        </section>

        <Field label="Hook" hint="The first line. Everything else follows it.">
          <Input
            value={hook}
            onChange={(event) => setHook(event.target.value)}
            onBlur={save}
          />
        </Field>

        <Field label="The post">
          <Textarea
            value={body}
            rows={12}
            placeholder="Write it here. It saves when you click away."
            onChange={(event) => setBody(event.target.value)}
            onBlur={save}
          />
        </Field>

        <section>
          <h3 className="legend mb-2.5 text-ink-2">Goes out</h3>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="date"
              aria-label="Date"
              value={draftDay}
              onChange={(event) => setDraftDay(event.target.value)}
              className="w-40"
            />
            <Input
              type="time"
              aria-label="Time"
              value={draftTime}
              onChange={(event) => setDraftTime(event.target.value)}
              className="w-28"
            />
            <Button
              disabled={!draftDay}
              onClick={() => onSchedule(post.id, draftDay, draftTime || "09:00")}
            >
              {post.scheduled_for ? "Move" : "Schedule"}
            </Button>
            {post.scheduled_for ? (
              <Button onClick={() => onSchedule(post.id, "", "")}>
                Back to backlog
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-[12px] text-ink-2">
            Times are {timezone.replace("_", " ")}, your workspace zone.
          </p>
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
                      className="h-20 w-full object-cover"
                    />
                  ) : (
                    <div className="well flex h-20 items-center justify-center">
                      <span className="meta text-ink-3">no preview</span>
                    </div>
                  )}
                  <figcaption className="flex items-center gap-1 border-t border-rule px-2 py-1">
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

      <div className="flex flex-wrap items-center gap-2 border-t border-rule p-4">
        <Button onClick={copy}>
          {copied ? (
            <Check size={16} strokeWidth={2} className="text-teal" />
          ) : (
            <Copy size={16} strokeWidth={1.5} />
          )}
          {copied ? "Copied" : "Copy text"}
        </Button>

        <Button onClick={() => onTogglePublished(post)}>
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
      </div>
    </Drawer>
  );
}
