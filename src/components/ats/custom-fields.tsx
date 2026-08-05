"use client";

import { Plus, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import {
  createFieldDef,
  deleteFieldDef,
  setCandidateField,
} from "@/lib/actions";
import type {
  CandidateRow,
  CustomFieldType,
  PersonFieldDefRow,
} from "@/lib/supabase/types";

/**
 * The admin-defined columns, rendered from person_field_defs and patched one
 * key at a time on blur. Adding a field here is a defs row, never a migration.
 */
export function CustomFieldsSection({
  candidate,
  defs,
  isAdmin,
}: {
  candidate: CandidateRow;
  defs: PersonFieldDefRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [, startTransition] = useTransition();
  const [manageOpen, setManageOpen] = useState(false);

  // Drafts keyed by def key, so typing does not write and blur does. The saved
  // value arrives back through props after the refresh.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const valueOf = (key: string) =>
    drafts[key] ?? candidate.custom_fields[key] ?? "";

  const save = (def: PersonFieldDefRow, value: string) => {
    const stored = candidate.custom_fields[def.key] ?? "";
    if (value === stored) return;
    startTransition(async () => {
      const result = await setCandidateField(candidate.id, def.key, value);
      if (!result.ok) {
        notify(`${result.error} ${def.label} was not saved.`, "danger");
        return;
      }
      router.refresh();
    });
  };

  if (defs.length === 0 && !isAdmin) return null;

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="legend text-ink-2">Custom fields</h3>
        {isAdmin ? (
          <button
            onClick={() => setManageOpen(true)}
            className="flex items-center gap-1 text-[12px] font-medium text-ink-2 hover:text-ink"
          >
            <Settings2 size={13} strokeWidth={1.75} />
            Manage
          </button>
        ) : null}
      </div>

      {defs.length === 0 ? (
        <p className="text-[12px] text-ink-3">
          No fields defined yet. Manage adds one, no migration required.
        </p>
      ) : (
        <dl className="flex flex-col gap-2.5">
          {defs.map((def) => (
            <div key={def.id} className="flex items-start gap-3">
              <dt className="w-20 shrink-0 pt-1.5 text-[12px] text-ink-3">
                {def.label}
              </dt>
              <dd className="min-w-0 flex-1">
                {def.field_type === "long_text" ? (
                  <Textarea
                    rows={2}
                    aria-label={def.label}
                    value={valueOf(def.key)}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [def.key]: e.target.value }))
                    }
                    onBlur={(e) => save(def, e.target.value)}
                  />
                ) : def.field_type === "select" ? (
                  <Select
                    aria-label={def.label}
                    value={valueOf(def.key)}
                    onChange={(e) => {
                      setDrafts((d) => ({ ...d, [def.key]: e.target.value }));
                      save(def, e.target.value);
                    }}
                    className="h-8"
                  >
                    <option value="">Not set</option>
                    {def.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={def.field_type === "url" ? "url" : "text"}
                    aria-label={def.label}
                    value={valueOf(def.key)}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [def.key]: e.target.value }))
                    }
                    onBlur={(e) => save(def, e.target.value)}
                    className="h-8"
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {isAdmin ? (
        <ManageFieldsDialog
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          defs={defs}
        />
      ) : null}
    </section>
  );
}

function ManageFieldsDialog({
  open,
  onClose,
  defs,
}: {
  open: boolean;
  onClose: () => void;
  defs: PersonFieldDefRow[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [busy, startTransition] = useTransition();

  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");

  const add = () => {
    const name = label.trim();
    if (!name) {
      notify("Give the field a name.", "danger");
      return;
    }
    startTransition(async () => {
      const result = await createFieldDef({
        label: name,
        fieldType,
        options:
          fieldType === "select"
            ? options
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : [],
      });
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      setLabel("");
      setOptions("");
      notify(`Field added: ${name}`);
      router.refresh();
    });
  };

  const remove = (def: PersonFieldDefRow) => {
    startTransition(async () => {
      const result = await deleteFieldDef(def.id);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(
        `${def.label} removed. Values stay stored but nothing shows them now.`,
      );
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Custom fields"
      description="Columns every candidate carries. Adding one is a row, not a migration."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-4">
        {defs.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {defs.map((def) => (
              <li
                key={def.id}
                className="flex items-center gap-2 rounded-control border border-rule px-3 py-1.5"
              >
                <span className="flex-1 text-[12px] font-medium">
                  {def.label}
                </span>
                <span className="legend text-ink-3">{def.field_type}</span>
                <button
                  onClick={() => remove(def)}
                  disabled={busy}
                  aria-label={`Remove ${def.label}`}
                  className="flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-red disabled:opacity-40"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <Field label="New field">
          <Input
            value={label}
            placeholder="Notice period"
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label="Type">
          <Select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
          >
            <option value="text">Text</option>
            <option value="long_text">Long text</option>
            <option value="select">Select</option>
            <option value="url">URL</option>
          </Select>
        </Field>
        {fieldType === "select" ? (
          <Field label="Options" hint="Comma separated.">
            <Input
              value={options}
              placeholder="Immediate, 1 month, 3 months"
              onChange={(e) => setOptions(e.target.value)}
            />
          </Field>
        ) : null}
        <Button onClick={add} disabled={busy}>
          <Plus size={16} strokeWidth={2} />
          Add field
        </Button>
      </div>
    </Dialog>
  );
}
