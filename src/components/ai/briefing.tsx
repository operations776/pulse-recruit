"use client";

import { AlertTriangle, Compass, Quote, Target, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

// PLS-96. A BD answer, rendered as a briefing.
//
// The model writes four labelled sections as plain text. We parse the labels
// here rather than asking it for JSON, deliberately: a model that must close a
// JSON object is a model that truncates mid-answer and renders nothing, and a
// research answer is worth more than its formatting. If the labels are missing
// or the model wrote prose instead, `parseBriefing` returns null and the caller
// shows the text exactly as written. Degrading to plain text is always correct;
// showing a parse error instead of an answer never is.

export type BriefingSection = {
  key: "changed" | "matters" | "move" | "evidence" | "pushback";
  label: string;
  body: string;
};

const LABELS: { key: BriefingSection["key"]; match: RegExp; label: string }[] = [
  { key: "changed", match: /^what changed:?\s*$/i, label: "What changed" },
  { key: "matters", match: /^why it matters:?\s*$/i, label: "Why it matters" },
  { key: "move", match: /^best next move:?\s*$/i, label: "Best next move" },
  { key: "evidence", match: /^evidence:?\s*$/i, label: "Evidence" },
  // PLS-114. The section the strategist writes when he thinks the recruiter
  // is wrong.
  // An adviser who only ever agrees is not an adviser, so this is a first
  // class part of the answer rather than a hedge buried in the prose.
  { key: "pushback", match: /^i'?d push back:?\s*$/i, label: "I'd push back" },
];

// Also accept the label and its content on one line, which models do often
// enough that refusing it would mean falling back to plain text for a
// perfectly well-formed answer.
const INLINE = LABELS.map((entry) => ({
  ...entry,
  match: new RegExp(`^${entry.label}:\\s*(.+)$`, "i"),
}));

/**
 * Pull the four sections out of a written answer.
 *
 * Returns null unless at least the first three are present: an answer missing
 * "Best next move" is not a briefing, and dressing it up as one would imply a
 * recommendation the model never made.
 */
export function parseBriefing(body: string): BriefingSection[] | null {
  const lines = body.split(/\r?\n/);
  const found = new Map<BriefingSection["key"], string[]>();
  let current: BriefingSection["key"] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const heading = LABELS.find((entry) => entry.match.test(trimmed));
    if (heading) {
      current = heading.key;
      if (!found.has(current)) found.set(current, []);
      continue;
    }

    const inline = INLINE.find((entry) => entry.match.test(trimmed));
    if (inline) {
      const [, rest] = trimmed.match(inline.match)!;
      current = inline.key;
      found.set(current, [rest.trim()]);
      continue;
    }

    if (current && trimmed.length > 0) {
      found.get(current)!.push(trimmed);
    }
  }

  const sections = LABELS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    body: (found.get(entry.key) ?? []).join("\n").trim(),
  })).filter((section) => section.body.length > 0);

  const keys = new Set(sections.map((section) => section.key));
  if (!keys.has("changed") || !keys.has("matters") || !keys.has("move")) {
    return null;
  }

  return sections;
}

// Category accents, not status. DESIGN.md section 3: these say which KIND of
// thing a section is, and nothing about whether anything is wrong. Status
// stays teal, amber and red.
const SECTION_STYLE: Record<
  BriefingSection["key"],
  { icon: typeof Compass; edge: string; text: string }
> = {
  changed: {
    icon: TrendingUp,
    edge: "border-l-[#2f6fb8]",
    text: "text-[#245a97]",
  },
  matters: {
    icon: Compass,
    edge: "border-l-[#4a5bbf]",
    text: "text-[#3a4899]",
  },
  // The move is the point of the whole answer, so it carries the strongest
  // accent of the three and sits on a tinted bed.
  move: {
    icon: Target,
    edge: "border-l-[#a8579b]",
    text: "text-[#8a4380]",
  },
  evidence: {
    icon: Quote,
    edge: "border-l-ink-3",
    text: "text-ink-2",
  },
  // Amber, and the only section that uses a status colour. Disagreement IS a
  // status: it is the strategist saying the plan on the table has a problem.
  // The word
  // "I'd push back" carries it too, so the colour is reinforcement.
  pushback: {
    icon: AlertTriangle,
    edge: "border-l-amber",
    text: "text-amber-text",
  },
};

export function Briefing({
  sections,
  footer,
}: {
  sections: BriefingSection[];
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {sections.map((section, index) => {
        const style = SECTION_STYLE[section.key];
        const Icon = style.icon;

        return (
          <section
            key={section.key}
            className={`settle border-l-[3px] py-2.5 pl-3 ${style.edge} ${
              index > 0 ? "mt-2.5 border-t border-t-rule pt-3" : ""
            } ${section.key === "move" ? "bg-move" : ""} ${
              section.key === "pushback" ? "bg-amber-bg" : ""
            }`}
          >
            <p className={`legend flex items-center gap-1.5 ${style.text}`}>
              <Icon size={16} strokeWidth={1.75} className="size-3.5" aria-hidden />
              {section.label}
            </p>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-[1.55]">
              {section.body}
            </p>
          </section>
        );
      })}
      {footer}
    </div>
  );
}
