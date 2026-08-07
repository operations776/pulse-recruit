import Image from "next/image";
import { AVATAR_TILE, initials } from "@/lib/hue";

// PLS-178. Circles, per DESIGN.md section 5 Rev E.
//
// This file used to say "rounded squares at --r-card, never circles", and Rev C
// meant it: the square was doing real work stopping a flat violet product from
// looking like every other dashboard. The warm palette and the elevation ramp
// carry that job now, which is a stronger way to be distinctive than refusing a
// shape.
//
// The size set matches the Figma's: 20/22/26/30 for inline use, 58/64 for the
// identity block. `px` is passed to next/image so it fetches at the right
// density rather than scaling a larger file down.
const sizes = {
  xs: { box: "size-5", text: "text-[9px]", px: 20 },
  sm: { box: "size-[22px]", text: "text-[9px]", px: 22 },
  md: { box: "size-[26px]", text: "text-[10px]", px: 26 },
  lg: { box: "size-[30px]", text: "text-[11px]", px: 30 },
  xl: { box: "size-[58px]", text: "text-[18px]", px: 58 },
  "2xl": { box: "size-16", text: "text-[20px]", px: 64 },
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

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={s.px}
        height={s.px}
        className={`${s.box} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${s.box} ${s.text} ${AVATAR_TILE} flex shrink-0 items-center justify-center rounded-full font-mono tracking-[0.08em]`}
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
        <span className="meta flex size-6 items-center justify-center rounded-card bg-well text-ink-2">
          +{names.length - max}
        </span>
      ) : null}
    </span>
  );
}
