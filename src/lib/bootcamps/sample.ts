/** A payload that exercises every field the importer accepts. */
export const bootcampSample = JSON.stringify(
  {
    title: 'Node.js Backend Engineering Bootcamp',
    slug: 'nodejs-backend-engineering-bootcamp',
    summary: 'Build and ship a production Node service, week by week, with a cohort.',
    banner: 'https://images.masteringbackend.com/bootcamps/node/banner.png',
    level: 'Intermediate',
    topics: [
      { title: 'Node.js', summary: 'The runtime and its tooling' },
      { title: 'Prisma', summary: 'Modelling data' },
    ],
    cohorts: [
      {
        name: 'Node.js Backend — Cohort 1',
        startsAt: '2026-10-05',
        endsAt: '2026-11-02',
        duration: 4,
        amount: 25000,
        maxStudent: 40,
        status: 'OPEN',
        completed: false,
        studyGroupLink: 'https://slack.example.com/nodejs-c1',
        paddle_price_id: 'pri_123',
        asyncpay_plan_id: '',
        allowsSubscription: true,
        weeks: [
          {
            title: 'Week 1 — Foundations',
            summary: 'The runtime, the event loop, and why it matters.',
            lessons: [
              { title: 'The runtime & event loop', type: 'ASSIGNMENT', mb: 10 },
              { title: 'Your first HTTP server', type: 'ASSIGNMENT', mb: 10 },
            ],
          },
          {
            title: 'Week 2 — Data & caching',
            lessons: [
              { title: 'Modelling data with Prisma', type: 'ASSIGNMENT', mb: 10 },
              {
                title: 'Caching with Redis',
                type: 'VIDEO',
                mb: 10,
                // Matched against the library by title before anything is written.
                item: 'Redis in Practice',
              },
            ],
          },
        ],
        events: [
          {
            title: 'Kickoff & orientation',
            eventType: 'LIVE_SESSION',
            date: '2026-10-05',
            start: '17:00',
            end: '18:00',
            timezone: 'UTC',
            week: 1,
            lesson: 'The runtime & event loop',
            meetingUrl: 'https://meet.example.com/kickoff',
          },
          {
            title: 'Office hours',
            eventType: 'OFFICE_HOURS',
            date: '2026-10-09',
            start: '16:00',
            end: '17:00',
            week: 1,
          },
        ],
        bonuses: [
          {
            kind: 'course',
            item: 'Redis in Practice',
            topic: 'Caching',
            summary: 'A deeper dive.',
          },
        ],
        students: ['ada@example.com', 'ben@example.com'],
      },
    ],
  },
  null,
  2,
);
