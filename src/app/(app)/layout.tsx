import { Suspense, type ReactNode } from "react";
import { ModuleRail } from "@/components/shell/module-rail";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { TopBar } from "@/components/shell/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { requireSession } from "@/lib/auth";
import { getNotifications } from "@/lib/data";

/**
 * The bell, resolved on its own.
 *
 * Notifications were awaited in the layout, which meant every navigation in
 * the product waited on a query nobody was looking at. Behind Suspense the
 * shell and the page stream immediately and the bell fills in when its own
 * query lands, so an unread count can never be the reason a screen is late.
 */
async function Bell() {
  const notifications = await getNotifications();
  return <NotificationsBell notifications={notifications} />;
}

// Every screen now reads from Postgres, so there is no client store left to
// provide. requireSession is what keeps an unauthenticated request from
// rendering the product at all, and RLS is the backstop behind it.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <ToastProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <TopBar
          orgName={session.org.name}
          email={session.email}
          bell={
            <Suspense fallback={<NotificationsBell notifications={[]} />}>
              <Bell />
            </Suspense>
          }
        />
        <div className="flex min-h-0 flex-1">
          <ModuleRail />
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
