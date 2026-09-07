'use client';

import { Field } from '@/components/shared/form/Section';
import { TagInput } from '@/components/shared/form/TagInput';

/**
 * Topics are seeded into question generation — an empty list means questions
 * come from the position alone.
 */
export function TopicsField({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <Field
      label="Topics"
      htmlFor="mi-topics"
      hint="Seeded into question generation. Enter or comma to add."
    >
      <TagInput id="mi-topics" value={value} onChange={onChange} disabled={disabled} />
    </Field>
  );
}
