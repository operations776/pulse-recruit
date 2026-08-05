import {
  BookOpen,
  Briefcase,
  ChartLine,
  ClipboardCheck,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import type { ContentSkill } from "@/lib/types";

// Pillar 5. A recruiter never starts from a blank page. They pick a named
// skill, which is a post shape, and the engine hands back the frame. The frame
// is deliberately three short lines: long enough to remove the blank page,
// short enough that the recruiter still writes the post in their own voice.
export type ContentSkillDef = {
  key: ContentSkill;
  name: string;
  blurb: string;
  prompt: string;
  icon: LucideIcon;
};

export const SKILLS: ContentSkillDef[] = [
  {
    key: "jd_post",
    name: "Role post",
    blurb:
      "Use when a live role deserves a wider audience than the people already applying to it.",
    prompt: [
      "Hook: the role, the city, the working pattern, and the top of the band. No coy salary.",
      "Edge: the one thing about this job a candidate cannot get at the obvious competitor.",
      "Ask: invite a reply, not an application. A comment or a DM is enough to start.",
    ].join("\n"),
    icon: Briefcase,
  },
  {
    key: "personal_story",
    name: "Personal story",
    blurb:
      "Use when something in your own week taught you a lesson another recruiter would recognise.",
    prompt: [
      "Moment: one specific thing that happened this week, with the detail that makes it real.",
      "Cost: what it actually cost you. A placement, a client, a weekend.",
      "Change: the rule you now work by because of it.",
    ].join("\n"),
    icon: BookOpen,
  },
  {
    key: "market_insight",
    name: "Market insight",
    blurb:
      "Use when a number off your own desk says something the market has not said out loud yet.",
    prompt: [
      "Observation: one number from your own data, with the window it covers.",
      "Cause: why it is happening, in plain terms, not a trend word.",
      "Action: what a hiring manager should change on Monday because of it.",
    ].join("\n"),
    icon: ChartLine,
  },
  {
    key: "candidate_story",
    name: "Candidate story",
    blurb:
      "Use when a placement turned on a detail nobody watching would have predicted.",
    prompt: [
      "Setback: where this person was stuck. Anonymised, no employer named, no identifying role.",
      "Turn: the non obvious thing that changed the outcome.",
      "Outcome: where they landed and how long it took.",
    ].join("\n"),
    icon: UserRoundCheck,
  },
  {
    key: "hiring_advice",
    name: "Hiring advice",
    blurb:
      "Use when you keep watching the same process mistake cost the same clients the same people.",
    prompt: [
      "Mistake: the exact step in their hiring process that is doing the damage.",
      "Cost: what it loses them, counted in days, dropouts, or declined offers.",
      "Fix: the smaller thing to do instead, specific enough to run this week.",
    ].join("\n"),
    icon: ClipboardCheck,
  },
];

export const SKILL_BY_KEY = Object.fromEntries(
  SKILLS.map((skill) => [skill.key, skill]),
) as Record<ContentSkill, (typeof SKILLS)[number]>;

/**
 * A colour per skill, for the calendar.
 *
 * Daniyal, on the shipped planner: "very bland, just orange, white, gray."
 * True, and it was a deliberate choice that went too far: every card was the
 * same cream, so a month of posts told you how many you had written and
 * nothing about what they were.
 *
 * These are accents, not fills. A card gets a 3px left edge and a tinted icon,
 * which is enough to read the mix of a month at a glance without turning the
 * grid into confetti. DESIGN.md rule 9 still holds: colour never carries
 * status on its own, every state also has an icon and a word, and status
 * colours (teal published, red failed) still override these.
 *
 * `tint` is the wash used behind an accent; `edge` is the left rule; `text`
 * colours the icon. All six sit at 4.5:1 or better on cream.
 */
export type SkillPalette = { edge: string; tint: string; text: string };

export const SKILL_COLOURS: Record<string, SkillPalette> = {
  jd_post: {
    edge: "border-l-[#2f6fb8]",
    tint: "bg-[#eaf2fb]",
    text: "text-[#245a97]",
  },
  personal_story: {
    edge: "border-l-[#a8579b]",
    tint: "bg-[#f9edf7]",
    text: "text-[#8a4380]",
  },
  market_insight: {
    edge: "border-l-[#0f6e56]",
    tint: "bg-[#e1f5ee]",
    text: "text-[#085041]",
  },
  candidate_story: {
    edge: "border-l-[#ba7517]",
    tint: "bg-[#faeeda]",
    text: "text-[#854f0b]",
  },
  hiring_advice: {
    edge: "border-l-[#4a5bbf]",
    tint: "bg-[#eeeffc]",
    text: "text-[#3a4899]",
  },
};

// Anything org-defined, and any built-in that ever gets added without a colour
// here. Neutral rather than a random hue: an unnamed shape should not shout.
const SKILL_COLOUR_FALLBACK: SkillPalette = {
  edge: "border-l-[#9a9284]",
  tint: "bg-well",
  text: "text-ink-2",
};

export function skillColour(key: string): SkillPalette {
  return SKILL_COLOURS[key] ?? SKILL_COLOUR_FALLBACK;
}
