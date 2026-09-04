/**
 * D1 (instructor-authoring-fixes plan): the playground block's Language
 * field was free text — an instructor could type anything, including a
 * language no runner supports. `PLAYGROUND_LANGUAGES` (src/lib/courses/
 * blocks.ts) mirrors `enum ProgrammingLanguage` from academy's schema,
 * cross-checked against every language mb-executor's LANGUAGES map actually
 * runs, so this list has no dead entries.
 *
 * Per this repo's own jsdom caveat, a Radix Select popup is never opened
 * here (no ResizeObserver polyfill; it hangs and has OOM'd Node before) —
 * this only asserts the trigger renders as a combobox showing the current
 * value, and that the old free-text input is gone.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BlockEditor } from '../BlockEditor';
import type { ArticleBlock } from '@/lib/courses/blocks';

function renderBlocks(blocks: ArticleBlock[]) {
  return render(<BlockEditor blocks={blocks} onChange={() => {}} />);
}

describe("a playground block's Language field", () => {
  it('is a selector, not free text', () => {
    renderBlocks([{ type: 'playground', language: 'Python', code: 'print(1)', title: 'main.py' }]);

    expect(screen.getByRole('combobox', { name: /language/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Language')).not.toHaveAttribute('type', 'text');
  });

  it("shows the block's current language as the selected value", () => {
    renderBlocks([{ type: 'playground', language: 'Python', code: '', title: '' }]);

    const trigger = screen.getByRole('combobox', { name: /language/i });
    expect(trigger).toHaveTextContent('Python');
  });

  it('shows a placeholder rather than crashing when no language is set yet', () => {
    renderBlocks([{ type: 'playground', language: null, code: '', title: '' }]);

    expect(screen.getByRole('combobox', { name: /language/i })).toBeInTheDocument();
  });
});
