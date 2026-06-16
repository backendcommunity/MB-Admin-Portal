# Week 3 Execution Plan

Objective: Deliver advanced admin workflows on top of the Week 1-2 foundation, with academy backend parity and no mock dependency.

## Scope

1. Projects module (list, detail, status transitions).
2. Roadmaps module (CRUD + ordering).
3. Plans and subscriptions operations (read + admin actions).
4. Approvals queue (pending content/actions review workflow).
5. Instructor-focused surfaces (my-content and earnings data hooks).

## Contract-First Rule

1. Use academy routes under /api/v3 only.
2. Keep IDs as UUID strings end-to-end.
3. All new frontend API helpers go through src/lib/api/* with adapter normalization in src/lib/api/adapters.ts.
4. No direct axios calls in page-level components.

## Day-by-Day Plan

## Day 1 - API Audit and Types

1. Inventory existing academy modules for: projects, roadmaps, plans, subscriptions, approvals, earnings.
2. Document route contracts and payload shapes in one matrix (method, path, query params, response envelope).
3. Add/extend frontend types in src/lib/types and adapter normalizers in src/lib/api/adapters.ts.
4. Add missing backend admin routes only when required by UI gaps.

Exit criteria:
- Contract matrix completed.
- All required frontend domain types compile.

## Day 2 - Projects and Roadmaps

1. Implement projects API client and table/detail UI with server-side pagination/filter/search.
2. Implement roadmaps API client and CRUD/detail UI.
3. Add optimistic updates only where backend responses are deterministic.
4. Add permission guards by role (SUPER_ADMIN/ADMIN).

Exit criteria:
- Projects and roadmaps list/detail flows functional against academy backend.
- Frontend build passes.

## Day 3 - Plans and Subscriptions

1. Implement plans list/detail/admin actions (activate/deactivate/update).
2. Implement subscriptions list/detail + filters (status, date range, plan).
3. Add CSV export endpoint wiring if backend route exists; otherwise feature-flag as pending backend.
4. Ensure all filters are mapped to backend query params, not client-only filtering.

Exit criteria:
- Plans and subscriptions workflows complete for core admin use cases.
- No unresolved type mismatches.

## Day 4 - Approvals, My Content, Earnings

1. Implement approvals queue with action endpoints (approve/reject/request changes).
2. Wire my-content page to instructor scoped endpoints and ownership checks.
3. Implement earnings dashboard cards and table from backend aggregates.
4. Add loading/empty/error states consistent with existing shared components.

Exit criteria:
- Approvals queue fully actionable.
- Instructor pages render real backend data.

## Day 5 - Hardening and Release Readiness

1. Run full frontend build and fix all blocking type/runtime issues.
2. Smoke test all Week 1-3 routes with authenticated roles.
3. Validate auth/session behavior (cookie pass-through, unauthorized handling).
4. Record known backend gaps and convert them into explicit backlog items.
5. Freeze API contracts for Week 4.

Exit criteria:
- Build green.
- Smoke checklist complete.
- Clear Week 4 handoff notes.

## Engineering Checklist

1. Keep route pages thin; push logic into domain components and api helpers.
2. Standardize query keys and invalidation per module.
3. Use string ID types in props, DTOs, mutations, and adapters.
4. Avoid introducing new local mock stores for Week 3 features.
5. Maintain role-based page protection using existing auth utilities.

## Validation Matrix

1. Frontend:
- npm run build
- Role-based route access checks
- CRUD/action smoke for each Week 3 module

2. Backend:
- Verify each required admin endpoint with real auth cookie context
- Validate query param parsing and pagination metadata
- Confirm response envelopes match adapter assumptions

## Risks and Mitigation

1. Route mismatch risk:
- Mitigation: enforce Day 1 contract matrix before UI coding.

2. UUID/number drift:
- Mitigation: lint and review for Number(...) conversion on entity IDs.

3. Backend gaps discovered late:
- Mitigation: add minimal admin routes by Day 1-2 and feature-flag optional UI actions.

4. Auth inconsistency across environments:
- Mitigation: test with local academy and same-cookie flow through frontend proxy routes.
