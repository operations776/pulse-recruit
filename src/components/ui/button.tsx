import type { ComponentProps } from "react";

// DESIGN.md: pill radius, 34px default, 28px compact. Buttons say what they do.

const variants = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700",
  secondary:
    "border border-line bg-surface text-ink-900 hover:bg-canvas",
  ghost: "text-ink-600 hover:bg-canvas hover:text-ink-900",
  danger:
    "border border-danger-500/30 text-danger-500 hover:bg-danger-500/5",
} as const;

const sizes = {
  md: "h-[34px] px-3.5 text-[13px]",
  sm: "h-7 px-3 text-[12px]",
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
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors duration-150 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
