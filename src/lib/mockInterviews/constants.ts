/**
 * One source of option lists for both the form and the importer.
 *
 * Drawn from what the catalogue actually uses, not invented: `style` and
 * `seniority` are the values that occur across the seeded templates, and
 * `Chat` is the only format any row carries.
 */

export const STYLES = [
  'Technical',
  'System Design',
  'Coding',
  'Behavioral',
  'Mixed',
  'Case Study',
] as const;

/** Audio and Video exist in the seed convention and nowhere else. */
export const FORMATS = ['Chat'] as const;
export const UNSHIPPED_FORMATS = ['Audio', 'Video'] as const;

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

/**
 * The server's write bounds, mirrored field for field from
 * `academy/src/modules/admin/validators/mock-interview-templates.ts` (the
 * sibling API repo) — that Joi schema is the single source of truth. Two
 * repos cannot share a schema, so this is the one place in this repo to
 * update if that file's bounds ever change.
 */
export const SERVER_LIMITS = {
  NAME_MAX: 200,
  SUMMARY_MAX: 500,
  DESCRIPTION_MAX: 20000,
  COMPANY_MAX: 120,
  POSITION_MAX: 120,
  SENIORITY_MAX: 60,
  CATEGORY_MAX: 120,
  TOPIC_MAX: 80,
  RUBRIC_CRITERION_MAX: 120,
  RUBRIC_DESCRIPTION_MAX: 500,
  /** A weight below this is DROPPED, not refused — see the importer's rubric section. */
  RUBRIC_MIN_WEIGHT: 1,
  DURATION_MIN: 1,
  DURATION_MAX: 600,
  QUESTIONS_MIN: 1,
  QUESTIONS_MAX: 100,
} as const;

/** Suggestions, not a closed set — the field is free text. */
export const SENIORITIES = ['Junior', 'Mid-level', 'Senior', 'Staff'] as const;
export const CATEGORIES = [
  'Backend',
  'System Design',
  'DevOps',
  'Cybersecurity',
  'Algorithms & Data Structures',
  'API Design',
  'Low Level Design',
  'Behavioral',
] as const;

export type Style = (typeof STYLES)[number];
export type Format = (typeof FORMATS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

export type RubricCriterion = {
  criterion: string;
  weight: number;
  description?: string;
};

/**
 * What most of the catalogue already uses. Offered as a preset because
 * writing three rows by hand every time is the friction that ends with
 * templates carrying no rubric at all — and a template with no rubric is
 * scored on the model's impression rather than recomputed.
 */
export const STANDARD_RUBRIC: RubricCriterion[] = [
  { criterion: 'Technical Accuracy', weight: 40, description: '' },
  { criterion: 'Code Quality', weight: 30, description: '' },
  { criterion: 'Communication', weight: 30, description: '' },
];
