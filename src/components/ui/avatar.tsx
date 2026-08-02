import Image from "next/image";
import { hueFor, hueText, hueTint, initials } from "@/lib/hue";

// DESIGN.md: a SQUARE tinted tile with wide-tracked mono initials. The square
// avatar is part of the print language, a circle is not.
const sizes = {
  sm: { box: "size-6", text: "text-[9px]", px: 24 },
  md: { box: "size-8", text: "text-[10px]", px: 32 },
  lg: { box: "size-10", text: "text-[11px]", px: 40 },
} as const;

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string;
  size?: keyof typeof sizes;
}) {
  const s = sizes[size];
  const hue = hueFor(name);

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={s.px}
        height={s.px}
        className={`${s.box} shrink-0 rounded-sharp object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${s.box} ${s.text} ${hueTint[hue]} ${hueText[hue]} flex shrink-0 items-center justify-center rounded-sharp font-mono font-medium tracking-[0.08em]`}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  return (
    <span className="flex items-center gap-1">
      {names.slice(0, max).map((n) => (
        <span key={n} title={n}>
          <Avatar name={n} size="sm" />
        </span>
      ))}
      {names.length > max ? (
        <span className="data-literal flex size-6 items-center justify-center rounded-sharp bg-paper-deep text-[10px] text-ink-soft">
          +{names.length - max}
        </span>
      ) : null}
    </span>
  );
}
