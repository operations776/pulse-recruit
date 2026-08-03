import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { ChatSource } from "@/lib/supabase/types";
import * as research from "@/lib/server/ai/exa";
import type { ToolSchema } from "@/lib/server/ai/openai";

// The tool sets are the only difference between the two surfaces (AI.md
// section 5). MARKET can reach the web and cannot touch the database. OPS can
// read the caller's own rows and cannot reach the web. That boundary is
// structural, not a line in a prompt.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ToolContext = {
  supabase: Supabase;
  orgId: string;
  signal?: AbortSignal;
  // Budget left for this run, decremented as work is done. A tool that would
  // exceed it declines and says so, rather than silently overspending.
  budget: { searches: number; pageReads: number };
};

export type ToolOutcome = {
  // What goes back to the model. Compact JSON: every character is billed.
  result: string;
  steps: { label: string; detail: string }[];
  sources: ChatSource[];
  spent: { searches: number; pageReads: number };
};

const empty = (result: string): ToolOutcome => ({
  result,
  steps: [],
  sources: [],
  spent: { searches: 0, pageReads: 0 },
});

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function str(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function num(args: Record<string, unknown>, key: string, fallback: number): number {
  const value = args[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ---------------------------------------------------------------------------
// MARKET: the open web
// ---------------------------------------------------------------------------

export const MARKET_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Search the live web and get the text of the results. Use one search per distinct question. Prefer specific queries naming companies, roles, or locations over broad ones.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query, phrased as you would to a search engine.",
          },
          category: {
            type: "string",
            enum: ["company", "news", "linkedin profile", "financial report"],
            description:
              "Narrow the result type when the question clearly calls for one. Omit otherwise.",
          },
          published_after: {
            type: "string",
            description:
              "ISO date, for example 2026-07-01. Use when the question is about recent events so stale pages are excluded.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_pages",
      description:
        "Read the full text of specific URLs already found by search, when a snippet was not enough to answer confidently.",
      parameters: {
        type: "object",
        properties: {
          urls: {
            type: "array",
            items: { type: "string" },
            description: "Up to five URLs taken from earlier search results.",
          },
        },
        required: ["urls"],
      },
    },
  },
];

async function runMarketTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  if (name === "search_web") {
    const query = str(args, "query");
    if (!query) return empty(JSON.stringify({ error: "A query is required." }));
    if (ctx.budget.searches <= 0) {
      return empty(
        JSON.stringify({
          error:
            "The search budget for this question is spent. Answer from what you already have and say what you could not check.",
        }),
      );
    }

    const hits = await research.search({
      query,
      category: str(args, "category") || undefined,
      publishedAfter: str(args, "published_after") || undefined,
      signal: ctx.signal,
    });

    return {
      result: JSON.stringify({
        query,
        results: hits.map((h) => ({
          title: h.title,
          url: h.url,
          published: h.publishedDate,
          text: h.text,
        })),
      }),
      steps: [
        {
          label: "Searched",
          detail: `${query}, ${hits.length} ${hits.length === 1 ? "result" : "results"}`,
        },
      ],
      sources: hits.map((h) => ({
        label: h.title,
        detail:
          hostOf(h.url) +
          (h.publishedDate ? `, ${h.publishedDate.slice(0, 10)}` : ""),
        url: h.url,
      })),
      spent: { searches: 1, pageReads: 0 },
    };
  }

  if (name === "read_pages") {
    const raw = Array.isArray(args.urls) ? (args.urls as unknown[]) : [];
    const urls = raw.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));
    if (urls.length === 0) {
      return empty(JSON.stringify({ error: "No readable URLs were given." }));
    }
    if (ctx.budget.pageReads < urls.length) {
      return empty(
        JSON.stringify({
          error:
            "The page-reading budget for this question is spent. Answer from what you already have.",
        }),
      );
    }

    const pages = await research.readPages({ urls, signal: ctx.signal });

    return {
      result: JSON.stringify({
        pages: pages.map((p) => ({ url: p.url, title: p.title, text: p.text })),
      }),
      steps: pages.map((p) => ({ label: "Read", detail: hostOf(p.url) })),
      sources: pages.map((p) => ({
        label: p.title,
        detail: hostOf(p.url),
        url: p.url,
      })),
      spent: { searches: 0, pageReads: pages.length },
    };
  }

  return empty(JSON.stringify({ error: `Unknown tool ${name}.` }));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// OPS: the org's own rows, through the caller's session so RLS still applies
// ---------------------------------------------------------------------------
//
// The pipeline lives in `people` joined to `candidacies` (PLS-45). One human is
// one `people` row; each role they are on is a `candidacy` carrying its own
// stage and its own activity clock. The legacy `candidates` table still exists
// with the pre-split rows and different ids, so reading it would under-report
// the pipeline and resolve to the wrong person. Nothing here reads it.

export const OPS_TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "list_roles",
      description:
        "Every role with its stage counts, how many are hired against target, and whether it is marked at risk. Start here for almost any question about the pipeline.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_candidates",
      description:
        "People on roles, most recent activity first. One row per person per role, because the same person can sit at a different stage on two different roles. Filter to one role or one stage when the question is about a specific one.",
      parameters: {
        type: "object",
        properties: {
          role: {
            type: "string",
            description: "Role title or ref, for example 'Senior Product Designer' or JOB-0002.",
          },
          stage: { type: "string", description: "Stage name, for example 'Screening'." },
          limit: { type: "number", description: "Default 40, maximum 100." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stalled_candidates",
      description:
        "People on roles with no activity for a number of days, longest silence first. This is the tool for 'who is going cold' and 'what needs me today'.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Days of silence. Default 7." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recent_activity",
      description:
        "What actually moved recently: stage changes with the stage moved from and to. Use for 'what moved yesterday' or 'what happened this week'.",
      parameters: {
        type: "object",
        properties: {
          hours: { type: "number", description: "How far back to look. Default 24." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "The task list, so you do not raise something already captured.",
      parameters: {
        type: "object",
        properties: {
          include_done: { type: "boolean", description: "Default false." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Write a task for the recruiter. Use this only when the user asks you to, or explicitly agrees. One task per distinct action, with a title that names the person or role it concerns.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short and specific. Names who or what it concerns.",
          },
          detail: {
            type: "string",
            description: "One or two sentences of context, including why.",
          },
        },
        required: ["title"],
      },
    },
  },
];

type StageLite = { id: string; name: string; job_id: string };
type JobLite = { id: string; ref: string; title: string };
type PersonLite = { id: string; ref: string; name: string; title: string; company_name: string };
type CandidacyLite = {
  id: string;
  person_id: string;
  job_id: string;
  stage_id: string;
  match: number | null;
  last_activity_at: string;
};

// Every ops tool needs the same three lookups. Reading them once per call keeps
// each tool a single round trip's worth of latency rather than three.
async function pipelineIndex(supabase: ToolContext["supabase"]) {
  const [jobs, stages, people] = await Promise.all([
    supabase.from("jobs").select("id, ref, title, state, hired, target"),
    supabase.from("stages").select("id, name, job_id").order("position"),
    supabase.from("people").select("id, ref, name, title, company_name"),
  ]);

  return {
    jobs: (jobs.data ?? []) as (JobLite & {
      state: string;
      hired: number;
      target: number;
    })[],
    stages: (stages.data ?? []) as StageLite[],
    jobById: new Map(((jobs.data ?? []) as JobLite[]).map((j) => [j.id, j])),
    stageById: new Map(((stages.data ?? []) as StageLite[]).map((s) => [s.id, s])),
    personById: new Map(((people.data ?? []) as PersonLite[]).map((p) => [p.id, p])),
  };
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

async function runOpsTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const { supabase } = ctx;

  if (name === "list_roles") {
    const index = await pipelineIndex(supabase);
    const { data } = await supabase
      .from("candidacies")
      .select("id, job_id, stage_id")
      .is("archived_at", null);
    const live = (data ?? []) as { id: string; job_id: string; stage_id: string }[];

    const rows = index.jobs.map((job) => {
      const mine = live.filter((c) => c.job_id === job.id);
      const byStage: Record<string, number> = {};
      for (const stage of index.stages.filter((s) => s.job_id === job.id)) {
        byStage[stage.name] = mine.filter((c) => c.stage_id === stage.id).length;
      }
      return {
        ref: job.ref,
        title: job.title,
        state: job.state,
        hired: job.hired,
        target: job.target,
        live_candidates: mine.length,
        by_stage: byStage,
      };
    });

    return {
      result: JSON.stringify({ roles: rows }),
      steps: [{ label: "Read pipeline", detail: `${rows.length} roles` }],
      sources: [{ label: "Pipeline", detail: `${rows.length} roles in your workspace` }],
      spent: { searches: 0, pageReads: 0 },
    };
  }

  if (name === "list_candidates") {
    const limit = Math.min(Math.max(num(args, "limit", 40), 1), 100);
    const roleFilter = str(args, "role").toLowerCase();
    const stageFilter = str(args, "stage").toLowerCase();

    const index = await pipelineIndex(supabase);
    const { data } = await supabase
      .from("candidacies")
      .select("id, person_id, job_id, stage_id, match, last_activity_at")
      .is("archived_at", null)
      .order("last_activity_at", { ascending: false })
      .limit(200);

    const rows = ((data ?? []) as CandidacyLite[])
      .map((c) => {
        const person = index.personById.get(c.person_id);
        const job = index.jobById.get(c.job_id);
        return {
          ref: person?.ref ?? "",
          name: person?.name ?? "",
          title: person?.title ?? "",
          company: person?.company_name ?? "",
          role: job?.title ?? "",
          role_ref: job?.ref ?? "",
          stage: index.stageById.get(c.stage_id)?.name ?? "",
          match: c.match,
          last_activity: c.last_activity_at,
          silent_days: daysSince(c.last_activity_at),
        };
      })
      // A candidacy whose person row is missing is a broken record, not a
      // nameless candidate. Reporting it as a blank name would be worse.
      .filter((c) => c.name !== "")
      .filter((c) => {
        if (roleFilter && !`${c.role} ${c.role_ref}`.toLowerCase().includes(roleFilter)) {
          return false;
        }
        if (stageFilter && !c.stage.toLowerCase().includes(stageFilter)) return false;
        return true;
      })
      .slice(0, limit);

    return {
      result: JSON.stringify({ candidates: rows }),
      steps: [{ label: "Read candidates", detail: `${rows.length} matched` }],
      sources: [{ label: "Candidates", detail: `${rows.length} records read` }],
      spent: { searches: 0, pageReads: 0 },
    };
  }

  if (name === "stalled_candidates") {
    const days = Math.min(Math.max(num(args, "days", 7), 1), 90);
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

    const index = await pipelineIndex(supabase);
    const { data } = await supabase
      .from("candidacies")
      .select("id, person_id, job_id, stage_id, last_activity_at")
      .is("archived_at", null)
      .lt("last_activity_at", cutoff)
      .order("last_activity_at", { ascending: true })
      .limit(100);

    const rows = ((data ?? []) as CandidacyLite[])
      .map((c) => {
        const person = index.personById.get(c.person_id);
        return {
          ref: person?.ref ?? "",
          name: person?.name ?? "",
          role: index.jobById.get(c.job_id)?.title ?? "",
          stage: index.stageById.get(c.stage_id)?.name ?? "",
          silent_days: daysSince(c.last_activity_at),
        };
      })
      .filter((c) => c.name !== "");

    return {
      result: JSON.stringify({ threshold_days: days, stalled: rows }),
      steps: [{ label: "Checked for silence", detail: `${rows.length} past ${days} days` }],
      sources: [
        {
          label: "Stalled candidates",
          detail: `${rows.length} with no activity for ${days} days`,
        },
      ],
      spent: { searches: 0, pageReads: 0 },
    };
  }

  if (name === "recent_activity") {
    const hours = Math.min(Math.max(num(args, "hours", 24), 1), 720);
    const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();

    // stage_events is the history of the person model. activity_events still
    // hangs off the pre-split `candidates` table with ids that no longer match
    // anyone, so reading it here would attach real events to the wrong names.
    const index = await pipelineIndex(supabase);
    const [events, candidacies] = await Promise.all([
      supabase
        .from("stage_events")
        .select("candidacy_id, from_stage_id, to_stage_id, created_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("candidacies").select("id, person_id, job_id"),
    ]);

    const candidacyById = new Map(
      ((candidacies.data ?? []) as { id: string; person_id: string; job_id: string }[]).map(
        (c) => [c.id, c],
      ),
    );

    const rows = ((events.data ?? []) as {
      candidacy_id: string;
      from_stage_id: string | null;
      to_stage_id: string;
      created_at: string;
    }[])
      .map((e) => {
        const candidacy = candidacyById.get(e.candidacy_id);
        const person = candidacy ? index.personById.get(candidacy.person_id) : undefined;
        return {
          when: e.created_at,
          person: person?.name ?? "",
          person_ref: person?.ref ?? "",
          role: candidacy ? (index.jobById.get(candidacy.job_id)?.title ?? "") : "",
          from_stage: e.from_stage_id
            ? (index.stageById.get(e.from_stage_id)?.name ?? "")
            : null,
          to_stage: index.stageById.get(e.to_stage_id)?.name ?? "",
        };
      })
      .filter((e) => e.person !== "");

    return {
      result: JSON.stringify({ window_hours: hours, stage_changes: rows }),
      steps: [{ label: "Read activity", detail: `${rows.length} in the last ${hours}h` }],
      sources: [
        { label: "Activity", detail: `${rows.length} stage changes in the last ${hours} hours` },
      ],
      spent: { searches: 0, pageReads: 0 },
    };
  }

  if (name === "list_tasks") {
    const includeDone = args.include_done === true;
    let query = supabase
      .from("tasks")
      .select("ref, title, detail, due, done_at, origin")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!includeDone) query = query.is("done_at", null);

    const { data } = await query;

    return {
      result: JSON.stringify({ tasks: data ?? [] }),
      steps: [{ label: "Read tasks", detail: `${data?.length ?? 0} open` }],
      sources: [{ label: "Tasks", detail: `${data?.length ?? 0} read` }],
      spent: { searches: 0, pageReads: 0 },
    };
  }

  if (name === "create_task") {
    const title = str(args, "title");
    if (!title) {
      return empty(JSON.stringify({ error: "A task needs a title." }));
    }

    const { error } = await supabase.rpc("create_task", {
      target_org: ctx.orgId,
      task_title: title,
      task_detail: str(args, "detail"),
      task_origin: "claude",
    });

    // The model does not get to decide whether the write happened. The database
    // does, and a failure is reported as a failure (AI.md section 4).
    if (error) {
      return empty(JSON.stringify({ created: false, error: error.message }));
    }

    return {
      result: JSON.stringify({ created: true, title }),
      steps: [{ label: "Wrote task", detail: title }],
      sources: [{ label: "Task created", detail: title }],
      spent: { searches: 0, pageReads: 0 },
    };
  }

  return empty(JSON.stringify({ error: `Unknown tool ${name}.` }));
}

export async function runTool(
  surface: "market" | "ops",
  name: string,
  rawArguments: string,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const args = parseArgs(rawArguments);
  return surface === "market"
    ? runMarketTool(name, args, ctx)
    : runOpsTool(name, args, ctx);
}
