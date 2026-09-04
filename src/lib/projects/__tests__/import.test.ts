/**
 * The importer's job is to refuse a payload the API would reject, before the
 * first write. Most of these cover the grading contract, because a spec that is
 * subtly wrong is a task that silently never grades.
 */
import { describe, it, expect } from 'vitest';

import { parseProjectImport, slugify } from '../import';
import { projectSample } from '../sample';

const minimal = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ title: 'Test Project', summary: 'A summary.', ...over });

const withTask = (task: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  minimal({
    projectTasks: [{ title: 'Stage', tasks: [{ title: 'T', description: 'D', ...task }] }],
    ...over,
  });

describe('parseProjectImport', () => {
  it('reads the whole sample, counting every level', () => {
    const { doc, errors, counts } = parseProjectImport(projectSample);
    expect(errors).toEqual([]);
    expect(doc?.title).toBe('Ship a Job Queue');
    expect(counts).toMatchObject({ projectTasks: 2, tasks: 4, learners: 2 });
    // Three TASKs carry a spec; the QUIZ does not.
    expect(counts.graded).toBe(3);
  });

  it('rejects a document that is not JSON, without throwing', () => {
    const { doc, errors } = parseProjectImport('{ nope');
    expect(doc).toBeNull();
    expect(errors[0]).toContain('not valid JSON');
  });

  it('requires a summary, because the column is NOT NULL', () => {
    const { errors } = parseProjectImport(JSON.stringify({ title: 'No summary' }));
    expect(errors.join(' ')).toContain('NOT NULL');
  });

  it('derives a slug from the title', () => {
    const { doc } = parseProjectImport(minimal());
    expect(doc?.slug).toBe('test-project');
    expect(slugify('Node.js & Go!')).toBe('nodejs-go');
  });

  it('leaves a project as a draft unless the payload says otherwise', () => {
    const { doc } = parseProjectImport(minimal());
    // `isWaiting` defaults to true on the column, and it is the publish state.
    expect(doc?.isWaiting).toBe(true);
  });

  // ── the playground ────────────────────────────────────────────────────────

  it('requires a language and entrypoint in terminal mode', () => {
    const { errors } = parseProjectImport(minimal({ mode: 'terminal' }));
    expect(errors.join(' ')).toContain('language');
    expect(errors.join(' ')).toContain('entrypoint');
  });

  it('refuses an entrypoint that escapes the workdir', () => {
    const { errors } = parseProjectImport(
      minimal({ mode: 'terminal', language: 'node', entrypoint: '../etc/passwd' }),
    );
    expect(errors.join(' ')).toContain("'..'");
  });

  it('falls back on an unknown mode rather than failing', () => {
    const { doc, notes } = parseProjectImport(minimal({ mode: 'wasm' }));
    expect(doc?.mode).toBe('rest-api');
    expect(notes.join(' ')).toContain('wasm');
  });

  // ── the grading contract ──────────────────────────────────────────────────

  it('refuses a spec with no assertions, which would pass anything', () => {
    const { errors } = parseProjectImport(
      withTask({ apiSpec: { method: 'GET', url: '/x', response: { assertions: [] } } }),
    );
    expect(errors.join(' ')).toContain('passes whatever the learner wrote');
  });

  it('refuses an assertion kind the prober does not evaluate', () => {
    const { errors } = parseProjectImport(
      withTask({
        apiSpec: {
          method: 'GET',
          url: '/x',
          response: { assertions: [{ kind: 'bodyEquals', value: 1 }] },
        },
      }),
    );
    expect(errors.join(' ')).toContain('not one of');
  });

  it('refuses a url that is not a path on the learner server', () => {
    const { errors } = parseProjectImport(
      withTask({
        apiSpec: {
          method: 'GET',
          url: 'https://example.com/x',
          response: { assertions: [{ kind: 'status', equals: 200 }] },
        },
      }),
    );
    expect(errors.join(' ')).toContain('begins with /');
  });

  it('refuses a jsonPath assertion that asserts nothing about the value', () => {
    const { errors } = parseProjectImport(
      withTask({
        apiSpec: {
          method: 'GET',
          url: '/x',
          response: { assertions: [{ kind: 'jsonPath', path: 'id' }] },
        },
      }),
    );
    expect(errors.join(' ')).toContain('equals, exists or type');
  });

  it('keeps an empty shape path, which targets the whole body', () => {
    const { doc, errors } = parseProjectImport(
      withTask({
        apiSpec: {
          method: 'GET',
          url: '/x',
          response: { assertions: [{ kind: 'shape', path: '', shape: { id: 'string' } }] },
        },
      }),
    );
    expect(errors).toEqual([]);
    const assertion = doc?.projectTasks[0].tasks[0].apiSpec?.response.assertions[0];
    expect(assertion).toMatchObject({ kind: 'shape', path: '' });
  });

  it('drops a contract the project mode does not read', () => {
    const { doc, notes } = parseProjectImport(
      withTask({ terminalSpec: { stdin: ['a'], expectedOutput: 'b' } }, { mode: 'rest-api' }),
    );
    expect(doc?.projectTasks[0].tasks[0].terminalSpec).toBeNull();
    expect(notes.join(' ')).toContain('does not read terminalSpec');
  });

  it('drops a contract on a type that is not machine-checked', () => {
    const { doc, notes } = parseProjectImport(
      withTask({
        type: 'ACTIVITY',
        apiSpec: {
          method: 'GET',
          url: '/x',
          response: { assertions: [{ kind: 'status', equals: 200 }] },
        },
      }),
    );
    expect(doc?.projectTasks[0].tasks[0].apiSpec).toBeNull();
    expect(notes.join(' ')).toContain('only a TASK is machine-checked');
  });

  it('warns when a TASK carries no contract at all', () => {
    const { doc, notes } = parseProjectImport(withTask({}));
    expect(doc).not.toBeNull();
    expect(notes.join(' ')).toContain('nothing can grade it');
  });

  it('says nothing about grading in frontend mode, where there is no contract', () => {
    const { notes } = parseProjectImport(withTask({}, { mode: 'frontend' }));
    expect(notes.join(' ')).not.toContain('nothing can grade it');
  });

  // ── the rest ──────────────────────────────────────────────────────────────

  it('requires a description on every task', () => {
    const { errors } = parseProjectImport(
      minimal({ projectTasks: [{ title: 'Stage', tasks: [{ title: 'T' }] }] }),
    );
    expect(errors.join(' ')).toContain('needs a description');
  });

  it('skips an address that is not an email instead of failing the batch', () => {
    const { doc, notes } = parseProjectImport(minimal({ learners: ['ada@x.com', 'nope'] }));
    expect(doc?.learners).toEqual(['ada@x.com']);
    expect(notes.join(' ')).toContain('not an email');
  });

  it('reports fields it does not know rather than dropping them silently', () => {
    const { notes } = parseProjectImport(minimal({ colour: 'red' }));
    expect(notes.join(' ')).toContain('colour');
  });

  it('says so when there is nothing to do', () => {
    const { doc, notes } = parseProjectImport(minimal());
    expect(doc).not.toBeNull();
    expect(notes.join(' ')).toContain('nothing for a learner to do');
  });

  it('returns no document at all while an error stands', () => {
    const { doc } = parseProjectImport(minimal({ mode: 'terminal' }));
    expect(doc).toBeNull();
  });
});
