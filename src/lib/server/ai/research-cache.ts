import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { ResearchHit } from "@/lib/server/ai/exa";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// PLS-95. Research cache for the BD Strategist.
//
// Two recruiters in one agency researching the same market in the same
// afternoon should not pay twice for the same answer, and neither should we.
// That is the whole reason this exists: it saves Exa spend and it makes a
// repeat question fast. It is NOT a general speed-up, and it must never make
// evidence look more current than it is.
//
// Three rules the rest of this file exists to keep:
//
//   1. Never across orgs. The key is scoped by org_id, the RLS policy is
//      scoped by org_id, and every read and write runs on the caller's own
//      session. One agency's research is not another's.
//   2. A hit costs nothing. No provider call happened, so no Exa search or
//      page-read unit is counted. Charging for a cache hit would be charging
//      for work we did not do.
//   3. A hit is labelled. The run log says "Using recent research" with an
//      age, never "Searching". A recruiter deciding whether to call a client
//      needs to know if the evidence is an hour old or a day old.

/** Search results go stale fast in BD: a funding round lands and it matters. */
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
/** A page's text changes far more slowly than the set of pages that exist. */
const PAGE_TTL_MS = 12 * 60 * 60 * 1000;

export type CacheKind = "search" | "page";

export type CacheHit = {
  hits: ResearchHit[];
  /** When the provider call actually happened, for the freshness label. */
  cachedAt: string;
  ageMs: number;
};

/**
 * A stable key for a search.
 *
 * Normalised so that trivial differences (case, extra spaces) share an entry,
 * and `publishedAfter` is part of the key rather than ignored: a search for
 * "since June" and a search for "since August" are different questions and
 * must not share a row.
 */
export function searchKey(input: {
  query: string;
  numResults: number;
  category?: string;
  publishedAfter?: string;
}): string {
  const query = input.query.trim().toLowerCase().replace(/\s+/g, " ");
  return [
    "search",
    query,
    String(input.numResults),
    input.category ?? "-",
    input.publishedAfter ?? "-",
  ].join("|");
}

export function pageKey(url: string): string {
  return `page|${url.trim()}`;
}

/**
 * Read a cache entry, if one is live and still honest.
 *
 * `fresherThan` is the freshness bypass. When a run asks for results published
 * after some date, an entry created BEFORE that date cannot answer it: it was
 * built when those results did not exist yet. Serving it would be presenting
 * an old search as though it had looked for new things.
 */
export async function readCache(
  supabase: Supabase,
  orgId: string,
  cacheKey: string,
  fresherThan?: string,
): Promise<CacheHit | null> {
  try {
    const { data, error } = await supabase
      .from("bd_research_cache")
      .select("payload, created_at, expires_at")
      .eq("org_id", orgId)
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error || !data) return null;

    // Expiry is enforced here as well as by the sweep. A row can outlive its
    // expires_at between sweeps, and a stale read is worse than a live call.
    const expiresAt = new Date(data.expires_at as string).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

    const createdAt = new Date(data.created_at as string);
    if (fresherThan) {
      const boundary = new Date(fresherThan).getTime();
      if (Number.isFinite(boundary) && createdAt.getTime() < boundary) {
        return null;
      }
    }

    const hits = data.payload as unknown;
    if (!Array.isArray(hits)) return null;

    return {
      hits: hits as ResearchHit[],
      cachedAt: createdAt.toISOString(),
      ageMs: Math.max(0, Date.now() - createdAt.getTime()),
    };
  } catch {
    // Law: a cache failure degrades to a live call, it never fails the run.
    // The recruiter pays for one search instead of none, which is the correct
    // direction to be wrong in.
    return null;
  }
}

/**
 * Store a provider result.
 *
 * Law 2: upsert on the unique (org_id, cache_key) index rather than
 * check-then-insert. Two runs researching the same thing at the same moment
 * both write, and the second must land on the same row rather than raise.
 *
 * Never throws. A cache write that fails has cost the caller nothing: the
 * answer is already in hand and the credits are already settled honestly.
 */
export async function writeCache(
  supabase: Supabase,
  orgId: string,
  cacheKey: string,
  kind: CacheKind,
  hits: ResearchHit[],
): Promise<void> {
  // An empty result is never cached. On this surface an empty search is a
  // failed run that gets refunded, and caching it would refuse the same
  // question for a day.
  if (hits.length === 0) return;

  const ttl = kind === "search" ? SEARCH_TTL_MS : PAGE_TTL_MS;

  try {
    await supabase.from("bd_research_cache").upsert(
      {
        org_id: orgId,
        cache_key: cacheKey,
        kind,
        payload: hits,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttl).toISOString(),
      },
      { onConflict: "org_id,cache_key" },
    );
  } catch {
    // Deliberately silent. See above: nothing the user did has gone wrong.
  }
}

/** "14 minutes ago", for the run log and the evidence label. */
export function describeAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
