import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  badge,
  subtitle,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Sits beside the title — a status or level, not a sentence. */
  badge?: ReactNode;
  /** A slug or id under the title, set in mono. */
  subtitle?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {subtitle ? (
          <p className="truncate font-mono text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
