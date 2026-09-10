import { PLAYGROUND_LANGUAGES } from './blocks';

/**
 * `PLAYGROUND_LANGUAGES` stores the human-readable names authors pick from
 * ("Java", "Node.js", …). The academy API stores and grades against the
 * executor's own codes ("java", "node", …) — the same codes mb-executor's
 * LANGUAGES map keys on. This is the one place the two vocabularies meet: the
 * exercise payload/load path, not `LanguageMultiSelect` itself, which stays on
 * display names because it is shared with courses/projects/blocks.
 */
const ENUM_TO_CODE: Record<string, string> = {
  NODEJS: 'node',
  PYTHON: 'python',
  PHP: 'php',
  RUBY: 'ruby',
  JAVA: 'java',
  C: 'c',
  CPP: 'cpp',
  GO: 'go',
  RUST: 'rust',
  CSHARP: 'csharp',
  KOTLIN: 'kotlin',
  SCALA: 'scala',
  PERL: 'perl',
};

/** Languages the academy API requires a typed `signature` for on FUNCTION_CALL. */
export const STATIC_LANGUAGES: readonly string[] = [
  'java',
  'c',
  'cpp',
  'go',
  'rust',
  'csharp',
  'kotlin',
  'scala',
];

/** Display name or code → executor code (what academy stores). Unknown → unchanged. */
export function toExecutorCode(value: string): string {
  const lower = value.trim().toLowerCase();
  if (Object.values(ENUM_TO_CODE).includes(lower)) return lower;
  const hit = PLAYGROUND_LANGUAGES.find((language) => language.value.toLowerCase() === lower);
  return hit ? ENUM_TO_CODE[hit.enumKey] : value;
}

/** Executor code → picker display name. Unknown → unchanged (so off-list values still show). */
export function toDisplayName(code: string): string {
  const key = Object.entries(ENUM_TO_CODE).find(([, value]) => value === code.toLowerCase())?.[0];
  return PLAYGROUND_LANGUAGES.find((language) => language.enumKey === key)?.value ?? code;
}
