/**
 * The one place a quiz question crosses into the API's shape.
 *
 * The editor works in indexes, because "which radio is correct" is an index —
 * and so do the seeded quizzes, which store `answer`. The API stores whatever
 * its validator accepts, and that is `{ question, options, correctAnswer }`
 * with the correct option as text.
 *
 * Text is the right thing to send: `course-quiz` and `roadmap-course-quiz`
 * grade by comparing the chosen option against `correctAnswer` and read nothing
 * else, while `path-quiz` normalises either shape. A quiz written as text grades
 * correctly in all three; one written as an index grades zero in two of them.
 */

/** Either shape: what the editor holds, or what a pasted JSON payload may carry. */
export type DraftQuestion = {
  prompt?: string;
  question?: string;
  options?: string[];
  answer?: number;
  correctAnswer?: string;
  explanation?: string;
  points?: number;
};

export type ApiQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  points?: number;
};

/**
 * Resolve the correct option's text.
 *
 * Order matters: an explicit `correctAnswer` wins, because a payload that
 * carries one has already made the choice. Otherwise the index is resolved
 * against the *unfiltered* options, since trimming empties first would shift
 * every index after the gap and silently mark the wrong answer correct.
 */
function correctTextOf(question: DraftQuestion): string {
  const explicit = question.correctAnswer?.trim();
  if (explicit) return explicit;

  const options = question.options ?? [];
  const index = question.answer;
  if (typeof index !== 'number' || index < 0 || index >= options.length) return '';
  return (options[index] ?? '').trim();
}

export function toApiQuestions(questions: DraftQuestion[]): ApiQuestion[] {
  return (questions ?? []).map((question) => ({
    // `prompt` is the editor's field name and appears in no stored row.
    question: (question.question ?? question.prompt ?? '').trim(),
    options: (question.options ?? []).map((option) => option.trim()).filter(Boolean),
    correctAnswer: correctTextOf(question),
    ...(question.explanation ? { explanation: question.explanation } : {}),
    ...(typeof question.points === 'number' ? { points: question.points } : {}),
  }));
}

/**
 * What is still missing before the API would accept these, in the wording the
 * drawer shows the author. The API requires a non-empty `correctAnswer`, so a
 * question whose correct option is blank fails validation — which used to
 * surface as a bare 422 after the author had already filled the form in.
 */
export function questionGaps(questions: DraftQuestion[]): string | null {
  if (!questions?.length) return 'at least one question';

  const complete = questions.every((question) => {
    const text = (question.question ?? question.prompt ?? '').trim();
    const options = (question.options ?? []).filter((option) => option.trim());
    return Boolean(text) && options.length >= 2 && Boolean(correctTextOf(question));
  });

  return complete ? null : 'a prompt, two options and a marked answer on every question';
}
