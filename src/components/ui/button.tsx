import type { ComponentProps } from "react";

// DESIGN.md section 9. Keycap edge, sentence case never uppercase, 48px for
// primary and 44px minimum for everything else.
const variants = {
  primary:
    "cap bg-violet text-on-violet hover:bg-violet-hover [--edge:var(--color-violet-edge)]",
  secondary:
    "cap border border-ink bg-transparent text-ink hover:bg-well [--edge:var(--color-ink)]",
  ghost: "text-ink-2 hover:bg-well hover:text-ink",
  danger:
    "cap border border-red bg-transparent text-red hover:bg-red-bg [--edge:var(--color-red)]",
} as const;

const sizes = {
  // 48px for primary actions, 44px is the floor for everything else.
  // DESIGN.md section 2: 32px for primary actions, 28px is the floor.
  lg: "h-8 px-3.5",
  md: "h-7 px-3",
} as const;

// DESIGN.md rule 5: violet is a verb. A disabled control is not a verb, so a
// disabled primary drops the cap entirely rather than fading to a washed pink
// that is neither a token colour nor a thing you can press. Rule 2 says the
// keycap edge belongs to things you press, so that goes too.
const disabled =
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-well disabled:text-ink-3 disabled:shadow-none disabled:hover:bg-well disabled:hover:text-ink-3";

export function Button({
  variant = "secondary",
  size,
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  const resolved = size ?? (variant === "primary" ? "lg" : "md");
  return (
    <button
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-[12px] font-medium ${variants[variant]} ${sizes[resolved]} ${disabled} ${className}`}
      {...props}
    />
  );
}
