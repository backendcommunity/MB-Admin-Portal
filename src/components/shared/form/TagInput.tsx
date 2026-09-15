'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Chips backed by a string array — tags, languages, skills, technologies.
 * Enter or comma commits; Backspace on an empty input removes the last chip.
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'Type and press Enter',
  id,
  disabled,
  max = 20,
  validate,
  onInvalidEntry,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  max?: number;
  /** Optional per-entry shape check (e.g. email format). Rejected entries never become chips. */
  validate?: (entry: string) => boolean;
  /** Called with the raw entry when `validate` rejects it, so the caller can surface why. */
  onInvalidEntry?: (entry: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const commit = (raw: string) => {
    const entry = raw.trim().replace(/,$/, '');
    if (!entry) return;
    if (value.length >= max) return;
    if (value.some((existing) => existing.toLowerCase() === entry.toLowerCase())) {
      setDraft('');
      return;
    }
    if (validate && !validate(entry)) {
      onInvalidEntry?.(entry);
      return;
    }
    onChange([...value, entry]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5',
        'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs font-medium text-foreground"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="text-muted-foreground transition-colors hover:text-destructive"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
