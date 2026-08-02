"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, Select } from "@/components/ui/input";
import { Badge, Breadcrumb, EmptyState } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

import { useStore } from "@/lib/store";
import type { CompanyType } from "@/lib/types";

const TABS = ["All", "Clients", "Prospects"] as const;
type Tab = (typeof TABS)[number];

const TAB_TYPE: Record<Tab, CompanyType | null> = {
  All: null,
  Clients: "client",
  Prospects: "prospect",
};

// Domains are compared the way a person would read them, so pasting
// https://fieldstone.com/ still collides with fieldstone.com.
function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export default function CompaniesPage() {
  const { state, memberById, addCompany } = useStore();
  const { notify } = useToast();

  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // DESIGN.md: "/" focuses search, unless the caret is already in a control.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const counts = useMemo(
    () => ({
      All: state.companies.length,
      Clients: state.companies.filter((c) => c.type === "client").length,
      Prospects: state.companies.filter((c) => c.type === "prospect").length,
    }),
    [state.companies],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const wanted = TAB_TYPE[tab];
    return state.companies.filter((c) => {
      if (wanted && c.type !== wanted) return false;
      if (
        needle &&
        !`${c.name} ${c.domain} ${c.location}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [state.companies, tab, query]);

  const reset = () => {
    setTab("All");
    setQuery("");
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Recruitment", "Companies"]} />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="display text-[18px] font-semibold leading-7 tracking-[-0.01em]">
              Companies
            </h1>
            <span className="flex items-baseline gap-1.5">
              <span className="meta text-ink">{rows.length}</span>
              <span className="legend text-ink-3">
                {rows.length === 1 ? "result" : "results"}
              </span>
            </span>
          </div>

          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} strokeWidth={2.25} />
            Add company
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-rule">
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`border-b-2 px-3 pb-2.5 text-[12px] ${
                  tab === t
                    ? "border-vermilion font-semibold text-vermilion-hover"
                    : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {t}
                <span className="meta ml-1.5 text-[12px] text-ink-3">
                  {counts[t]}
                </span>
              </button>
            ))}
          </div>

          <div className="pb-2">
            <SearchInput
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, domain, location"
              aria-label="Search companies"
              className="w-64"
            />
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 pt-4">
        {rows.length === 0 ? (
          <EmptyState
            title="No companies match this view"
            body="Clear the search box, or switch back to the All tab, to see every client and prospect on the book."
            action={<Button onClick={reset}>Clear filters</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((company) => {
              
              const owner = memberById(company.ownerId);
              const ownerName = owner?.name ?? "Unassigned";

              return (
                <article
                  key={company.id}
                  className="rounded-control border border-rule bg-sheet p-4 "
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`flex size-9 shrink-0 items-center justify-center rounded-control text-[12px] font-semibold bg-well text-ink-2`}
                    >
                      {company.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[12px] font-semibold leading-5">
                        {company.name}
                      </h2>
                      <a
                        href={`https://${normalizeDomain(company.domain)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="meta block truncate text-ink-2 hover:text-vermilion-hover hover:underline"
                      >
                        {company.domain}
                      </a>
                    </div>
                  </div>

                  <dl className="mt-3.5 flex items-start gap-6">
                    <div className="min-w-0">
                      <dt className="legend text-ink-3">Location</dt>
                      <dd className="mt-0.5 truncate text-[12px]">
                        {company.location || "Not recorded"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="legend text-ink-3">Headcount</dt>
                      <dd className="mt-0.5 truncate">
                        {company.headcount ? (
                          <span className="meta">{company.headcount}</span>
                        ) : (
                          <span className="text-[12px] text-ink-3">
                            Not recorded
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-rule pt-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={ownerName} src={owner?.avatarUrl} size="sm" />
                      <span className="truncate text-[12px] text-ink-2">
                        {ownerName}
                      </span>
                    </span>
                    <Badge hue={company.type === "client" ? "accent" : "neutral"}>
                      {company.type}
                    </Badge>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <AddCompanyDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(name) => notify(`${name} added to companies`)}
        existing={state.companies.map((c) => ({
          name: c.name,
          domain: normalizeDomain(c.domain),
        }))}
        create={addCompany}
      />
    </main>
  );
}

function AddCompanyDialog({
  open,
  onClose,
  onCreated,
  existing,
  create,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
  existing: { name: string; domain: string }[];
  create: (input: {
    name: string;
    domain: string;
    type: CompanyType;
    location: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    domain: "",
    location: "",
    type: "prospect" as CompanyType,
  });
  const [error, setError] = useState("");

  const reset = () => {
    setForm({ name: "", domain: "", location: "", type: "prospect" });
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    const name = form.name.trim();
    const domain = normalizeDomain(form.domain);

    if (!name) {
      setError("Enter the company name.");
      return;
    }
    if (!domain) {
      setError("Enter a domain, for example fieldstone.com.");
      return;
    }

    // The real table has a unique index on (org_id, lower(domain)) and the
    // insert handles the conflict. This mirrors it so the copy is already right
    // when the database becomes the enforcer.
    const clash = existing.find((c) => c.domain === domain);
    if (clash) {
      setError(`${clash.name} already uses ${domain}.`);
      return;
    }

    create({ name, domain, location: form.location.trim(), type: form.type });
    onCreated(name);
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add company"
      description="Clients and prospects share one book, so the type is the only thing that separates them."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Add company
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Company name">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Fieldstone"
            autoFocus
          />
        </Field>
        <Field label="Domain">
          <Input
            value={form.domain}
            onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
            placeholder="fieldstone.com"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              placeholder="Manchester, UK"
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as CompanyType }))
              }
            >
              <option value="prospect">Prospect</option>
              <option value="client">Client</option>
            </Select>
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
