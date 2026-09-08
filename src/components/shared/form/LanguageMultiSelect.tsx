'use client';

import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { PLAYGROUND_LANGUAGES } from '@/lib/courses/blocks';

/**
 * D1 follow-up: an exercise's Languages field was a free-text `TagInput`, so an
 * author could type a language the judge cannot run at all. This is a
 * checkbox grid over the same thirteen-entry `PLAYGROUND_LANGUAGES` list the
 * playground block already trusts, storing the same human-readable `value`
 * strings the column holds ("Python", "Node.js", …) — a stricter INPUT on the
 * same free-text column, not a new format.
 *
 * An exercise authored before this existed may already hold a value outside
 * the thirteen (or a typo). Dropping it silently on the next save would be a
 * surprise data loss, so an off-list value stays selected and visible, just
 * flagged as unsupported with its own way to remove it.
 */
export function LanguageMultiSelect({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const known = new Set(PLAYGROUND_LANGUAGES.map((language) => language.value));
  const unsupported = value.filter((entry) => !known.has(entry as never));

  const toggle = (language: string, checked: boolean) => {
    if (checked) onChange([...value, language]);
    else onChange(value.filter((entry) => entry !== language));
  };

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Languages"
        className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-input bg-background p-2.5 sm:grid-cols-3"
      >
        {PLAYGROUND_LANGUAGES.map((language) => (
          <label key={language.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.includes(language.value)}
              disabled={disabled}
              onCheckedChange={(next) => toggle(language.value, next === true)}
              aria-label={language.value}
            />
            {language.value}
          </label>
        ))}
      </div>

      {unsupported.length ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-warning-wash px-2.5 py-1.5 text-xs text-warning">
          <span className="font-semibold">Not on the supported list — the judge cannot run:</span>
          {unsupported.map((language) => (
            <span
              key={language}
              className="inline-flex items-center gap-1 rounded border border-warning/40 px-1.5 py-0.5"
            >
              {language}
              <button
                type="button"
                aria-label={`Remove unsupported language ${language}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((entry) => entry !== language))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
