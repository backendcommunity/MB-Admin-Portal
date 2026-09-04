import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportUsersModal from '../ImportUsersModal';
import { createUserImport } from '@/lib/api/userImports';

vi.mock('@/lib/api/userImports', () => ({
  createUserImport: vi.fn(),
}));

describe('ImportUsersModal', () => {
  it('offers the activation video but disables it while the flow is not live', async () => {
    render(<ImportUsersModal open onOpenChange={() => {}} onImported={() => {}} />);
    const box = await screen.findByRole('checkbox', { name: /activation walkthrough/i });
    expect(box).toBeDisabled();
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument();
  });

  it('sends no `name` key for a row whose name had to be derived — the server is the sole authority on derivation', async () => {
    vi.mocked(createUserImport).mockResolvedValue({
      success: true,
      id: 'imp1',
      totalRows: 2,
      queued: 2,
      enqueueFailed: 0,
    });

    render(<ImportUsersModal open onOpenChange={() => {}} onImported={() => {}} />);
    const textarea = screen.getByRole('textbox', { name: /roster csv or json/i });
    fireEvent.change(textarea, {
      target: { value: 'name,email\nAda Lovelace,ada-c1@x.io\n,noname-c1@x.io\n' },
    });

    fireEvent.click(await screen.findByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(createUserImport).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(createUserImport).mock.calls[0][0];

    const withName = payload.rows.find((r) => r.email === 'ada-c1@x.io');
    const withoutName = payload.rows.find((r) => r.email === 'noname-c1@x.io');

    expect(withName).toEqual({ name: 'Ada Lovelace', email: 'ada-c1@x.io' });
    // The row had no name in the file — the payload must carry NO `name`
    // key at all, not an empty string and not the locally-derived guess.
    // The server is the single authority on derivation (see
    // academy's deriveNameFromEmail).
    expect(withoutName).toEqual({ email: 'noname-c1@x.io' });
    expect(withoutName).not.toHaveProperty('name');
  });

  it('loads the sample into the textarea and previews it without a blocking error', async () => {
    render(<ImportUsersModal open onOpenChange={() => {}} onImported={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /load sample/i }));

    const textarea = screen.getByRole('textbox', { name: /roster csv or json/i });
    expect((textarea as HTMLTextAreaElement).value).not.toBe('');

    // No "nothing will be written until these are fixed" error panel — the
    // sample must parse cleanly even though it deliberately contains rows
    // that get skipped with a reason.
    expect(
      screen.queryByText(/nothing will be written until these are fixed/i),
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/skipped rows and other notes/i)).toBeInTheDocument();
  });
});
