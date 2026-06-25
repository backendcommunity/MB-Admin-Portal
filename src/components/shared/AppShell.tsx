"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Sidebar } from "@/components/shared/Sidebar";
import { Topbar } from "@/components/shared/Topbar";
import { useApiQuery } from "@/lib/api/query";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const role = useAuthStore((state) => state.userRole);

  const approvalsQuery = useApiQuery<{ total: number }>(
    ["approvals-badge-count"],
    "/admin/approvals?page=1&limit=1&type=all",
    undefined,
    {
      enabled: role === "ADMIN" || role === "SUPER_ADMIN",
    }
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        approvalsCount={approvalsQuery.data?.total ?? 0}
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
