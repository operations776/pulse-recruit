// The ONLY place the product name and identity live. A rename touches this file and nothing else.
//
// PLS-102: "Pulse" became "Pulse Recruit", the name on the rebrand. `short` is
// the masthead: "PULSE RECRUIT" set in Archivo at display size does not fit the
// 48px top bar next to the workspace switcher, and the rebrand's own header
// sets the two words on one line at a smaller size. Anything that needs the
// full name uses `name`.
export const brand = {
  name: "Pulse Recruit",
  short: "Pulse",
  tagline: "The ATS that keeps your pipeline alive",
  company: "RecruiterGTM",
  domain: "pulse.recruitergtm.io",
  supportEmail: "operations@recruitergtm.com",
} as const;
