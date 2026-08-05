"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { saveBDMemory, type SaveBDMemoryInput } from "@/lib/actions";
import type {
  BDAgentMemoryRow,
  BDMemoryKind,
  BDMemoryScope,
} from "@/lib/supabase/types";

// PLS-98. Adding and editing what the strategist knows.
//
// This is the whole point of the visible-memory model: a recruiter decides
// what the agent knows, in their own words, and can take it back. No hidden
// profile, nothing inferred from behaviour.

const KINDS: { value: BDMemoryKind; label: string; hint: string }[] = [
  {
    value: "positioning",
    label: "Positioning",
    hint: "What you specialise in and how you describe it.",
  },
  {
    value: "ideal_client",
    label: "Ideal client",
    hint: "The kind of company worth your time.",
  },
  { value: "buyer", label: "Buyer", hint: "Who signs, and what they care about." },
  {
    value: "territory",
    label: "Territory",
    hint: "The geography or market you work.",
  },
  { value: "offer", label: "Offer", hint: "What you sell and on what terms." },
  {
    value: "qualification",
    label: "Qualification bar",
    hint: "What makes you walk away from a deal.",
  },
  {
    value: "preference",
    label: "Working preference",
    hint: "How you want the strategist to advise you.",
  },
];

export function MemoryDialog({
  open,
  onClose,
  editing,
  canManageAgency,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Present when editing an existing record, absent when adding one. */
  editing: BDAgentMemoryRow | null;
  canManageAgency: boolean;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [scope, setScope] = useState<BDMemoryScope>(
    editing?.scope ?? (canManageAgency ? "agency" : "personal"),
  );
  const [kind, setKind] = useState<BDMemoryKind>(
    (editing?.kind as BDMemoryKind) ?? "positioning",
  );
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setError("");
    onClose();
  };

  const save = async () => {
    setError("");
    setSaving(true);

    const input: SaveBDMemoryInput = {
      ...(editing ? { id: editing.id } : {}),
      scope,
      kind,
      title,
      body,
    };

    const result = await saveBDMemory(input);
    setSaving(false);

    if (!result.ok) {
      // The dialog stays open and keeps what was typed. A rejected save that
      // also loses the text is how somebody stops bothering to write it down.
      setError(result.error);
      return;
    }

    // Close BEFORE the refresh: revalidating under an open layer remounts it
    // and drops the input, which is the named bug class in CLAUDE.md.
    close();
    notify(
      editing
        ? `Updated: ${result.data.title}`
        : `The strategist now knows: ${result.data.title}`,
    );
    onSaved();
  };

  const chosen = KINDS.find((entry) => entry.value === kind);

  return (
    <Dialog
      open={open}
      onClose={close}
      title={editing ? "Edit context" : "Add context"}
      description="Strategy and preference only. The strategist still researches every market claim."
      footer={
        <>
          <Button onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={saving || !title.trim() || !body.trim()}
          >
            {saving ? "Saving" : editing ? "Save changes" : "Add context"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Who this applies to"
          hint={
            scope === "agency"
              ? "Everyone in the workspace shares this, and it shapes every member's strategist."
              : "Only you. Your teammates never see this and their strategist never uses it."
          }
        >
          <Select
            value={scope}
            onChange={(event) => setScope(event.target.value as BDMemoryScope)}
            // Editing cannot move a record between layers: agency strategy and
            // personal coaching have different owners and different audiences.
            disabled={Boolean(editing)}
          >
            <option value="personal">Just me</option>
            <option value="agency" disabled={!canManageAgency}>
              The whole agency
              {canManageAgency ? "" : " (owner or admin only)"}
            </option>
          </Select>
        </Field>

        <Field label="Type" hint={chosen?.hint}>
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as BDMemoryKind)}
          >
            {KINDS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="Nordic battery manufacturing"
            autoFocus
          />
        </Field>

        <Field
          label="What the strategist should know"
          hint="Write it the way you would tell a new hire. Specifics beat adjectives."
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="We place process and quality engineers into battery gigafactories in Sweden, Norway and Finland. Our buyer is usually the Head of Manufacturing, not HR. We do not take contingent work under 20 percent."
            className="w-full leading-[1.55]"
          />
        </Field>

        {error ? (
          <p className="rounded-control border border-red bg-red-bg px-3 py-2 text-[12px] text-red">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
