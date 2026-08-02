"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge, Breadcrumb } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { brand } from "@/config/brand";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

const SECTIONS = ["General", "Team", "Billing"] as const;
type Section = (typeof SECTIONS)[number];

// Owner is the brand relationship, admin is a categorization, member is plain.
const ROLE_BADGE = {
  owner: "accent",
  admin: "teal",
  member: "neutral",
} as const satisfies Record<Role, "accent" | "teal" | "neutral">;

const PLAN_FEATURES = [
  "Unlimited jobs, candidates and companies",
  "The sourcing agent with company signals",
  "Shared pipelines for the whole team",
  "Email sequences from inside the pipeline",
  "Priority support from the people who built it",
];

const CARD = "rounded-sharp border border-rule bg-paper-white p-5";

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("General");

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Settings"]} />
        <h1 className="mt-2 font-display text-[22px] font-semibold leading-7 tracking-[-0.01em]">
          Settings
        </h1>
      </div>

      <div className="flex flex-1 items-start gap-6 px-6 pb-8 pt-5">
        <nav
          aria-label="Settings sections"
          className="sticky top-0 w-48 shrink-0 rounded-sharp border border-rule bg-paper-white p-1.5"
        >
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map((item) => {
              const active = section === item;
              return (
                <li key={item}>
                  <button
                    onClick={() => setSection(item)}
                    aria-current={active ? "page" : undefined}
                    className={`w-full rounded-sharp px-3 py-2 text-left text-[13px] transition-colors duration-150 ${
                      active
                        ? "bg-vermilion-wash font-semibold text-vermilion-deep"
                        : "text-ink-soft hover:bg-paper hover:text-ink"
                    }`}
                  >
                    {item}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 max-w-[620px] flex-1">
          {section === "General" ? <GeneralPanel /> : null}
          {section === "Team" ? <TeamPanel /> : null}
          {section === "Billing" ? <BillingPanel /> : null}
        </div>
      </div>
    </main>
  );
}

function GeneralPanel() {
  const { org } = useStore();
  const { notify } = useToast();

  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <section className={CARD}>
        <h2 className="text-[16px] font-semibold leading-[22px]">Workspace</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          The name your team sees in the top bar, and the address candidates and
          clients land on.
        </p>

        <div className="mt-4 flex flex-col gap-3.5">
          <Field label="Workspace name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nortech Search"
            />
          </Field>

          <Field
            label="Workspace URL slug"
            hint="Lowercase letters, numbers and hyphens."
          >
            <span className="flex items-center gap-2">
              <span className="shrink-0 text-[12px] text-ink-mute">
                {brand.domain}/
              </span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="nortech-search"
              />
            </span>
          </Field>
        </div>

        <div className="mt-5">
          <Button
            variant="primary"
            onClick={() => notify("Workspace settings saved")}
          >
            Save changes
          </Button>
        </div>
      </section>

      <section className={CARD}>
        <h2 className="text-[16px] font-semibold leading-[22px]">Danger zone</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Deleting the workspace removes every job, candidate, note and file for
          the whole team. There is no undo and no export afterwards.
        </p>
        <div className="mt-4">
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete workspace
          </Button>
        </div>
      </section>

      <DeleteWorkspaceDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        orgName={org.name}
      />
    </div>
  );
}

function DeleteWorkspaceDialog({
  open,
  onClose,
  orgName,
}: {
  open: boolean;
  onClose: () => void;
  orgName: string;
}) {
  const { notify } = useToast();
  const [typed, setTyped] = useState("");

  const close = () => {
    setTyped("");
    onClose();
  };

  const matches = typed === orgName;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Delete ${orgName}?`}
      description="Every job, candidate, note and file goes with it. Type the workspace name to confirm."
      footer={
        <>
          <Button onClick={close}>Keep workspace</Button>
          <Button
            variant="danger"
            disabled={!matches}
            onClick={() => {
              notify(`${orgName} is queued for deletion`, "danger");
              close();
            }}
            className={matches ? "" : "opacity-50"}
          >
            Delete workspace
          </Button>
        </>
      }
    >
      <Field label={`Type ${orgName} to confirm`}>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={orgName}
          autoFocus
        />
      </Field>
    </Dialog>
  );
}

function TeamPanel() {
  const { members, currentUser } = useStore();
  const { notify } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-baseline gap-1.5">
          <span className="data-literal text-ink">{members.length}</span>
          <span className="micro-label text-ink-mute">
            {members.length === 1 ? "member" : "members"}
          </span>
        </span>

        <Button variant="primary" onClick={() => setInviteOpen(true)}>
          <Plus size={15} strokeWidth={2.25} />
          Invite teammate
        </Button>
      </div>

      <section className="rounded-sharp border border-rule bg-paper-white px-5 py-1">
        <ul>
          {members.map((member) => {
            const isYou = member.id === currentUser.id;
            return (
              <li
                key={member.id}
                className="flex h-11 items-center gap-3 border-b border-rule last:border-b-0"
              >
                <Avatar name={member.name} src={member.avatarUrl} size="sm" />

                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate text-[13px] font-medium">
                    {member.name}
                  </span>
                  <span className="data-literal truncate text-ink-soft">
                    {member.email}
                  </span>
                </span>

                <Badge hue={ROLE_BADGE[member.role]}>{member.role}</Badge>

                {isYou ? (
                  <span className="w-[74px] shrink-0 text-right text-[12px] text-ink-mute">
                    You
                  </span>
                ) : (
                  <span className="w-[74px] shrink-0 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        notify("Removing a teammate is not connected yet")
                      }
                    >
                      Remove
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

function InviteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState("");

  const close = () => {
    setEmail("");
    setRole("member");
    setError("");
    onClose();
  };

  const submit = () => {
    const value = email.trim();
    if (!value) {
      setError("Enter the email address to invite.");
      return;
    }
    if (!value.includes("@")) {
      setError("That address is missing an @, so it cannot be delivered.");
      return;
    }
    notify(`Invite sent to ${value}`);
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Invite teammate"
      description="They get an email with a link into this workspace. Seats are billed per person."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Send invite
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Work email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@agency.com"
            autoFocus
          />
        </Field>

        <Field
          label="Role"
          hint="Admins manage jobs and members. Members work their own pipelines."
        >
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </Select>
        </Field>

        {error ? (
          <p role="alert" className="text-[12px] font-medium text-brick">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function BillingPanel() {
  const { notify } = useToast();

  return (
    <section className={CARD}>
      <p className="micro-label text-ink-mute">Current plan</p>
      <h2 className="mt-1.5 text-[16px] font-semibold leading-[22px]">
        Founding agency
      </h2>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-[24px] font-semibold leading-[30px] tabular-nums">
          $50
        </span>
        <span className="text-[12px] text-ink-mute">/month</span>
      </p>

      <p className="mt-2 text-[13px] text-ink-soft">
        Locked for the first ten agencies, then $299.
      </p>

      <ul className="mt-4 flex flex-col gap-2.5 border-t border-rule pt-4">
        {PLAN_FEATURES.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[13px]">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-vermilion-wash">
              <Check size={11} strokeWidth={3} className="text-vermilion" />
            </span>
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <Button onClick={() => notify("Billing portal is not connected yet")}>
          Manage billing
        </Button>
      </div>
    </section>
  );
}
