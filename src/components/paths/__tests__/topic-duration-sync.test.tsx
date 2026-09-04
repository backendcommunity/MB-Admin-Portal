/**
 * B5 (instructor-authoring-fixes plan): "path topic duration does not update
 * the hours field." Reproduced live against the dev server as
 * instructor@mbtest.com — the persisted value IS correct (the sidebar spine
 * and a fresh page load both show it), so this is a display-only bug, not
 * data loss.
 *
 * Root cause: the inline Title/Hours inputs in the curriculum pane are
 * uncontrolled (`defaultValue`, committed on blur — see the comment above
 * their wrapping div) so a keystroke doesn't re-render the whole pane and
 * move the caret. The wrapping div is keyed by `topic.id` alone, which
 * correctly remounts (and re-seeds `defaultValue`) when the SELECTED topic
 * changes, but does nothing when the SAME topic's own duration changes via a
 * different path — specifically, saving a new Duration from the "Edit all
 * fields" drawer. The drawer's own save is correct and the sidebar reflects
 * it immediately; only this one uncontrolled input goes stale.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PathDetailClient from '@/components/paths/PathDetailClient';
import type { PathDetail, Topic } from '@/lib/api/paths';

function makeTopic(id: string, title: string, duration: number): Topic {
  return {
    id,
    title,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    summary: '',
    description: '',
    banner: '',
    level: 'Beginner',
    duration,
    outcomes: [],
    recommendation: 1,
    reference: '',
    isPremium: false,
    order: 0,
    items: [],
  };
}

function makePath(duration: number): PathDetail {
  return {
    id: 'p1',
    title: 'Backend Engineering',
    slug: 'backend-engineering',
    summary: 'A summary comfortably past the forty character minimum for publishing.',
    banner: null,
    level: 'Advanced',
    difficulty: '',
    isPremium: false,
    amount: 0,
    isWaiting: false,
    isPublic: true,
    ownerTeamId: null,
    archivedAt: null,
    status: 'PUBLISHED',
    skills: [],
    languages: [],
    estimatedWeeks: 12,
    hoursPerWeek: 8,
    counts: { topics: 1, enrolled: 0, items: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    description: '',
    preview: '',
    timeframe: '',
    instructor: '',
    prerequisites: [],
    paddlePlanCode: null,
    paddle_price_id: '',
    waitingLink: '',
    createdById: '',
    createdBy: null,
    topics: [makeTopic('t1', 'How the Internet Works', duration)],
    readiness: [],
  };
}

const fetchPath = vi.fn();
const updateTopic = vi.fn();
vi.mock('@/lib/api/paths', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/paths')>('@/lib/api/paths');
  return {
    ...actual,
    fetchPath: (...args: unknown[]) => fetchPath(...args),
    fetchLearners: () => Promise.resolve({ data: [], total: 0, page: 1, limit: 20 }),
    checkPathSlug: () => Promise.resolve({ slug: '', available: true, suggestion: '' }),
    updateTopic: (...args: unknown[]) => updateTopic(...args),
    createTopic: vi.fn(),
    deleteTopic: vi.fn(),
    detachItem: vi.fn(),
    reorderTopics: vi.fn(),
    reorderItems: vi.fn(),
    setPathStatus: vi.fn(),
    updatePath: vi.fn(),
    removeLearner: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'p1' }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PathDetailClient />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchPath.mockReset();
  updateTopic.mockReset();
});

describe('the inline Hours field, after a duration change made elsewhere', () => {
  it('reflects a duration saved via the "Edit all fields" drawer, not the stale value', async () => {
    // The API round trip: PUT persists, and the next GET (refetch) reflects
    // it — matching what the live reproduction confirmed the server does
    // correctly. The bug under test is purely about what the ALREADY-
    // mounted inline input shows afterwards.
    let served = makePath(6);
    fetchPath.mockImplementation(() => Promise.resolve(served));
    updateTopic.mockImplementation(async (_pathId: string, topicId: string, payload: object) => {
      served = {
        ...served,
        topics: served.topics.map((t) => (t.id === topicId ? { ...t, ...payload } : t)),
      };
      return served.topics.find((t) => t.id === topicId);
    });

    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    const hours = () => screen.getByLabelText('Hours') as HTMLInputElement;
    await waitFor(() => expect(hours().value).toBe('6'));

    // Two buttons share this label — one in the card header, one inside the
    // TopicPane itself — either opens the same drawer.
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit all fields' })[0]);
    const dialog = await screen.findByRole('dialog');
    const durationField = within(dialog).getByLabelText('Duration (hours)') as HTMLInputElement;
    fireEvent.change(durationField, { target: { value: '20' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save topic' }));

    // The drawer closes once the save resolves.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // The sidebar spine is a plain controlled render, so it already proves
    // the new value round-tripped.
    await waitFor(() => expect(screen.getByText('20h')).toBeInTheDocument());

    // This is the field that stayed stale: same topic, same key, uncontrolled
    // `defaultValue` never re-applied.
    await waitFor(() => expect(hours().value).toBe('20'));
  });
});
