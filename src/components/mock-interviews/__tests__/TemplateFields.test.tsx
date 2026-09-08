import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import {
  IdentityFields,
  RoleFields,
  InterviewFields,
} from '@/components/mock-interviews/fields/TemplateFields';
import type { TemplateInput } from '@/lib/api/mockInterviews';

/**
 * These groups are shared by the create page and the detail page (Tasks 12,
 * 13). Both wire `onChange` as `setValue((prev) => ({ ...prev, ...patch }))`,
 * so a group that ever emits the FULL object instead of a partial patch would
 * still look correct in isolation — but would silently clobber whatever the
 * caller hadn't re-read yet in a batched update. Assert the exact patch shape
 * on every call, not just the end result.
 */

type GroupProps = {
  value: TemplateInput;
  onChange: (patch: TemplateInput) => void;
  disabled?: boolean;
};

const fullValue: TemplateInput = {
  name: 'Existing name',
  summary: 'Existing summary',
  description: 'Existing description',
  company: 'Existing co',
  position: 'Existing position',
  seniority: 'Staff',
  style: 'Behavioral',
  category: 'Backend',
  difficulty: 'Medium',
  duration: 45,
  questions: 5,
};

/**
 * Every plain text/number field, across every group, driven from one table.
 *
 * `name` MUST match this component's report entry in
 * `.superpowers/sdd/2026-09-05-mock-interview-crud/task-10-report.md`
 * exactly — Tasks 12 and 13 query these labels with `getByLabelText`. `Name`
 * and `Duration` carry a required-field asterisk in their rendered label
 * (`"Name *"`, `"Duration *"`), so their regex is anchored to the start only.
 *
 * `format` is deliberately absent: its `onChange` is a no-op by contract (the
 * API refuses anything but `Chat`), so it never emits a patch at all — that
 * is covered separately below.
 */
const textFieldCases: Array<{
  label: string;
  name: RegExp;
  Group: ComponentType<GroupProps>;
  field: keyof TemplateInput;
  type: string;
}> = [
  { label: 'Name', name: /^name/i, Group: IdentityFields, field: 'name', type: 'X' },
  { label: 'Summary', name: /^summary/i, Group: IdentityFields, field: 'summary', type: 'X' },
  {
    label: 'Description',
    name: /^description/i,
    Group: IdentityFields,
    field: 'description',
    type: 'X',
  },
  { label: 'Company', name: /^company/i, Group: RoleFields, field: 'company', type: 'X' },
  { label: 'Position', name: /^position/i, Group: RoleFields, field: 'position', type: 'X' },
  { label: 'Seniority', name: /^seniority/i, Group: RoleFields, field: 'seniority', type: 'X' },
  { label: 'Category', name: /^category/i, Group: InterviewFields, field: 'category', type: 'X' },
  { label: 'Duration', name: /^duration/i, Group: InterviewFields, field: 'duration', type: '9' },
  {
    label: 'Questions',
    name: /^questions/i,
    Group: InterviewFields,
    field: 'questions',
    type: '9',
  },
];

describe.each(textFieldCases)('$label', ({ name, Group, field, type }) => {
  it('emits a patch with exactly one key — its own field, never the whole object', async () => {
    const onChange = vi.fn();
    render(<Group value={fullValue} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(name), type);

    expect(onChange.mock.calls.length).toBeGreaterThan(0);
    for (const call of onChange.mock.calls) {
      expect(Object.keys(call[0])).toEqual([field]);
    }
  });
});

/** The two Select-backed fields need a different interaction than typing. */
const selectFieldCases: Array<{
  label: string;
  name: RegExp;
  field: keyof TemplateInput;
  option: string;
}> = [
  { label: 'Style', name: /^style/i, field: 'style', option: 'Coding' },
  { label: 'Difficulty', name: /^difficulty/i, field: 'difficulty', option: 'Hard' },
];

describe.each(selectFieldCases)('$label select', ({ name, field, option }) => {
  it('emits a patch with exactly one key when an option is chosen', async () => {
    const onChange = vi.fn();
    render(<InterviewFields value={fullValue} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(name));
    await userEvent.click(await screen.findByRole('option', { name: option }));

    expect(onChange).toHaveBeenCalledWith({ [field]: option });
  });
});

describe('Format field', () => {
  it('renders format options other than Chat as disabled, so the gap is visible', async () => {
    render(<InterviewFields value={fullValue} onChange={() => {}} />);

    await userEvent.click(screen.getByLabelText(/^format/i));
    const audio = await screen.findByRole('option', { name: /audio/i });
    const video = screen.getByRole('option', { name: /video/i });
    const chat = screen.getByRole('option', { name: /^chat$/i });

    expect(audio).toHaveAttribute('aria-disabled', 'true');
    expect(video).toHaveAttribute('aria-disabled', 'true');
    expect(chat).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('never calls onChange when an unshipped format option is clicked', async () => {
    const onChange = vi.fn();
    render(<InterviewFields value={fullValue} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(/^format/i));
    const audio = await screen.findByRole('option', { name: /audio/i });
    await userEvent.click(audio);

    expect(onChange).not.toHaveBeenCalled();
  });
});
