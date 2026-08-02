"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { brand } from "@/config/brand";

// These routes sit outside the app shell, so the toast context is mounted here
// rather than inherited from the (app) layout.
export default function SignUpPage() {
  return (
    <ToastProvider>
      <div className="flex flex-1 items-center justify-center bg-paper px-6 py-12">
        <SignUpCard />
      </div>
    </ToastProvider>
  );
}

const EMPTY = { name: "", email: "", password: "", agency: "" };

function SignUpCard() {
  const { notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.agency.trim()) {
      setError("Fill in every field to create your workspace.");
      return;
    }
    setError("");
    notify(`Creating the workspace for ${form.agency.trim()}`);
  };

  return (
    <div className="w-full max-w-[400px] rounded-control border border-rule bg-sheet p-6 ">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-control bg-ink"
        >
          <span className="size-2 rounded-full bg-teal" />
        </span>
        <span className="display text-[13px] font-bold">{brand.name}</span>
      </span>

      <h1 className="mt-6 display text-[18px] font-semibold leading-7 tracking-[-0.01em]">
        Create your workspace
      </h1>
      <p className="mt-1.5 text-[12px] text-ink-2">
        One workspace per agency. Invite the rest of the desk once you are in.
      </p>

      <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-3.5">
        <Field label="Full name">
          <Input
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Daniyal Aziz"
          />
        </Field>

        <Field label="Work email">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
            placeholder="you@agency.com"
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set("password")(e.target.value)}
            placeholder="At least 10 characters"
          />
        </Field>

        <Field label="Agency name">
          <Input
            name="agency"
            autoComplete="organization"
            value={form.agency}
            onChange={(e) => set("agency")(e.target.value)}
            placeholder="Nortech Search"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-[12px] font-medium text-red">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" className="mt-1 w-full">
          Create workspace
        </Button>
      </form>

      <p className="mt-5 text-center text-[12px] text-ink-2">
        <Link
          href="/signin"
          className="font-semibold text-vermilion-hover hover:underline"
        >
          Already have an account? Sign in
        </Link>
      </p>

      <p className="mt-3 text-center text-[12px] text-ink-3">
        Questions before you start? {brand.supportEmail}
      </p>
    </div>
  );
}
