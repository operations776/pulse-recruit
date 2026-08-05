"use client";

import { Mic, MicOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { decodeEvents } from "@/lib/ai-events";
import { shapeValue } from "@/lib/shapes";
import { speechSupported, startDictation } from "@/lib/speech";
import type { Shape } from "@/lib/supabase/types";

const LINK_BUTTON =
  "cap inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-control border border-ink bg-transparent px-3.5 text-[12px] font-medium text-ink hover:bg-well [--edge:var(--color-ink)]";

/**
 * New post.
 *
 * This used to ask for a hook and a shape and hand back an empty box, which
 * left the writing exactly where it was: with the recruiter, on a Monday,
 * staring at a blank textarea. Now they describe the idea in a sentence, out
 * loud if they like, and Pulse writes it in their voice.
 *
 * The draft is editable before it lands. What they change is the signal the
 * persona learns from, so an edited draft is worth more than a perfect one.
 */
export function GenerateDialog({
  open,
  onClose,
  shapes,
  hasPersona,
  configured,
  seedDay = "",
  onAdd,
  adding,
}: {
  open: boolean;
  onClose: () => void;
  shapes: Shape[];
  hasPersona: boolean;
  configured: boolean;
  /** Set when the composer was opened from a specific day on the calendar. */
  seedDay?: string;
  onAdd: (input: {
    shape: Shape;
    hook: string;
    body: string;
    day: string;
    generated: string | null;
  }) => void;
  adding: boolean;
}) {
  const [idea, setIdea] = useState("");
  const [shape, setShape] = useState<string>(() =>
    shapes[0] ? shapeValue(shapes[0]) : "",
  );
  const [day, setDay] = useState(seedDay);
  const [draft, setDraft] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);

  const stopDictation = useRef<(() => void) | null>(null);
  const [canDictate, setCanDictate] = useState(false);

  // Support is read after mount: it depends on the browser, and deciding on
  // the server would either hide the mic for everyone or promise it to Firefox.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot capability read
    setCanDictate(speechSupported());
  }, []);

  useEffect(() => {
    return () => stopDictation.current?.();
  }, []);

  const reset = () => {
    stopDictation.current?.();
    stopDictation.current = null;
    setListening(false);
    setIdea("");
    setDay(seedDay);
    setDraft("");
    setGenerated(null);
    setError("");
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const toggleMic = () => {
    if (listening) {
      stopDictation.current?.();
      stopDictation.current = null;
      setListening(false);
      return;
    }
    const stop = startDictation({
      onText: (text) =>
        setIdea((current) => (current ? `${current} ${text}` : text)),
      onEnd: () => setListening(false),
      onError: (message) => {
        setError(message);
        setListening(false);
      },
    });
    if (!stop) return;
    stopDictation.current = stop;
    setListening(true);
  };

  const generate = async () => {
    const description = idea.trim();
    if (!description) {
      setError("Describe the post you want first.");
      return;
    }

    stopDictation.current?.();
    setListening(false);
    setError("");
    setBusy(true);
    setDraft("");

    try {
      const response = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea: description, shape }),
      });

      if (!response.ok || !response.body) {
        // A refusal arrives as JSON, not a stream. The idea stays in the box,
        // because clearing it would read as sent.
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? "The draft could not be written.");
        setBusy(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = decodeEvents(buffer);
        buffer = rest;

        for (const event of events) {
          if (event.type === "delta") {
            text += event.text;
            setDraft(text);
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }

      if (text.trim()) setGenerated(text.trim());
    } catch {
      setError("Pulse could not be reached. Nothing was written or charged.");
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const chosen = shapes.find((s) => shapeValue(s) === shape) ?? shapes[0];
    const body = draft.trim();
    if (!body) {
      setError("There is nothing to add yet. Write the draft first.");
      return;
    }
    onAdd({
      shape: chosen,
      // The first line is the hook, which is how the calendar and the backlog
      // label a post.
      hook: body.split("\n").find((line) => line.trim())?.slice(0, 120) ?? body.slice(0, 120),
      body,
      day,
      // Kept so a later edit can be diffed against what the model wrote. Null
      // when the human typed it themselves: there is nothing to learn from.
      generated,
    });
    reset();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      size="wide"
      title="New post"
      description="Describe the idea. Pulse writes it in your voice, and you edit before it lands."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            onClick={add}
            disabled={adding || busy || !draft.trim()}
          >
            {day ? "Add to the calendar" : "Add to the backlog"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="legend text-ink-2">What do you want to say?</span>
            <div className="relative">
              <Textarea
                value={idea}
                rows={4}
                autoFocus
                placeholder="Lost a placement this week because the client took nine days to give feedback. Want to make the point that speed is the whole job."
                onChange={(event) => {
                  setIdea(event.target.value);
                  if (error) setError("");
                }}
                className="w-full pr-12 leading-[1.6]"
              />
              {/* Hidden rather than disabled where the browser has no speech
                  engine: a dead mic teaches people not to trust the control. */}
              {canDictate ? (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={listening ? "Stop dictating" : "Dictate the idea"}
                  aria-pressed={listening}
                  className={`absolute right-2 top-2 flex size-8 items-center justify-center rounded-control ${
                    listening
                      ? "bg-teal text-sheet"
                      : "text-ink-3 hover:bg-well hover:text-ink"
                  }`}
                >
                  {listening ? (
                    <MicOff size={16} strokeWidth={1.5} />
                  ) : (
                    <Mic size={16} strokeWidth={1.5} />
                  )}
                </button>
              ) : null}
            </div>
            {listening ? (
              <span className="legend text-teal-text">
                Listening. Speak, then press the mic again.
              </span>
            ) : null}
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-2">
              <span className="legend text-ink-2">Shape</span>
              <Select
                value={shape}
                onChange={(event) => setShape(event.target.value)}
              >
                {shapes.map((s) => (
                  <option key={shapeValue(s)} value={shapeValue(s)}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>

            {/* A disabled control must say why on itself. The reason used to
                live in a box off to the side, which reads as the button being
                broken rather than waiting on something. */}
            <Button
              onClick={generate}
              disabled={busy || !configured || !hasPersona}
              title={
                !configured
                  ? "No model key is configured on this deployment."
                  : !hasPersona
                    ? "Build your voice first."
                    : undefined
              }
            >
              <Sparkles size={16} strokeWidth={1.5} />
              {busy
                ? "Writing"
                : !configured
                  ? "Writing is not switched on"
                  : !hasPersona
                    ? "Build your voice first"
                    : draft
                      ? "Write it again"
                      : "Write it"}
            </Button>
          </div>

          <label className="flex flex-col gap-2">
            <span className="legend text-ink-2">The post</span>
            <Textarea
              value={draft}
              rows={14}
              placeholder="The draft appears here. Change anything: what you change is what your persona learns from."
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-[18rem] w-full leading-[1.6]"
            />
          </label>

          {error ? (
            <p role="alert" className="text-[12px] font-medium text-red">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[280px]">
          {/* Two different reasons writing cannot run, deliberately worded so
              they cannot be mistaken for each other. The first is our problem
              and the recruiter can do nothing about it; the second is one
              minute of their time and has a button attached. */}
          {!configured ? (
            <p className="rounded-control border border-amber bg-amber-bg px-3 py-2 text-[12px] text-amber-text">
              This deployment has no model key, so Pulse cannot write anything
              for anyone. That is a Pulse configuration problem, not something
              you did. You can still write a post by hand and add it.
            </p>
          ) : !hasPersona ? (
            <div className="rounded-control border border-amber bg-amber-bg px-3 py-2.5">
              <p className="text-[12px] font-medium text-amber-text">
                Writing works. Your voice is the missing piece.
              </p>
              <p className="mt-1 text-[12px] text-amber-text">
                Pulse writes as you, not as a generic recruiter, so it needs a
                minute of your writing first. Until then every draft would come
                back sounding like nobody.
              </p>
              <Link href="/content/persona" className={`${LINK_BUTTON} mt-2.5`}>
                Build my voice
              </Link>
            </div>
          ) : null}

          <section>
            <h3 className="legend mb-2.5 text-ink-2">The frame</h3>
            <p className="well whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
              {shapes.find((s) => shapeValue(s) === shape)?.prompt ??
                "Pick a shape."}
            </p>
          </section>

          <section>
            <h3 className="legend mb-2.5 text-ink-2">Goes out</h3>
            <Input
              type="date"
              aria-label="Date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="w-40"
            />
            <p className="mt-2 text-[12px] text-ink-2">
              Leave it empty to park the post in the backlog.
            </p>
          </section>
        </div>
      </div>
    </Dialog>
  );
}
