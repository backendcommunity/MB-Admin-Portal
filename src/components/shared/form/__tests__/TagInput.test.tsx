import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { TagInput, splitEntries } from '@/components/shared/form/TagInput';

function Harness(props: Partial<React.ComponentProps<typeof TagInput>> = {}) {
  const [value, setValue] = useState<string[]>([]);
  return <TagInput id="tags" value={value} onChange={setValue} {...props} />;
}

describe('splitEntries', () => {
  it('splits on commas, semicolons, newlines and tabs by default', () => {
    expect(splitEntries('a@x.com, b@x.com;c@x.com\nd@x.com\te@x.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com',
      'e@x.com',
    ]);
  });

  it('keeps multi-word entries intact — spaces are not separators by default', () => {
    expect(splitEntries('Node.js Basics, System Design')).toEqual([
      'Node.js Basics',
      'System Design',
    ]);
  });

  it('drops empty fragments left by trailing or doubled separators', () => {
    expect(splitEntries('a@x.com,,b@x.com,')).toEqual(['a@x.com', 'b@x.com']);
  });

  it('honours a caller-supplied pattern, e.g. whitespace for emails', () => {
    expect(splitEntries('a@x.com b@x.com\nc@x.com', /[\s,;]+/)).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
    ]);
  });
});

describe('TagInput — pasting a list', () => {
  it('turns a pasted comma-separated list into one chip per entry', async () => {
    render(<Harness />);
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.paste('alpha, beta, gamma');

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.getByText('gamma')).toBeInTheDocument();
    // Nothing is left stranded in the draft.
    expect(input).toHaveValue('');
  });

  it('splits a pasted column of newline-separated values', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('alpha\nbeta\ngamma');

    expect(screen.getAllByRole('button', { name: /^remove /i })).toHaveLength(3);
  });

  it('drops entries already present, case-insensitively, without duplicating chips', async () => {
    render(<Harness />);
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.paste('alpha, ALPHA, beta');

    expect(screen.getAllByRole('button', { name: /^remove /i })).toHaveLength(2);
  });

  it('reports rejected entries once for the whole paste, not once each', async () => {
    const onRejected = vi.fn();
    render(<Harness validate={(entry) => entry.includes('@')} onRejected={onRejected} />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('good@x.com, nope, also-nope');

    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(onRejected).toHaveBeenCalledWith(
      expect.objectContaining({ invalid: ['nope', 'also-nope'] }),
    );
    expect(screen.getAllByRole('button', { name: /^remove /i })).toHaveLength(1);
  });

  it('caps the paste at `max` and reports the entries that did not fit', async () => {
    const onRejected = vi.fn();
    render(<Harness max={2} onRejected={onRejected} />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('a, b, c, d');

    expect(screen.getAllByRole('button', { name: /^remove /i })).toHaveLength(2);
    expect(onRejected).toHaveBeenCalledWith(expect.objectContaining({ overflow: ['c', 'd'] }));
  });
});

describe('TagInput — capacity and overflow', () => {
  it('accepts any number of entries when max is null', async () => {
    const onRejected = vi.fn();
    render(<Harness max={null} onRejected={onRejected} />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste(Array.from({ length: 120 }, (_, i) => `t${i}`).join(', '));

    expect(screen.getAllByRole('button', { name: /^remove /i })).toHaveLength(120);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('scrolls the chips inside a bounded box instead of growing the form', async () => {
    const { container } = render(<Harness max={null} />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste(Array.from({ length: 120 }, (_, i) => `t${i}`).join(', '));

    // The box that holds the chips is the one that must scroll — an unbounded
    // one would push the dialog's own buttons off the screen.
    const box = container.querySelector('div');
    expect(box?.className).toContain('overflow-y-auto');
    expect(box?.className).toMatch(/max-h-/);
  });
});

describe('TagInput — reaching the input in a scrolled box', () => {
  it('focuses the input when the box itself is clicked', async () => {
    const { container } = render(<Harness max={null} />);
    const box = container.querySelector('div') as HTMLElement;
    await userEvent.click(box);

    // Once the box scrolls, the input is below the fold — clicking the empty
    // space is the obvious way back to it, so it must actually focus.
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it("leaves a chip's remove button working rather than stealing its click", async () => {
    render(<Harness max={null} />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.paste('alpha, beta');
    await userEvent.click(screen.getByRole('button', { name: 'Remove alpha' }));

    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });
});

describe('TagInput — typed entry', () => {
  it('still commits on Enter and on a typed comma', async () => {
    render(<Harness />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'alpha{Enter}');
    await userEvent.type(input, 'beta,');

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('reports the uncommitted draft so a parent can submit without an Enter press', async () => {
    const onDraftChange = vi.fn();
    render(<Harness onDraftChange={onDraftChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'alpha');

    expect(onDraftChange).toHaveBeenLastCalledWith('alpha');
  });

  it('removes the last chip on Backspace in an empty input', async () => {
    render(<Harness />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'alpha{Enter}beta{Enter}');
    await userEvent.type(input, '{Backspace}');

    expect(screen.queryByText('beta')).not.toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });
});
