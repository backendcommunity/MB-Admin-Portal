# Academy API Parity Matrix (Frontend vs Included Academy Backend)

Date: 2026-06-15

## Effective API Base

- Frontend now targets: `https://demo.masteringbackend.com/api/v3`
- Academy app mount: `/api/v3` in `academy/src/app.ts`

## Key Auth Contract Findings

- Frontend login call: `POST /auth/login`
- Academy login route exists: `POST /auth/login`
- Academy login response shape:
  - `{ success, message, data: { token, user } }`
- Frontend login currently expects:
  - `{ token, role }`
- Academy role enum: `USER | INSTRUCTOR | ADMIN`
- Frontend role enum: `SUPER_ADMIN | ADMIN | INSTRUCTOR`
- Academy auth middleware reads cookie `mb_token` from request cookies.
- Frontend currently sends `Authorization: Bearer <token>` via interceptor; this may not be sufficient if cookie is required by all protected endpoints.

## Endpoint Parity

Legend:
- `MATCH`: frontend endpoint exists in academy with same or compatible path/method intent
- `PARTIAL`: related endpoint exists but path semantics or payload/response differs
- `MISSING`: no corresponding academy endpoint for current frontend call pattern

### Auth

- Frontend `POST /auth/login` -> Academy `POST /auth/login`: `PARTIAL`
  - Path matches, response shape differs.

### Users

- Frontend `GET /users` (expects `{ data, total }`): `MISSING`
- Frontend `POST /users`: `MISSING`
- Frontend `PUT /users/:id`: `MISSING`
- Frontend `DELETE /users?id=`: `MISSING`
- Frontend `GET /users/:id`: `MISSING`
- Frontend `PATCH /users/:id` for suspend/role/reset-password actions: `MISSING`
- Academy available user routes are mostly self-service:
  - `GET /users/courses`
  - `GET /users/roadmaps`
  - `GET /users/project30s`
  - `GET /users/achievements`
  - `GET /users/streak`
  - `GET /users/continue-learning`
  - `GET /users/leaderboard`
  - `GET /users/study-schedule`
  - `PATCH /users/study-schedule`
  - `GET /users/upload-url`
  - `PUT /users`
  - `PATCH /users`
  - `PUT /users/projects/:id`
  - `PATCH /users/projects/:id`
  - `POST /users/delete-account`
  - `POST /users/undelete`

### Bootcamps

- Frontend `GET /bootcamps` (expects `{ data, total }`): `PARTIAL`
  - Academy has `GET /bootcamps`, but response shape may differ.
- Frontend `POST /bootcamps`: `MATCH`
- Frontend `PUT /bootcamps/:id`: `MISSING`
- Frontend `DELETE /bootcamps?id=`: `MISSING`

### Cohorts

- Frontend `GET /cohorts`: `MISSING`
- Frontend `POST /cohorts`: `MISSING`
- Frontend `PUT /cohorts`: `MISSING`
- Frontend `DELETE /cohorts?id=`: `MISSING`
- Frontend detail client calls such as:
  - `POST /cohorts/:id/members`
  - `POST/PATCH/PUT/DELETE /cohorts/:id/curriculum`
  - `DELETE /cohorts/:id/members`
  - all: `MISSING`
- Academy cohort operations are nested under bootcamps:
  - `POST /bootcamps/:id/cohorts`
  - `POST /bootcamps/:id/cohorts/:cohort/students`
  - `GET /bootcamps/:id/cohorts/:cohortId/...`

### Courses

- Frontend `GET /courses` (expects `{ data, total }`): `PARTIAL`
  - Academy has `GET /courses`, response shape likely different.
- Frontend `POST /courses`: `MATCH`
- Frontend `PUT /courses/:id`: `MISSING`
- Frontend `DELETE /courses?id=`: `MISSING`
- Frontend detail client chapter management:
  - `POST /courses/:courseId/chapters`: `MATCH`
  - `PATCH /courses/:courseId/chapters`: `MISSING`
  - `PUT /courses/:courseId/chapters`: `MISSING`
  - `DELETE /courses/:courseId/chapters`: `MISSING`
  - `DELETE /courses/:courseId`: `MISSING`

## Highest-Risk Mismatches To Fix Next

1. Login response mapping (`data.token`, `data.user.role`) and role normalization (`USER` vs `SUPER_ADMIN`).
2. Auth transport mismatch (cookie-based academy auth vs bearer-token-centric frontend assumptions).
3. Cohorts domain path mismatch (frontend root `/cohorts` vs academy nested `/bootcamps/:id/cohorts/...`).
4. Users CRUD endpoints expected by admin portal are not present in academy routes.
5. Update/delete routes for courses and bootcamps are not currently represented in academy route layer.

## Suggested Integration Strategy

1. Add a frontend adapter layer per domain to transform academy responses into existing UI shapes.
2. Normalize auth payload in login flow and derive role from `data.user.role`.
3. Decide one auth mechanism for runtime calls:
   - cookie/session with `withCredentials`, or
   - token header support from academy middleware.
4. For missing admin CRUD routes, either:
   - implement equivalent endpoints in academy admin surface, or
   - refactor frontend screens to use available academy operations.
5. Disable and eventually remove local Next mock routes under `src/app/api` once each domain is cut over.
