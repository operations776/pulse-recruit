import {
  BarChart3,
  Building2,
  CalendarDays,
  Kanban,
  ListChecks,
  Mail,
  MessageSquare,
  PenLine,
  KeyRound,
  Radio,
  Send,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/types";

// DESIGN.md section 8: four products behind one nav is the hardest problem in
// this product, and colour is fully spoken for by roles. Identity therefore
// runs through the masthead wordmark and the record ID prefix, both of which
// survive being exported, printed and pasted into an email.
//
// One module per RecruiterGTM pillar.
export type ModuleDef = {
  key: ModuleKey | "settings";
  wordmark: string;
  // Null for rooms that are not one of the five pillars. The masthead prints
  // "Workspace" rather than inventing a pillar number for them.
  pillar: number | null;
  pillarName: string;
  prefix: string;
  href: string;
  icon: LucideIcon;
  blurb: string;
  nav: { href: string; label: string; icon: LucideIcon }[];
};

export const MODULES: ModuleDef[] = [
  {
    key: "market",
    wordmark: "MARKET",
    pillar: 1,
    pillarName: "Offer productization",
    prefix: "BD",
    href: "/market",
    icon: Sparkles,
    blurb:
      "The BD engine. Ask what the market is doing and get an answer built from live research, with every source listed.",
    nav: [{ href: "/market", label: "BD engine", icon: MessageSquare }],
  },
  {
    key: "ops",
    wordmark: "OPS",
    pillar: 2,
    pillarName: "AI operations manager",
    prefix: "TASK",
    href: "/ops",
    icon: ListChecks,
    blurb:
      "Your ops manager. It reads your pipeline and tells you what moved, what stalled, and what needs you today.",
    nav: [
      { href: "/ops", label: "Morning brief", icon: MessageSquare },
      { href: "/ops/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    key: "outbound",
    wordmark: "OUTBOUND",
    pillar: 3,
    pillarName: "Multichannel outbound",
    prefix: "SEQ",
    href: "/signals",
    icon: Radio,
    blurb:
      "Signals from your Dream 100, the sequences they trigger, and the mailboxes that send them.",
    nav: [
      { href: "/signals", label: "Signals", icon: Radio },
      { href: "/sequences", label: "Sequences", icon: Send },
      { href: "/mailboxes", label: "Mailboxes", icon: Mail },
    ],
  },
  {
    key: "talent",
    wordmark: "TALENT",
    pillar: 4,
    pillarName: "ATS",
    prefix: "CAND",
    href: "/pipeline",
    icon: Kanban,
    blurb: "The pipeline, the people, and the companies you place them into.",
    nav: [
      { href: "/pipeline", label: "Pipeline", icon: Kanban },
      { href: "/candidates", label: "Candidates", icon: Users },
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    key: "content",
    wordmark: "CONTENT",
    pillar: 5,
    pillarName: "Content",
    prefix: "POST",
    href: "/content",
    icon: PenLine,
    blurb:
      "The content engine. Write through a named skill, then plan the week rather than starting from zero every Monday.",
    nav: [
      { href: "/content", label: "Planner", icon: CalendarDays },
      { href: "/content/skills", label: "Skills", icon: Sparkles },
    ],
  },
];

// Settings is a room, not a pillar. It is not in MODULES because the icon rail
// mounts it separately at the bottom, but it still needs a masthead: without
// one, moduleForPath fell through to TALENT and the sidebar told you that you
// were in the ATS while you were editing API keys. DESIGN.md section 8 exists
// to stop exactly that.
export const SETTINGS_MODULE: ModuleDef = {
  key: "settings",
  wordmark: "SETTINGS",
  pillar: null,
  pillarName: "Workspace and keys",
  prefix: "SET",
  href: "/settings",
  icon: Settings,
  blurb:
    "Your workspace, your team, your plan, and the accounts you connect to Pulse.",
  nav: [
    { href: "/settings", label: "Workspace", icon: SlidersHorizontal },
    { href: "/settings/channels", label: "Channels", icon: Share2 },
    { href: "/settings/integrations", label: "API keys", icon: KeyRound },
  ],
};

export function moduleForPath(pathname: string): ModuleDef {
  const match = MODULES.find((m) =>
    m.nav.some(
      (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
    ),
  );
  if (match) return match;

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return SETTINGS_MODULE;
  }

  return MODULES.find((m) => m.key === "talent")!;
}
