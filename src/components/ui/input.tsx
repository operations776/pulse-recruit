"use client";

import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

// Width is deliberately NOT in the base. Baking w-full in here forced every
// inline filter select to full width and stacked the filter bar vertically.
// Callers own their width; the default suits form fields.
const base =
  "rounded-lg border border-line bg-surface text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-emerald-600 focus:outline-none";

export function Input({ className = "w-full", ...props }: ComponentProps<"input">) {
  return <input className={`${base} h-[34px] px-3 ${className}`} {...props} />;
}

export function Textarea({
  className = "w-full",
  ...props
}: ComponentProps<"textarea">) {
  return <textarea className={`${base} px-3 py-2 leading-5 ${className}`} {...props} />;
}

export function Select({
  className = "w-full",
  children,
  ...props
}: ComponentProps<"select"> & { children: ReactNode }) {
  return (
    <select className={`${base} h-[34px] px-2.5 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function SearchInput({
  className = "",
  ...props
}: ComponentProps<"input">) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <Search
        size={14}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-3 text-ink-400"
      />
      <input
        type="search"
        className={`${base} h-[34px] w-full rounded-full pl-8 pr-3`}
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
    <label className="flex flex-col gap-1.5">
      <span className="micro-label text-ink-600">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-ink-400">{hint}</span> : null}
    </label>
  );
}
