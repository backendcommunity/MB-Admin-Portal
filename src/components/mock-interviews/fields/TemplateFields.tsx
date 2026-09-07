'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldGrid } from '@/components/shared/form/Section';
import {
  CATEGORIES,
  DIFFICULTIES,
  SENIORITIES,
  STYLES,
  UNSHIPPED_FORMATS,
} from '@/lib/mockInterviews/constants';
import type { TemplateInput } from '@/lib/api/mockInterviews';

/**
 * The field groups create and detail SHARE.
 *
 * Not two parallel forms: they would drift the first time a field is added,
 * and the create page is where a missing field is least likely to be noticed.
 */

type GroupProps = {
  value: TemplateInput;
  onChange: (patch: TemplateInput) => void;
  disabled?: boolean;
};

export function IdentityFields({ value, onChange, disabled }: GroupProps) {
  return (
    <>
      <Field label="Name" htmlFor="mi-name" required>
        <Input
          id="mi-name"
          value={value.name ?? ''}
          disabled={disabled}
          placeholder="Senior Go Backend Engineer"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>

      <Field label="Summary" htmlFor="mi-summary" hint="One line for the catalogue card.">
        <textarea
          id="mi-summary"
          rows={2}
          value={value.summary ?? ''}
          disabled={disabled}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
          onChange={(event) => onChange({ summary: event.target.value })}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="mi-description"
        hint="What this interview covers, and what it deliberately does not."
      >
        <textarea
          id="mi-description"
          rows={5}
          value={value.description ?? ''}
          disabled={disabled}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </Field>
    </>
  );
}

export function RoleFields({ value, onChange, disabled }: GroupProps) {
  return (
    <FieldGrid>
      <Field label="Company" htmlFor="mi-company" hint="Empty for a generic template.">
        <Input
          id="mi-company"
          value={value.company ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({ company: event.target.value })}
        />
      </Field>

      <Field label="Position" htmlFor="mi-position">
        <Input
          id="mi-position"
          value={value.position ?? ''}
          disabled={disabled}
          placeholder="Backend Engineer"
          onChange={(event) => onChange({ position: event.target.value })}
        />
      </Field>

      <Field label="Seniority" htmlFor="mi-seniority" hint="Suggestions only; free text is fine.">
        <>
          <Input
            id="mi-seniority"
            list="mi-seniority-options"
            value={value.seniority ?? ''}
            disabled={disabled}
            placeholder="Senior"
            onChange={(event) => onChange({ seniority: event.target.value })}
          />
          <datalist id="mi-seniority-options">
            {SENIORITIES.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </>
      </Field>
    </FieldGrid>
  );
}

export function InterviewFields({ value, onChange, disabled }: GroupProps) {
  return (
    <>
      <FieldGrid>
        <Field
          label="Style"
          htmlFor="mi-style"
          hint="Question genre. Read by the chat engine; falls back to Technical."
        >
          <Select
            value={value.style ?? 'Technical'}
            disabled={disabled}
            onValueChange={(next) => onChange({ style: next as TemplateInput['style'] })}
          >
            <SelectTrigger id="mi-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Format"
          htmlFor="mi-format"
          hint="Delivery channel. Only Chat ships — the others are shown so the gap is visible."
        >
          <Select value="Chat" disabled={disabled} onValueChange={() => undefined}>
            <SelectTrigger id="mi-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Chat">Chat</SelectItem>
              {UNSHIPPED_FORMATS.map((option) => (
                <SelectItem key={option} value={option} disabled>
                  {option} — not shipped yet
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Category" htmlFor="mi-category" hint="Reuse one or coin a new one.">
          <>
            <Input
              id="mi-category"
              list="mi-category-options"
              value={value.category ?? ''}
              disabled={disabled}
              onChange={(event) => onChange({ category: event.target.value })}
            />
            <datalist id="mi-category-options">
              {CATEGORIES.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </>
        </Field>

        <Field label="Difficulty" htmlFor="mi-difficulty">
          <Select
            value={value.difficulty ?? 'Easy'}
            disabled={disabled}
            onValueChange={(next) => onChange({ difficulty: next as TemplateInput['difficulty'] })}
          >
            <SelectTrigger id="mi-difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Duration" htmlFor="mi-duration" required hint="Minutes.">
          <Input
            id="mi-duration"
            type="number"
            min={1}
            value={value.duration ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ duration: Number(event.target.value) })}
          />
        </Field>
      </FieldGrid>

      <Field label="Questions" htmlFor="mi-questions" hint="Target count. Optional.">
        <Input
          id="mi-questions"
          type="number"
          min={1}
          value={value.questions ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({ questions: event.target.value ? Number(event.target.value) : null })
          }
        />
      </Field>
    </>
  );
}
