'use client';

import { Field } from '@/components/shared/form/Section';
import { Input } from '@/components/ui/input';
import { CodeArea } from '@/components/shared/form/CodeArea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATIC_LANGUAGES, toDisplayName } from '@/lib/courses/exercise-languages';

export type GraderConfig = {
  driver?: string;
  trim?: boolean;
  caseInsensitive?: boolean;
  collapseWhitespace?: boolean;
  entry?: string;
  signature?: { params: string[]; returns: string };
  comparator?: 'deep' | 'float';
  floatTolerance?: number;
  framework?: string;
  testFile?: string;
};

/** Which `GraderConfig` keys the API accepts for each grader type. */
const GRADER_CONFIG_KEYS: Record<string, Array<keyof GraderConfig>> = {
  OUTPUT_MATCH: ['trim', 'caseInsensitive', 'collapseWhitespace', 'driver'],
  FUNCTION_CALL: ['entry', 'comparator', 'floatTolerance', 'signature'],
  TEST_CASES: ['framework', 'testFile'],
};

/**
 * Drops whatever doesn't belong to `graderType`. Every branch below spreads
 * `{...value}` onto its own field's `onChange` (so it never clobbers a
 * sibling field mid-edit) — which also means a value carried over from a
 * previous grader type (e.g. `framework`/`testFile` left over from TEST_CASES)
 * would otherwise silently ride along into a FUNCTION_CALL or OUTPUT_MATCH
 * payload the API doesn't expect it on. Call this whenever `graderType`
 * itself changes, not on every field edit.
 */
export function pruneGraderConfig(config: GraderConfig, graderType: string): GraderConfig {
  const keep = new Set(GRADER_CONFIG_KEYS[graderType] ?? []);
  const next: GraderConfig = {};
  (Object.keys(config) as Array<keyof GraderConfig>).forEach((key) => {
    if (keep.has(key) && config[key] !== undefined) {
      (next as Record<string, unknown>)[key] = config[key];
    }
  });
  return next;
}

/**
 * The academy API rejects an exercise the moment its grader needs one of
 * these and doesn't have it: FUNCTION_CALL without `entry` (and, on a static
 * language, without `signature`), TEST_CASES without `testFile`. Each grader
 * type below is exactly what that grader needs to run, nothing more —
 * OUTPUT_MATCH needs none of it, which is why an unknown/other grader (and
 * OUTPUT_MATCH's own extra field being optional) renders sparingly.
 */
const FRAMEWORK_BY_LANGUAGE: Record<string, string> = {
  python: 'python-unittest',
  node: 'node-test',
  perl: 'perl-test',
  ruby: 'ruby-minitest',
  go: 'go-test',
  rust: 'rust-test',
  php: 'php-tap',
  java: 'java-tap',
  c: 'c-tap',
  cpp: 'cpp-tap',
  csharp: 'csharp-tap',
  kotlin: 'kotlin-tap',
  scala: 'scala-tap',
};

const FRAMEWORKS = [
  'python-unittest',
  'node-test',
  'perl-test',
  'ruby-minitest',
  'go-test',
  'rust-test',
  'php-tap',
  'java-tap',
  'c-tap',
  'cpp-tap',
  'csharp-tap',
  'kotlin-tap',
  'scala-tap',
];

function buildSignature(
  paramsText: string,
  returnsText: string,
): { params: string[]; returns: string } | undefined {
  const params = paramsText
    .split(',')
    .map((param) => param.trim())
    .filter(Boolean);
  const returns = returnsText.trim();
  return params.length || returns ? { params, returns } : undefined;
}

export function GraderConfigEditor({
  graderType,
  languages,
  value,
  onChange,
}: {
  graderType: string;
  languages: string[];
  value: GraderConfig;
  onChange: (next: GraderConfig) => void;
}) {
  if (graderType === 'OUTPUT_MATCH') {
    return (
      <Field
        label="Driver program (optional)"
        hint="For class/method exercises: a public class Main that reads stdin, uses the learner's class, and prints. Compiled together with the learner's file. Java only."
      >
        <CodeArea
          value={value.driver ?? ''}
          ariaLabel="Driver program"
          placeholder="public class Main { public static void main(String[] args) { ... } }"
          onChange={(driver) => onChange({ ...value, driver })}
        />
      </Field>
    );
  }

  if (graderType === 'FUNCTION_CALL') {
    const staticLanguages = languages.filter((language) => STATIC_LANGUAGES.includes(language));
    const paramsText = (value.signature?.params ?? []).join(', ');
    const returnsText = value.signature?.returns ?? '';

    return (
      <div className="space-y-3">
        <Field label="Function name">
          <Input
            value={value.entry ?? ''}
            aria-label="Function name"
            onChange={(event) => onChange({ ...value, entry: event.target.value })}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Parameter types">
            <Input
              value={paramsText}
              aria-label="Parameter types"
              placeholder="int, string[]"
              onChange={(event) =>
                onChange({ ...value, signature: buildSignature(event.target.value, returnsText) })
              }
            />
          </Field>
          <Field label="Return type">
            <Input
              value={returnsText}
              aria-label="Return type"
              onChange={(event) =>
                onChange({ ...value, signature: buildSignature(paramsText, event.target.value) })
              }
            />
          </Field>
        </div>
        {staticLanguages.length ? (
          <p className="text-xs text-muted-foreground">
            {staticLanguages.map((language) => toDisplayName(language)).join(', ')}{' '}
            {staticLanguages.length === 1 ? 'needs' : 'need'} a typed signature.
          </p>
        ) : null}
      </div>
    );
  }

  if (graderType === 'TEST_CASES') {
    const firstLanguage = languages[0];
    const defaultFramework = firstLanguage ? FRAMEWORK_BY_LANGUAGE[firstLanguage] : undefined;
    const framework = value.framework ?? defaultFramework ?? FRAMEWORKS[0];

    return (
      <div className="space-y-3">
        <Field label="Test framework">
          <Select
            value={framework}
            onValueChange={(next) => onChange({ ...value, framework: next })}
          >
            <SelectTrigger aria-label="Test framework">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRAMEWORKS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Test file">
          <CodeArea
            value={value.testFile ?? ''}
            ariaLabel="Test file"
            placeholder="The test file the judge runs against the learner's submission"
            onChange={(testFile) => onChange({ ...value, testFile })}
          />
        </Field>
      </div>
    );
  }

  return null;
}
