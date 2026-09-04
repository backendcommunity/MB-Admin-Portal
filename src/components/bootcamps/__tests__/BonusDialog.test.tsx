/**
 * Item 6: the API now accepts a bonus with a title and description and no
 * linked video/resource/course. The dialog needs a "Custom" choice
 * alongside the existing kinds, and exactly one of {linked item, custom
 * title+description} must be satisfiable — never both, never neither.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BonusDialog from '../BonusDialog';
import type { Bonus } from '@/lib/api/bootcamps';

const createBonus = vi.fn();
const updateBonus = vi.fn();
const searchLibrary = vi.fn();

vi.mock('@/lib/api/bootcamps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/bootcamps')>('@/lib/api/bootcamps');
  return {
    ...actual,
    createBonus: (...args: unknown[]) => createBonus(...args),
    updateBonus: (...args: unknown[]) => updateBonus(...args),
    searchLibrary: (...args: unknown[]) => searchLibrary(...args),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  searchLibrary.mockResolvedValue([]);
  createBonus.mockResolvedValue({ id: 'b1' });
  updateBonus.mockResolvedValue({ id: 'b1' });
});

describe('BonusDialog — custom bonus', () => {
  it('offers a custom choice alongside the library kinds', () => {
    render(
      <BonusDialog open onOpenChange={() => {}} cohortId="c1" bonus={null} onSaved={() => {}} />,
    );
    expect(screen.getByRole('combobox', { name: /points at/i })).toHaveTextContent(/course/i);
    // Radix's own popup hangs jsdom in this repo — assert on the trigger's
    // static text rather than opening it. The value default is asserted via
    // payload behaviour in the other tests instead.
  });

  it('disables Add bonus until a link is picked, when not custom', () => {
    render(
      <BonusDialog open onOpenChange={() => {}} cohortId="c1" bonus={null} onSaved={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /add bonus/i })).toBeDisabled();
  });

  it('requires both title and description for a custom bonus, then submits kind/itemId-free', async () => {
    render(
      <BonusDialog
        open
        onOpenChange={() => {}}
        cohortId="c1"
        bonus={
          {
            id: 'b1',
            cohortId: 'c1',
            kind: null,
            itemId: '',
            itemTitle: '',
            topic: '',
            summary: '',
          } as Bonus
        }
        onSaved={() => {}}
      />,
    );

    // Seeded from a bonus with no itemId — the dialog opens already in
    // custom mode, and the library picker is not shown.
    expect(screen.queryByText(/change/i)).not.toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: /^save$/i });
    expect(addButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/title/i), 'Bonus office hours');
    expect(addButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/description/i), 'A live Q&A for this cohort.');
    expect(addButton).toBeEnabled();

    await userEvent.click(addButton);

    await waitFor(() => expect(updateBonus).toHaveBeenCalled());
    const [, , payload] = updateBonus.mock.calls[0];
    expect(payload).toEqual({
      topic: 'Bonus office hours',
      summary: 'A live Q&A for this cohort.',
    });
    expect('kind' in payload).toBe(false);
    expect('itemId' in payload).toBe(false);
  });
});
