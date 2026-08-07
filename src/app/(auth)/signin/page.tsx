"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { brand } from "@/config/brand";
import { createClient } from "@/lib/supabase/client";

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

// Supabase messages are accurate but written for developers. Translate the ones
// a recruiter will actually hit, and pass anything else through unchanged so a
// real failure is never hidden behind a friendly guess.
function readable(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "That email and password do not match.";
  }
  if (message.includes("Email not confirmed")) {
    return "Confirm your email address first, then sign in.";
  }
  if (message.includes("Email logins are disabled")) {
    return "Password sign in is switched off for this workspace.";
  }
  return message;
}

function SignInCard() {
  const { notify } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password to sign in.");
      return;
    }

    setError("");
    setPending(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(readable(signInError.message));
      setPending(false);
      return;
    }

    // The next param is read here rather than through useSearchParams so the
    // page does not need a Suspense boundary just to know where to land.
    const next =
      new URLSearchParams(window.location.search).get("next") || "/pipeline";

    router.push(next);
    // Middleware reads the session cookie on the next request, so the refresh
    // is what makes the new session visible to the server tree.
    router.refresh();
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
        <span className="display text-[13px] font-medium">{brand.name}</span>
      </span>

      <h1 className="mt-6 display text-[18px] font-medium leading-7 tracking-[-0.01em]">
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

        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          className="mt-1 w-full"
        >
          {pending ? "Signing in" : "Sign in"}
        </Button>
      </form>

      {/* Pre-launch build, so the demo login is printed on the panel rather
          than passed around in a message. */}
      <div className="well mt-4 rounded-control p-3">
        <p className="legend text-ink-2">Demo account</p>
        <p className="mt-1.5 font-mono text-[12px] tabular-nums text-ink">
          daniyal@nortech.io
        </p>
        <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink">
          pulse-demo-2026
        </p>
      </div>

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
          className="font-medium text-violet-hover hover:underline"
        >
          New here? Create an account
        </Link>
      </p>
    </div>
  );
}
