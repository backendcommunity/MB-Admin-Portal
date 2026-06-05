"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Menu, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NAV_ITEMS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

type TopbarProps = {
  onMenuClick: () => void;
};

const toTitleCase = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label =
      NAV_ITEMS.find((item) => item.href === href)?.label ??
      toTitleCase(segment);

    return { href, label };
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md border border-border p-2 text-muted-foreground transition hover:text-foreground md:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-4 w-4" />
      </button>

      <nav className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
        {crumbs.map((crumb, index) => (
          <div key={crumb.href} className="flex items-center gap-2">
            <Link
              href={crumb.href}
              className={cn(
                "transition hover:text-foreground",
                index === crumbs.length - 1 && "text-foreground"
              )}
            >
              {crumb.label}
            </Link>
            {index < crumbs.length - 1 ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : null}
          </div>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-9"
            placeholder="Search..."
            aria-label="Search"
          />
        </div>
        <button
          type="button"
          className="rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary" />
      </div>
    </header>
  );
}
