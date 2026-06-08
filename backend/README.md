# MB Admin Backend (minimal)

This is a minimal Express + Prisma backend that is intended to run against PostgreSQL in production or on Neon during development.

Quick start:

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Before starting the server, set `DATABASE_URL` in `.env` to your Neon PostgreSQL connection string.

The server runs on port 4001 and exposes the `/api/*` endpoints used by the frontend.
