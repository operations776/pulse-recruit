// The ONLY place the product name and identity live. A rename touches this file and nothing else.
//
// PLS-102: "Pulse" became "Pulse Recruit", the name on the rebrand. `short` is
// the masthead: "PULSE RECRUIT" set in Archivo at display size does not fit the
// 48px top bar next to the workspace switcher, and the rebrand's own header
// sets the two words on one line at a smaller size. Anything that needs the
// full name uses `name`.
// The BD strategist's name lives here for the same reason the product name
// does: it is written into the greeting, the persona panel, the drawer, the
// ledger copy and the system prompt, and a rename that has to find all of
// those by hand will miss one.
//
// PLS-134: "Mara" became "Reyhan", Daniyal's call. Note this is the name of
// RecruiterGTM's CEO, used deliberately as branding. `pronoun` exists because
// the copy previously said "she" about a made up persona, and a real person's
// name carries a real person's pronouns.
export const agent = {
  name: "Reyhan",
  role: "your BD strategist",
  pronoun: "he",
  possessive: "his",
} as const;

export const brand = {
  name: "Pulse Recruit",
  short: "Pulse",
  tagline: "The ATS that keeps your pipeline alive",
  company: "RecruiterGTM",
  domain: "pulse.recruitergtm.io",
  supportEmail: "operations@recruitergtm.com",
} as const;
