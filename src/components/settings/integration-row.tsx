"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { removeIntegrationKey, saveIntegrationKey } from "@/lib/actions";

// DESIGN.md rule 5: one vermilion control per view. Eleven providers on one
// screen would otherwise mean eleven primary buttons, so exactly one row can
// have its form open at a time and the scope is what enforces it.
const OpenRow = createContext<{
  open: string | null;
  setOpen: (provider: string | null) => void;
} | null>(null);

export function IntegrationFormScope({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <OpenRow.Provider value={{ open, setOpen }}>{children}</OpenRow.Provider>
  );
}

function useOpenRow() {
  const ctx = useContext(OpenRow);
  if (!ctx) {
    throw new Error("IntegrationRow must be used inside IntegrationFormScope");
  }
  return ctx;
}

export function IntegrationRow({
  provider,
  name,
  hasKey,
}: {
  provider: string;
  name: string;
  hasKey: boolean;
}) {
  const { open, setOpen } = useOpenRow();
  const { notify } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const isOpen = open === provider;

  const close = () => {
    // The key never survives a closed form, so it cannot be read back out of
    // the DOM later.
    setApiKey("");
    setError("");
    setOpen(null);
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Paste the key first.");
      return;
    }

    setError("");
    setPending(true);
    const result = await saveIntegrationKey(provider, apiKey.trim(), name);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    close();
    notify(`${name} key saved. It is stored encrypted and not shown again.`);
  };

  const remove = async () => {
    setError("");
    setPending(true);
    const result = await removeIntegrationKey(provider);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    close();
    notify(`${name} key removed.`);
  };

  if (!isOpen) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" onClick={() => setOpen(provider)}>
          {hasKey ? "Replace key" : "Add key"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>

      <div className="w-full basis-full pt-1">
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label={`${name} API key`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste the key"
            className="min-w-[220px] flex-1"
          />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving" : "Save key"}
          </Button>
          {hasKey ? (
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              onClick={remove}
            >
              Remove
            </Button>
          ) : null}
        </form>

        {error ? (
          <p role="alert" className="mt-2 text-[12px] font-medium text-red">
            {error}
          </p>
        ) : null}

        <p className="mt-2 text-[12px] text-ink-2">
          The key is encrypted on save and never shown again. Paste a new one to
          replace it.
        </p>
      </div>
    </>
  );
}
