import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { useAuthStore } from '@/store/authStore';

const createTemplate = vi.fn();
vi.mock('@/lib/api/mockInterviews', () => ({
  createTemplate: (...a: unknown[]) => createTemplate(...a),
}));

// See TemplateDetailClient.test.tsx: the portal's real session is the
// `useAuthStore` zustand store, not a `@/lib/auth/useAuth` hook.
const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

import ImportTemplatesModal from '@/components/mock-interviews/ImportTemplatesModal';

const open = (onImported = vi.fn()) =>
  render(<ImportTemplatesModal open onOpenChange={() => {}} onImported={onImported} />);

beforeEach(() => {
  vi.clearAllMocks();
  asRole('ADMIN');
  createTemplate.mockImplementation(async (p: any) => ({ id: `id-${p.name}` }));
});

describe('ImportTemplatesModal', () => {
  it('blocks Import while the JSON is invalid', () => {
    open();
    fireEvent.change(screen.getByLabelText(/template json/i), { target: { value: '{ nope' } });
    expect(screen.getByRole('button', { name: /^import$/i })).toBeDisabled();
    expect(screen.getByText(/not valid json/i)).toBeInTheDocument();
  });

  it('reports coercions and still allows the import', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));
    expect(screen.getByText(/imported anyway/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^import$/i })).toBeEnabled();
  });

  it('creates one template per row, replaying the same POST the form makes', async () => {
    const onImported = vi.fn();
    open(onImported);
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => expect(createTemplate).toHaveBeenCalledTimes(2));
    expect(onImported).toHaveBeenCalled();
  });

  it('says where it stopped when one row fails, and does not claim success', async () => {
    createTemplate
      .mockResolvedValueOnce({ id: 'ok-1' })
      .mockRejectedValueOnce(new Error('duration must be a number'));

    open();
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    expect(await screen.findByText(/stopped/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 2/i)).toBeInTheDocument();
  });

  it('imports as drafts for an instructor, who cannot publish', async () => {
    asRole('INSTRUCTOR');
    open();
    fireEvent.click(screen.getByRole('button', { name: /load sample/i }));
    // The sample's first row carries isPublic: true; an instructor's import
    // must fall back to draft, matching parseTemplateImport's own contract.
    expect(screen.getByText(/imported as a draft/i)).toBeInTheDocument();
  });
});
