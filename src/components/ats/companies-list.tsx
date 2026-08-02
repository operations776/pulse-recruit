"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Breadcrumb, EmptyState, StatusChip } from "@/components/ui/misc";
import { ownerLabel } from "@/lib/people";
import type { CompanyRow, CompanyType } from "@/lib/supabase/types";

const TABS = ["All", "Clients", "Prospects"] as const;
type Tab = (typeof TABS)[number];

const TAB_TYPE: Record<Tab, CompanyType | null> = {
  All: null,
  Clients: "client",
  Prospects: "prospect",
};

// Domains are compared the way a person would read them, so a stored
// https://fieldstone.com/ still links to fieldstone.com.
function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function CompaniesList({
  companies,
  viewerId,
}: {
  companies: CompanyRow[];
  viewerId: string;
}) {
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");

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
      All: companies.length,
      Clients: companies.filter((c) => c.type === "client").length,
      Prospects: companies.filter((c) => c.type === "prospect").length,
    }),
    [companies],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const wanted = TAB_TYPE[tab];
    return companies.filter((c) => {
      if (wanted && c.type !== wanted) return false;
      if (
        needle &&
        !`${c.name} ${c.domain} ${c.location}`.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [companies, tab, query]);

  const reset = () => {
    setTab("All");
    setQuery("");
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Talent", "Companies"]} />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="display text-[18px]">Companies</h1>
            <span className="flex items-baseline gap-1.5">
              <span className="meta text-ink">{rows.length}</span>
              <span className="legend text-ink-3">
                {rows.length === 1 ? "result" : "results"}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-rule">
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`h-8 border-b-2 px-3 text-[12px] ${
                  tab === t
                    ? "border-ink font-medium text-ink"
                    : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {t}
                <span className="meta ml-1.5 text-ink-3">{counts[t]}</span>
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
        {companies.length === 0 ? (
          <EmptyState
            title="No companies yet"
            body="Clients and prospects share one book. Nothing has been added to it in this workspace."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No companies match this view"
            body="Clear the search box, or switch back to the All tab, to see every client and prospect on the book."
            action={<Button onClick={reset}>Clear filters</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((company) => {
              const domain = normalizeDomain(company.domain);
              const who = ownerLabel(company.owner_id, viewerId);

              return (
                <article
                  key={company.id}
                  className="rounded-card border border-rule bg-sheet p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-card bg-well font-mono text-[11px] text-ink-2"
                    >
                      {company.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[13px] font-medium leading-[1.3]">
                        {company.name}
                      </h2>
                      {domain ? (
                        <a
                          href={`https://${domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="meta block truncate text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                        >
                          {company.domain}
                        </a>
                      ) : (
                        <span className="text-[12px] text-ink-3">
                          No domain
                        </span>
                      )}
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
                      <Avatar name={who} size="sm" />
                      <span className="truncate text-[12px] text-ink-2">
                        {who}
                      </span>
                    </span>
                    <StatusChip
                      tone={company.type === "client" ? "on" : "off"}
                    >
                      {company.type}
                    </StatusChip>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
