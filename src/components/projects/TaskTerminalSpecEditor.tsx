'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export type TerminalTestCase = {
  stdin: string[];
  expectedOutput: string;
};

type Props = {
  value: TerminalTestCase[];
  onChange: (value: TerminalTestCase[]) => void;
};

export default function TaskTerminalSpecEditor({ value, onChange }: Props) {
  function updateCase(index: number, patch: Partial<TerminalTestCase>) {
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCase() {
    onChange([...value, { stdin: [''], expectedOutput: '' }]);
  }

  function removeCase(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {value.map((testCase, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-input p-3">
          <div className="flex items-center justify-between">
            <Label>Test case {i + 1}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Remove test case ${i + 1}`}
              onClick={() => removeCase(i)}
            >
              Remove
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`stdin-${i}`}>stdin (one input per line)</Label>
            <textarea
              id={`stdin-${i}`}
              value={testCase.stdin.join('\n')}
              onChange={(e) => updateCase(i, { stdin: e.target.value.split('\n') })}
              className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`expected-${i}`}>Expected output</Label>
            <textarea
              id={`expected-${i}`}
              value={testCase.expectedOutput}
              onChange={(e) => updateCase(i, { expectedOutput: e.target.value })}
              className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addCase}>
        Add test case
      </Button>
    </div>
  );
}
