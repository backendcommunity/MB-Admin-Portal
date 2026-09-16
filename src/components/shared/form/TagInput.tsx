'use client';

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Separators a pasted blob is split on by default. Whitespace is deliberately
 * NOT in here: the common case is tags ("Node.js Basics", "System Design"),
 * where a space is part of the entry rather than a boundary. Callers whose
 * entries can never contain a space — emails, most obviously — pass their own
 * `splitPattern` and get space-separated pastes split too.
 */
const DEFAULT_SPLIT = /[,;\n\r\t]+/;

/**
 * Splits a raw blob (typed or pasted) into trimmed, non-empty entries.
 * Exported so a parent can parse the still-uncommitted draft the same way
 * this component would, rather than re-deriving the rule.
 */
export function splitEntries(raw: string, pattern: RegExp = DEFAULT_SPLIT): string[] {
  return raw
    .split(pattern)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** What a commit refused, reported once per commit rather than once per entry. */
export type RejectedEntries = {
  /** Failed the caller's `validate`. */
  invalid: string[];
  /** Valid, but past `max` — the field was already full. */
  overflow: string[];
};

/**
 * Chips backed by a string array — tags, languages, skills, emails.
 *
 * Enter or comma commits, Backspace on an empty input removes the last chip,
 * and a PASTE is split into one chip per entry. That last part is the whole
 * reason this is not a plain input: pasting a list is the normal way an
 * operator supplies more than two of anything, and a paste that lands as one
 * undivided blob (then fails a per-entry `validate`) is the failure mode this
 * component exists to prevent.
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'Type or paste, separated by commas',
  id,
  disabled,
  max = 20,
  validate,
  splitPattern = DEFAULT_SPLIT,
  onRejected,
  onDraftChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  /**
   * Hard cap on the number of chips, or `null` for no cap. A capped field
   * reports what did not fit through `onRejected.overflow`.
   */
  max?: number | null;
  /** Optional per-entry shape check (e.g. email format). Rejected entries never become chips. */
  validate?: (entry: string) => boolean;
  /** Overrides which characters separate entries in a typed or pasted blob. */
  splitPattern?: RegExp;
  /**
   * Called ONCE per commit with everything that commit refused — never once
   * per entry, so pasting thirty bad addresses cannot produce thirty toasts.
   * Duplicates are not reported: dropping a repeat is silent by design.
   */
  onRejected?: (rejected: RejectedEntries) => void;
  /**
   * The uncommitted input text, on every keystroke. Lets a parent submit
   * without an Enter press: clicking a submit button blurs this input, and a
   * parent that only knows about committed chips would either see stale state
   * or (worse) have its button still disabled at the moment of the click.
   */
  onDraftChange?: (draft: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cap = max ?? Number.POSITIVE_INFINITY;

  const updateDraft = (next: string) => {
    setDraft(next);
    onDraftChange?.(next);
  };

  /**
   * The single commit path for typing, blurring and pasting alike — one entry
   * or a hundred. Dedupe is case-insensitive and spans both the existing
   * chips and the batch itself, so a list that repeats an address still
   * yields one chip.
   */
  const commit = (raw: string) => {
    const entries = splitEntries(raw, splitPattern);
    if (!entries.length) return;

    const next = [...value];
    const seen = new Set(next.map((entry) => entry.toLowerCase()));
    const invalid: string[] = [];
    const overflow: string[] = [];

    for (const entry of entries) {
      if (seen.has(entry.toLowerCase())) continue;
      if (validate && !validate(entry)) {
        invalid.push(entry);
        continue;
      }
      if (next.length >= cap) {
        overflow.push(entry);
        continue;
      }
      seen.add(entry.toLowerCase());
      next.push(entry);
    }

    if (next.length !== value.length) {
      onChange(next);
      // The box scrolls once it is full, and the input is its last child —
      // without this a commit would leave the caret scrolled out of sight,
      // which on a long paste looks exactly like the field having stopped
      // accepting input.
      requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: 'nearest' }));
    }
    if (invalid.length || overflow.length) onRejected?.({ invalid, overflow });

    // Anything rejected stays in the box so it can be corrected rather than
    // vanishing; a clean commit empties it.
    updateDraft(invalid.join(', '));
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

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (!pasted) return;
    event.preventDefault();
    // Commit alongside whatever was already typed, so pasting onto a
    // half-typed entry completes it instead of racing it.
    commit(`${draft}${pasted}`);
  };

  return (
    <div
      // Click-to-focus, but only on the box's own whitespace: once the list
      // scrolls, the input sits below the fold, and clicking the empty space
      // is the obvious way to reach it. Guarding on `currentTarget` keeps a
      // chip's remove button working — without it, this would swallow that
      // click and refocus the input instead.
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({ block: 'nearest' });
      }}
      className={cn(
        'flex min-h-10 max-h-40 flex-wrap items-center gap-1.5 overflow-y-auto rounded-md border border-input bg-background px-2 py-1.5',
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
        ref={inputRef}
        id={id}
        value={draft}
        disabled={disabled}
        onChange={(event) => updateDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => commit(draft)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
