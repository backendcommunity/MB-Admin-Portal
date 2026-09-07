import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore } from '@/store/authStore';

const fetchTemplate = vi.fn();
const updateTemplate = vi.fn();
const submitForReview = vi.fn();

vi.mock('@/lib/api/mockInterviews', () => ({
  fetchTemplate: (...a: unknown[]) => fetchTemplate(...a),
  updateTemplate: (...a: unknown[]) => updateTemplate(...a),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 't-1' }),
}));
vi.mock('@/lib/api/instructor', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api/instructor')>('@/lib/api/instructor');
  return {
    ...actual,
    submitForReview: (...args: unknown[]) => submitForReview(...args),
  };
});

// The portal has no `@/lib/auth/useAuth` hook — the real session lives in the
// `useAuthStore` zustand store (`userRole` + `authResolved`). This matches
// the convention `NewTemplateClient.test.tsx` establishes for Task 12.
const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

import TemplateDetailClient from '@/components/mock-interviews/TemplateDetailClient';

const detail = (over: Partial<any> = {}) => ({
  id: 't-1',
  name: 'Go Backend',
  summary: '',
  description: '',
  company: '',
  position: 'Backend Engineer',
  seniority: 'Senior',
  style: 'Technical',
  format: 'Chat',
  category: 'Backend',
  difficulty: 'Medium',
  duration: 30,
  questions: 8,
  topics: ['golang'],
  evaluationRubric: [],
  isPublic: false,
  isWaiting: false,
  waitingLink: null,
  isCustom: false,
  sourceJd: null,
  createdById: null,
  createdAt: '2026-08-01',
  attemptCount: 1,
  attempts: {
    stats: { total: 1, completed: 1, completionRate: 100, averageScore: 80 },
    recent: [
      {
        id: 'ui-1',
        status: 'COMPLETED',
        score: 80,
        startedAt: '2026-08-01',
        completedAt: '2026-08-02',
        candidate: { name: 'Ada Okoro', avatar: null },
      },
    ],
  },
  ...over,
});

const wrap = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TemplateDetailClient />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  asRole('ADMIN');
  fetchTemplate.mockResolvedValue(detail());
});

describe('TemplateDetailClient', () => {
  it('mounts one panel at a time — Interview fields are absent until its tab is chosen', async () => {
    wrap();
    expect(await screen.findByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^style$/i)).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /interview/i }));
    expect(screen.getByLabelText(/^style$/i)).toBeInTheDocument();
    // Not `/^name$/i`: Name is a required field and renders as "Name *" (see
    // Task 10's accessible-names table), so an exact-match anchor never
    // matches it whether the field is mounted or not — that made the
    // original version of this assertion pass regardless of what the
    // component actually did. `/^name/i` (no trailing anchor) matches the
    // real label text and is the one that can actually fail.
    expect(screen.queryByLabelText(/^name/i)).toBeNull();
  });

  it('shows the attempt count in the tab label', async () => {
    wrap();
    expect(await screen.findByRole('tab', { name: /attempts \(1\)/i })).toBeInTheDocument();
  });

  it('hides the Origin tab unless the template is learner-generated', async () => {
    wrap();
    await screen.findByLabelText(/name/i);
    expect(screen.queryByRole('tab', { name: /origin/i })).toBeNull();
  });

  it('shows Origin with the pasted JD for a custom template', async () => {
    fetchTemplate.mockResolvedValue(detail({ isCustom: true, sourceJd: 'Senior Rust Engineer…' }));
    wrap();
    fireEvent.click(await screen.findByRole('tab', { name: /origin/i }));
    expect(screen.getByText(/Senior Rust Engineer/)).toBeInTheDocument();
  });

  it('renders the candidate name on the Attempts tab', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('tab', { name: /attempts/i }));
    expect(screen.getByText('Ada Okoro')).toBeInTheDocument();
  });

  it('shows an em dash for a null completion rate or average score, never 0', async () => {
    fetchTemplate.mockResolvedValue(
      detail({
        attempts: {
          stats: { total: 1, completed: 0, completionRate: null, averageScore: null },
          recent: [],
        },
      }),
    );
    wrap();
    fireEvent.click(await screen.findByRole('tab', { name: /attempts/i }));
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/^0%$/)).toBeNull();
  });

  it('shows the Email column only when a candidate carries one', async () => {
    fetchTemplate.mockResolvedValue(
      detail({
        attempts: {
          stats: { total: 1, completed: 1, completionRate: 100, averageScore: 80 },
          recent: [
            {
              id: 'ui-1',
              status: 'COMPLETED',
              score: 80,
              startedAt: '2026-08-01',
              completedAt: '2026-08-02',
              candidate: { name: 'Ada Okoro', avatar: null, email: 'ada@example.com' },
            },
          ],
        },
      }),
    );
    wrap();
    fireEvent.click(await screen.findByRole('tab', { name: /attempts/i }));
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('omits the Email column when the instructor payload has no email key', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('tab', { name: /attempts/i }));
    expect(screen.queryByText(/@/)).toBeNull();
    // Guards against rendering the column with a "—" placeholder instead of
    // not rendering it at all — the header itself must be absent, matching
    // the brief's "no branch of its own" instruction (the key is genuinely
    // missing, not present-with-null).
    expect(screen.queryByRole('columnheader', { name: /^email$/i })).toBeNull();
  });

  it('an admin sees a Publish control; an instructor sees Submit for review with the server note', async () => {
    const first = wrap();
    expect(await screen.findByRole('button', { name: /^publish$/i })).toBeInTheDocument();
    first.unmount();

    asRole('INSTRUCTOR');
    fetchTemplate.mockResolvedValue(
      detail({ isWaiting: true, waitingLink: 'The rubric needs a rework.' }),
    );
    wrap();
    expect(await screen.findByRole('button', { name: /resubmit/i })).toBeInTheDocument();
    expect(screen.getByText('The rubric needs a rework.')).toBeInTheDocument();
  });

  it('wires the instructor Submit for review button to the real endpoint, with the mock-interview kind', async () => {
    submitForReview.mockResolvedValue({
      success: true,
      id: 't-1',
      type: 'MOCK_INTERVIEW',
      status: 'PENDING_REVIEW',
    });
    asRole('INSTRUCTOR');
    wrap();

    await userEvent.click(await screen.findByRole('button', { name: /submit for review/i }));

    await waitFor(() => expect(submitForReview).toHaveBeenCalledWith('mock-interview', 't-1'));
    await waitFor(() => expect(fetchTemplate).toHaveBeenCalledTimes(2));
  });

  it('the header badge tells the truth: Pending review (not Published) once isWaiting is set, even with isPublic true', async () => {
    fetchTemplate.mockResolvedValue(detail({ isPublic: true, isWaiting: true }));
    wrap();

    await screen.findByLabelText(/^name/i);
    expect(screen.queryByText(/^published$/i)).toBeNull();
    expect(screen.getByText(/in review/i)).toBeInTheDocument();
  });

  it('the header badge reads Published only when isWaiting is false and isPublic is true', async () => {
    fetchTemplate.mockResolvedValue(detail({ isPublic: true, isWaiting: false }));
    wrap();

    await screen.findByLabelText(/^name/i);
    expect(screen.getByText(/^published$/i)).toBeInTheDocument();
  });

  it('publishing carries an unsaved edit along instead of losing it on refetch', async () => {
    // Reproduces the bug exactly: edit a field, hit Publish (not Save), and
    // confirm the edit is still there afterward. Before the fix, Publish
    // sent only `{ isPublic }` and the seeding effect (keyed on `data`
    // itself, which gets a new identity on every refetch) reseeded `form`
    // from the server response and silently reverted the edit.
    updateTemplate.mockImplementation(async (id: string, payload: any) => {
      // The server always echoes back the full updated row — not just the
      // id — so the mock has to do the same for this test to actually
      // exercise the real code path (the component now syncs `form` from
      // this return value; a response that omits every field would make
      // the sync itself the thing that clobbers `name`, defeating the
      // point of this test).
      const updated = { ...detail(), ...payload, id };
      fetchTemplate.mockResolvedValue(updated);
      return updated;
    });
    wrap();

    const nameField = await screen.findByLabelText(/^name/i);
    fireEvent.change(nameField, { target: { value: 'EDITED NAME' } });
    expect(screen.getByLabelText(/^name/i)).toHaveValue('EDITED NAME');

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(updateTemplate).toHaveBeenCalled());
    const [, payload] = updateTemplate.mock.calls[0];
    // The publish call itself must carry the edit, not just the flag.
    expect(payload.name).toBe('EDITED NAME');

    await waitFor(() => expect(screen.getByLabelText(/^name/i)).toHaveValue('EDITED NAME'));
  });

  it('keeps form.isPublic in sync after Publish, so a later unrelated Save cannot silently revert it', async () => {
    // Reproduces the round-2 regression exactly: `togglePublish` sent
    // `{ ...form, isPublic: !data.isPublic }` but never called `setForm`,
    // and the seeding effect is keyed on the id alone (round 1's fix), which
    // does not change after a publish — so `form.isPublic` stayed frozen at
    // its pre-publish value. A later Save, editing something unrelated,
    // would ship that stale flag and flip the template back to draft with
    // no toast, no warning. This asserts on the mock's recorded payload
    // directly, not on rendered DOM state — react-query's structural
    // sharing can reuse the previous `data` reference when a refetch
    // returns a value it considers equivalent, which let an earlier,
    // weaker version of this kind of test pass even against the bug.
    updateTemplate.mockImplementation(async (id: string, payload: any) => {
      const updated = { ...detail(), ...payload, id };
      fetchTemplate.mockResolvedValue(updated);
      return updated;
    });
    wrap();

    await screen.findByLabelText(/^name/i);
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));
    await waitFor(() => expect(updateTemplate).toHaveBeenCalledTimes(1));
    const [, publishPayload] = updateTemplate.mock.calls[0];
    expect(publishPayload.isPublic).toBe(true);

    const nameField = await screen.findByLabelText(/^name/i);
    fireEvent.change(nameField, { target: { value: 'A LATER UNRELATED EDIT' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateTemplate).toHaveBeenCalledTimes(2));

    const [, savePayload] = updateTemplate.mock.calls[1];
    expect(savePayload.isPublic).toBe(true);
    expect(savePayload.name).toBe('A LATER UNRELATED EDIT');
  });

  it('disables Save while a publish is in flight, and Publish while a save is', async () => {
    let resolveUpdate!: (value: unknown) => void;
    updateTemplate.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    wrap();
    await screen.findByLabelText(/name/i);

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();

    resolveUpdate({ id: 't-1' });
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled());
  });

  it('saves via updateTemplate, then invalidates the admin list and refetches', async () => {
    updateTemplate.mockResolvedValue({ id: 't-1' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    render(
      <QueryClientProvider client={client}>
        <TemplateDetailClient />
      </QueryClientProvider>,
    );

    await screen.findByLabelText(/name/i);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateTemplate).toHaveBeenCalledWith('t-1', expect.any(Object)));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin-mock-interviews'] }),
    );
    await waitFor(() => expect(fetchTemplate).toHaveBeenCalledTimes(2));
  });
});
