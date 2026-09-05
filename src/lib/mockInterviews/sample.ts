/**
 * Deliberately imperfect.
 *
 * Row 1 is clean. Row 2 is written in the OLD seed convention (genre in
 * `format`, no `style`) and additionally carries a zero-weight criterion, a
 * repeated topic, the dead `level` column and an unknown key — so the notes
 * panel has something true to say and the coercions are visible before anyone
 * trusts them with a real file.
 */
export const templateSample = JSON.stringify(
  [
    {
      name: 'Senior Go Backend Engineer',
      summary: 'Concurrency, interfaces and service design in Go.',
      description:
        'Goroutines, channels, context propagation, interface design and testing a service that talks to three others.',
      company: '',
      position: 'Backend Engineer',
      seniority: 'Senior',
      style: 'Technical',
      format: 'Chat',
      category: 'Backend',
      difficulty: 'Hard',
      duration: 40,
      questions: 8,
      topics: ['golang', 'goroutines', 'channels', 'context', 'interfaces'],
      evaluationRubric: [
        {
          criterion: 'Technical Accuracy',
          weight: 40,
          description: 'Correctness of the Go semantics they describe.',
        },
        { criterion: 'Concurrency reasoning', weight: 35 },
        { criterion: 'Communication', weight: 25 },
      ],
      isPublic: true,
    },
    {
      name: 'Event-Driven Architecture Review',
      summary: 'Designing around queues, retries and ordering.',
      description:
        'Exactly-once versus at-least-once, idempotent consumers, dead-letter handling and when a queue is the wrong answer.',
      position: 'Staff Engineer',
      seniority: 'Staff',
      format: 'System Design',
      level: 'Senior',
      category: 'System Design',
      difficulty: 'Expert',
      duration: 45,
      questions: 5,
      topics: ['kafka', 'idempotency', 'ordering', 'dead-letter', 'kafka'],
      evaluationRubric: [
        { criterion: 'Architecture', weight: 50 },
        { criterion: 'Failure handling', weight: 30 },
        { criterion: 'Buzzword density', weight: 0 },
      ],
      estimatedSalary: '$180k',
      isPublic: false,
    },
  ],
  null,
  2,
);
