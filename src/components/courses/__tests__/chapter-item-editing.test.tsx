/**
 * Chapter-attached quizzes and exercises were second-class citizens in the
 * curriculum builder: every affordance (drag handle, move buttons, Edit) was
 * gated behind `isOwned`, which only ever matched video/article, so a quiz or
 * exercise rendered as a badge, plain text and a delete button.
 *
 * The owner's decision: one freely interleaved sequence across every kind,
 * and every write against a chapter's items (create, edit, attach, delete,
 * reorder) must invalidate the `['admin-courses']` list query, which
 * otherwise sits on a 60s staleTime and keeps showing a stale item count.
 *
 * These tests drive `CourseDetailClient` end to end (real `moveItem` /
 * `itemDrag` wiring, real `ItemDrawer`/`LibraryPicker`/`ConfirmDelete`), only
 * mocking the network edge in `@/lib/api/courses`.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import CourseDetailClient from '../CourseDetailClient';
import { useAuthStore } from '@/store/authStore';
import type { CourseDetail } from '@/lib/api/courses';

const fetchCourse = vi.fn();
const fetchCategories = vi.fn();
const reorderChapterItems = vi.fn();
const reorderChapters = vi.fn();
const detachQuiz = vi.fn();
const searchLibrary = vi.fn();
const attachQuiz = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return {
    ...actual,
    fetchCourse: (...args: unknown[]) => fetchCourse(...args),
    fetchCategories: (...args: unknown[]) => fetchCategories(...args),
    reorderChapterItems: (...args: unknown[]) => reorderChapterItems(...args),
    reorderChapters: (...args: unknown[]) => reorderChapters(...args),
    detachQuiz: (...args: unknown[]) => detachQuiz(...args),
    searchLibrary: (...args: unknown[]) => searchLibrary(...args),
    attachQuiz: (...args: unknown[]) => attachQuiz(...args),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'course-1' }),
}));

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <CourseDetailClient />
    </QueryClientProvider>,
  );
  return { invalidateSpy };
}

// A chapter carrying every kind, interleaved — the shape that was impossible
// before this fix (attached kinds always rendered after every owned one).
const course = (): CourseDetail => ({
  id: 'course-1',
  title: 'Distributed Systems',
  slug: 'distributed-systems',
  summary: 'Learn distributed systems.',
  banner: null,
  type: 'VIDEO',
  level: 'Intermediate',
  category: null,
  isPublic: false,
  isPremium: false,
  amount: 0,
  isWaiting: true,
  archivedAt: null,
  status: 'DRAFT',
  tags: [],
  languages: [],
  counts: { chapters: 1, items: 3, enrolled: 0 },
  totalDuration: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastUpdated: '2026-01-01T00:00:00.000Z',
  description: null,
  categoryId: null,
  preview: null,
  vimeoFolderURI: null,
  vimeoFolderId: null,
  waitingLink: null,
  productId: null,
  paddlePlanCode: null,
  paddle_price_id: '',
  createdById: null,
  chapters: [
    {
      id: 'ch1',
      title: 'Chapter One',
      summary: null,
      description: null,
      banner: null,
      slug: 'chapter-one',
      type: 'MIXED',
      isPremium: true,
      order: 0,
      items: [
        { id: 'v1', kind: 'video', title: 'Video A', order: 0 },
        // The join row id (`jc1`) is what reorder/delete use; `refId` (the
        // library quiz's own id) is what editing the shared row must use.
        { id: 'jc1', kind: 'quiz', title: 'Quiz One', refId: 'quiz-999', order: 1, meta: '3 qs' },
        { id: 'a1', kind: 'article', title: 'Article B', order: 2 },
      ],
    },
  ],
  capstone: {
    projects: [],
    mockInterviews: [],
    quizzes: [],
    exercises: [],
    videos: [],
    articles: [],
  },
  stats: { enrolled: 0, completed: 0, completionRate: 0 },
  readiness: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ userRole: 'ADMIN' as never, authResolved: true });
  fetchCategories.mockResolvedValue([]);
  fetchCourse.mockResolvedValue(course());
  reorderChapterItems.mockResolvedValue({ success: true });
  detachQuiz.mockResolvedValue({ success: true });
  attachQuiz.mockResolvedValue({ success: true });
});

describe('a quiz row in the interleaved list', () => {
  it('exposes a drag handle and an Edit button, same as an owned item', async () => {
    renderWithClient();
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    const quizTitle = await screen.findByText('Quiz One');
    const row = quizTitle.closest('[draggable]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.getAttribute('draggable')).toBe('true');
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});

describe('reordering an interleaved chapter', () => {
  it('moving a quiz between two owned items sends the full mixed id sequence, in order', async () => {
    renderWithClient();
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    const quizTitle = await screen.findByText('Quiz One');
    const row = quizTitle.closest('[draggable]') as HTMLElement;
    // Quiz One sits at index 1 (between Video A and Article B) — move it up.
    fireEvent.click(within(row).getByRole('button', { name: 'Move item up' }));

    await waitFor(() => expect(reorderChapterItems).toHaveBeenCalled());
    // `id` values only — the join row for the quiz (`jc1`), never `refId`
    // (`quiz-999`), which the reorder endpoint has no notion of.
    expect(reorderChapterItems).toHaveBeenCalledWith('course-1', 'ch1', ['jc1', 'v1', 'a1']);
  });

  it('invalidates the admin-courses list after a reorder', async () => {
    const { invalidateSpy } = renderWithClient();
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    const quizTitle = await screen.findByText('Quiz One');
    const row = quizTitle.closest('[draggable]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Move item down' }));

    await waitFor(() => expect(reorderChapterItems).toHaveBeenCalled());
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin-courses'] }),
    );
  });
});

describe('deleting (detaching) a chapter item', () => {
  it('invalidates the admin-courses list after the detach', async () => {
    const { invalidateSpy } = renderWithClient();
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    const quizTitle = await screen.findByText('Quiz One');
    const row = quizTitle.closest('[draggable]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Remove Quiz One' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(detachQuiz).toHaveBeenCalledWith('course-1', 'quiz-999'));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin-courses'] }),
    );
  });
});

describe('attaching a quiz from the library', () => {
  it('invalidates the admin-courses list once attached', async () => {
    searchLibrary.mockResolvedValue({
      data: [{ id: 'quiz-42', kind: 'quiz', title: 'Existing Quiz', meta: '', reuse: 'attach' }],
      total: 1,
      page: 1,
      limit: 20,
    });
    const { invalidateSpy } = renderWithClient();
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    fireEvent.click(await screen.findByRole('button', { name: 'quiz' }));
    // Attaching an unattached item opens straight on "Use existing".
    const pickButton = await screen.findByRole('button', { name: /Existing Quiz/ });
    fireEvent.click(pickButton);

    await waitFor(() =>
      expect(attachQuiz).toHaveBeenCalledWith('course-1', { quizId: 'quiz-42', chapterId: 'ch1' }),
    );
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin-courses'] }),
    );
  });
});
