'use client';

import { cn } from '@/lib/utils';

/**
 * The underlined tab strip the course editor uses.
 *
 * Deliberately not the shadcn `Tabs` pill group: these tabs sit directly above
 * a full page of content and read as sections of one record, which the
 * underline says and a pill group does not.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-border" role="tablist">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'border-b-2 px-3 py-2 text-sm transition-colors',
            value === id
              ? 'border-primary font-semibold text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
