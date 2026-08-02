import type { ReactNode } from "react";
import { IconRail } from "@/components/shell/icon-rail";
import { TopBar } from "@/components/shell/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { StoreProvider } from "@/lib/store";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <ToastProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <TopBar />
          <div className="flex min-h-0 flex-1">
            <IconRail />
            {children}
          </div>
        </div>
      </ToastProvider>
    </StoreProvider>
  );
}
