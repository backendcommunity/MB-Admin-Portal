/**
 * Item 3 of the approval-workflow follow-up: an instructor's course import
 * used to write chapters/videos and only THEN hit `createCategory` (or the
 * bare `/quizzes` and `/exercises` POSTs), all three admin-only per the API
 * report — so a document with a new category, or an inline quiz/exercise,
 * failed partway through with rows already created. The fix refuses before
 * any write, naming exactly what's blocking it.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

import ImportCourseModal from '../ImportCourseModal';
import { useAuthStore } from '@/store/authStore';

const fetchCategories = vi.fn();
const createCategory = vi.fn();
const createCourse = vi.fn();
const createChapter = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return {
    ...actual,
    fetchCategories: (...args: unknown[]) => fetchCategories(...args),
    createCategory: (...args: unknown[]) => createCategory(...args),
    createCourse: (...args: unknown[]) => createCourse(...args),
    createChapter: (...args: unknown[]) => createChapter(...args),
  };
});

const axiosGet = vi.fn();
const axiosPost = vi.fn();

vi.mock('@/lib/api/axios', () => ({
  axiosInstance: {
    get: (...args: unknown[]) => axiosGet(...args),
    post: (...args: unknown[]) => axiosPost(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

beforeEach(() => {
  vi.clearAllMocks();
  // No categories exist yet — the sample doc's `category: "Architecture"`
  // will resolve to `newCategory` being set.
  fetchCategories.mockResolvedValue([]);
  axiosGet.mockResolvedValue({ data: { data: [] } });
  createCategory.mockResolvedValue({ id: 'cat-1', name: 'Architecture', color: '#000' });
  createCourse.mockResolvedValue({ id: 'course-1' });
  createChapter.mockResolvedValue({ id: 'chapter-1' });
});

describe('ImportCourseModal — instructor preflight', () => {
  it('refuses a document naming a new category before writing anything', async () => {
    asRole('INSTRUCTOR');
    render(<ImportCourseModal open onClose={() => {}} onImported={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /load sample/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /import course/i })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: /import course/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Cannot import this document',
        expect.objectContaining({
          description: expect.stringContaining('Category "Architecture" doesn\'t exist'),
        }),
      ),
    );
    expect(createCategory).not.toHaveBeenCalled();
    expect(createCourse).not.toHaveBeenCalled();
  });

  it('names the blocked quiz and exercise too, once the category already exists', async () => {
    asRole('INSTRUCTOR');
    // The category now exists, so only the quiz/exercise guards should fire.
    fetchCategories.mockResolvedValue([{ id: 'cat-1', name: 'Architecture', color: '#000' }]);
    render(<ImportCourseModal open onClose={() => {}} onImported={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /load sample/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /import course/i })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: /import course/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [, options] = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.description).toMatch(/new quiz/i);
    expect(options.description).toMatch(/new exercise/i);
    expect(createChapter).not.toHaveBeenCalled();
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it('does not gate an admin the same way', async () => {
    asRole('ADMIN');
    fetchCategories.mockResolvedValue([]);
    axiosPost.mockResolvedValue({ data: { id: 'quiz-1' } });
    render(<ImportCourseModal open onClose={() => {}} onImported={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /load sample/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /import course/i })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: /import course/i }));

    await waitFor(() => expect(createCategory).toHaveBeenCalledWith('Architecture'));
    expect(createCourse).toHaveBeenCalled();
  });
});
