"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { submitApplication } from "@/lib/actions";

/**
 * The public form. Client-side checks are a courtesy; the RPC re-validates
 * everything, because this is the one write an anonymous stranger can reach.
 */
export function ApplyForm({
  slug,
  jobTitle,
}: {
  slug: string;
  jobTitle: string;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [linkedin, setLinkedin] = useState("");

  const submit = () => {
    if (!name.trim()) {
      setError("Your name is required.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("A valid email is required.");
      return;
    }
    setError("");

    startTransition(async () => {
      const result = await submitApplication({
        slug,
        name,
        email,
        phone,
        title,
        company,
        linkedin,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-control border border-teal bg-teal-bg text-teal">
          <Check size={20} strokeWidth={2} />
        </span>
        <p className="text-[13px] font-medium">Application received.</p>
        <p className="max-w-[38ch] text-[12px] text-ink-2">
          The team behind {jobTitle} has your details and will be in touch if
          it is a fit.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Full name">
        <Input
          value={name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          placeholder="Sam Carter"
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sam@example.com"
        />
      </Field>
      <Field label="Phone, optional">
        <Input
          type="tel"
          value={phone}
          autoComplete="tel"
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <Field label="Current title, optional">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Current company, optional">
        <Input value={company} onChange={(e) => setCompany(e.target.value)} />
      </Field>
      <Field label="LinkedIn, optional">
        <Input
          type="url"
          value={linkedin}
          placeholder="https://linkedin.com/in/you"
          onChange={(e) => setLinkedin(e.target.value)}
        />
      </Field>

      {error ? (
        <p role="alert" className="text-[12px] font-medium text-red">
          {error}
        </p>
      ) : null}

      <Button variant="primary" onClick={submit} disabled={pending}>
        {pending ? "Sending" : "Apply for this role"}
      </Button>
    </div>
  );
}
