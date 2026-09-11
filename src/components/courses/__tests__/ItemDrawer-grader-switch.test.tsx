/**
 * Fix round 1 (review of Task 7). Switching an exercise's grader type
 * mid-edit changes what shape a test case must be: FUNCTION_CALL grades
 * `args`/`expectedOutput`, every other grader grades `input`/`expectedOutput`.
 * The first cut of this drawer left `state.testCases` untouched across the
 * switch — a stored `{input, expectedOutput}` row rendered with Arguments
 * showing "[]" (looked committed) but `testCase.args` stayed `undefined`; if
 * the author never blurred that field, the PUT kept the stdin shape with no
 * `args` key at all, the gap check still said "Complete", and the API
 * rejected the save.
 *
 * A Radix `Select` popup is never opened in `src/components/courses` tests
 * in this repo (see `BlockEditor.test.tsx`: no ResizeObserver polyfill, it
 * has OOM'd Node before). `@/components/ui/select` is mocked here with a
 * native `<select>` instead — it drives the exact same `onValueChange` prop
 * `ItemDrawer` wires the migration through, without touching Radix or jsdom's
 * missing ResizeObserver at all.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import ItemDrawer, { migrateTestCases, type DrawerTarget, type TestCaseDraft } from '../ItemDrawer';
import type { ChapterItem } from '@/lib/api/courses';

const fetchExerciseDetail = vi.fn();
const updateExerciseLibrary = vi.fn();
const attachExercise = vi.fn();
const postSpy = vi.fn();

vi.mock('@/lib/api/courses', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/courses')>('@/lib/api/courses');
  return {
    ...actual,
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

// A minimal native-`<select>` stand-in for every named export of
// `@/components/ui/select`. `Select` walks its subtree for `SelectItem`
// elements and renders them as real `<option>`s, so `fireEvent.change` on the
// resulting combobox calls the real `onValueChange` — same prop, same
// handler, none of Radix's popup/portal machinery.
vi.mock('@/components/ui/select', () => {
  const SelectItem = ({ children }: { value: string; children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  function collectItems(
    node: React.ReactNode,
    out: Array<{ value: string; label: React.ReactNode }>,
  ) {
    React.Children.forEach(node, (child) => {
      if (!child || typeof child !== 'object') return;
      const element = child as React.ReactElement;
      if (element.type === SelectItem) {
        const itemProps = element.props as { value: string; children?: React.ReactNode };
        out.push({ value: itemProps.value, label: itemProps.children });
        return;
      }
      const nested = (element.props as { children?: React.ReactNode } | undefined)?.children;
      if (nested) collectItems(nested, out);
    });
  }

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (next: string) => void;
    children: React.ReactNode;
  }) {
    const items: Array<{ value: string; label: React.ReactNode }> = [];
    collectItems(children, items);
    return React.createElement(
      'select',
      {
        role: 'combobox',
        value,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange(event.target.value),
      },
      items.map((item) =>
        React.createElement('option', { key: item.value, value: item.value }, item.label),
      ),
    );
  }

  const Passthrough = ({ children }: { children?: React.ReactNode }) => children ?? null;

  return {
    Select,
    SelectItem,
    SelectTrigger: Passthrough,
    SelectContent: Passthrough,
    SelectValue: () => null,
    SelectGroup: Passthrough,
    SelectLabel: Passthrough,
    SelectSeparator: () => null,
    SelectScrollUpButton: () => null,
    SelectScrollDownButton: () => null,
  };
});

const attachedExerciseItem: ChapterItem = {
  id: 'jc-ex-1',
  kind: 'exercise',
  title: 'Old Exercise Title',
  refId: 'exercise-777',
  order: 1,
  meta: 'Easy',
};

function exerciseTarget(item: ChapterItem): DrawerTarget {
  return { kind: 'exercise', chapterId: 'ch1', item };
}

function renderDrawer() {
  return render(
    <ItemDrawer
      open
      target={exerciseTarget(attachedExerciseItem)}
      courseId="course-1"
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
}

async function switchGraderTo(next: string) {
  const select = await screen.findByRole('combobox');
  fireEvent.change(select, { target: { value: next } });
}

beforeEach(() => {
  vi.clearAllMocks();
  updateExerciseLibrary.mockResolvedValue({ success: true });
});

describe('migrateTestCases (unit)', () => {
  it('migrates a stdin case to FUNCTION_CALL shape, dropping input', () => {
    const cases: TestCaseDraft[] = [{ input: 'abc', expectedOutput: 'cba' }];
    expect(migrateTestCases(cases, 'FUNCTION_CALL')).toEqual([{ args: [], expectedOutput: 'cba' }]);
  });

  it('migrates a FUNCTION_CALL case back to stdin shape, dropping args', () => {
    const cases: TestCaseDraft[] = [{ args: [1, 2], expectedOutput: 3 }];
    expect(migrateTestCases(cases, 'OUTPUT_MATCH')).toEqual([{ input: '', expectedOutput: 3 }]);
  });

  it('preserves already-array args instead of resetting them', () => {
    const cases: TestCaseDraft[] = [{ args: [1, 2], expectedOutput: 3 }];
    expect(migrateTestCases(cases, 'FUNCTION_CALL')).toEqual([{ args: [1, 2], expectedOutput: 3 }]);
  });

  it('preserves description/hidden/weight across the switch', () => {
    const cases: TestCaseDraft[] = [
      { input: 'abc', expectedOutput: 'cba', description: 'basic case', hidden: true, weight: 2 },
    ];
    expect(migrateTestCases(cases, 'FUNCTION_CALL')).toEqual([
      { args: [], expectedOutput: 'cba', description: 'basic case', hidden: true, weight: 2 },
    ]);
  });
});

describe('switching grader type migrates test cases end to end', () => {
  it('(a) switching to FUNCTION_CALL without touching Arguments still PUTs args: [] and drops input', async () => {
    fetchExerciseDetail.mockResolvedValue({
      id: 'exercise-777',
      title: 'Old Exercise Title',
      description: 'Reverse a string',
      instructions: 'Write a function',
      solution: 'def solve(): pass',
      starterCode: '',
      hint: '',
      languages: ['python'],
      graderType: 'OUTPUT_MATCH',
      graderConfig: {},
      testCases: [{ input: 'abc', expectedOutput: 'cba' }],
      points: 10,
      passMark: 60,
      difficulty: 'Easy',
    });
    renderDrawer();
    await screen.findByDisplayValue('Reverse a string');

    await switchGraderTo('FUNCTION_CALL');
    // Migration must be visible immediately, not just at save time.
    expect(await screen.findByPlaceholderText('Arguments (JSON array)')).toHaveValue('[]');

    fireEvent.click(await screen.findByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(updateExerciseLibrary).toHaveBeenCalled());

    const [, payload] = updateExerciseLibrary.mock.calls[0];
    expect(payload.testCases).toEqual([{ args: [], expectedOutput: 'cba' }]);
    expect(payload.testCases[0]).not.toHaveProperty('input');
  });

  it('(b) invalid JSON in Arguments commits nothing, keeps the prior args, and blocks "Complete"', async () => {
    fetchExerciseDetail.mockResolvedValue({
      id: 'exercise-777',
      title: 'Old Exercise Title',
      description: 'Reverse a string',
      instructions: 'Write a function',
      solution: 'def solve(): pass',
      starterCode: '',
      hint: '',
      languages: ['python'],
      graderType: 'OUTPUT_MATCH',
      graderConfig: {},
      testCases: [{ input: 'abc', expectedOutput: 'cba' }],
      points: 10,
      passMark: 60,
      difficulty: 'Easy',
    });
    renderDrawer();
    await screen.findByDisplayValue('Reverse a string');

    await switchGraderTo('FUNCTION_CALL');
    const argsField = await screen.findByPlaceholderText('Arguments (JSON array)');
    expect(argsField).toHaveValue('[]');

    fireEvent.change(argsField, { target: { value: 'not json' } });
    fireEvent.blur(argsField);

    // The invalid text stays on screen rather than snapping back to "[]" or
    // being silently accepted.
    expect(argsField).toHaveValue('not json');
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
    expect(screen.getByText(/valid JSON arguments/)).toBeInTheDocument();
    // "Incomplete." (not the "Complete. This item is ready." banner) —
    // note "Complete." is itself a substring of "Incomplete.", so this is
    // asserted directly rather than via a negative substring match.
    expect(screen.getByText('Incomplete.')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(updateExerciseLibrary).toHaveBeenCalled());

    // Committed state keeps the prior migrated value ([]), not [] overwritten
    // again nor anything derived from the invalid text.
    const [, payload] = updateExerciseLibrary.mock.calls[0];
    expect(payload.testCases).toEqual([{ args: [], expectedOutput: 'cba' }]);
  });

  it('(c) switching FUNCTION_CALL to OUTPUT_MATCH PUTs an input key and drops args', async () => {
    fetchExerciseDetail.mockResolvedValue({
      id: 'exercise-777',
      title: 'Old Exercise Title',
      description: 'Reverse a string',
      instructions: 'Write a function',
      solution: 'def solve(): pass',
      starterCode: '',
      hint: '',
      languages: ['python'],
      graderType: 'FUNCTION_CALL',
      graderConfig: { entry: 'solve' },
      testCases: [{ args: [1, 2], expectedOutput: 3 }],
      points: 10,
      passMark: 60,
      difficulty: 'Easy',
    });
    renderDrawer();
    await screen.findByDisplayValue('Reverse a string');
    // Confirms it actually loaded in FUNCTION_CALL/args mode before switching away.
    expect(await screen.findByPlaceholderText('Arguments (JSON array)')).toHaveValue('[1,2]');

    await switchGraderTo('OUTPUT_MATCH');
    expect(await screen.findByPlaceholderText('Input (stdin)')).toHaveValue('');
    expect(screen.queryByPlaceholderText('Arguments (JSON array)')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(updateExerciseLibrary).toHaveBeenCalled());

    const [, payload] = updateExerciseLibrary.mock.calls[0];
    expect(payload.testCases).toEqual([{ input: '', expectedOutput: 3 }]);
    expect(payload.testCases[0]).not.toHaveProperty('args');
    // graderConfig is pruned too — `entry` belongs to FUNCTION_CALL, not
    // OUTPUT_MATCH, and must not silently ride along.
    expect(payload.graderConfig).toEqual({});
  });
});
