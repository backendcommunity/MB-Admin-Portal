import { describe, it, expect } from 'vitest';
import { parseImport, importSample, type ImportCatalog } from '../import';

const catalog: ImportCatalog = {
  categories: [
    { id: 'cat-arch', name: 'Architecture', color: '#7c5cff' },
    { id: 'cat-backend', name: 'Backend', color: '#13aece' },
  ],
  projects: [{ id: 'pr-1', title: 'Ship a job queue' }],
  mockInterviews: [{ id: 'mi-1', title: 'Backend systems screen' }],
  takenSlugs: ['taken-course'],
};

describe('parseImport — the sample', () => {
  it('validates clean and publishes', () => {
    const result = parseImport(importSample(), catalog);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.counts).toMatchObject({
      chapters: 2,
      video: 2,
      article: 1,
      quiz: 1,
      exercise: 1,
      capstone: 2,
      incomplete: 0,
    });
    expect(result.doc?.publish).toBe(true);
    expect(result.doc?.course.categoryId).toBe('cat-arch');
  });
});

describe('parseImport — blocking errors', () => {
  it('rejects malformed JSON', () => {
    const result = parseImport('{nope', catalog);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('rejects an array in course mode but accepts one for a curriculum', () => {
    expect(parseImport('[]', catalog).ok).toBe(false);
    const curriculum = parseImport(
      JSON.stringify([
        { title: 'Ch A', items: [{ kind: 'video', title: 'V', video: 'x', duration: 60 }] },
      ]),
      catalog,
      'curriculum',
    );
    expect(curriculum.ok).toBe(true);
    expect(curriculum.counts.chapters).toBe(1);
  });

  it('requires a course title', () => {
    const result = parseImport(JSON.stringify({ summary: 'x' }), catalog);
    expect(result.errors).toContain('title is required.');
  });

  it('requires a chapter title', () => {
    const result = parseImport(JSON.stringify({ title: 'T', chapters: [{ items: [] }] }), catalog);
    expect(result.errors).toContain('chapters[0].title is required.');
  });

  it('requires a kind on every item', () => {
    const result = parseImport(
      JSON.stringify({ title: 'T', chapters: [{ title: 'C', items: [{ title: 'no kind' }] }] }),
      catalog,
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('needs a kind');
  });

  it('rejects an unknown item kind', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [{ title: 'C', items: [{ kind: 'podcast', title: 'x' }] }],
      }),
      catalog,
    );
    expect(result.errors[0]).toContain('unknown kind');
  });

  it('never returns a document when it blocks', () => {
    expect(parseImport(JSON.stringify({ chapters: [] }), catalog).doc).toBeNull();
  });
});

describe('parseImport — recoverable notes', () => {
  it('falls back on unknown enums and says so', () => {
    const result = parseImport(
      JSON.stringify({ title: 'T', type: 'PODCAST', level: 'Wizard' }),
      catalog,
    );
    expect(result.ok).toBe(true);
    expect(result.doc?.course.type).toBe('VIDEO');
    expect(result.notes.some((n) => n.includes('PODCAST'))).toBe(true);
    expect(result.notes.some((n) => n.includes('Wizard'))).toBe(true);
  });

  it('marks an unknown category for creation instead of dropping it', () => {
    const result = parseImport(
      JSON.stringify({ title: 'T', category: 'Message Systems' }),
      catalog,
    );
    expect(result.doc?.newCategory).toBe('Message Systems');
    expect(result.notes.some((n) => n.includes('will be created'))).toBe(true);
  });

  it('suffixes a taken slug', () => {
    const result = parseImport(JSON.stringify({ title: 'Taken course' }), catalog);
    expect(result.doc?.course.slug).toBe('taken-course-2');
  });

  it('leaves an out-of-range answer unmarked rather than marking option 0 correct', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [
          {
            title: 'C',
            items: [
              {
                kind: 'quiz',
                title: 'Q',
                description: 'd',
                questions: [{ prompt: 'p', options: ['a', 'b'], answer: 9 }],
              },
            ],
          },
        ],
      }),
      catalog,
    );
    expect(result.ok).toBe(true);
    const quiz = result.doc?.chapters[0].items[0];
    // Snapping to 0 silently declared a wrong option correct; the author has to
    // be told instead, and the item is flagged incomplete until they fix it.
    expect(quiz?.kind === 'quiz' && quiz.questions[0].answer).toBe(-1);
    expect(quiz?.kind === 'quiz' && quiz.complete).toBe(false);
    expect(result.notes.some((n) => n.includes('no usable answer'))).toBe(true);
  });

  it('reads a text correctAnswer and marks the option it names', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [
          {
            title: 'C',
            items: [
              {
                kind: 'quiz',
                title: 'Q',
                description: 'd',
                questions: [{ question: 'p', options: ['a', 'b'], correctAnswer: 'b' }],
              },
            ],
          },
        ],
      }),
      catalog,
    );

    const quiz = result.doc?.chapters[0].items[0];
    expect(quiz?.kind === 'quiz' && quiz.questions[0].answer).toBe(1);
    expect(quiz?.kind === 'quiz' && quiz.questions[0].prompt).toBe('p');
    expect(quiz?.kind === 'quiz' && quiz.complete).toBe(true);
  });

  it('flags a correctAnswer that is not one of the options', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [
          {
            title: 'C',
            items: [
              {
                kind: 'quiz',
                title: 'Q',
                description: 'd',
                questions: [{ question: 'p', options: ['a', 'b'], correctAnswer: 'zzz' }],
              },
            ],
          },
        ],
      }),
      catalog,
    );

    const quiz = result.doc?.chapters[0].items[0];
    expect(quiz?.kind === 'quiz' && quiz.questions[0].answer).toBe(-1);
    expect(result.notes.some((n) => n.includes('not one of its options'))).toBe(true);
  });

  it('imports an incomplete item and counts it', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [{ title: 'C', items: [{ kind: 'video', title: 'V' }] }],
      }),
      catalog,
    );
    expect(result.ok).toBe(true);
    expect(result.counts.incomplete).toBe(1);
    expect(result.notes.some((n) => n.includes('video source'))).toBe(true);
  });

  it('skips a capstone entry that names something which does not exist', () => {
    const result = parseImport(
      JSON.stringify({ title: 'T', capstone: [{ kind: 'project', title: 'Nope' }] }),
      catalog,
    );
    expect(result.counts.capstone).toBe(0);
    expect(result.notes.some((n) => n.includes('Create it first'))).toBe(true);
  });

  it('reports unknown top-level fields rather than dropping them silently', () => {
    const result = parseImport(JSON.stringify({ title: 'T', mystery: 1 }), catalog);
    expect(result.notes.some((n) => n.includes('"mystery"'))).toBe(true);
  });
});

describe('parseImport — publish gate', () => {
  it('downgrades publish to draft when the course is not ready', () => {
    const result = parseImport(JSON.stringify({ title: 'Thin', publish: true }), catalog);
    expect(result.doc?.publish).toBe(false);
    expect(result.notes.some((n) => n.includes('imports as a draft'))).toBe(true);
  });

  it('judges readiness against the category the document will create', () => {
    const doc = JSON.parse(importSample());
    doc.category = 'Brand New Area';
    const result = parseImport(JSON.stringify(doc), catalog);
    expect(result.doc?.newCategory).toBe('Brand New Area');
    expect(result.doc?.publish).toBe(true);
  });

  it('does not publish a premium course with no Paddle price', () => {
    const doc = JSON.parse(importSample());
    delete doc.paddlePriceId;
    const result = parseImport(JSON.stringify(doc), catalog);
    expect(result.doc?.publish).toBe(false);
    expect(result.notes.some((n) => n.includes('premium pricing'))).toBe(true);
  });
});

describe('parseImport — rich text', () => {
  it('sanitises HTML and converts markdown in long-form fields', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        description: '<p onclick="x()">html</p><script>bad()</script>',
        chapters: [
          {
            title: 'C',
            description: '## Markdown heading',
            items: [
              {
                kind: 'article',
                title: 'A',
                content: '**bold** paragraph that is definitely long enough to pass.',
              },
            ],
          },
        ],
      }),
      catalog,
    );

    expect(result.doc?.course.description).toBe('<p>html</p>');
    expect(result.doc?.chapters[0].description).toBe('<h3>Markdown heading</h3>');
    const article = result.doc?.chapters[0].items[0];
    expect(article?.kind === 'article' && article.content).toContain('<strong>bold</strong>');
  });
});

describe('parseImport — article blocks', () => {
  it('imports a block body and derives the prose fallback from it', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [
          {
            title: 'C',
            items: [
              {
                kind: 'article',
                title: 'Print function',
                blocks: [
                  {
                    type: 'html',
                    html: 'Welcome to the lesson, which is long enough to count as prose.',
                  },
                  { type: 'playground', language: 'Python', title: 'main.py', code: 'print("hi")' },
                  { type: 'quiz', question: 'Which?', options: ['a', 'b'], answer: 1 },
                ],
              },
            ],
          },
        ],
      }),
      catalog,
    );

    expect(result.ok).toBe(true);
    const article = result.doc?.chapters[0].items[0];
    expect(article?.kind === 'article' && article.blocks).toHaveLength(3);
    // content is the prose blocks only — never the playground or checkpoint
    expect(article?.kind === 'article' && article.content).toContain('Welcome to the lesson');
    expect(article?.kind === 'article' && article.content).not.toContain('print(');
    expect(article?.complete).toBe(true);
  });

  it('sanitises prose inside blocks', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [
          {
            title: 'C',
            items: [
              {
                kind: 'article',
                title: 'A',
                blocks: [
                  {
                    type: 'html',
                    html: '<p onclick="x()">a long enough sentence for the body rule</p><script>bad()</script>',
                  },
                ],
              },
            ],
          },
        ],
      }),
      catalog,
    );

    const article = result.doc?.chapters[0].items[0];
    const html = article?.kind === 'article' ? (article.blocks[0] as { html: string }).html : '';
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<script');
  });

  it('notes blocks it does not recognise rather than importing them', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [
          {
            title: 'C',
            items: [
              {
                kind: 'article',
                title: 'A',
                blocks: [
                  { type: 'html', html: 'Long enough prose to satisfy the body length rule here.' },
                  { type: 'carousel', images: [] },
                ],
              },
            ],
          },
        ],
      }),
      catalog,
    );

    expect(result.ok).toBe(true);
    const article = result.doc?.chapters[0].items[0];
    expect(article?.kind === 'article' && article.blocks).toHaveLength(1);
    expect(result.notes.some((note) => note.includes('unknown type'))).toBe(true);
  });

  it('still accepts an article with only content', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [
          {
            title: 'C',
            items: [
              {
                kind: 'article',
                title: 'A',
                content: 'A body long enough to pass the minimum length.',
              },
            ],
          },
        ],
      }),
      catalog,
    );

    const article = result.doc?.chapters[0].items[0];
    expect(article?.kind === 'article' && article.blocks).toEqual([]);
    expect(article?.complete).toBe(true);
  });

  it('flags a block body with no real prose', () => {
    const result = parseImport(
      JSON.stringify({
        title: 'T',
        chapters: [
          {
            title: 'C',
            items: [
              {
                kind: 'article',
                title: 'A',
                blocks: [{ type: 'playground', language: 'Go', code: 'fmt.Println()' }],
              },
            ],
          },
        ],
      }),
      catalog,
    );

    const article = result.doc?.chapters[0].items[0];
    expect(article?.complete).toBe(false);
    expect(article?.missing).toContain('prose in at least one block');
  });
});
