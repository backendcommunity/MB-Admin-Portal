import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('IdentityFields', () => {
  it('emits only the changed field, not the whole object', async () => {
    const onChange = vi.fn();
    render(<IdentityFields value={fullValue} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(/^name/i), 'X');

    for (const call of onChange.mock.calls) {
      expect(Object.keys(call[0])).toEqual(['name']);
    }
  });
});

describe('RoleFields', () => {
  it('emits only the changed field, not the whole object', async () => {
    const onChange = vi.fn();
    render(<RoleFields value={fullValue} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(/^company/i), 'X');

    for (const call of onChange.mock.calls) {
      expect(Object.keys(call[0])).toEqual(['company']);
    }
  });
});

describe('InterviewFields', () => {
  it('emits only the changed field for a text input, not the whole object', async () => {
    const onChange = vi.fn();
    render(<InterviewFields value={fullValue} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(/^category/i), 'X');

    for (const call of onChange.mock.calls) {
      expect(Object.keys(call[0])).toEqual(['category']);
    }
  });

  it('emits only the changed field for the Style select, not the whole object', async () => {
    const onChange = vi.fn();
    render(<InterviewFields value={fullValue} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(/^style/i));
    await userEvent.click(await screen.findByRole('option', { name: 'Coding' }));

    expect(onChange).toHaveBeenCalledWith({ style: 'Coding' });
  });

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
