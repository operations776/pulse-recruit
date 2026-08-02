"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  CREDITS,
  MAILBOXES,
  MARKET_CHAT,
  OPS_CHAT,
  POSTS,
  SEQUENCES,
  TASKS,
} from "@/lib/mock/modules";
import {
  ACTIVITY,
  CANDIDATES,
  COMPANIES,
  CURRENT_USER,
  JOBS,
  MEMBERS,
  NOTES,
  NOW,
  ORG,
  SIGNALS,
  DREAM_COMPANIES,
  STAGES,
} from "@/lib/mock/seed";
import type {
  ActivityEvent,
  Candidate,
  CandidateMetrics,
  Company,
  Note,
  Signal,
  DreamCompany,
  ChatMessage,
  ChatSurface,
  ContentPost,
  ContentSkill,
  CreditLedger,
  Mailbox,
  Sequence,
  SequenceStep,
  Task,
} from "@/lib/types";

// In-memory stand-in for the Supabase data layer.
//
// ARCHITECTURE.md law 1: any write touching two or more tables is a single
// atomic RPC. Each action below that spans collections is deliberately ONE
// reducer case, so when this is swapped for Supabase each maps to exactly one
// Postgres function. Never split one of these into sequential dispatches.

type State = {
  candidates: Candidate[];
  companies: Company[];
  notes: Note[];
  activity: ActivityEvent[];
  signals: Signal[];
  dreamCompanies: DreamCompany[];
  credits: CreditLedger;
  chat: ChatMessage[];
  tasks: Task[];
  mailboxes: Mailbox[];
  sequences: Sequence[];
  posts: ContentPost[];
  archivedIds: string[];
};

type Action =
  | { type: "move_candidate"; candidateId: string; stageId: string; stageName: string }
  | { type: "bulk_move"; candidateIds: string[]; stageId: string; stageName: string }
  | { type: "bulk_archive"; candidateIds: string[] }
  | { type: "bulk_delete"; candidateIds: string[] }
  | { type: "add_candidate"; candidate: Candidate }
  | { type: "update_candidate"; candidateId: string; patch: Partial<Candidate> }
  | { type: "add_note"; note: Note }
  | { type: "add_company"; company: Company }
  | { type: "dismiss_signal"; signalId: string }
  | { type: "ask"; surface: ChatSurface; question: string; answer: ChatMessage }
  | { type: "toggle_task"; taskId: string }
  | { type: "add_task"; task: Task }
  | { type: "set_sequence_status"; sequenceId: string; status: Sequence["status"] }
  | { type: "update_step"; sequenceId: string; stepId: string; patch: Partial<SequenceStep> }
  | { type: "reconnect_mailbox"; mailboxId: string }
  | { type: "add_post"; post: ContentPost }
  | { type: "set_post_status"; postId: string; status: ContentPost["status"] };

let sequence = 0;
function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}_${sequence}`;
}

function event(
  candidateId: string,
  kind: ActivityEvent["kind"],
  summary: string,
): ActivityEvent {
  return {
    id: nextId("a"),
    orgId: ORG.id,
    candidateId,
    kind,
    summary,
    actorId: CURRENT_USER.id,
    createdAt: NOW.toISOString(),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    // RPC: candidates + candidate_stage_events
    case "move_candidate": {
      const stamp = NOW.toISOString();
      return {
        ...state,
        candidates: state.candidates.map((c) =>
          c.id === action.candidateId
            ? { ...c, stageId: action.stageId, lastActivityAt: stamp }
            : c,
        ),
        activity: [
          event(action.candidateId, "stage_changed", `Moved to ${action.stageName}`),
          ...state.activity,
        ],
      };
    }

    // RPC: candidates + candidate_stage_events, one transaction for the whole batch
    case "bulk_move": {
      const stamp = NOW.toISOString();
      const ids = new Set(action.candidateIds);
      return {
        ...state,
        candidates: state.candidates.map((c) =>
          ids.has(c.id)
            ? { ...c, stageId: action.stageId, lastActivityAt: stamp }
            : c,
        ),
        activity: [
          ...action.candidateIds.map((id) =>
            event(id, "stage_changed", `Moved to ${action.stageName}`),
          ),
          ...state.activity,
        ],
      };
    }

    case "bulk_archive":
      return {
        ...state,
        archivedIds: [...state.archivedIds, ...action.candidateIds],
      };

    // RPC: notes + activity rows are removed before the candidate row, so no
    // child can ever outlive its parent.
    case "bulk_delete": {
      const ids = new Set(action.candidateIds);
      return {
        ...state,
        notes: state.notes.filter((n) => !ids.has(n.candidateId)),
        activity: state.activity.filter((a) => !ids.has(a.candidateId)),
        candidates: state.candidates.filter((c) => !ids.has(c.id)),
        archivedIds: state.archivedIds.filter((id) => !ids.has(id)),
      };
    }

    // RPC: candidates + candidate_stage_events
    case "add_candidate":
      return {
        ...state,
        candidates: [action.candidate, ...state.candidates],
        activity: [
          event(action.candidate.id, "created", "Added to pipeline"),
          ...state.activity,
        ],
      };

    case "update_candidate":
      return {
        ...state,
        candidates: state.candidates.map((c) =>
          c.id === action.candidateId ? { ...c, ...action.patch } : c,
        ),
      };

    // RPC: notes + candidates.last_activity_at + activity
    case "add_note": {
      const stamp = NOW.toISOString();
      return {
        ...state,
        notes: [action.note, ...state.notes],
        candidates: state.candidates.map((c) =>
          c.id === action.note.candidateId ? { ...c, lastActivityAt: stamp } : c,
        ),
        activity: [event(action.note.candidateId, "note_added", "Note added"), ...state.activity],
      };
    }

    case "add_company":
      return { ...state, companies: [action.company, ...state.companies] };

    case "dismiss_signal":
      return {
        ...state,
        signals: state.signals.map((s) =>
          s.id === action.signalId ? { ...s, dismissed: true } : s,
        ),
      };

    // RPC: chat_messages (two rows) + credit_ledger. The debit and both
    // messages land together, so a spent credit can never exist without the
    // answer it paid for, and vice versa.
    case "ask": {
      const user: ChatMessage = {
        id: nextId("msg"),
        orgId: ORG.id,
        surface: action.surface,
        role: "user",
        body: action.question,
        createdAt: NOW.toISOString(),
      };
      return {
        ...state,
        chat: [...state.chat, user, action.answer],
        credits: {
          ...state.credits,
          usedThisWeek:
            state.credits.usedThisWeek + (action.answer.creditsSpent ?? 0),
        },
      };
    }

    case "toggle_task":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, done: !t.done } : t,
        ),
      };

    case "add_task":
      return { ...state, tasks: [action.task, ...state.tasks] };

    case "set_sequence_status":
      return {
        ...state,
        sequences: state.sequences.map((q) =>
          q.id === action.sequenceId ? { ...q, status: action.status } : q,
        ),
      };

    case "update_step":
      return {
        ...state,
        sequences: state.sequences.map((q) =>
          q.id === action.sequenceId
            ? {
                ...q,
                steps: q.steps.map((st) =>
                  st.id === action.stepId ? { ...st, ...action.patch } : st,
                ),
              }
            : q,
        ),
      };

    case "reconnect_mailbox":
      return {
        ...state,
        mailboxes: state.mailboxes.map((m) =>
          m.id === action.mailboxId ? { ...m, status: "connected" } : m,
        ),
      };

    case "add_post":
      return { ...state, posts: [action.post, ...state.posts] };

    case "set_post_status":
      return {
        ...state,
        posts: state.posts.map((post) =>
          post.id === action.postId
            ? {
                ...post,
                status: action.status,
                scheduledFor:
                  action.status === "scheduled"
                    ? (post.scheduledFor ??
                      new Date(NOW.getTime() + 86_400_000).toISOString())
                    : post.scheduledFor,
              }
            : post,
        ),
      };

    default:
      return state;
  }
}

const initialState: State = {
  candidates: CANDIDATES,
  companies: COMPANIES,
  notes: NOTES,
  activity: ACTIVITY,
  signals: SIGNALS,
  dreamCompanies: DREAM_COMPANIES,
  credits: CREDITS,
  chat: [...MARKET_CHAT, ...OPS_CHAT],
  tasks: TASKS,
  mailboxes: MAILBOXES,
  sequences: SEQUENCES,
  posts: POSTS,
  archivedIds: [],
};

type StoreValue = {
  state: State;
  org: typeof ORG;
  members: typeof MEMBERS;
  currentUser: typeof CURRENT_USER;
  jobs: typeof JOBS;
  stages: typeof STAGES;
  selection: string[];
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  selectMany: (ids: string[]) => void;
  moveCandidate: (candidateId: string, stageId: string) => void;
  bulkMove: (stageId: string) => void;
  bulkArchive: () => void;
  bulkDelete: () => void;
  addCandidate: (input: NewCandidateInput) => void;
  addNote: (candidateId: string, body: string) => void;
  addCompany: (input: NewCompanyInput) => void;
  dismissSignal: (signalId: string) => void;
  creditsLeft: () => number;
  ask: (surface: ChatSurface, question: string) => boolean;
  chatFor: (surface: ChatSurface) => ChatMessage[];
  toggleTask: (taskId: string) => void;
  addTask: (title: string, detail: string) => void;
  setSequenceStatus: (sequenceId: string, status: Sequence["status"]) => void;
  updateStep: (sequenceId: string, stepId: string, patch: Partial<SequenceStep>) => void;
  reconnectMailbox: (mailboxId: string) => void;
  addPost: (skill: ContentSkill, hook: string) => void;
  setPostStatus: (postId: string, status: ContentPost["status"]) => void;
  memberById: (id: string) => (typeof MEMBERS)[number] | undefined;
  stagesForJob: (jobId: string) => typeof STAGES;
  candidatesForJob: (jobId: string) => Candidate[];
  metricsFor: (candidateId: string) => CandidateMetrics;
  notesFor: (candidateId: string) => Note[];
  activityFor: (candidateId: string) => ActivityEvent[];
};

export type NewCandidateInput = {
  name: string;
  email: string;
  phone: string;
  title: string;
  companyName: string;
  jobId: string;
  stageId: string;
};

export type NewCompanyInput = {
  name: string;
  domain: string;
  type: Company["type"];
  location: string;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selection, setSelection] = useState<string[]>([]);

  const toggleSelected = useCallback((id: string) => {
    setSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clearSelection = useCallback(() => setSelection([]), []);
  const selectMany = useCallback((ids: string[]) => setSelection(ids), []);

  const value = useMemo<StoreValue>(() => {
    const stageName = (stageId: string) =>
      STAGES.find((s) => s.id === stageId)?.name ?? "";

    return {
      state,
      org: ORG,
      members: MEMBERS,
      currentUser: CURRENT_USER,
      jobs: JOBS,
      stages: STAGES,
      selection,
      toggleSelected,
      clearSelection,
      selectMany,

      moveCandidate: (candidateId, stageId) =>
        dispatch({
          type: "move_candidate",
          candidateId,
          stageId,
          stageName: stageName(stageId),
        }),

      bulkMove: (stageId) => {
        dispatch({
          type: "bulk_move",
          candidateIds: selection,
          stageId,
          stageName: stageName(stageId),
        });
        setSelection([]);
      },

      bulkArchive: () => {
        dispatch({ type: "bulk_archive", candidateIds: selection });
        setSelection([]);
      },

      bulkDelete: () => {
        dispatch({ type: "bulk_delete", candidateIds: selection });
        setSelection([]);
      },

      addCandidate: (input) =>
        dispatch({
          type: "add_candidate",
          candidate: {
            id: nextId("cand"),
            ref: `CAND-${String(900 + sequence).padStart(4, "0")}`,
            orgId: ORG.id,
            jobId: input.jobId,
            stageId: input.stageId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            title: input.title,
            companyName: input.companyName,
            location: "",
            linkedinUrl: "",
            salary: "",
            source: "Manual",
            match: 0,
            ownerId: CURRENT_USER.id,
            lastActivityAt: NOW.toISOString(),
            createdAt: NOW.toISOString(),
          },
        }),

      addNote: (candidateId, body) =>
        dispatch({
          type: "add_note",
          note: {
            id: nextId("n"),
            orgId: ORG.id,
            candidateId,
            authorId: CURRENT_USER.id,
            body,
            createdAt: NOW.toISOString(),
          },
        }),

      addCompany: (input) =>
        dispatch({
          type: "add_company",
          company: {
            id: nextId("c"),
            orgId: ORG.id,
            name: input.name,
            domain: input.domain,
            type: input.type,
            location: input.location,
            headcount: "",
            ownerId: CURRENT_USER.id,
            createdAt: NOW.toISOString(),
          },
        }),

      dismissSignal: (signalId) => dispatch({ type: "dismiss_signal", signalId }),

      creditsLeft: () =>
        Math.max(0, state.credits.weeklyAllowance - state.credits.usedThisWeek),

      // Returns false when the weekly allowance is spent, so the caller reports
      // the refusal honestly instead of pretending the question went through.
      ask: (surface, question) => {
        const cost = surface === "market" ? 12 : 0;
        const left = state.credits.weeklyAllowance - state.credits.usedThisWeek;
        if (cost > left) return false;

        const answer: ChatMessage = {
          id: nextId("msg"),
          orgId: ORG.id,
          surface,
          role: "assistant",
          body:
            surface === "market"
              ? "Live market research is not wired up yet. When it is, this answer will be built from job boards, funding news and LinkedIn, and every source will be listed below it."
              : "The ops manager is not wired up to a model yet. When it is, this answer will be built only from your own pipeline, never from the open web.",
          sources:
            surface === "market"
              ? [{ label: "Pending", detail: "Research provider not connected" }]
              : [{ label: "Pipeline", detail: "Reads your ATS only" }],
          creditsSpent: cost,
          createdAt: NOW.toISOString(),
        };

        dispatch({ type: "ask", surface, question, answer });
        return true;
      },

      chatFor: (surface) => state.chat.filter((m) => m.surface === surface),

      toggleTask: (taskId) => dispatch({ type: "toggle_task", taskId }),

      addTask: (title, detail) =>
        dispatch({
          type: "add_task",
          task: {
            id: nextId("task"),
            ref: `TASK-${1200 + sequence}`,
            orgId: ORG.id,
            title,
            detail,
            due: NOW.toISOString(),
            done: false,
            origin: "manual",
          },
        }),

      setSequenceStatus: (sequenceId, status) =>
        dispatch({ type: "set_sequence_status", sequenceId, status }),

      updateStep: (sequenceId, stepId, patch) =>
        dispatch({ type: "update_step", sequenceId, stepId, patch }),

      reconnectMailbox: (mailboxId) =>
        dispatch({ type: "reconnect_mailbox", mailboxId }),

      addPost: (skill, hook) =>
        dispatch({
          type: "add_post",
          post: {
            id: nextId("post"),
            ref: `POST-${1000 + sequence}`,
            orgId: ORG.id,
            skill,
            hook,
            body: "",
            status: "idea",
            scheduledFor: null,
            createdAt: NOW.toISOString(),
          },
        }),

      setPostStatus: (postId, status) =>
        dispatch({ type: "set_post_status", postId, status }),

      memberById: (id) => MEMBERS.find((m) => m.id === id),

      stagesForJob: (jobId) =>
        STAGES.filter((s) => s.jobId === jobId).sort((a, b) => a.position - b.position),

      candidatesForJob: (jobId) =>
        state.candidates.filter(
          (c) => c.jobId === jobId && !state.archivedIds.includes(c.id),
        ),

      metricsFor: (candidateId) => {
        const events = state.activity.filter((a) => a.candidateId === candidateId);
        return {
          emails: events.filter((e) => e.kind === "email_sent").length,
          notes: state.notes.filter((n) => n.candidateId === candidateId).length,
          documents: events.filter((e) => e.kind === "document_added").length,
          interviews: events.filter((e) => e.kind === "interview_scheduled").length,
        };
      },

      notesFor: (candidateId) =>
        state.notes
          .filter((n) => n.candidateId === candidateId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

      activityFor: (candidateId) =>
        state.activity
          .filter((a) => a.candidateId === candidateId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }, [state, selection, toggleSelected, clearSelection, selectMany]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
