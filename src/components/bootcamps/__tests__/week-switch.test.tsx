/**
 * Switching between weeks must refill the fields.
 *
 * This is the same bug the path editor had: state seeded once at mount keeps
 * showing the first subject's text, so editing week 2 silently overwrites it
 * with week 1's title. `useSeededForm` is what prevents it, and this drives it
 * through a component rather than testing the hook in isolation.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';

import { useSeededForm } from '@/lib/forms/useSeededForm';

const WEEKS = [
  { id: 'w1', title: 'Week 1 — Foundations', summary: 'The runtime.' },
  { id: 'w2', title: 'Week 2 — APIs', summary: 'Routing.' },
];

function Editor() {
  const [selectedId, setSelectedId] = useState('w1');
  const week = WEEKS.find((row) => row.id === selectedId)!;
  const [draft, setDraft] = useSeededForm(`${week.id}:${week.title}:${week.summary}`, () => ({
    title: week.title,
    summary: week.summary,
  }));

  return (
    <div>
      {WEEKS.map((row) => (
        <button key={row.id} type="button" onClick={() => setSelectedId(row.id)}>
          pick {row.id}
        </button>
      ))}
      <input
        aria-label="title"
        value={draft.title}
        onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
      />
      <input aria-label="summary" value={draft.summary} readOnly />
    </div>
  );
}

describe('week fields follow the selection', () => {
  it('shows the newly selected week, not the one seeded at mount', () => {
    render(<Editor />);
    expect(screen.getByLabelText('title')).toHaveValue('Week 1 — Foundations');

    fireEvent.click(screen.getByText('pick w2'));

    expect(screen.getByLabelText('title')).toHaveValue('Week 2 — APIs');
    expect(screen.getByLabelText('summary')).toHaveValue('Routing.');
  });

  it('keeps what is being typed until the subject actually changes', () => {
    render(<Editor />);
    const title = screen.getByLabelText('title');

    fireEvent.change(title, { target: { value: 'Half-typed' } });
    expect(title).toHaveValue('Half-typed');

    // A re-render with the same stored week must not reset the field.
    fireEvent.click(screen.getByText('pick w1'));
    expect(title).toHaveValue('Half-typed');
  });

  it('drops the edit once a different week is chosen', () => {
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('title'), { target: { value: 'Half-typed' } });
    fireEvent.click(screen.getByText('pick w2'));
    expect(screen.getByLabelText('title')).toHaveValue('Week 2 — APIs');
  });
});
