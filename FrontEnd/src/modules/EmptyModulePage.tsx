import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";

type EmptyModulePageProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function EmptyModulePage({
  title,
  description = "This module will show real data once the API is wired.",
  icon,
  emptyTitle,
  emptyDescription,
}: EmptyModulePageProps) {
  return (
    <section className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={icon}
      />
    </section>
  );
}
