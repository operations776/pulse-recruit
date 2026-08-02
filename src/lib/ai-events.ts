// The wire format between the research engine and the transcript.
//
// Client-safe on purpose: the route handler writes these and the chat panel
// reads them, so they cannot drift. No server-only import belongs here.

import type { ChatSource } from "@/lib/supabase/types";

// What the engine is doing right now, in the recruiter's words rather than the
// engine's. These are shown live, so they say what is happening, not which
// function is on the stack.
export type RunPhase =
  | "reserving"
  | "planning"
  | "searching"
  | "reading"
  | "checking"
  | "writing"
  | "settling";

export type AskEvent =
  // The run has a home in the transcript. Sent first, so a reload mid-run can
  // still find the message that is in flight.
  | { type: "opened"; messageId: string; reserved: number }
  | { type: "phase"; phase: RunPhase; detail?: string }
  // One line per unit of work performed: a search issued, a page read, a
  // pipeline query run. This is the audit trail the user watches happen.
  | { type: "step"; label: string; detail: string }
  | { type: "source"; source: ChatSource }
  | { type: "delta"; text: string }
  // The text streamed so far was the model thinking out loud before reaching
  // for a tool, not the answer. Clear the draft and keep waiting.
  | { type: "reset" }
  | {
      type: "done";
      messageId: string;
      creditsSpent: number;
      creditsRefunded: number;
      availableAfter: number;
    }
  | { type: "error"; message: string; retryable: boolean };

export function encodeEvent(event: AskEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// Parse a raw SSE buffer into whole events, returning whatever tail could not
// be parsed yet so the caller can prepend it to the next chunk. A partial JSON
// frame at a chunk boundary is normal, not an error.
export function decodeEvents(buffer: string): {
  events: AskEvent[];
  rest: string;
} {
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  const events: AskEvent[] = [];

  for (const frame of frames) {
    const line = frame.trim();
    if (!line.startsWith("data:")) continue;
    try {
      events.push(JSON.parse(line.slice(5).trim()) as AskEvent);
    } catch {
      // A frame we cannot parse is dropped rather than killing the stream.
      // The run still settles server side, so nothing is lost but a status line.
    }
  }

  return { events, rest };
}
