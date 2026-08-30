import {
  ASSERTION_KINDS,
  HTTP_METHODS,
  LEVELS,
  MODES,
  PLAYGROUND_LANGUAGES,
  TASK_TYPES,
  type ApiSpec,
  type Assertion,
  type Level,
  type Mode,
  type TaskType,
  type TerminalSpec,
} from '@/lib/api/projects';

/**
 * Parse a pasted JSON payload into a whole project.
 *
 * Same contract as the course, path and bootcamp importers: `errors` block the
 * import, `notes` are recoverable and imported anyway, and `counts` say exactly
 * what will be created before anything is written.
 *
 * The grading contract gets the most attention here. `apiSpec` and
 * `terminalSpec` decide whether a learner passed, and the wrong one for the
 * project's mode is a task that silently never grades — so mode is resolved
 * first and every spec is checked against it.
 */

const KNOWN_PROJECT = [
  'title',
  'slug',
  'summary',
  'description',
  'banner',
  'level',
  'duration',
  'skills',
  'technologies',
  'prerequisites',
  'industries',
  'languages',
  'isPremium',
  'amount',
  'isSample',
  'isWaiting',
  'waitingLink',
  'baseRepository',
  'frontendURL',
  'referenceApiURL',
  'PRDLink',
  'mode',
  'language',
  'entrypoint',
  'terminalJail',
  'showPreviewOnLoad',
  'projectTasks',
  'learners',
];
const KNOWN_PT = ['title', 'slug', 'summary', 'banner', 'isPremium', 'tasks'];
const KNOWN_TASK = [
  'title',
  'description',
  'slug',
  'type',
  'required',
  'isPremium',
  'mb',
  'answer',
  'questions',
  'video',
  'article',
  'chapter',
  'apiSpec',
  'terminalSpec',
];

const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

export type ImportTask = {
  title: string;
  description: string;
  slug: string;
  type: TaskType;
  required: boolean;
  isPremium: boolean;
  mb: number;
  answer: string;
  questions: Array<Record<string, unknown>>;
  apiSpec: ApiSpec | null;
  terminalSpec: TerminalSpec | null;
  /** Library titles, resolved before anything is written. */
  video?: string;
  article?: string;
  chapter?: string;
};

export type ImportProjectTask = {
  title: string;
  slug: string;
  summary: string;
  banner: string;
  isPremium: boolean;
  tasks: ImportTask[];
};

export type ImportDocument = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  banner: string;
  level: Level;
  duration: number;
  skills: string[];
  technologies: string[];
  prerequisites: string[];
  industries: string[];
  languages: string[];
  isPremium: boolean;
  amount: number;
  isSample: boolean;
  isWaiting: boolean;
  waitingLink: string;
  baseRepository: string;
  frontendURL: string;
  referenceApiURL: string;
  PRDLink: string;
  mode: Mode;
  language: string;
  entrypoint: string;
  terminalJail: boolean;
  showPreviewOnLoad: boolean;
  projectTasks: ImportProjectTask[];
  learners: string[];
};

export type ImportResult = {
  doc: ImportDocument | null;
  errors: string[];
  notes: string[];
  counts: { projectTasks: number; tasks: number; graded: number; learners: number };
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
const bool = (v: unknown, fallback = false) => (typeof v === 'boolean' ? v : fallback);
const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];

function unknownKeys(
  obj: Record<string, unknown>,
  known: string[],
  where: string,
  notes: string[],
) {
  const strays = Object.keys(obj).filter((key) => !known.includes(key));
  if (strays.length) notes.push(`${where}: ignored unknown field(s) ${strays.join(', ')}.`);
}

/**
 * Validate one assertion against the five kinds the prober evaluates.
 * Anything else is ignored at grade time, so it is refused rather than stored.
 */
function parseAssertion(raw: unknown, where: string, errors: string[]): Assertion | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${where}: each assertion must be an object.`);
    return null;
  }
  const a = raw as Record<string, unknown>;
  const kind = str(a.kind);
  if (!(ASSERTION_KINDS as readonly string[]).includes(kind)) {
    errors.push(`${where}: "${kind}" is not one of ${ASSERTION_KINDS.join(', ')}.`);
    return null;
  }

  if (kind === 'status') {
    if (typeof a.equals !== 'number') {
      errors.push(`${where}: a status assertion needs a numeric \`equals\`.`);
      return null;
    }
    return { kind: 'status', equals: a.equals };
  }
  if (kind === 'jsonPath') {
    const path = str(a.path);
    if (!path) {
      errors.push(`${where}: a jsonPath assertion needs a \`path\`.`);
      return null;
    }
    if (a.equals === undefined && a.exists === undefined && a.type === undefined) {
      errors.push(`${where}: a jsonPath assertion needs one of equals, exists or type.`);
      return null;
    }
    return {
      kind: 'jsonPath',
      path,
      ...(a.equals !== undefined ? { equals: a.equals } : {}),
      ...(a.exists !== undefined ? { exists: bool(a.exists) } : {}),
      ...(a.type !== undefined ? { type: str(a.type) } : {}),
    };
  }
  if (kind === 'bodySubset') {
    if (a.subset === undefined) {
      errors.push(`${where}: a bodySubset assertion needs a \`subset\`.`);
      return null;
    }
    return { kind: 'bodySubset', subset: a.subset };
  }
  if (kind === 'header') {
    const name = str(a.name);
    if (!name) {
      errors.push(`${where}: a header assertion needs a \`name\`.`);
      return null;
    }
    return {
      kind: 'header',
      name,
      ...(a.equals !== undefined ? { equals: str(a.equals) } : {}),
      ...(a.matches !== undefined ? { matches: str(a.matches) } : {}),
    };
  }
  // shape
  if (a.shape === undefined) {
    errors.push(`${where}: a shape assertion needs a \`shape\`.`);
    return null;
  }
  return {
    kind: 'shape',
    // "" targets the whole body, so an empty string is meaningful.
    path: typeof a.path === 'string' ? a.path : '',
    shape: a.shape,
    ...(a.minItems !== undefined ? { minItems: num(a.minItems) } : {}),
  };
}

function parseApiSpec(raw: unknown, where: string, errors: string[]): ApiSpec | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${where}: apiSpec must be an object.`);
    return null;
  }
  const spec = raw as Record<string, unknown>;

  const method = str(spec.method, 'GET').toUpperCase();
  if (!(HTTP_METHODS as readonly string[]).includes(method)) {
    errors.push(`${where}: method must be one of ${HTTP_METHODS.join(', ')}.`);
    return null;
  }

  const url = str(spec.url);
  if (!url.startsWith('/')) {
    errors.push(`${where}: url is a path on the learner's server, so it begins with /.`);
    return null;
  }

  const response = (spec.response ?? {}) as Record<string, unknown>;
  const rawAssertions = Array.isArray(response.assertions) ? response.assertions : [];
  if (!rawAssertions.length) {
    // The one mistake that looks like a working test.
    errors.push(`${where}: a spec with no assertions passes whatever the learner wrote.`);
    return null;
  }

  const assertions = rawAssertions
    .map((entry, index) => parseAssertion(entry, `${where}, assertion ${index + 1}`, errors))
    .filter((a): a is Assertion => a !== null);
  if (assertions.length !== rawAssertions.length) return null;

  return {
    method: method as ApiSpec['method'],
    url,
    request: (spec.request ?? {}) as ApiSpec['request'],
    response: {
      ...(typeof response.status === 'number' ? { status: response.status } : {}),
      assertions,
    },
  };
}

function parseTerminalSpec(raw: unknown, where: string, errors: string[]): TerminalSpec | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${where}: terminalSpec must be an object.`);
    return null;
  }
  const spec = raw as Record<string, unknown>;
  if (typeof spec.expectedOutput !== 'string') {
    errors.push(`${where}: terminalSpec needs an \`expectedOutput\`.`);
    return null;
  }
  return {
    stdin: Array.isArray(spec.stdin) ? spec.stdin.map((x) => String(x)) : [],
    expectedOutput: spec.expectedOutput,
  };
}

export function parseProjectImport(raw: string): ImportResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const empty = { projectTasks: 0, tasks: 0, graded: 0, learners: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      doc: null,
      errors: [`That is not valid JSON — ${(error as Error).message}`],
      notes,
      counts: empty,
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      doc: null,
      errors: ['The document must be a single JSON object.'],
      notes,
      counts: empty,
    };
  }

  const root = parsed as Record<string, unknown>;
  unknownKeys(root, KNOWN_PROJECT, 'project', notes);

  const title = str(root.title);
  if (!title) errors.push('The project needs a title.');
  if (title.length > 100)
    errors.push('The title is longer than the 100 characters the column holds.');

  // NOT NULL on the column, and a summary silently equal to the title reads as
  // a real one on the learner page.
  const summary = str(root.summary);
  if (!summary) errors.push('The project needs a summary — the column is NOT NULL.');

  let level = str(root.level, 'Beginner');
  if (!(LEVELS as readonly string[]).includes(level)) {
    notes.push(`level "${level}" is not one of ${LEVELS.join(', ')} — using Beginner.`);
    level = 'Beginner';
  }

  let mode = str(root.mode, 'rest-api');
  if (!(MODES as readonly string[]).includes(mode)) {
    notes.push(`mode "${mode}" is not one of ${MODES.join(', ')} — using rest-api.`);
    mode = 'rest-api';
  }

  let language = str(root.language);
  const entrypoint = str(root.entrypoint);
  if (mode === 'terminal') {
    if (!(PLAYGROUND_LANGUAGES as readonly string[]).includes(language)) {
      errors.push(`terminal mode needs a language: ${PLAYGROUND_LANGUAGES.join(' or ')}.`);
    }
    if (!entrypoint) errors.push('terminal mode needs an entrypoint.');
    else if (entrypoint.startsWith('/') || entrypoint.includes('..')) {
      errors.push("entrypoint must be a relative path with no '..' segments.");
    }
  } else if (language) {
    notes.push(`language is only read in terminal mode — "${language}" is ignored.`);
    language = '';
  }

  const projectTasks: ImportProjectTask[] = [];
  const rawPts = Array.isArray(root.projectTasks) ? root.projectTasks : [];
  if (!rawPts.length) {
    notes.push(
      'No ProjectTasks. The project is created, but there is nothing for a learner to do.',
    );
  }

  rawPts.forEach((entry, index) => {
    const where = `ProjectTask ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${where}: must be an object.`);
      return;
    }
    const pt = entry as Record<string, unknown>;
    unknownKeys(pt, KNOWN_PT, where, notes);

    const ptTitle = str(pt.title);
    if (!ptTitle) {
      errors.push(`${where}: needs a title.`);
      return;
    }

    const tasks = (Array.isArray(pt.tasks) ? pt.tasks : []).flatMap(
      (taskEntry, taskIndex): ImportTask[] => {
        const at = `${where} “${ptTitle}”, task ${taskIndex + 1}`;
        if (!taskEntry || typeof taskEntry !== 'object') {
          errors.push(`${at}: must be an object.`);
          return [];
        }
        const t = taskEntry as Record<string, unknown>;
        unknownKeys(t, KNOWN_TASK, at, notes);

        const taskTitle = str(t.title);
        if (!taskTitle) {
          errors.push(`${at}: needs a title.`);
          return [];
        }
        const description = str(t.description);
        if (!description) {
          errors.push(`${at}: needs a description — it is what the learner reads.`);
          return [];
        }

        let type = str(t.type, 'TASK').toUpperCase();
        if (!(TASK_TYPES as readonly string[]).includes(type)) {
          notes.push(`${at}: type "${type}" is unknown — using TASK.`);
          type = 'TASK';
        }

        // A contract only means something in the mode that reads it.
        let apiSpec: ApiSpec | null = null;
        let terminalSpec: TerminalSpec | null = null;

        if (t.apiSpec !== undefined && t.apiSpec !== null) {
          if (mode !== 'rest-api') {
            notes.push(
              `${at}: this project is in ${mode} mode, which does not read apiSpec — dropped.`,
            );
          } else if (type !== 'TASK') {
            notes.push(`${at}: only a TASK is machine-checked, so its apiSpec is dropped.`);
          } else {
            apiSpec = parseApiSpec(t.apiSpec, at, errors);
          }
        }
        if (t.terminalSpec !== undefined && t.terminalSpec !== null) {
          if (mode !== 'terminal') {
            notes.push(
              `${at}: this project is in ${mode} mode, which does not read terminalSpec — dropped.`,
            );
          } else if (type !== 'TASK') {
            notes.push(`${at}: only a TASK is machine-checked, so its terminalSpec is dropped.`);
          } else {
            terminalSpec = parseTerminalSpec(t.terminalSpec, at, errors);
          }
        }

        if (type === 'TASK' && mode !== 'frontend' && !apiSpec && !terminalSpec) {
          notes.push(
            `${at}: no ${mode === 'terminal' ? 'terminalSpec' : 'apiSpec'}, so nothing can grade it.`,
          );
        }

        return [
          {
            title: taskTitle,
            description,
            slug: str(t.slug) || slugify(taskTitle),
            type: type as TaskType,
            required: bool(t.required, true),
            isPremium: bool(t.isPremium),
            mb: num(t.mb, 10),
            answer: str(t.answer),
            questions: Array.isArray(t.questions)
              ? (t.questions as Array<Record<string, unknown>>)
              : [],
            apiSpec,
            terminalSpec,
            ...(str(t.video) ? { video: str(t.video) } : {}),
            ...(str(t.article) ? { article: str(t.article) } : {}),
            ...(str(t.chapter) ? { chapter: str(t.chapter) } : {}),
          },
        ];
      },
    );

    projectTasks.push({
      title: ptTitle,
      slug: str(pt.slug) || slugify(ptTitle),
      summary: str(pt.summary),
      banner: str(pt.banner),
      isPremium: bool(pt.isPremium),
      tasks,
    });
  });

  const learners = (Array.isArray(root.learners) ? root.learners : [])
    .map((v) => str(v).toLowerCase())
    .filter((email) => {
      if (!email) return false;
      if (!EMAIL.test(email)) {
        notes.push(`"${email}" is not an email address, skipped.`);
        return false;
      }
      return true;
    });

  const allTasks = projectTasks.flatMap((pt) => pt.tasks);
  const counts = {
    projectTasks: projectTasks.length,
    tasks: allTasks.length,
    graded: allTasks.filter((t) => t.apiSpec || t.terminalSpec).length,
    learners: learners.length,
  };

  if (errors.length) return { doc: null, errors, notes, counts };

  return {
    doc: {
      title,
      slug: str(root.slug) || slugify(title),
      summary,
      description: str(root.description),
      banner: str(root.banner),
      level: level as Level,
      duration: num(root.duration),
      skills: list(root.skills),
      technologies: list(root.technologies),
      prerequisites: list(root.prerequisites),
      industries: list(root.industries),
      languages: list(root.languages),
      isPremium: bool(root.isPremium),
      amount: num(root.amount),
      isSample: bool(root.isSample),
      // The column defaults to true, so an import with no flag stays a draft.
      isWaiting: bool(root.isWaiting, true),
      waitingLink: str(root.waitingLink),
      baseRepository: str(root.baseRepository),
      frontendURL: str(root.frontendURL),
      referenceApiURL: str(root.referenceApiURL),
      PRDLink: str(root.PRDLink),
      mode: mode as Mode,
      language,
      entrypoint,
      terminalJail: bool(root.terminalJail, true),
      showPreviewOnLoad: bool(root.showPreviewOnLoad),
      projectTasks,
      learners,
    },
    errors,
    notes,
    counts,
  };
}
