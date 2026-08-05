"use client";

import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import {
  connectLinkedInCookie,
  connectLinkedInCredentials,
  resendLinkedInCheckpoint,
  startLinkedInConnect,
  submitLinkedInCheckpoint,
} from "@/lib/actions";

// PLS-89. Connecting a LinkedIn profile without leaving Pulse.
//
// Three routes to the same place, in the order we recommend them:
//
//   hosted       LinkedIn's own screen on Unipile's domain. No password ever
//                reaches us. Costs a round trip out of the app.
//   credentials  Email and password, straight through. What Daniyal asked for.
//   cookie       The li_at value from a browser already signed in. No password
//                typed anywhere, and the least likely to trip a security check.
//
// The last two can land on a checkpoint: LinkedIn wants a code. Unipile holds
// that intent open for five MINUTES, so the code screen is not something to
// come back to later, and this dialog says so on the screen rather than letting
// someone discover it by timing out.

type Method = "hosted" | "credentials" | "cookie";

const METHODS: { id: Method; label: string; blurb: string }[] = [
  {
    id: "hosted",
    label: "LinkedIn sign in",
    blurb:
      "Opens LinkedIn's own page. Nothing you type there passes through Pulse. Recommended.",
  },
  {
    id: "credentials",
    label: "Email and password",
    blurb:
      "Sign in here. Your password goes to LinkedIn through Unipile and is never stored by Pulse.",
  },
  {
    id: "cookie",
    label: "Session cookie",
    blurb:
      "Paste the li_at cookie from a browser already signed in. No password, and the least likely to be challenged.",
  },
];

/** A checkpoint the connect call came back with, held while the user answers. */
type Pending = { accountId: string; checkpoint: string };

const CHECKPOINT_COPY: Record<string, string> = {
  "2FA": "LinkedIn wants the six digit code from your authenticator app.",
  OTP: "LinkedIn has emailed you a code.",
  IN_APP_VALIDATION:
    "LinkedIn has asked you to approve this in the LinkedIn app, then enter the number it shows.",
  CAPTCHA:
    "LinkedIn wants a captcha solved, which cannot be done from here. Use the LinkedIn sign in method instead.",
  PHONE_REGISTER: "LinkedIn wants a phone number on the account first.",
};

export function ConnectDialog({
  open,
  onClose,
  configured,
}: {
  open: boolean;
  onClose: () => void;
  configured: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [method, setMethod] = useState<Method>("hosted");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cookie, setCookie] = useState("");
  const [code, setCode] = useState("");
  const [checkpoint, setCheckpoint] = useState<Pending | null>(null);
  const [error, setError] = useState("");

  // Clear the password and the cookie whenever the dialog shuts. Neither is
  // ever needed twice, and leaving a credential in component state after the
  // layer is gone keeps it in memory for no reason. This runs on the close
  // path rather than in an effect, so there is no cascading render.
  const close = () => {
    setPassword("");
    setCookie("");
    setCode("");
    setCheckpoint(null);
    setError("");
    onClose();
  };

  const done = (name: string) => {
    // Close BEFORE the refresh. Revalidating under an open dialog remounts the
    // tree and drops whatever is in it, which is the bug class in CLAUDE.md.
    close();
    notify(`${name} is connected. Scheduled posts will go out as this profile.`);
    router.refresh();
  };

  const handle = (result: Awaited<ReturnType<typeof connectLinkedInCredentials>>) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data.step === "checkpoint") {
      setCheckpoint({
        accountId: result.data.accountId,
        checkpoint: result.data.checkpoint,
      });
      setPassword("");
      setError("");
      return;
    }
    done(result.data.name);
  };

  const submitCredentials = () => {
    setError("");
    startTransition(async () => {
      handle(await connectLinkedInCredentials(username, password));
    });
  };

  const submitCookie = () => {
    setError("");
    startTransition(async () => {
      // Send the browser's own user agent. LinkedIn treats a session that
      // suddenly changes browser as suspicious, so matching the one the cookie
      // was issued to is what makes the connection last.
      handle(await connectLinkedInCookie(cookie, navigator.userAgent));
    });
  };

  const submitCode = () => {
    if (!checkpoint) return;
    setError("");
    startTransition(async () => {
      const result = await submitLinkedInCheckpoint(checkpoint.accountId, code);
      setCode("");
      handle(result);
    });
  };

  const resend = () => {
    if (!checkpoint) return;
    setError("");
    startTransition(async () => {
      const result = await resendLinkedInCheckpoint(checkpoint.accountId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify("LinkedIn is sending another code.");
    });
  };

  const openHosted = () => {
    setError("");
    startTransition(async () => {
      const result = await startLinkedInConnect();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.data;
    });
  };

  /* ----- the code screen, once LinkedIn has asked ----- */

  if (checkpoint) {
    return (
      <Dialog
        open={open}
        onClose={close}
        title="LinkedIn wants a code"
        description="This request stays open for five minutes, so enter it now rather than coming back to it."
        footer={
          <>
            <Button onClick={resend} disabled={pending}>
              Send it again
            </Button>
            <Button
              variant="primary"
              onClick={submitCode}
              disabled={pending || !code.trim()}
            >
              {pending ? "Checking" : "Confirm"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2 text-[12px] text-ink-2">
            <ShieldCheck
              size={16}
              strokeWidth={1.5}
              className="mt-px shrink-0 text-ink-3"
            />
            {CHECKPOINT_COPY[checkpoint.checkpoint] ??
              "LinkedIn has sent you a verification code."}
          </p>

          <Field label="Code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.trim()) submitCode();
              }}
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="000000"
              autoFocus
            />
          </Field>

          {error ? (
            <p className="rounded-control border border-red bg-red-bg px-3 py-2 text-[12px] text-red">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    );
  }

  /* ----- choosing a method ----- */

  const active = METHODS.find((m) => m.id === method) ?? METHODS[0];

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Connect a LinkedIn profile"
      description="This is the profile your scheduled posts go out as."
      footer={
        method === "hosted" ? (
          <Button
            variant="primary"
            onClick={openHosted}
            disabled={!configured || pending}
          >
            <ExternalLink size={16} strokeWidth={1.75} />
            {pending ? "Opening" : "Continue to LinkedIn"}
          </Button>
        ) : method === "credentials" ? (
          <Button
            variant="primary"
            onClick={submitCredentials}
            disabled={!configured || pending || !username.trim() || !password}
          >
            {pending ? "Signing in" : "Sign in"}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={submitCookie}
            disabled={!configured || pending || !cookie.trim()}
          >
            {pending ? "Connecting" : "Connect"}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {/* Radios, not tabs: this is a choice being made, and it is the one
            thing on the screen that changes what the button does. */}
        <div
          role="radiogroup"
          aria-label="How to connect"
          className="overflow-hidden rounded-control border border-rule"
        >
          {METHODS.map((option, index) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={method === option.id}
              onClick={() => {
                setMethod(option.id);
                setError("");
              }}
              className={`flex w-full items-start gap-3 px-3 py-2.5 text-left ${
                index > 0 ? "border-t border-rule" : ""
              } ${method === option.id ? "bg-paper" : ""}`}
            >
              <span
                aria-hidden
                className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${
                  method === option.id
                    ? "border-[5px] border-ink"
                    : "border-rule-strong"
                }`}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[12px] text-ink-2">
                  {option.blurb}
                </span>
              </span>
            </button>
          ))}
        </div>

        {method === "credentials" ? (
          <>
            <Field label="LinkedIn email">
              <Input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              hint="Sent to LinkedIn through Unipile to open the session. Pulse never stores it."
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && username.trim() && password) {
                    submitCredentials();
                  }
                }}
                autoComplete="off"
              />
            </Field>
          </>
        ) : null}

        {method === "cookie" ? (
          <>
            <Field
              label="li_at cookie"
              hint="In LinkedIn, open developer tools, Application, Cookies, www.linkedin.com, and copy the value of li_at."
            >
              <Input
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                autoComplete="off"
                placeholder="AQEDAR..."
              />
            </Field>
            <p className="flex items-start gap-2 text-[12px] text-ink-2">
              <KeyRound
                size={16}
                strokeWidth={1.5}
                className="mt-px shrink-0 text-ink-3"
              />
              Connect from the same browser you are signed in to LinkedIn with.
              Pulse sends that browser&rsquo;s identity along with the cookie, and a
              session that appears to jump browsers is the one LinkedIn
              challenges first.
            </p>
          </>
        ) : null}

        {!configured ? (
          <p className="rounded-control border border-amber bg-amber-bg px-3 py-2 text-[12px] text-amber-text">
            LinkedIn posting is not switched on for this deployment yet.
            UNIPILE_API_KEY and UNIPILE_DSN have to be set first.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-control border border-red bg-red-bg px-3 py-2 text-[12px] text-red">
            {error}
          </p>
        ) : null}

        {method !== "hosted" ? (
          <p className="text-[12px] text-ink-3">
            {active.id === "credentials"
              ? "If LinkedIn asks for a code, you will be asked for it here, and it expires in five minutes."
              : "A cookie lasts until LinkedIn signs that browser out, at which point the profile shows as needing a reconnect."}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
