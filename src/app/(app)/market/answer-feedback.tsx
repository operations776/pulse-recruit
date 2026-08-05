"use client";

import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveBDFeedback } from "@/lib/actions";

// PLS-97. Coaching the strategist.
//
// Marking an answer useful or off target writes a visible personal memory that
// later runs read. Two deliberate choices:
//
//   Off target REQUIRES a reason. "That was wrong" teaches nothing; "stop
//   suggesting agencies under 50 people" changes every future answer. The
//   server enforces this too, so the rule holds even if this form is bypassed.
//
//   Feedback costs no credits and calls no model. It is a row, not a run.

export function AnswerFeedback({
  answerId,
  /** Set once this answer already has feedback from this recruiter. */
  existing,
}: {
  answerId: string;
  existing: "useful" | "off_target" | null;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<"useful" | "off_target" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<"useful" | "off_target" | null>(existing);

  const submit = (rating: "useful" | "off_target") => {
    setError("");
    startTransition(async () => {
      const result = await saveBDFeedback({ answerId, rating, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(rating);
      setOpen(null);
      setNote("");
      notify(
        rating === "useful"
          ? "Noted. The strategist will keep coaching you this way."
          : "Noted. The strategist will use that on the next question.",
      );
      router.refresh();
    });
  };

  return (
    <div className="mt-3 border-t border-rule pt-2.5">
      {open ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="legend text-ink-2">
              {open === "off_target"
                ? "What should it have done instead?"
                : "What was useful about it? (optional)"}
            </span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={1900}
              autoFocus
              placeholder={
                open === "off_target"
                  ? "These companies are too small. Stay above 200 headcount."
                  : "Naming the hiring manager and the pretext is what I needed."
              }
              className="w-full leading-[1.5]"
            />
          </label>

          {error ? (
            <p className="rounded-control border border-red bg-red-bg px-3 py-2 text-[12px] text-red">
              {error}
            </p>
          ) : null}

          <span className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={pending || (open === "off_target" && !note.trim())}
              onClick={() => submit(open)}
            >
              {pending ? "Saving" : "Save"}
            </Button>
            <Button
              onClick={() => {
                setOpen(null);
                setError("");
              }}
            >
              Cancel
            </Button>
            {open === "off_target" && !note.trim() ? (
              <span className="text-[12px] text-ink-3">
                A correction needs a reason to be worth anything.
              </span>
            ) : null}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {saved ? (
            <span className="legend flex items-center gap-1.5 text-teal-text">
              <Check size={16} strokeWidth={2} className="size-3.5" />
              {saved === "useful" ? "Marked useful" : "Correction saved"}
            </span>
          ) : (
            <span className="legend text-ink-3">Was this useful?</span>
          )}

          <Button
            onClick={() => {
              setOpen("useful");
              setNote("");
            }}
            disabled={pending}
            aria-label="Mark this answer useful"
          >
            <ThumbsUp size={16} strokeWidth={1.5} />
            Useful
          </Button>
          <Button
            onClick={() => {
              setOpen("off_target");
              setNote("");
            }}
            disabled={pending}
            aria-label="Mark this answer off target"
          >
            <ThumbsDown size={16} strokeWidth={1.5} />
            Off target
          </Button>
        </div>
      )}
    </div>
  );
}
