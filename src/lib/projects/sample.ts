/** A payload that exercises every field the importer accepts. */
export const projectSample = JSON.stringify(
  {
    title: 'Ship a Job Queue',
    slug: 'ship-a-job-queue',
    summary: 'Build a durable background job queue with retries, backoff and a dead-letter queue.',
    description:
      'You will build the queue a production service actually needs: at-least-once delivery, exponential backoff, a dead-letter queue and a worker that survives a restart mid-job.',
    banner: 'https://images.masteringbackend.com/projects/queue.png',
    level: 'Intermediate',
    duration: 12,
    skills: ['Concurrency', 'Idempotency', 'Backpressure'],
    technologies: ['Node.js', 'Redis', 'BullMQ'],
    prerequisites: ['A working Node service'],
    industries: ['Fintech', 'Marketplaces'],
    languages: ['node'],
    isPremium: false,
    amount: 0,
    isSample: false,
    // Defaults to true — leave it out and the project arrives as a draft.
    isWaiting: false,
    baseRepository: 'https://github.com/masteringbackend/job-queue-starter',
    referenceApiURL: 'https://ref.masteringbackend.com/job-queue',
    PRDLink: 'https://docs.masteringbackend.com/prd/job-queue',
    // Decides which grading contract every task below can carry.
    mode: 'rest-api',
    projectTasks: [
      {
        title: 'Enqueue and drain',
        summary: 'The smallest queue that works.',
        tasks: [
          {
            title: 'POST /jobs accepts a job',
            description: 'Accept a job body and return its id with 201.',
            type: 'TASK',
            mb: 15,
            apiSpec: {
              method: 'POST',
              url: '/jobs',
              request: {
                headers: { 'content-type': 'application/json' },
                body: { type: 'email', payload: { to: 'a@b.c' } },
              },
              response: {
                status: 201,
                assertions: [
                  { kind: 'status', equals: 201 },
                  { kind: 'jsonPath', path: 'id', exists: true },
                  { kind: 'jsonPath', path: 'state', equals: 'queued' },
                ],
              },
            },
          },
          {
            title: 'GET /jobs/:id reports state',
            description: 'Return the job with its current state.',
            type: 'TASK',
            mb: 10,
            apiSpec: {
              method: 'GET',
              url: '/jobs/:id',
              response: {
                status: 200,
                assertions: [{ kind: 'shape', path: '', shape: { id: 'string', state: 'string' } }],
              },
            },
          },
          {
            title: 'Why at-least-once?',
            description: 'Check the delivery guarantee you have actually built.',
            type: 'QUIZ',
            mb: 5,
            required: false,
            questions: [
              {
                question: 'A worker crashes after doing the work but before acking. What happens?',
                options: ['The job is lost', 'The job runs again', 'The queue stalls'],
                correctAnswer: 'The job runs again',
              },
            ],
          },
        ],
      },
      {
        title: 'Retries and backoff',
        summary: 'Failure is the normal case.',
        tasks: [
          {
            title: 'Exhausted jobs land in the DLQ',
            description: 'After the last attempt the job moves to the dead-letter queue.',
            type: 'TASK',
            mb: 20,
            // Matched against the library by title before anything is written.
            video: 'Redis in Practice',
            apiSpec: {
              method: 'GET',
              url: '/dlq',
              response: {
                assertions: [{ kind: 'shape', path: 'jobs', shape: { id: 'string' }, minItems: 1 }],
              },
            },
          },
        ],
      },
    ],
    learners: ['ada@example.com', 'ben@example.com'],
  },
  null,
  2,
);
