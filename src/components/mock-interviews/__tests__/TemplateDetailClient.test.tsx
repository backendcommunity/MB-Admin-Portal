import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore } from '@/store/authStore';

const fetchTemplate = vi.fn();
const updateTemplate = vi.fn();

vi.mock('@/lib/api/mockInterviews', () => ({
  fetchTemplate: (...a: unknown[]) => fetchTemplate(...a),
  updateTemplate: (...a: unknown[]) => updateTemplate(...a),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 't-1' }),
}));

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
  isCustom: false,
  sourceJd: null,
  addedBy: null,
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
    expect(screen.queryByLabelText(/^name$/i)).toBeNull();
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
    wrap();
    expect(await screen.findByRole('button', { name: /submit for review/i })).toBeInTheDocument();
    expect(screen.getByText(/refused server-side/i)).toBeInTheDocument();
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
