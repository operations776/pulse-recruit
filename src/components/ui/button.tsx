import type { ComponentProps } from "react";

// DESIGN.md: square (2px), uppercase mono label. No pills.
const variants = {
  primary:
    "bg-vermilion text-paper-white border border-vermilion hover:bg-vermilion-deep hover:border-vermilion-deep",
  secondary:
    "border border-rule-strong bg-transparent text-ink hover:bg-ink hover:text-paper-white",
  ghost: "border border-transparent text-ink-soft hover:text-ink hover:border-rule",
  danger: "border border-brick text-brick hover:bg-brick hover:text-paper-white",
} as const;

const sizes = {
  md: "h-8 px-3.5",
  sm: "h-[26px] px-2.5",
} as const;

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      className={`btn-label inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sharp transition-colors duration-150 disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
