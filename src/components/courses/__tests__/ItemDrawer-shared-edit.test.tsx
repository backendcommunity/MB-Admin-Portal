/**
 * Quizzes and exercises are shared library rows (`QuizCourse`/`ExerciseCourse`
 * join a course to them), not owned copies. `ItemDrawer`'s quiz/exercise path
 * used to be create-then-attach only — `existingId` short-circuited creation
 * and just attached, with no way to edit a row already attached.
 *
 * A chapter's item list only carries a title/meta summary for an attached
 * item (see `ChapterItem`), so editing needs the full library row, fetched
 * and saved by `refId` (the quiz/exercise's own id) — never `id` (the join
 * row id used everywhere else for reorder/attach/detach). Mixing the two up
 * is the most likely bug in this shape, which is exactly what the first test
 * below pins.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import ItemDrawer, { GRADERS, type DrawerTarget } from '../ItemDrawer';
import type { ChapterItem } from '@/lib/api/courses';
import { PLAYGROUND_LANGUAGES } from '@/lib/courses/blocks';

const fetchQuizDetail = vi.fn();
const updateQuizLibrary = vi.fn();
const attachQuiz = vi.fn();
const fetchExerciseDetail = vi.fn();
const updateExerciseLibrary = vi.fn();
const attachExercise = vi.fn();
const postSpy = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return {
    ...actual,
    fetchQuizDetail: (...args: unknown[]) => fetchQuizDetail(...args),
    updateQuizLibrary: (...args: unknown[]) => updateQuizLibrary(...args),
    attachQuiz: (...args: unknown[]) => attachQuiz(...args),
    fetchExerciseDetail: (...args: unknown[]) => fetchExerciseDetail(...args),
    updateExerciseLibrary: (...args: unknown[]) => updateExerciseLibrary(...args),
    attachExercise: (...args: unknown[]) => attachExercise(...args),
  };
});

vi.mock('@/lib/api/axios', () => ({
  axiosInstance: {
    post: (...args: unknown[]) => postSpy(...args),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const attachedQuizItem: ChapterItem = {
  id: 'jc1', // the QuizCourse join row — never what a PUT to /quizzes/:id should use
  kind: 'quiz',
  title: 'Old Quiz Title',
  refId: 'quiz-999', // the Quiz library row's own id
  order: 0,
  meta: '2 questions',
};

const attachedExerciseItem: ChapterItem = {
  id: 'jc-ex-1',
  kind: 'exercise',
  title: 'Old Exercise Title',
  refId: 'exercise-777',
  order: 1,
  meta: 'Easy',
};

function quizTarget(item: ChapterItem): DrawerTarget {
  return { kind: 'quiz', chapterId: 'ch1', item };
}

function exerciseTarget(item: ChapterItem): DrawerTarget {
  return { kind: 'exercise', chapterId: 'ch1', item };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchQuizDetail.mockResolvedValue({
    id: 'quiz-999',
    title: 'Old Quiz Title',
    description: 'A quiz about things',
    passingScore: 70,
    timeLimit: 10,
    maxAttempts: 3,
    difficulty: 'Medium',
    questions: [{ question: 'What is 2+2?', options: ['3', '4'], correctAnswer: '4' }],
  });
  updateQuizLibrary.mockResolvedValue({ success: true });
  attachQuiz.mockResolvedValue({ success: true });
  fetchExerciseDetail.mockResolvedValue({
    id: 'exercise-777',
    title: 'Old Exercise Title',
    description: 'Reverse a string',
    instructions: 'Write a function',
    solution: 'def solve(): pass',
    starterCode: '',
    hint: 'Think about indices',
    languages: ['Python'],
    graderType: 'OUTPUT_MATCH',
    testCases: [{ input: 'abc', expectedOutput: 'cba' }],
    points: 10,
    passMark: 60,
    difficulty: 'Easy',
  });
  updateExerciseLibrary.mockResolvedValue({ success: true });
});

describe('editing an attached quiz', () => {
  it('loads and PUTs by refId (the library row), not by the join row id', async () => {
    render(
      <ItemDrawer
        open
        target={quizTarget(attachedQuizItem)}
        courseId="course-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => expect(fetchQuizDetail).toHaveBeenCalledWith('quiz-999'));
    // The join row id must never reach the library fetch/update.
    expect(fetchQuizDetail).not.toHaveBeenCalledWith('jc1');

    await screen.findByDisplayValue('A quiz about things');

    fireEvent.click(await screen.findByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(updateQuizLibrary).toHaveBeenCalled());
    const [id, payload] = updateQuizLibrary.mock.calls[0];
    expect(id).toBe('quiz-999');
    expect(payload).not.toBe('jc1');
    expect(payload.title).toBe('Old Quiz Title');

    // An edit updates the shared row in place — it must never also attach
    // (which would be meaningless — it is already attached) or create a
    // second quiz via POST /quizzes.
    expect(attachQuiz).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('calls onSaved once the PUT resolves', async () => {
    const onSaved = vi.fn();
    render(
      <ItemDrawer
        open
        target={quizTarget(attachedQuizItem)}
        courseId="course-1"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    await screen.findByDisplayValue('A quiz about things');
    fireEvent.click(await screen.findByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('shows a plain warning that this edits shared content everywhere it is attached', async () => {
    render(
      <ItemDrawer
        open
        target={quizTarget(attachedQuizItem)}
        courseId="course-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(/every course and chapter it is attached to/i),
    ).toBeInTheDocument();
  });
});

describe('editing an attached exercise', () => {
  it('loads and PUTs by refId, not the join row id', async () => {
    render(
      <ItemDrawer
        open
        target={exerciseTarget(attachedExerciseItem)}
        courseId="course-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => expect(fetchExerciseDetail).toHaveBeenCalledWith('exercise-777'));
    expect(fetchExerciseDetail).not.toHaveBeenCalledWith('jc-ex-1');

    await screen.findByDisplayValue('Reverse a string');
    fireEvent.click(await screen.findByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(updateExerciseLibrary).toHaveBeenCalled());
    expect(updateExerciseLibrary.mock.calls[0][0]).toBe('exercise-777');
    expect(attachExercise).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('renders the Languages control as a checkbox group of exactly the thirteen supported languages', async () => {
    render(
      <ItemDrawer
        open
        target={exerciseTarget(attachedExerciseItem)}
        courseId="course-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await screen.findByDisplayValue('Reverse a string');

    const group = screen.getByRole('group', { name: 'Languages' });
    const checkboxes = within(group).getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(PLAYGROUND_LANGUAGES.length);
    PLAYGROUND_LANGUAGES.forEach((language) => {
      expect(within(group).getByRole('checkbox', { name: language.value })).toBeInTheDocument();
    });

    // No free-text entry point anywhere near the control — a TagInput's
    // draft input carries this placeholder.
    expect(screen.queryByPlaceholderText('Type and press Enter')).not.toBeInTheDocument();
  });

  it('shows an off-list stored language rather than silently dropping it', async () => {
    fetchExerciseDetail.mockResolvedValue({
      id: 'exercise-777',
      title: 'Old Exercise Title',
      description: 'Reverse a string',
      instructions: 'Write a function',
      solution: 'def solve(): pass',
      starterCode: '',
      hint: '',
      languages: ['COBOL'],
      graderType: 'OUTPUT_MATCH',
      testCases: [{ input: 'abc', expectedOutput: 'cba' }],
      points: 10,
      passMark: 60,
      difficulty: 'Easy',
    });
    render(
      <ItemDrawer
        open
        target={exerciseTarget(attachedExerciseItem)}
        courseId="course-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await screen.findByDisplayValue('Reverse a string');

    // Still visible, not silently dropped — and visibly flagged rather than
    // presented as an equal, judge-runnable choice.
    expect(await screen.findByText('COBOL')).toBeInTheDocument();
    expect(screen.getByText(/not on the supported list/i)).toBeInTheDocument();
    // Not one of the thirteen checkboxes — it has no checkbox of its own.
    const group = screen.getByRole('group', { name: 'Languages' });
    expect(within(group).queryByRole('checkbox', { name: 'COBOL' })).not.toBeInTheDocument();
  });

  it('loads a stored executor code back into the matching language checkbox', async () => {
    // academy now stores/grades against executor codes ("java"), not the
    // picker's display names ("Java") — the load path must translate back.
    fetchExerciseDetail.mockResolvedValue({
      id: 'exercise-777',
      title: 'Old Exercise Title',
      description: 'Reverse a string',
      instructions: 'Write a function',
      solution: 'def solve(): pass',
      starterCode: '',
      hint: '',
      languages: ['java'],
      graderType: 'OUTPUT_MATCH',
      graderConfig: {},
      testCases: [{ input: 'abc', expectedOutput: 'cba' }],
      points: 10,
      passMark: 60,
      difficulty: 'Easy',
    });
    render(
      <ItemDrawer
        open
        target={exerciseTarget(attachedExerciseItem)}
        courseId="course-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await screen.findByDisplayValue('Reverse a string');

    const group = screen.getByRole('group', { name: 'Languages' });
    expect(within(group).getByRole('checkbox', { name: 'Java' })).toBeChecked();
  });

  it('PUTs languages back out as executor codes, alongside graderConfig', async () => {
    fetchExerciseDetail.mockResolvedValue({
      id: 'exercise-777',
      title: 'Old Exercise Title',
      description: 'Reverse a string',
      instructions: 'Write a function',
      solution: 'def solve(): pass',
      starterCode: '',
      hint: '',
      languages: ['java'],
      graderType: 'OUTPUT_MATCH',
      graderConfig: { driver: 'public class Main {}' },
      testCases: [{ input: 'abc', expectedOutput: 'cba' }],
      points: 10,
      passMark: 60,
      difficulty: 'Easy',
    });
    render(
      <ItemDrawer
        open
        target={exerciseTarget(attachedExerciseItem)}
        courseId="course-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await screen.findByDisplayValue('Reverse a string');
    fireEvent.click(await screen.findByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(updateExerciseLibrary).toHaveBeenCalled());
    const [, payload] = updateExerciseLibrary.mock.calls[0];
    // Display names never reach the API — only the executor codes it stores.
    expect(payload.languages).toEqual(['java']);
    expect(payload.graderConfig).toEqual({ driver: 'public class Main {}' });
  });
});

describe('exercise grader picker', () => {
  it('does not offer CUSTOM — the academy API rejects it outright', () => {
    // A Radix Select popup is never opened in this test file (see the
    // Languages-checkbox tests' sibling, BlockEditor.test.tsx: no
    // ResizeObserver polyfill, it hangs jsdom) — pin the exported options
    // list instead of the rendered popup contents.
    expect(GRADERS).toEqual(['OUTPUT_MATCH', 'FUNCTION_CALL', 'TEST_CASES']);
    expect(GRADERS).not.toContain('CUSTOM');
  });
});
