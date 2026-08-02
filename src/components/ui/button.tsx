import type { ComponentProps } from "react";

// DESIGN.md section 9. Keycap edge, sentence case never uppercase, 48px for
// primary and 44px minimum for everything else.
const variants = {
  primary:
    "cap bg-vermilion text-on-vermilion hover:bg-vermilion-hover [--edge:var(--color-vermilion-edge)]",
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
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-[12px] font-medium disabled:opacity-40 ${variants[variant]} ${sizes[resolved]} ${className}`}
      {...props}
    />
  );
}
