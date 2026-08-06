"use client";

import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// DESIGN.md 6b and 9: inputs are inset wells, no outer border, 48px tall,
// 17px text, focus ring inset.
const base =
  "well rounded-control text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet";

export function Input({ className = "w-full", ...props }: ComponentProps<"input">) {
  return <input className={`${base} h-8 px-3 ${className}`} {...props} />;
}

export function Textarea({
  className = "w-full",
  ...props
}: ComponentProps<"textarea">) {
  return <textarea className={`${base} px-3 py-2 leading-[1.5] ${className}`} {...props} />;
}

export function Select({
  className = "w-full",
  children,
  ...props
}: ComponentProps<"select"> & { children: ReactNode }) {
  return (
    <select className={`${base} h-8 px-3 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function SearchInput({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <Search
        size={15}
        strokeWidth={2}
        className="pointer-events-none absolute left-3 text-ink-3"
      />
      <input
        type="search"
        className={`${base} h-8 w-full pl-9 pr-3`}
        {...props}
      />
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="legend text-ink-2">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-ink-2">{hint}</span> : null}
    </label>
  );
}
