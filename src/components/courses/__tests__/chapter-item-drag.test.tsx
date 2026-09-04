/**
 * C1 (instructor-authoring-fixes plan): "chapter items cannot be dragged to
 * reorder." The plan flags real history here — a chapter reorder endpoint
 * once returned success while doing nothing, with a comment falsely
 * claiming the model had no `order` column. Checked that first: reproduced
 * live against the dev server with a real instructor course, two videos,
 * and a raw PATCH to /chapters/:chapterId/items/reorder — the API persists
 * correctly (confirmed by a fresh GET afterwards, no stale cache). So the
 * defect, if real, is in the UI's drag wiring, not the write.
 *
 * This test drives the actual DOM drag events `useDragReorder` listens for
 * (dragStart/dragOver/drop) on the two rendered chapter items, the same way
 * a real browser drag fires them, to see whether the reorder call is sent
 * at all — Group C's first diagnostic question ("fails to fire, fires and
 * sends nothing, or sends and is not persisted").
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import CourseDetailClient from '../CourseDetailClient';
import { useAuthStore } from '@/store/authStore';
import type { CourseDetail } from '@/lib/api/courses';

const fetchCourse = vi.fn();
const fetchCategories = vi.fn();
const reorderChapterItems = vi.fn();
const reorderChapters = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return {
    ...actual,
    fetchCourse: (...args: unknown[]) => fetchCourse(...args),
    fetchCategories: (...args: unknown[]) => fetchCategories(...args),
    reorderChapterItems: (...args: unknown[]) => reorderChapterItems(...args),
    reorderChapters: (...args: unknown[]) => reorderChapters(...args),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'course-1' }),
}));

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CourseDetailClient />
    </QueryClientProvider>,
  );
}

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
  counts: { chapters: 1, items: 2, enrolled: 0 },
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
        { id: 'v2', kind: 'video', title: 'Video B', order: 1 },
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
  useAuthStore.setState({ userRole: 'INSTRUCTOR' as never, authResolved: true });
  fetchCategories.mockResolvedValue([]);
  fetchCourse.mockResolvedValue(course());
  reorderChapterItems.mockResolvedValue({ success: true });
});

describe('dragging a chapter item to reorder it', () => {
  it('sends the reorder call with the items in their new order', async () => {
    renderWithClient();
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    // Item titles render inside an editable Input (`defaultValue`), not as
    // plain text — `getByDisplayValue` reaches that, `getByText` won't.
    const itemA = await screen.findByDisplayValue('Video A');
    const itemB = await screen.findByDisplayValue('Video B');
    const rowA = itemA.closest('[draggable]') as HTMLElement;
    const rowB = itemB.closest('[draggable]') as HTMLElement;
    expect(rowA).toBeTruthy();
    expect(rowB).toBeTruthy();

    // A real drag: dragstart on the source, dragover the target (React's
    // handler calls preventDefault so a drop is legal), then drop on the
    // target — exactly the sequence useDragReorder's handlers wire up.
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };
    fireEvent.dragStart(rowA, { dataTransfer });
    fireEvent.dragOver(rowB, { dataTransfer });
    fireEvent.drop(rowB, { dataTransfer });

    await waitFor(() => expect(reorderChapterItems).toHaveBeenCalled());
    expect(reorderChapterItems).toHaveBeenCalledWith('course-1', 'ch1', ['v2', 'v1']);
  });
});

describe('dragging a chapter (not its items)', () => {
  it('still reorders chapters, unaffected by the item-drag split', async () => {
    // The fix splits one shared useDragReorder into two instances. This
    // pins that the chapter-level drag — the other half of that split —
    // still works on its own, not just the item-level half above.
    reorderChapters.mockResolvedValue({ success: true });
    const twoChapterCourse: CourseDetail = {
      ...course(),
      chapters: [
        ...course().chapters,
        {
          id: 'ch2',
          title: 'Chapter Two',
          summary: null,
          description: null,
          banner: null,
          slug: 'chapter-two',
          type: 'MIXED',
          isPremium: true,
          order: 1,
          items: [],
        },
      ],
    };
    fetchCourse.mockResolvedValue(twoChapterCourse);

    renderWithClient();
    fireEvent.click(await screen.findByRole('tab', { name: 'Curriculum' }));

    // Chapter titles render inside an editable Input too — same reason
    // `getByDisplayValue` is needed above.
    const chapterOne = (await screen.findByDisplayValue('Chapter One')).closest(
      '[draggable]',
    ) as HTMLElement;
    const chapterTwo = (await screen.findByDisplayValue('Chapter Two')).closest(
      '[draggable]',
    ) as HTMLElement;
    expect(chapterOne).toBeTruthy();
    expect(chapterTwo).toBeTruthy();

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
    };
    fireEvent.dragStart(chapterOne, { dataTransfer });
    fireEvent.dragOver(chapterTwo, { dataTransfer });
    fireEvent.drop(chapterTwo, { dataTransfer });

    await waitFor(() => expect(reorderChapters).toHaveBeenCalled());
    expect(reorderChapters).toHaveBeenCalledWith('course-1', ['ch2', 'ch1']);
  });
});
