import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { LanguageMultiSelect } from '../LanguageMultiSelect';
import { PLAYGROUND_LANGUAGES } from '@/lib/courses/blocks';

describe('LanguageMultiSelect', () => {
  it('offers exactly the thirteen supported languages, with no free-text entry', () => {
    render(<LanguageMultiSelect value={[]} onChange={vi.fn()} />);

    const group = screen.getByRole('group', { name: 'Languages' });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(13);
    expect(within(group).getAllByRole('checkbox')).toHaveLength(PLAYGROUND_LANGUAGES.length);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('checking a language adds it, unchecking removes it', () => {
    const onChange = vi.fn();
    const { rerender } = render(<LanguageMultiSelect value={['Python']} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Go' }));
    expect(onChange).toHaveBeenCalledWith(['Python', 'Go']);

    rerender(<LanguageMultiSelect value={['Python']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Python' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('cannot represent a language outside the list — no text input exists to type one into', () => {
    render(<LanguageMultiSelect value={[]} onChange={vi.fn()} />);
    // Every interactive control in the group is a checkbox for a known
    // language; there is nowhere to type "Assembly" or a typo.
    const group = screen.getByRole('group', { name: 'Languages' });
    within(group)
      .getAllByRole('checkbox')
      .forEach((box) => {
        expect(PLAYGROUND_LANGUAGES.map((l) => l.value)).toContain(box.getAttribute('aria-label'));
      });
  });

  it('keeps an off-list stored value visible and flagged, rather than dropping it', () => {
    render(<LanguageMultiSelect value={['COBOL', 'Python']} onChange={vi.fn()} />);

    expect(screen.getByText('COBOL')).toBeInTheDocument();
    expect(screen.getByText(/not on the supported list/i)).toBeInTheDocument();
    // Python is a real choice, so it should NOT be flagged as unsupported.
    const warningBanner = screen.getByText(/not on the supported list/i).closest('div')!;
    expect(within(warningBanner).queryByText('Python')).not.toBeInTheDocument();
  });

  it('removing a flagged off-list value drops only that one', () => {
    const onChange = vi.fn();
    render(<LanguageMultiSelect value={['COBOL', 'Python']} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove unsupported language COBOL' }));
    expect(onChange).toHaveBeenCalledWith(['Python']);
  });
});
