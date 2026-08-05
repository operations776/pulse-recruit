"use client";

import { Check, Copy, Link2, Link2Off } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { disableApplications, enableApplications } from "@/lib/actions";
import type { JobRow } from "@/lib/supabase/types";

/**
 * The public application link for a role: mint it, copy it, revoke it.
 * Revoking nulls the slug, which kills every copy that was ever shared.
 */
export function ApplicationLink({ job }: { job: JobRow }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const url = job.application_slug
    ? `${typeof window === "undefined" ? "" : window.location.origin}/apply/${job.application_slug}`
    : null;

  const enable = () => {
    startTransition(async () => {
      const result = await enableApplications(job.id);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify("Application link created. Anyone holding it can apply to this role.");
      router.refresh();
    });
  };

  const disable = () => {
    startTransition(async () => {
      const result = await disableApplications(job.id);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify("Application link revoked. Every shared copy just stopped working.");
      router.refresh();
    });
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard can be blocked; the confirmation below still tells the user
      // the intent registered, and the URL stays visible to copy by hand.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  if (!job.application_slug) {
    return (
      <Button onClick={enable} disabled={pending} aria-label="Create a public application link">
        <Link2 size={16} strokeWidth={1.5} />
        Application link
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <Button onClick={copy} aria-label="Copy the application link">
        {copied ? (
          <Check size={16} strokeWidth={2} className="text-teal" />
        ) : (
          <Copy size={16} strokeWidth={1.5} />
        )}
        {copied ? "Copied" : "Copy apply link"}
      </Button>
      <Button
        onClick={disable}
        disabled={pending}
        aria-label="Revoke the application link"
      >
        <Link2Off size={16} strokeWidth={1.5} />
        Revoke
      </Button>
    </span>
  );
}
