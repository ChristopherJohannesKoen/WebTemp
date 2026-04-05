# Testing And Failpoint Guide

## Purpose

The template ships three different confidence layers:

- unit and module tests through Vitest
- API boundary tests through Nest app integration/e2e specs
- browser flows through Playwright

This document explains how the test harness is structured and how failure-path coverage works without leaking test seams into production code.

## Test Layers

## Unit And Package Tests

Use Vitest for:

- pure helpers
- schema/contract checks
- component behavior
- service-level logic

Examples:

- `packages/contracts/test`
- `apps/web/test`
- `apps/api/test/*.spec.ts`

These tests should stay fast and deterministic.

## API Boundary Tests

Nest integration/e2e tests in `apps/api/test` validate:

- auth and session behavior
- middleware behavior
- security invariants
- metrics and observability surfaces
- error envelope behavior

These tests prove the API contract at the application boundary without requiring the full browser stack.

## Browser E2E Tests

Playwright under `tests/e2e` runs against:

- the real Next.js app
- the real Nest API
- a dedicated E2E Postgres database

The suite covers:

- public auth flows
- signup/login/reset flows
- projects CRUD/filter/export behavior
- session management
- RBAC regression paths
- bootstrap ownership invariants under concurrent seed execution
- multi-actor admin race coverage with separate browser contexts

## E2E Bootstrap Path

The Playwright harness does not start the normal API entrypoint. It starts:

- [`tests/e2e/start-api.mjs`](../tests/e2e/start-api.mjs)
- which compiles and launches [`apps/api/src/e2e-main.ts`](../apps/api/src/e2e-main.ts)

That E2E-specific entrypoint loads the regular app plus a test-only failpoint module.

The production entrypoint remains:

- [`apps/api/src/main.ts`](../apps/api/src/main.ts)

The website does not branch on E2E query params or test-only environment toggles to simulate failures.

## Failpoint Model

The failpoint system exists so browser tests can simulate upstream failures cleanly.

It lives in:

- [`apps/api/src/modules/e2e`](../apps/api/src/modules/e2e)
- [`tests/e2e/support/failpoints.ts`](../tests/e2e/support/failpoints.ts)

The model supports one-shot failure injection by method and path. Current usage covers upstream `503` simulation for protected route error-boundary tests.

### Why this exists

This avoids anti-patterns such as:

- test query params in production route loaders
- `TEMPLATE_E2E` branches in runtime request code
- special-case browser logic that only exists to satisfy tests

The application runtime stays clean, while the harness still has full control over failure-path testing.

## Writing A Browser Failure Test

The pattern is:

1. reset the E2E database
2. sign in normally
3. arm a failpoint through the E2E helper
4. navigate to the affected page
5. assert the correct error boundary or UI failure state

If you add a new failure-path browser test, prefer extending the failpoint harness instead of adding app-only switches.

## Hermetic Build Requirement

The repository now treats build determinism as part of test quality.

`npm run build` must:

- succeed without mutating tracked source/config files
- leave the worktree clean
- remain compatible with subsequent tests

CI enforces this with a post-build `git diff --exit-code` check.

If a future tooling change requires rewriting tracked files after build, treat it as a regression.

## Contract Coverage Expectations

JSON website endpoints should be covered in at least two ways:

- compile-time usage through `packages/contracts`
- runtime validation through the web client and tests

At minimum, changes that affect contract-backed routes should have:

- a unit or package-level contract test where useful
- a caller-level web test or API test
- browser E2E coverage when the route is part of a critical user journey

## Performance Assets

The repository also includes `tests/perf` for k6-based validation. The smoke scenario is now a blocking CI gate, while the broader profile set stays nightly/manual. Keep them aligned with:

- real API paths
- real auth/session flow expectations
- idempotency behavior
- current cookie and CSRF assumptions
- current bootstrap and owner-floor invariants

## Concurrency Coverage Expectations

Top-tier correctness in this template now assumes coverage for:

- concurrent seed/bootstrap execution against the same database
- owner-floor protection during conflicting owner-sensitive role changes
- stale admin sessions losing access on the next privileged request
- session touch/rotation/revocation behavior under repeated authenticated reads

If you change ownership, session, or admin semantics, extend these suites instead of replacing them with timing-based smoke checks.

## Review Checklist

When adding a new feature or route, confirm:

- Is there unit-level coverage for local logic?
- Is there API-boundary coverage for security and contract behavior?
- Does the browser flow need Playwright coverage?
- If a failure-path browser test is required, can it use the E2E failpoint system?
- Does the change keep build and test runs hermetic?
