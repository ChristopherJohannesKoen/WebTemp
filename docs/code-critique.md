# Codebase Critique (April 3, 2026)

## Scope reviewed

- API auth/session flow, RBAC, CSRF/origin checks, and project/user/admin modules.
- Web API client/server integration patterns.
- Schema and test strategy.

---

## Executive summary

This repository is a strong template baseline: the layering is clean, DTO validation is mostly disciplined, and audit logging is consistently applied to sensitive writes. The most important gaps were concentrated in correctness and security hardening rather than missing product breadth.

### Top priorities from the April 3 critique

1. Eliminate privileged-role bootstrap race condition.
2. Tighten CSRF/origin behavior for non-production deploys.
3. Stop over-fetching sensitive relational fields.
4. Reconcile `SESSION_SECRET` configuration with the actual session model.
5. Expand test coverage around middleware and security invariants.

---

## Detailed findings

### 1) Owner bootstrap race condition in signup

**Severity:** High  
**Where:** `AuthService.signUp`

The original implementation used `user.count() === 0` to promote the first account to `owner`. Under concurrent signups, multiple requests could observe the same empty state and create multiple owners.

**Status after the hardening pass:** `closed`

**Resolution:**

- Public signup now always creates `member`.
- The initial owner is established by the seed/setup flow, not by public runtime behavior.

### 2) CSRF/origin guard was overly permissive outside production

**Severity:** High  
**Where:** `OriginGuardMiddleware`

The original middleware allowed missing `Origin` and `Referer` in every non-production environment, which was convenient for local work but too permissive for staging-like deployments.

**Status after the hardening pass:** `closed`

**Resolution:**

- Missing `Origin` and `Referer` is now rejected by default outside `NODE_ENV=test`.
- Local development can opt in explicitly with `ALLOW_MISSING_ORIGIN_FOR_DEV=true`.
- CSRF token validation remains the primary protection for authenticated unsafe requests.

### 3) Project queries over-fetched creator data

**Severity:** Medium-High  
**Where:** `ProjectsService`

The previous `include: { creator: true }` pattern pulled full related user rows into memory, including internal fields such as password hashes.

**Status after the hardening pass:** `closed`

**Resolution:**

- Project queries now use shared public relation selects limited to `id`, `email`, `name`, and `role`.
- The same pattern is documented for future modules.

### 4) Required `SESSION_SECRET` did not match the implementation

**Severity:** Medium  
**Where:** environment validation and docs

The core session model uses opaque random tokens hashed server-side. A required `SESSION_SECRET` implied JWT/HMAC-style signing that did not actually exist.

**Status after the hardening pass:** `closed`

**Resolution:**

- `SESSION_SECRET` was removed from the required core environment contract.
- Docs now describe the actual opaque session model.

### 5) Session read path wrote `lastUsedAt` on every request

**Severity:** Medium  
**Where:** session resolution paths

Updating `lastUsedAt` on every authenticated request creates avoidable write amplification and unnecessary DB churn.

**Status after the hardening pass:** `closed`

**Resolution:**

- Session freshness writes are throttled by `SESSION_TOUCH_INTERVAL_MS`.
- Session rotation and revocation behavior remain intact.

### 6) `RolesGuard` returned `403` for unauthenticated requests

**Severity:** Low-Medium  
**Where:** `RolesGuard`

Returning `403` for missing authentication blurred the line between "login required" and "authenticated but not allowed."

**Status after the hardening pass:** `closed`

**Resolution:**

- Role-protected routes now return `401` when no authenticated user is present.
- `403` remains reserved for authenticated-but-forbidden requests.

### 7) CSV export contract was ambiguous

**Severity:** Low-Medium  
**Where:** `ProjectsService.exportProjects`

The earlier critique flagged silent truncation risk. The template now uses stream-based export, but the contract still needed to be explicit when the synchronous limit is exceeded.

**Status after the hardening pass:** `closed`

**Resolution:**

- Synchronous export now returns the full filtered result or a structured `400`.
- Over-limit responses carry the machine-readable code `export_limit_exceeded`.
- Docs and UI copy now describe that behavior.

### 8) Security-focused test coverage was too thin

**Severity:** Medium  
**Where:** test suite composition

Security regressions tend to cluster around origin rules, CSRF, auth semantics, and bootstrap invariants.

**Status after the hardening pass:** `partially addressed`

**What was added:**

- signup/bootstrap tests for seeded-owner-only behavior
- middleware-boundary tests for origin and CSRF behavior
- HTTP-boundary tests for `401` vs `403`
- project service tests for public relation selects and export-limit behavior
- session touch/rotation tests

**What remains worth adding later:**

- a real database-level bootstrap invariant test if the template ever reintroduces runtime owner bootstrap logic
- deeper stress/concurrency coverage around session churn and multi-actor administrative workflows

---

## Positive patterns worth preserving

- Clear module boundaries and layered responsibilities.
- Validation-first request handling with shared error structures.
- Audit logging on identity and data mutation flows.
- Full browser-level regression coverage for auth, projects, sessions, and RBAC.

---

## Remediation mapping

| Finding | Status |
| --- | --- |
| Owner bootstrap race | Closed |
| Permissive origin handling | Closed |
| Over-fetching creator rows | Closed |
| Unused `SESSION_SECRET` contract | Closed |
| Session write amplification | Closed |
| `401` vs `403` auth semantics | Closed |
| Export contract clarity | Closed |
| Security-focused coverage depth | Partially addressed |

---

## Overall assessment

The repository is now better described as a hardened reusable template than a starter scaffold. The highest-risk correctness and security mismatches from the April 3 critique have been resolved, and the remaining work is mostly incremental hardening and future extension depth rather than foundational repair.
