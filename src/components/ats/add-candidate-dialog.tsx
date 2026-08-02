"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { Stage } from "@/lib/types";

export function AddCandidateDialog({
  open,
  onClose,
  jobId,
  stages,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  stages: Stage[];
}) {
  const { addCandidate, state } = useStore();
  const { notify } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    title: "",
    companyName: "",
    stageId: stages[0]?.id ?? "",
  });
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setForm({ name: "", email: "", phone: "", title: "", companyName: "", stageId: stages[0]?.id ?? "" });
    setError("");
  };

  const submit = () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name) return setError("Enter the candidate's name.");
    if (!email) return setError("Enter an email address.");

    // The real table has a unique index on (org_id, lower(email)) and the insert
    // handles the conflict. This mirrors that check so the UI copy is already
    // correct when the database becomes the enforcer.
    const clash = state.candidates.find(
      (c) => c.email.toLowerCase() === email && c.jobId === jobId,
    );
    if (clash) {
      return setError(`${clash.name} is already on this role with that email.`);
    }

    addCandidate({ ...form, name, email, jobId });
    notify(`${name} added`);
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add candidate"
      description="They land on the stage you pick and appear on the board immediately."
      footer={
        <>
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
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
              value={form.companyName}
              onChange={(e) => set("companyName")(e.target.value)}
              placeholder="Corewave"
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="text-[12px] font-medium text-brick">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
