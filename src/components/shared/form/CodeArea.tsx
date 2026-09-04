'use client';

import { useId, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

/**
 * A textarea for source code rather than prose.
 *
 * A default textarea is actively hostile to code: browsers autocapitalise the
 * first word, autocorrect identifiers, substitute typographic quotes for the
 * straight ones a compiler needs, and Tab moves focus instead of indenting.
 * Grammarly and friends inject markup on top. Everything here exists to stop that,
 * so whatever is typed or pasted is stored byte for byte.
 *
 * Tab indents, Shift+Tab outdents, and Escape releases focus so the field stays
 * keyboard-escapable — trapping Tab without an exit strands keyboard users.
 */
export function CodeArea({
  value,
  onChange,
  id,
  placeholder,
  minHeight = 140,
  ariaLabel,
  indent = '  ',
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  placeholder?: string;
  minHeight?: number;
  ariaLabel?: string;
  indent?: string;
}) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }
    if (event.key !== 'Tab') return;

    const field = event.currentTarget;
    const { selectionStart, selectionEnd } = field;
    const before = value.slice(0, selectionStart);
    const selected = value.slice(selectionStart, selectionEnd);
    const after = value.slice(selectionEnd);

    // Multi-line selection: indent or outdent the whole block, like an editor.
    if (selected.includes('\n')) {
      event.preventDefault();
      const lines = selected.split('\n');
      const next = event.shiftKey
        ? lines.map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
        : lines.map((line) => indent + line);
      const joined = next.join('\n');
      onChange(before + joined + after);
      requestAnimationFrame(() => {
        field.selectionStart = selectionStart;
        field.selectionEnd = selectionStart + joined.length;
      });
      return;
    }

    event.preventDefault();
    if (event.shiftKey) {
      if (!before.endsWith(indent)) return;
      const trimmed = before.slice(0, -indent.length);
      onChange(trimmed + selected + after);
      requestAnimationFrame(() => {
        field.selectionStart = field.selectionEnd = trimmed.length;
      });
      return;
    }

    onChange(before + indent + after);
    requestAnimationFrame(() => {
      field.selectionStart = field.selectionEnd = selectionStart + indent.length;
    });
  };

  return (
    <textarea
      id={fieldId}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      autoComplete="off"
      // Grammarly and similar extensions otherwise edit the contents in place.
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
      wrap="off"
      style={{ minHeight, tabSize: indent.length }}
      className={cn(
        'w-full rounded-md border border-input bg-background px-3 py-2',
        'font-mono text-xs leading-relaxed',
        // pre keeps runs of spaces and blank lines; overflow-x rather than wrap so
        // a long line stays one line, as it will when it runs.
        'whitespace-pre overflow-x-auto',
        'outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/40',
      )}
    />
  );
}
