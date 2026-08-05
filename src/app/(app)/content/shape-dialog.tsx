"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { createShape, draftShape } from "@/lib/actions";

/**
 * Describe a kind of post, get a frame back, edit it, save it.
 *
 * The generated frame lands in editable fields rather than saving straight
 * away. A shape you never read is a shape that quietly produces posts in a
 * structure you did not choose, and the frame is the part that decides what
 * every future post using it actually does.
 */
export function ShapeDialog({
  open,
  onClose,
  configured,
}: {
  open: boolean;
  onClose: () => void;
  configured: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [prompt, setPrompt] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setDescription("");
    setName("");
    setBlurb("");
    setPrompt("");
    setDrafted(false);
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const draft = () => {
    const text = description.trim();
    if (!text) {
      setError("Describe the kind of post first.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await draftShape(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName(result.data.name);
      setBlurb(result.data.blurb);
      setPrompt(result.data.prompt);
      setDrafted(true);
    });
  };

  const save = () => {
    if (!name.trim() || !prompt.trim()) {
      setError("A shape needs a name and a frame.");
      return;
    }
    // The dialog closes before the write, so the revalidate cannot land under
    // an open layer and remount it.
    const saving = { name: name.trim(), blurb: blurb.trim(), prompt: prompt.trim() };
    close();

    startTransition(async () => {
      const result = await createShape(saving);
      if (!result.ok) {
        notify(`${result.error} The shape was not saved.`, "danger");
        return;
      }
      notify(`${saving.name} added. It is in the shape picker now.`);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New shape"
      description="Describe the kind of post. Pulse writes the frame, you keep what fits."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={pending || !name.trim() || !prompt.trim()}
          >
            Save shape
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-2">
          <span className="legend text-ink-2">What kind of post is this?</span>
          <Textarea
            value={description}
            rows={3}
            autoFocus
            placeholder="A post about a client win, without naming the client."
            onChange={(event) => {
              setDescription(event.target.value);
              if (error) setError("");
            }}
            className="w-full leading-[1.6]"
          />
        </label>

        <div>
          <Button onClick={draft} disabled={pending || !configured}>
            <Sparkles size={16} strokeWidth={1.5} />
            {pending
              ? "Writing the frame"
              : !configured
                ? "Writing is not switched on"
                : drafted
                  ? "Draft it again"
                  : "Draft the frame"}
          </Button>
        </div>

        {/* Editable from the start, so a shape can be written entirely by hand
            on a deployment with no model key. */}
        <label className="flex flex-col gap-2">
          <span className="legend text-ink-2">Name</span>
          <Input
            value={name}
            placeholder="Client win"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="legend text-ink-2">When to use it</span>
          <Input
            value={blurb}
            placeholder="Use when a placement landed and the client cannot be named."
            onChange={(event) => setBlurb(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="legend text-ink-2">The frame</span>
          <Textarea
            value={prompt}
            rows={5}
            placeholder={
              "Three lines, each one instruction:\nSetback: where this started.\nTurn: what changed it.\nOutcome: where it landed."
            }
            onChange={(event) => setPrompt(event.target.value)}
            className="w-full leading-[1.6]"
          />
          <span className="text-[12px] text-ink-2">
            Three beats that move: a setup, a turn, a landing. This is what
            every post written through this shape will be told to do.
          </span>
        </label>

        {error ? (
          <p role="alert" className="text-[12px] font-medium text-red">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
