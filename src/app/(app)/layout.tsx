import type { ReactNode } from "react";
import { ModuleRail } from "@/components/shell/module-rail";
import { TopBar } from "@/components/shell/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { requireSession } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";

// StoreProvider is still here because the screens that have not been moved onto
// Supabase yet read from it. The shell itself is now real: the org name and the
// signed in email come from the session, and requireSession is what keeps an
// unauthenticated request from rendering the product at all.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <StoreProvider>
      <ToastProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <TopBar orgName={session.org.name} email={session.email} />
          <div className="flex min-h-0 flex-1">
            <ModuleRail />
            {children}
          </div>
        </div>
      </ToastProvider>
    </StoreProvider>
  );
}
