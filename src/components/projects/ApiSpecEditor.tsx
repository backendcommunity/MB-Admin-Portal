'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ASSERTION_KINDS,
  HTTP_METHODS,
  type ApiSpec,
  type Assertion,
  type AssertionKind,
  type HttpMethod,
} from '@/lib/api/projects';

/**
 * The grading contract for a rest-api task.
 *
 * `response.assertions` is what decides pass or fail, and there are exactly
 * five kinds the prober evaluates. Anything else is ignored at grade time,
 * which reads to an author as a test that mysteriously never fails — so the
 * editor only offers those five, and each row renders only the fields its own
 * kind uses.
 */

export const emptySpec = (): ApiSpec => ({
  method: 'GET',
  url: '/',
  request: {},
  response: { assertions: [{ kind: 'status', equals: 200 }] },
});

/**
 * A JSON field that keeps the last good value while you are mid-edit.
 *
 * Reparsing on every keystroke would destroy the object the moment a brace is
 * unbalanced, so an invalid draft is held as text and reported instead.
 */
function JsonField({
  label,
  hint,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: unknown;
  onChange: (next: unknown) => void;
  rows?: number;
}) {
  const [text, setText] = useState(() =>
    value === undefined ? '' : JSON.stringify(value, null, 2),
  );
  const [error, setError] = useState('');

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <textarea
        value={text}
        rows={rows}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (!next.trim()) {
            setError('');
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(next));
            setError('');
          } catch {
            setError('Not valid JSON yet — the last good value is kept.');
          }
        }}
        className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-warning">{error}</p> : null}
    </div>
  );
}

function AssertionRow({
  assertion,
  index,
  onChange,
  onRemove,
}: {
  assertion: Assertion;
  index: number;
  onChange: (next: Assertion) => void;
  onRemove: () => void;
}) {
  const patch = (fields: Record<string, unknown>) =>
    onChange({ ...assertion, ...fields } as Assertion);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Select
          value={assertion.kind}
          onValueChange={(value) =>
            // Each kind carries different keys. Keeping the old ones would
            // store a jsonPath's `path` on a status assertion the prober
            // never reads.
            onChange({ kind: value as AssertionKind } as Assertion)
          }
        >
          <SelectTrigger
            className="h-8 w-auto min-w-32 text-xs"
            aria-label={`Assertion ${index + 1} kind`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSERTION_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={onRemove}>
          Remove
        </Button>
      </div>

      {assertion.kind === 'status' ? (
        <div className="space-y-1.5">
          <Label htmlFor={`a-status-${index}`}>Status equals</Label>
          <Input
            id={`a-status-${index}`}
            type="number"
            value={assertion.equals ?? 200}
            onChange={(event) => patch({ equals: Number(event.target.value) || 0 })}
          />
        </div>
      ) : null}

      {assertion.kind === 'jsonPath' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`a-path-${index}`}>Path</Label>
            <Input
              id={`a-path-${index}`}
              value={assertion.path ?? ''}
              placeholder="data.id"
              onChange={(event) => patch({ path: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">Dotted path into the JSON body.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`a-type-${index}`}>Type</Label>
            <Input
              id={`a-type-${index}`}
              value={assertion.type ?? ''}
              placeholder="string"
              onChange={(event) => patch({ type: event.target.value || undefined })}
            />
          </div>
          <div className="md:col-span-2">
            <JsonField
              label="Equals"
              hint="Optional: the exact value, compared as JSON."
              value={assertion.equals}
              onChange={(next) => patch({ equals: next })}
              rows={2}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 md:col-span-2">
            <span className="text-sm">Must exist</span>
            <Switch
              checked={Boolean(assertion.exists)}
              onCheckedChange={(next) => patch({ exists: next || undefined })}
              aria-label="Must exist"
            />
          </label>
        </div>
      ) : null}

      {assertion.kind === 'bodySubset' ? (
        <JsonField
          label="Subset"
          hint="Every key here must appear in the body with the same value. Extra keys are allowed."
          value={assertion.subset}
          onChange={(next) => patch({ subset: next })}
          rows={4}
        />
      ) : null}

      {assertion.kind === 'header' ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor={`a-name-${index}`}>Header</Label>
            <Input
              id={`a-name-${index}`}
              value={assertion.name ?? ''}
              placeholder="content-type"
              onChange={(event) => patch({ name: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`a-eq-${index}`}>Equals</Label>
            <Input
              id={`a-eq-${index}`}
              value={assertion.equals ?? ''}
              placeholder="application/json"
              onChange={(event) => patch({ equals: event.target.value || undefined })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`a-re-${index}`}>Matches</Label>
            <Input
              id={`a-re-${index}`}
              value={assertion.matches ?? ''}
              placeholder="^application/json"
              onChange={(event) => patch({ matches: event.target.value || undefined })}
            />
            <p className="text-xs text-muted-foreground">Used only when Equals is blank.</p>
          </div>
        </div>
      ) : null}

      {assertion.kind === 'shape' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`a-spath-${index}`}>Path</Label>
            <Input
              id={`a-spath-${index}`}
              value={assertion.path ?? ''}
              placeholder="data"
              onChange={(event) => patch({ path: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">Blank targets the whole body.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`a-min-${index}`}>Minimum items</Label>
            <Input
              id={`a-min-${index}`}
              type="number"
              value={assertion.minItems ?? ''}
              onChange={(event) =>
                patch({ minItems: event.target.value ? Number(event.target.value) : undefined })
              }
            />
            <p className="text-xs text-muted-foreground">Only for an array at that path.</p>
          </div>
          <div className="md:col-span-2">
            <JsonField
              label="Shape"
              hint={'Keys and types, not values — { "id": "string", "count": "number" }.'}
              value={assertion.shape}
              onChange={(next) => patch({ shape: next })}
              rows={4}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ApiSpecEditor({
  value,
  onChange,
}: {
  value: ApiSpec;
  onChange: (next: ApiSpec) => void;
}) {
  const assertions = value.response?.assertions ?? [];

  const setAssertions = (next: Assertion[]) =>
    onChange({ ...value, response: { ...value.response, assertions: next } });

  const seed = (kind: AssertionKind): Assertion => {
    if (kind === 'status') return { kind, equals: 200 };
    if (kind === 'jsonPath') return { kind, path: '', exists: true };
    if (kind === 'bodySubset') return { kind, subset: {} };
    if (kind === 'header') return { kind, name: '' };
    return { kind: 'shape', path: '', shape: {} };
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Request we send
        </p>

        <div className="grid gap-3 md:grid-cols-[140px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="spec-method">Method</Label>
            <Select
              value={value.method}
              onValueChange={(next) => onChange({ ...value, method: next as HttpMethod })}
            >
              <SelectTrigger id="spec-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spec-url">Path</Label>
            <Input
              id="spec-url"
              value={value.url}
              placeholder="/jobs"
              onChange={(event) => onChange({ ...value, url: event.target.value })}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Appended to the builder&apos;s server URL, so it begins with a slash.
            </p>
          </div>
        </div>

        <JsonField
          label="Request headers"
          hint={'e.g. { "content-type": "application/json" }'}
          value={value.request?.headers}
          onChange={(next) =>
            onChange({ ...value, request: { ...value.request, headers: next as never } })
          }
          rows={2}
        />
        <JsonField
          label="Query string"
          hint={'e.g. { "page": "2" } — values are strings.'}
          value={value.request?.query}
          onChange={(next) =>
            onChange({ ...value, request: { ...value.request, query: next as never } })
          }
          rows={2}
        />
        <JsonField
          label="Request body"
          hint="Sent as JSON."
          value={value.request?.body}
          onChange={(next) => onChange({ ...value, request: { ...value.request, body: next } })}
        />
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Response we assert
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="spec-status">Expected status</Label>
          <Input
            id="spec-status"
            type="number"
            value={value.response?.status ?? ''}
            placeholder="200"
            onChange={(event) =>
              onChange({
                ...value,
                response: {
                  ...value.response,
                  status: event.target.value ? Number(event.target.value) : undefined,
                },
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Checked before the assertions run. Leave blank to skip it.
          </p>
        </div>

        {assertions.map((assertion, index) => (
          <AssertionRow
            key={index}
            assertion={assertion}
            index={index}
            onChange={(next) => setAssertions(assertions.map((a, i) => (i === index ? next : a)))}
            onRemove={() => setAssertions(assertions.filter((_, i) => i !== index))}
          />
        ))}

        {assertions.length === 0 ? (
          // The failure worth naming: the API refuses this, and it is the one
          // mistake that looks like a working test.
          <div className="rounded-lg border border-warning bg-warning-wash p-3 text-xs text-warning">
            No assertions. The runner would call the endpoint and pass the task whatever comes back,
            so the API refuses to save this.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {ASSERTION_KINDS.map((kind) => (
            <Button
              key={kind}
              variant="outline"
              size="sm"
              onClick={() => setAssertions([...assertions, seed(kind)])}
            >
              + {kind}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
