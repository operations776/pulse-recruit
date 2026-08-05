import type { ReactNode } from "react";
import { ModuleRail } from "@/components/shell/module-rail";
import { TopBar } from "@/components/shell/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { requireSession } from "@/lib/auth";
import { getNotifications } from "@/lib/data";

// Every screen now reads from Postgres, so there is no client store left to
// provide. requireSession is what keeps an unauthenticated request from
// rendering the product at all, and RLS is the backstop behind it.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const notifications = await getNotifications();

  return (
    <ToastProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <TopBar
          orgName={session.org.name}
          email={session.email}
          notifications={notifications}
        />
        <div className="flex min-h-0 flex-1">
          <ModuleRail />
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
