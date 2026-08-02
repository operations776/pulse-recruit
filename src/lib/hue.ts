// Identity palette assignment. DESIGN.md: the six hues categorize, they never
// decorate, so the same key must always resolve to the same hue.

export const HUES = [
  "coral",
  "amber",
  "indigo",
  "violet",
  "sky",
  "pink",
] as const;

export type Hue = (typeof HUES)[number];

// Ordered collections (pipeline stages, workspace tiles) assign by position so
// neighbours can never collide. Hashing is only correct for unordered identity.
export function hueByIndex(index: number): Hue {
  return HUES[index % HUES.length];
}

export function hueFor(key: string): Hue {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return HUES[hash % HUES.length];
}

// Tailwind cannot see dynamically built class names, so the variants are
// spelled out. Text and background are kept separate because tinted surfaces
// use the same hue at low opacity.
export const hueText: Record<Hue, string> = {
  coral: "text-hue-coral",
  amber: "text-hue-amber",
  indigo: "text-hue-indigo",
  violet: "text-hue-violet",
  sky: "text-hue-sky",
  pink: "text-hue-pink",
};

export const hueBg: Record<Hue, string> = {
  coral: "bg-hue-coral",
  amber: "bg-hue-amber",
  indigo: "bg-hue-indigo",
  violet: "bg-hue-violet",
  sky: "bg-hue-sky",
  pink: "bg-hue-pink",
};

export const hueTint: Record<Hue, string> = {
  coral: "bg-hue-coral/10",
  amber: "bg-hue-amber/10",
  indigo: "bg-hue-indigo/10",
  violet: "bg-hue-violet/10",
  sky: "bg-hue-sky/10",
  pink: "bg-hue-pink/10",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
