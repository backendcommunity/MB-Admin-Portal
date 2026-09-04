'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type TerminalTestCase = {
  stdin: string[];
  expectedOutput: string;
};

type Props = {
  value: TerminalTestCase;
  onChange: (value: TerminalTestCase) => void;
};

export default function TaskTerminalSpecEditor({ value, onChange }: Props) {
  function updateStdinAt(index: number, next: string) {
    onChange({
      ...value,
      stdin: value.stdin.map((s, i) => (i === index ? next : s)),
    });
  }

  function addInput() {
    onChange({ ...value, stdin: [...value.stdin, ''] });
  }

  function removeInput(index: number) {
    onChange({ ...value, stdin: value.stdin.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4 rounded-md border border-input p-3">
      <div className="space-y-1.5">
        <Label>
          stdin — one field per input the program will prompt for, in order. Shown to the builder
          pre-filled and editable before they run the test.
        </Label>
        {value.stdin.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No inputs. Add one if the program reads from stdin.
          </p>
        ) : (
          <div className="space-y-2">
            {value.stdin.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
                <Input
                  aria-label={`stdin input ${i + 1}`}
                  value={line}
                  onChange={(e) => updateStdinAt(i, e.target.value)}
                  placeholder="e.g. Solomon"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Remove input ${i + 1}`}
                  onClick={() => removeInput(i)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={addInput}>
          Add input
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="terminal-expected">Expected output</Label>
        <p className="text-sm text-muted-foreground">
          Use <code>{'{1}'}</code>, <code>{'{2}'}</code>, ... to reference input 1, input 2, etc. —
          the builder can type a different value than shown above, and it&apos;s substituted in here
          before comparing to what their program actually printed.
        </p>
        <textarea
          id="terminal-expected"
          value={value.expectedOutput}
          onChange={(e) => onChange({ ...value, expectedOutput: e.target.value })}
          placeholder={
            value.stdin.length ? 'e.g. Hello, {1}!' : 'e.g. static output with no inputs'
          }
          className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
