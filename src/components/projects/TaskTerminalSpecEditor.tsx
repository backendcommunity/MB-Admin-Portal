'use client';

import React from 'react';

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
  return (
    <div className="space-y-4 rounded-md border border-input p-3">
      <div className="space-y-1.5">
        <Label htmlFor="terminal-stdin">stdin (one input per line)</Label>
        <textarea
          id="terminal-stdin"
          value={value.stdin.join('\n')}
          onChange={(e) => onChange({ ...value, stdin: e.target.value.split('\n') })}
          className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="terminal-expected">Expected output</Label>
        <textarea
          id="terminal-expected"
          value={value.expectedOutput}
          onChange={(e) => onChange({ ...value, expectedOutput: e.target.value })}
          className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
