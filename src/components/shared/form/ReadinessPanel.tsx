'use client';

import { Check, AlertTriangle, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { ReadinessRule } from '@/lib/courses/readiness';
import { cn } from '@/lib/utils';

/**
 * The publish contract, shown as a checklist. Advisory here — the API runs the
 * same rules and is the one that refuses — but it means an author never presses
 * Publish without knowing what will happen.
 */
export function ReadinessPanel({ rules }: { rules: ReadinessRule[] }) {
  const done = rules.filter((rule) => rule.ok).length;
  const complete = done === rules.length;
  const percent = rules.length ? Math.round((done / rules.length) * 100) : 0;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Publish readiness</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {done} of {rules.length}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            complete ? 'bg-success' : 'bg-primary',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="space-y-2">
        {rules.map((rule) => (
          <li key={rule.field} className="flex gap-2 text-sm">
            <span
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded',
                rule.na
                  ? 'bg-muted text-muted-foreground'
                  : rule.ok
                    ? 'bg-success-wash text-success'
                    : 'bg-warning-wash text-warning',
              )}
            >
              {rule.na ? (
                <Minus className="h-3 w-3" />
              ) : rule.ok ? (
                <Check className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
            </span>
            <span className="min-w-0">
              <span className={cn(rule.na && 'text-muted-foreground')}>{rule.label}</span>
              {!rule.ok && rule.hint ? (
                <span className="block text-xs text-muted-foreground">{rule.hint}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
