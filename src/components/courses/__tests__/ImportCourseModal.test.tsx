/**
 * Item 3 of the approval-workflow follow-up: an instructor's course import
 * used to write chapters/videos and only THEN hit `createCategory` (or the
 * bare `/quizzes` and `/exercises` POSTs), all three admin-only per the API
 * report — so a document with a new category, or an inline quiz/exercise,
 * failed partway through with rows already created. The fix refuses before
 * any write, naming exactly what's blocking it.
 *
 * B6 of the instructor-authoring-fixes plan (2026-09-01) then found that the
 * SAMPLE document itself tripped this same preflight — it named a category
 * ("Architecture") no seed data has, and carried an inline quiz and
 * exercise, so "Load sample" -> "Import course" always refused for an
 * instructor. The fix there is in `importSample()` (see
 * lib/courses/__tests__/import.test.ts): the shipped sample no longer
 * creates a category or an inline quiz/exercise, so it must import clean.
 * The three preflight tests below now build their own documents with those
 * violations directly, rather than depending on the sample carrying them —
 * the sample being clean and the preflight guard working are two different
 * things to prove.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';

import ImportCourseModal from '../ImportCourseModal';
import { importSample } from '@/lib/courses/import';
import { useAuthStore } from '@/store/authStore';

const fetchCategories = vi.fn();
const createCategory = vi.fn();
const createCourse = vi.fn();
const createChapter = vi.fn();
const createVideo = vi.fn();
const createArticle = vi.fn();
const attachProject = vi.fn();
const attachMockInterview = vi.fn();
const setCourseStatus = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return {
    ...actual,
    fetchCategories: (...args: unknown[]) => fetchCategories(...args),
    createCategory: (...args: unknown[]) => createCategory(...args),
    createCourse: (...args: unknown[]) => createCourse(...args),
    createChapter: (...args: unknown[]) => createChapter(...args),
    createVideo: (...args: unknown[]) => createVideo(...args),
    createArticle: (...args: unknown[]) => createArticle(...args),
    attachProject: (...args: unknown[]) => attachProject(...args),
    attachMockInterview: (...args: unknown[]) => attachMockInterview(...args),
    setCourseStatus: (...args: unknown[]) => setCourseStatus(...args),
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

/** A document that names a category the catalog doesn't have. */
const docWithNewCategory = () =>
  JSON.stringify({
    title: 'A course',
    category: 'Message Systems',
    chapters: [{ title: 'C1', items: [{ kind: 'video', title: 'V', video: 'x', duration: 60 }] }],
  });

/** A document with an inline quiz and exercise — both admin-only to create. */
const docWithInlineQuizAndExercise = () =>
  JSON.stringify({
    title: 'A course',
    chapters: [
      {
        title: 'C1',
        items: [
          {
            kind: 'quiz',
            title: 'Q',
            description: 'd',
            questions: [{ prompt: 'p', options: ['a', 'b'], answer: 0 }],
          },
          {
            kind: 'exercise',
            title: 'E',
            description: 'd',
            instructions: 'i',
            solution: 's',
            languages: ['Go'],
            testCases: [{ input: 'a', expectedOutput: 'b' }],
          },
        ],
      },
    ],
  });

function pasteJson(json: string) {
  const field = screen.getByRole('textbox', { name: /course json/i });
  fireEvent.change(field, { target: { value: json } });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchCategories.mockResolvedValue([{ id: 'cat-backend', name: 'Backend', color: '#000' }]);
  axiosGet.mockResolvedValue({ data: { data: [] } });
  createCategory.mockResolvedValue({ id: 'cat-1', name: 'Message Systems', color: '#000' });
  createCourse.mockResolvedValue({ id: 'course-1' });
  createChapter.mockResolvedValue({ id: 'chapter-1' });
  createVideo.mockResolvedValue({ id: 'video-1' });
  createArticle.mockResolvedValue({ id: 'article-1' });
  attachProject.mockResolvedValue({});
  attachMockInterview.mockResolvedValue({});
  setCourseStatus.mockResolvedValue({});
});

describe('ImportCourseModal — instructor preflight', () => {
  it('refuses a document naming a new category before writing anything', async () => {
    asRole('INSTRUCTOR');
    render(<ImportCourseModal open onClose={() => {}} onImported={() => {}} />);

    pasteJson(docWithNewCategory());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /import course/i })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: /import course/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Cannot import this document',
        expect.objectContaining({
          description: expect.stringContaining('Category "Message Systems" doesn\'t exist'),
        }),
      ),
    );
    expect(createCategory).not.toHaveBeenCalled();
    expect(createCourse).not.toHaveBeenCalled();
  });

  it('names the blocked quiz and exercise', async () => {
    asRole('INSTRUCTOR');
    render(<ImportCourseModal open onClose={() => {}} onImported={() => {}} />);

    pasteJson(docWithInlineQuizAndExercise());
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
    axiosPost.mockResolvedValue({ data: { id: 'quiz-1' } });
    render(<ImportCourseModal open onClose={() => {}} onImported={() => {}} />);

    pasteJson(docWithNewCategory());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /import course/i })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: /import course/i }));

    await waitFor(() => expect(createCategory).toHaveBeenCalledWith('Message Systems'));
    expect(createCourse).toHaveBeenCalled();
  });
});

describe('ImportCourseModal — Load sample', () => {
  it('the shipped sample imports clean for an instructor: no new category, no inline quiz or exercise, nothing refused', async () => {
    asRole('INSTRUCTOR');
    render(<ImportCourseModal open onClose={() => {}} onImported={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /load sample/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /import course/i })).toBeEnabled(),
    );

    // The sample must parse with no new category and no quiz/exercise items —
    // exactly what an instructor is forbidden to create — so the preflight
    // guard has nothing to refuse.
    expect(JSON.parse(importSample()).category).not.toBe('Architecture');
    const sampleDoc = JSON.parse(importSample());
    const allItems = (sampleDoc.chapters ?? []).flatMap(
      (c: { items?: Array<{ kind: string }> }) => c.items ?? [],
    );
    expect(allItems.some((i: { kind: string }) => i.kind === 'quiz')).toBe(false);
    expect(allItems.some((i: { kind: string }) => i.kind === 'exercise')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /import course/i }));

    await waitFor(() => expect(createCourse).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
    expect(createCategory).not.toHaveBeenCalled();
    expect(axiosPost).not.toHaveBeenCalled();

    // The sample also carries amount/isPremium/paddlePriceId — real fields on
    // a real course, but presence-forbidden for a non-staff caller
    // (`stripPricingFields`, same guard A1 applies to the path form). The
    // importer posts `doc.course` almost verbatim, so unlike the form-driven
    // saves it must strip these itself or a genuinely correct sample still
    // 403s past the preflight guard, on the actual create call.
    const payload = createCourse.mock.calls[0][0];
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('isPremium');
    expect(payload).not.toHaveProperty('paddle_price_id');
  });
});
