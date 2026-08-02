import type { ReactNode } from "react";
import { ModuleRail } from "@/components/shell/module-rail";
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
            <ModuleRail />
            {children}
          </div>
        </div>
      </ToastProvider>
    </StoreProvider>
  );
}
