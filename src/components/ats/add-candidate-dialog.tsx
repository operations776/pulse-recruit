"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { createCandidate } from "@/lib/actions";
import type { StageRow } from "@/lib/supabase/types";

export function AddCandidateDialog({
  open,
  onClose,
  jobId,
  stages,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  stages: StageRow[];
}) {
  const { notify } = useToast();
  const [busy, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    title: "",
    company: "",
    stageId: stages[0]?.id ?? "",
  });
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      title: "",
      company: "",
      stageId: stages[0]?.id ?? "",
    });
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  // The duplicate-email rule is a unique index, and the action already turns
  // that violation into a sentence a recruiter can act on. Repeating the check
  // here would be a second source of truth that drifts, so the returned string
  // is shown as it comes back.
  const submit = () => {
    setError("");
    startTransition(async () => {
      const result = await createCandidate({
        jobId,
        stageId: form.stageId,
        name: form.name,
        email: form.email,
        phone: form.phone,
        title: form.title,
        company: form.company,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      notify(`${form.name.trim()} added to this role.`);
      close();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add candidate"
      description="They land on the stage you pick and appear on the board immediately."
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            Add candidate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Full name">
          <Input
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Sarah Chen"
            autoFocus
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            placeholder="sarah@company.com"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              placeholder="+44 7700 900000"
            />
          </Field>
          <Field label="Stage">
            <Select
              value={form.stageId}
              onChange={(e) => set("stageId")(e.target.value)}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current title">
            <Input
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Product Designer"
            />
          </Field>
          <Field label="Current company">
            <Input
              value={form.company}
              onChange={(e) => set("company")(e.target.value)}
              placeholder="Corewave"
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="text-[12px] font-medium text-red">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
