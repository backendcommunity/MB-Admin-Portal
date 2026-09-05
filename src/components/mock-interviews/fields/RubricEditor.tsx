'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { STANDARD_RUBRIC, type RubricCriterion } from '@/lib/mockInterviews/constants';

/**
 * Weighted criteria the report's `overallScore` is recomputed from.
 *
 * THE TOTAL NEED NOT BE 100. The server computes
 * `sum(score × weight) / sum(weight)`, so weights are normalised by their own
 * sum — but the prompt shows them to the model as percentages. Both are true,
 * so the editor nudges toward 100 and never blocks on it.
 *
 * A weight of zero or less IS refused: `parseRubric` filters on `weight > 0`
 * and discards the rest without saying so, which would leave a criterion
 * sitting here looking saved and never scored.
 */
export function RubricEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: RubricCriterion[];
  onChange: (next: RubricCriterion[]) => void;
  disabled?: boolean;
}) {
  const total = value.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const invalid = value.filter((row) => !(Number(row.weight) > 0));

  const patch = (index: number, next: Partial<RubricCriterion>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...next } : row)));

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          No rubric. The report keeps whatever score the model returned, unrecomputed — add criteria
          to make scoring deterministic.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_88px_1.35fr_40px] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Criterion</span>
            <span>Weight</span>
            <span>Description (optional)</span>
            <span />
          </div>

          {value.map((row, index) => (
            <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_88px_1.35fr_40px]">
              <Input
                value={row.criterion}
                placeholder="Technical accuracy"
                aria-label={`Criterion ${index + 1}`}
                disabled={disabled}
                onChange={(event) => patch(index, { criterion: event.target.value })}
              />
              <Input
                type="number"
                min={1}
                value={row.weight}
                aria-label={`Weight for ${row.criterion || `criterion ${index + 1}`}`}
                disabled={disabled}
                aria-invalid={!(Number(row.weight) > 0)}
                onChange={(event) => patch(index, { weight: Number(event.target.value) })}
              />
              <Input
                value={row.description ?? ''}
                placeholder="What the model should look for"
                aria-label={`Description ${index + 1}`}
                disabled={disabled}
                onChange={(event) => patch(index, { description: event.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                aria-label={`Remove ${row.criterion || `criterion ${index + 1}`}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...value, { criterion: '', weight: 10, description: '' }])}
        >
          Add criterion
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(STANDARD_RUBRIC.map((row) => ({ ...row })))}
        >
          Use the standard three
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-dashed pt-3">
        <span className="font-mono text-base tabular-nums" data-testid="rubric-total">
          {total}
        </span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, total)}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {value.length === 0
            ? 'No criteria yet — scoring stays whatever the model said.'
            : total === 100
              ? 'Totals 100 — reads cleanly as percentages.'
              : `Totals ${total}. Valid — weights are normalised by their sum — but ${total > 100 ? 'over' : 'under'} 100 reads oddly in the prompt.`}
        </span>
      </div>

      {invalid.length > 0 ? (
        <p role="alert" className="text-xs text-destructive">
          Every weight must be greater than zero — the scorer discards anything else silently, so
          the criterion would never be applied.
        </p>
      ) : null}
    </div>
  );
}
