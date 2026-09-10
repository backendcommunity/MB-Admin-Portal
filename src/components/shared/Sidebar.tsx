'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/constants/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onClose: () => void;
  approvalsCount?: number;
};

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onClose,
  approvalsCount = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const role = useAuthStore((state) => state.userRole);

  const grouped = useMemo(() => {
    if (!role) {
      return [];
    }

    return NAV_GROUPS.map((group) => ({
      group,
      items: NAV_ITEMS.filter((item) => item.group === group && item.roles.includes(role)),
    })).filter((section) => section.items.length > 0);
  }, [role]);

  const isEmpty = grouped.length === 0;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      ) : null}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200',
          collapsed ? 'w-20' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center justify-between px-4',
            collapsed && 'justify-center',
          )}
        >
          <span
            className={cn(
              'flex items-center gap-2.5 text-sm font-semibold tracking-tight',
              collapsed && 'sr-only',
            )}
          >
            <span className="h-2.5 w-2.5 rounded-[3px] bg-sidebar-primary" aria-hidden />
            MB Admin
          </span>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-md border border-sidebar-border p-1 text-sidebar-muted transition hover:border-sidebar-primary hover:text-sidebar-foreground md:inline-flex"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4">
          {grouped.map((section) => (
            <div key={section.group} className="space-y-1">
              {collapsed ? null : (
                <p className="px-3 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-sidebar-muted">
                  {section.group}
                </p>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]'
                        : 'text-sidebar-muted hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                      collapsed && 'justify-center',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className={cn('flex-1', collapsed && 'sr-only')}>{item.label}</span>
                    {!collapsed && item.badgeKey === 'approvals' && approvalsCount > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-sidebar-primary/20 text-sidebar-primary"
                      >
                        {approvalsCount}
                      </Badge>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
          {isEmpty ? (
            <p className="px-3 py-2 text-xs text-sidebar-muted">Sign in to view navigation.</p>
          ) : null}
        </nav>
      </aside>
    </>
  );
}
