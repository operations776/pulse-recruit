"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

// Sits in the dark top bar, so the ghost variant is re-toned onto the ink
// ground. Nothing lives behind hover: signing out is a visible control, not a
// menu you have to discover.
export function UserMenu({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/signin");
    // Middleware and every server component read the session cookie, so the
    // tree has to be refetched before the signed out state is real.
    router.refresh();
  };

  return (
    <span className="flex h-full items-center gap-3 border-l border-sheet/15 pl-4 pr-2">
      <span className="max-w-[200px] truncate text-[12px] text-sheet/75">
        {email}
      </span>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={signOut}
        className="text-sheet! hover:bg-sheet/10! hover:text-sheet!"
      >
        {pending ? "Signing out" : "Sign out"}
      </Button>
    </span>
  );
}
