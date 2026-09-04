import { richTextLength } from '@/lib/richtext';
import type { CourseDetail, ReadinessFailure } from '@/lib/api/courses';

export type ReadinessRule = {
  field: string;
  label: string;
  ok: boolean;
  hint?: string;
  /** Not applicable to this course — shown greyed rather than as a failure. */
  na?: boolean;
};

export const MIN_SUMMARY = 40;

type ReadinessSubject = Partial<
  Pick<
    CourseDetail,
    | 'title'
    | 'summary'
    | 'type'
    | 'banner'
    | 'categoryId'
    | 'level'
    | 'slug'
    | 'isPremium'
    | 'amount'
    | 'paddle_price_id'
    | 'isWaiting'
    | 'waitingLink'
    | 'chapters'
  >
>;

/**
 * The same contract the API enforces on publish, evaluated live so the button can
 * be gated and the author told what is missing before they press it. The API is
 * still the authority — this exists so the UI does not have to guess.
 */
export function evaluateReadiness(course: ReadinessSubject): ReadinessRule[] {
  const hasContent = (course.chapters ?? []).some((chapter) =>
    (chapter.items ?? []).some((item) => item.kind === 'video' || item.kind === 'article'),
  );

  const rules: ReadinessRule[] = [
    {
      field: 'title',
      label: 'Title, summary and type',
      ok:
        Boolean(course.title?.trim()) &&
        richTextLength(course.summary) >= MIN_SUMMARY &&
        Boolean(course.type),
      hint: `The summary is the catalogue card copy — at least ${MIN_SUMMARY} characters.`,
    },
    {
      field: 'banner',
      label: 'Banner image',
      ok: Boolean(course.banner),
      hint: 'Upload one, or paste a URL.',
    },
    {
      field: 'categoryId',
      label: 'Category and level',
      ok: Boolean(course.categoryId) && Boolean(course.level),
      hint: 'Both drive the catalogue filters.',
    },
    {
      field: 'chapters',
      label: 'One chapter with content',
      ok: hasContent,
      hint: 'Add a chapter holding at least one video or article.',
    },
  ];

  if (course.isPremium) {
    rules.push({
      field: 'amount',
      label: 'Price is set',
      ok: Number(course.amount ?? 0) > 0,
      hint: 'A premium course needs a price above zero.',
    });
    rules.push({
      field: 'paddle_price_id',
      label: 'Paddle price ID',
      ok: Boolean(course.paddle_price_id),
      hint: 'Checkout cannot resolve without it.',
    });
  } else {
    rules.push({ field: 'amount', label: 'Pricing (free course)', ok: true, na: true });
  }

  if (course.isWaiting) {
    rules.push({
      field: 'waitingLink',
      label: 'Waitlist link',
      ok: /^https?:\/\/.+/.test(course.waitingLink ?? ''),
      hint: 'Needs a valid URL.',
    });
  }

  return rules;
}

export function isReady(course: ReadinessSubject): boolean {
  return evaluateReadiness(course).every((rule) => rule.ok);
}

/** Turns the API's 422 payload back into the panel's shape. */
export function failuresToRules(failures: ReadinessFailure[]): ReadinessRule[] {
  return failures.map((failure) => ({
    field: failure.field,
    label: failure.message,
    ok: false,
  }));
}
