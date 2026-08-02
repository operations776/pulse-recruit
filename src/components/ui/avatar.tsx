import Image from "next/image";
import { hueFor, hueText, hueTint, initials } from "@/lib/hue";

// DESIGN.md: people look like people. Photo when we have one, hue-tinted
// initials when we do not. Never a grey circle.

const sizes = {
  sm: { box: "size-6", text: "text-[10px]", px: 24 },
  md: { box: "size-8", text: "text-[11px]", px: 32 },
  lg: { box: "size-10", text: "text-[13px]", px: 40 },
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  ring = false,
}: {
  name: string;
  src?: string;
  size?: keyof typeof sizes;
  ring?: boolean;
}) {
  const s = sizes[size];
  const hue = hueFor(name);
  const ringClass = ring ? "ring-2 ring-surface" : "";

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={s.px}
        height={s.px}
        className={`${s.box} shrink-0 rounded-full object-cover ${ringClass}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${s.box} ${s.text} ${hueTint[hue]} ${hueText[hue]} ${ringClass} flex shrink-0 items-center justify-center rounded-full font-semibold`}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  names,
  max = 3,
}: {
  names: string[];
  max?: number;
}) {
  return (
    <span className="flex items-center">
      {names.slice(0, max).map((n) => (
        <span key={n} className="-ml-1.5 first:ml-0" title={n}>
          <Avatar name={n} size="sm" ring />
        </span>
      ))}
      {names.length > max ? (
        <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-line-soft text-[10px] font-semibold text-ink-600 ring-2 ring-surface">
          +{names.length - max}
        </span>
      ) : null}
    </span>
  );
}
