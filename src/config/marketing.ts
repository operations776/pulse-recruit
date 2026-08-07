// PLS-107. Every word on the marketing site, in one file.
//
// Copy is ported from the rebrand's HTML rather than rewritten, because the
// pricing and the positioning are commercial decisions Daniyal has already
// made. Two deliberate edits throughout:
//
//   1. Em dashes become commas or colons, per the house rule.
//   2. Testimonial quotes and headline metrics are NOT copied. The rebrand
//      attributes invented quotes to real RecruiterGTM clients by name and
//      claims "40+ Agencies on Pulse", which is not true today. Publishing
//      that would put words in the mouths of people who never said them, so
//      the page ships with its layout and a placeholder that says so.

export const HERO = {
  // The rebrand cycles this word every four seconds. The list is here so the
  // component does not own the copy.
  headline: "The ATS that keeps your pipeline",
  cycle: ["alive", "moving", "warm", "closing", "on track", "unstuck", "ahead"],
  sub: "Pulse Recruit gives your agency one live view of every placement, candidate, and client task, so nobody goes cold and no follow-up slips.",
} as const;

export const HOW_IT_WORKS = [
  {
    step: "Step 01",
    title: "Import your pipeline",
    body: "Drop in candidates, clients, and open searches from your ATS or a spreadsheet. Pulse maps them onto placement and candidate stages automatically.",
  },
  {
    step: "Step 02",
    title: "Pulse surfaces cold spots",
    body: "Every candidate and client task carries an activity signal. When something stalls or a follow-up is overdue, it rises to the top before it goes cold.",
  },
  {
    step: "Step 03",
    title: "Your team acts, not digs",
    body: "Tasks route to the right recruiter with context attached. One board shows the whole agency what to move today, no status meeting required.",
  },
] as const;

export const FEATURES = [
  {
    title: "Pipeline that stays warm",
    body: "Every candidate and search carries an activity signal, so the ones going quiet surface before they ghost.",
  },
  {
    title: "One record per person",
    body: "Unified candidate and client profiles, every touch and note on one timeline, attributed to whoever took it.",
  },
  {
    title: "Signals that start conversations",
    body: "Hiring, funding and job-move signals on the companies you are chasing, straight from the feed to the first touch.",
  },
  {
    title: "An ops manager that works",
    body: "One list of what the team owes, who is carrying it, and what is already late. Add a task by typing a sentence.",
  },
  {
    title: "Numbers that mean something",
    body: "Time to first touch, source quality by channel, stage velocity across the desk.",
  },
  {
    title: "Fast enough to live in",
    body: "Dense screens, keyboard-first, and no waiting on a spinner to see your own pipeline.",
  },
] as const;

// Real, and checkable: these two people exist and build this product.
export const TEAM = [
  {
    name: "Daniyal Aziz",
    role: "AI Automation Engineer",
    body: "Builds the automation and data systems behind every RecruiterGTM engagement, and the Pulse Recruit platform itself.",
  },
  {
    name: "Reyhan Khan",
    role: "Growth and Client Delivery",
    body: "Leads client delivery and growth, turning every agency's live pipeline on Pulse into real placements.",
  },
] as const;

/**
 * Pricing. A commercial decision, ported exactly.
 *
 * The $50 founding rate matches what is already recorded in TICKETS.md, so
 * this is not placeholder copy from a design file.
 */
export const PRICING = {
  badge: "Founding pilot, 10 agencies",
  amount: "$50",
  period: "/month",
  after: "then $299/month, lock the founding rate for life",
  includes: [
    "Unlimited candidates, clients and placements",
    "Live pipeline board with cold-spot signals",
    "Client task routing across your whole team",
    "AI ops manager, 250 credits per week",
    "Guided import from your current ATS",
  ],
  note: "No credit card to start. Cancel anytime. Your data exports whenever you want.",
  everything: [
    {
      title: "Whole team, no seat fees",
      body: "Invite every recruiter on the desk at no extra cost.",
    },
    {
      title: "Unlimited records",
      body: "Candidates, clients, placements and tasks, no caps.",
    },
    {
      title: "Cold-spot signals",
      body: "Every candidate carries an activity signal, always on.",
    },
    {
      title: "AI operations manager",
      body: "Reads your own pipeline, never the open web.",
    },
    {
      title: "Guided onboarding",
      body: "We map your ATS export and you are live the same day.",
    },
    {
      title: "Founding rate for life",
      body: "Lock $50 a month for as long as you stay on the plan.",
    },
  ],
} as const;

export type FaqGroup = { group: string; items: { q: string; a: string }[] };

// All 15 questions, ported from the JS array the rebrand injects at runtime.
// Rendered server-side here so they are in the HTML for search engines and
// for anyone with JavaScript off.
export const FAQ: FaqGroup[] = [
  {
    group: "Getting started",
    items: [
      {
        q: "What is Pulse Recruit?",
        a: "Pulse Recruit is an ATS and operations platform built for boutique recruiting agencies. It keeps your pipeline, candidates, clients, and outbound signals in one live system, with an AI layer across five pillars: Market, Ops, Outbound, Talent, and Content.",
      },
      {
        q: "How do I import my existing data?",
        a: "Guided import brings candidates, clients, and open searches from your current ATS or a spreadsheet in minutes. During your pilot we map your columns to Pulse fields with you, so nothing lands in the wrong place.",
      },
      {
        q: "How long does setup take?",
        a: "Most desks are working in their real pipeline the same day. There is no migration project: you import what you have, and Pulse starts surfacing what needs attention immediately.",
      },
    ],
  },
  {
    group: "Pipeline and data",
    items: [
      {
        q: "How does the pipeline stay warm?",
        a: "Every candidate and search carries an activity signal. Records going cold surface at the top of the pipeline before they ghost, so you follow up while it still matters.",
      },
      {
        q: "Can my whole team work in the same workspace?",
        a: "Yes. A workspace is shared across your desk, with per-person write access. Every action is attributed to the teammate who took it, so you always know who moved what.",
      },
      {
        q: "Is my data mine to export?",
        a: "Always. Your candidates, clients, and history are yours. Export them at any time, nothing is locked in.",
      },
    ],
  },
  {
    group: "The AI pillars",
    items: [
      {
        q: "What do the five pillars actually do?",
        a: "Market researches your niche and buyers; Ops is the shared task list the whole team works from; Outbound turns hiring and funding signals into campaigns; Talent keeps searches moving to placed; Content plans posts in your voice.",
      },
      {
        q: "Does the AI make changes on its own?",
        a: "No. The pillars surface advice, drafts, and briefs, and you stay in control and approve anything that acts. Answers are evidence-backed so you can see why before you act.",
      },
      {
        q: "What are credits?",
        a: "Credits meter the AI work each week per workspace. One credit is one US cent of provider spend, reserved before a call and settled at the real cost after, so the meter is exact rather than estimated. You can see how many are left and when they reset in the app.",
      },
    ],
  },
  {
    group: "Pilots and billing",
    items: [
      {
        q: "How does the pilot work?",
        a: "Start a pilot on your own pipeline. Import what you have and Pulse starts surfacing what needs attention the same day. No long commitment; you decide once you have seen it on your real desk.",
      },
      {
        q: "How is Pulse priced?",
        a: "One plan at a founding rate of $50 a month for the first ten agencies, then $299 a month. The founding group keeps its rate for as long as it stays subscribed.",
      },
      {
        q: "Can I change plans later?",
        a: "Yes. Move up or cancel whenever you want, and your data exports either way.",
      },
    ],
  },
  {
    group: "Security and support",
    items: [
      {
        q: "How is my data secured?",
        a: "Access is scoped to your workspace and controlled per person, enforced in the database itself rather than only in the application. Authentication is handled by managed auth, and secrets never touch the browser.",
      },
      {
        q: "How do I get help?",
        a: "Email operations@recruitergtm.com and a human replies, usually within one business day.",
      },
      {
        q: "Do you offer onboarding support?",
        a: "Yes. Guided import and a walkthrough of your own desk are part of every pilot.",
      },
    ],
  },
];
