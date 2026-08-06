"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ToastProvider } from "@/components/ui/toast";
import { brand } from "@/config/brand";
import { createClient } from "@/lib/supabase/client";

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

// Two modes, decided on mount. "account" is a cold signup. "workspace" is a
// signed in user whose org never got created, which is where requireSession
// sends them, and there the only thing left to ask for is the agency name.
type Mode = "account" | "workspace";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readable(message: string): string {
  if (message.includes("User already registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (message.includes("Password should be at least")) {
    return "Pick a longer password, at least six characters.";
  }
  if (message.includes("Unable to validate email address")) {
    return "That does not look like an email address.";
  }
  if (message.includes("orgs_slug_key") || message.includes("duplicate key")) {
    return "That agency name is already taken. Try a different one.";
  }
  return message;
}

function SignUpCard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!live) return;
      setMode(data.user ? "workspace" : "account");
    });
    return () => {
      live = false;
    };
  }, []);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const createWorkspace = async (agency: string): Promise<boolean> => {
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("bootstrap_org", {
      org_name: agency,
      org_slug: slugify(agency),
    });
    if (rpcError) {
      setError(readable(rpcError.message));
      return false;
    }
    return true;
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const agency = form.agency.trim();

    if (mode === "workspace") {
      if (!agency) {
        setError("Name your agency to finish the workspace.");
        return;
      }
      if (!slugify(agency)) {
        setError("Use at least one letter or number in the agency name.");
        return;
      }

      setPending(true);
      if (!(await createWorkspace(agency))) {
        setPending(false);
        return;
      }
      router.push("/pipeline");
      router.refresh();
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim();

    if (!name || !email || !form.password || !agency) {
      setError("Fill in every field to create your workspace.");
      return;
    }
    if (!slugify(agency)) {
      setError("Use at least one letter or number in the agency name.");
      return;
    }

    setPending(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: { data: { name } },
    });

    if (signUpError) {
      setError(readable(signUpError.message));
      setPending(false);
      return;
    }

    // No session means email confirmation is on. The workspace cannot be
    // created yet, and saying otherwise would be a lie the user finds out
    // about on their next visit.
    if (!data.session) {
      setNotice(
        `Check ${email} and click the confirmation link. Your workspace is created the first time you sign in.`,
      );
      setPending(false);
      return;
    }

    if (!(await createWorkspace(agency))) {
      setPending(false);
      return;
    }

    router.push("/pipeline");
    router.refresh();
  };

  const workspaceOnly = mode === "workspace";

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
        {workspaceOnly ? "Name your workspace" : "Create your workspace"}
      </h1>
      <p className="mt-1.5 text-[12px] text-ink-2">
        {workspaceOnly
          ? "Your account is ready. Your agency does not have a workspace yet, so give it a name and you are in."
          : "One workspace per agency. Invite the rest of the desk once you are in."}
      </p>

      {mode === null ? (
        <p className="mt-5 text-[12px] text-ink-2">Checking your account</p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-3.5">
          {workspaceOnly ? null : (
            <>
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
            </>
          )}

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

          {notice ? (
            <p role="status" className="text-[12px] text-ink-2">
              {notice}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            disabled={pending}
            className="mt-1 w-full"
          >
            {pending ? "Creating workspace" : "Create workspace"}
          </Button>
        </form>
      )}

      <p className="mt-5 text-center text-[12px] text-ink-2">
        <Link
          href="/signin"
          className="font-semibold text-violet-hover hover:underline"
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
