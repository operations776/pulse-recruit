import type { LucideIcon } from "lucide-react";
import { hueText, type Hue } from "@/lib/hue";

// Marketing structural device. It names the section, it does not decorate it.
export function EyebrowPill({
  icon: Icon,
  label,
  hue = "vermilion",
}: {
  icon: LucideIcon;
  label: string;
  hue?: Hue;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-white px-2.5 py-1 ">
      <Icon size={12} strokeWidth={2.25} className={hueText[hue]} />
      <span className="micro-label text-ink-soft">{label}</span>
    </span>
  );
}
