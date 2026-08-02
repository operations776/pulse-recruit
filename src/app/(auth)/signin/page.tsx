"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { brand } from "@/config/brand";

// These routes sit outside the app shell, so the toast context is mounted here
// rather than inherited from the (app) layout.
export default function SignInPage() {
  return (
    <ToastProvider>
      <div className="flex flex-1 items-center justify-center bg-paper px-6 py-12">
        <SignInCard />
      </div>
    </ToastProvider>
  );
}

function SignInCard() {
  const { notify } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password to sign in.");
      return;
    }
    setError("");
    notify(`Signing in as ${email.trim()}`);
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
        Welcome back
      </h1>
      <p className="mt-1.5 text-[12px] text-ink-2">
        Sign in to pick your pipeline back up where you left it.
      </p>

      <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-3.5">
        <Field label="Email">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-[12px] font-medium text-red">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" className="mt-1 w-full">
          Sign in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-rule" />
        <span className="text-[12px] text-ink-3">or</span>
        <span aria-hidden className="h-px flex-1 bg-rule" />
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={() => notify("Google sign in is not connected yet")}
      >
        Continue with Google
      </Button>

      <p className="mt-5 text-center text-[12px] text-ink-2">
        <Link
          href="/signup"
          className="font-semibold text-vermilion-hover hover:underline"
        >
          New here? Create an account
        </Link>
      </p>
    </div>
  );
}
