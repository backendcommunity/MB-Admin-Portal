"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Sidebar } from "@/components/shared/Sidebar";
import { Topbar } from "@/components/shared/Topbar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        approvalsCount={0}
      />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] md:pl-64",
          collapsed && "md:pl-20"
        )}
      >
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
