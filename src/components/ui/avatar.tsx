import Image from "next/image";
import { AVATAR_TILE, initials } from "@/lib/hue";

// DESIGN.md section 5: rounded squares at --r-card, never circles.
const sizes = {
  sm: { box: "size-8", text: "text-[13px]", px: 32 },
  md: { box: "size-10", text: "text-[13px]", px: 40 },
  lg: { box: "size-11", text: "text-[15px]", px: 44 },
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
        className={`${s.box} shrink-0 rounded-card object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${s.box} ${s.text} ${AVATAR_TILE} flex shrink-0 items-center justify-center rounded-card font-mono tracking-[0.08em]`}
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
        <span className="meta flex size-8 items-center justify-center rounded-card bg-well text-ink-2">
          +{names.length - max}
        </span>
      ) : null}
    </span>
  );
}
