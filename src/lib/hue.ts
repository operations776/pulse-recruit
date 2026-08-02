// Identity palette assignment. DESIGN.md: the six vintage hues categorize, they
// never decorate, so the same key must always resolve to the same hue.

export const HUES = [
  "vermilion",
  "mustard",
  "sage",
  "teal",
  "plum",
  "clay",
] as const;

export type Hue = (typeof HUES)[number];

// Ordered collections (stages, workspace tiles) assign by position so
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

// Tailwind cannot see dynamically built class names, so variants are spelled out.
export const hueText: Record<Hue, string> = {
  vermilion: "text-hue-vermilion",
  mustard: "text-hue-mustard",
  sage: "text-hue-sage",
  teal: "text-hue-teal",
  plum: "text-hue-plum",
  clay: "text-hue-clay",
};

export const hueBg: Record<Hue, string> = {
  vermilion: "bg-hue-vermilion",
  mustard: "bg-hue-mustard",
  sage: "bg-hue-sage",
  teal: "bg-hue-teal",
  plum: "bg-hue-plum",
  clay: "bg-hue-clay",
};

export const hueTint: Record<Hue, string> = {
  vermilion: "bg-hue-vermilion/12",
  mustard: "bg-hue-mustard/12",
  sage: "bg-hue-sage/12",
  teal: "bg-hue-teal/12",
  plum: "bg-hue-plum/12",
  clay: "bg-hue-clay/12",
};

export const hueBorder: Record<Hue, string> = {
  vermilion: "border-hue-vermilion",
  mustard: "border-hue-mustard",
  sage: "border-hue-sage",
  teal: "border-hue-teal",
  plum: "border-hue-plum",
  clay: "border-hue-clay",
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
