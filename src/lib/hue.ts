// Panelboard Soft removes the identity palette entirely: "Modules are not
// colour-coded. Colour roles are fully spoken for." Vermilion is a verb, teal
// means on, amber means look at this, red is destructive. There is no sixth
// hue left to spend on decoration.
//
// Avatars and category marks therefore render neutral: a well-toned tile with
// ink-2 initials. Identity comes from the record ID prefix instead (section 8).

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const AVATAR_TILE = "bg-well text-ink-2";
