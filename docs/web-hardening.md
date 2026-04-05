# Web Hardening Guide

## Purpose

This document describes the hardened website baseline in `apps/web`. It is the reference for:

- browser security headers and Content Security Policy
- contract-backed web-to-API transport
- role-aware navigation and protected route behavior
- accessible auth-form behavior
- the expectations for future web-layer changes

The goal is not "secure enough for a demo." The goal is a repeatable default that can survive real product customization without regressing into ad hoc client behavior.

## Reference Baseline

The web hardening model in this document was informed by the local reference set
under the `references/` directory, especially:

- `next-safe-middleware-main` and the archived Next.js CSP issue PDFs for nonce
  and App Router behavior
- `ts-rest-main`, `zod-main`, and `zodios-main` for contract-backed client
  patterns
- `react-spectrum-main` plus the NVDA and React Spectrum accessibility issue
  captures for auth-form error semantics

The fuller provenance map is documented in
[Reference Baseline](./reference-baseline.md).

## Browser Boundary

The website owns its browser security policy in [`apps/web/middleware.ts`](../apps/web/middleware.ts) and [`apps/web/lib/csp.ts`](../apps/web/lib/csp.ts).

Every non-static page response is expected to carry:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` with deny-by-default controls
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Strict-Transport-Security` in production

These headers are not delegated to a reverse proxy by default. The template sets them in-app so the security posture remains correct even in local development, preview environments, and simple deployments.

## CSP Model

### Core policy

The template uses a nonce-based CSP. The important production directives are:

- `default-src 'self'`
- `base-uri 'self'`
- `frame-ancestors 'none'`
- `form-action 'self'`
- `object-src 'none'`
- nonce-based `script-src`
- nonce-based `style-src`
- explicit `connect-src`

Production must not fall back to blanket `style-src 'unsafe-inline'`.

### Development allowances

Development keeps only the relaxations needed for local Next.js tooling:

- websocket connections for HMR
- `unsafe-eval` for development scripts
- inline styles only where framework tooling still requires them locally

Those allowances are development-only. If they leak into production, treat that as a regression.

### Report-only mode

`CSP_REPORT_ONLY=true` adds a parallel `Content-Security-Policy-Report-Only` header. This is intended for:

- validating future CSP changes
- trialing new third-party integrations
- debugging unexpected browser violations

It is not the primary production hardening mechanism anymore. The enforced production policy is already strict by default.

### Dynamic rendering tradeoff

The root layout stays on a dynamic path so Next.js can attach the nonce per request. That is a deliberate tradeoff:

- stronger CSP
- less static optimization at the root boundary

If a future change attempts to push the root shell back toward static generation, it must preserve nonce delivery or provide an equally strong alternative.

## Transport Boundary

The website no longer treats API calls as raw path strings plus optimistic casting. JSON business endpoints are consumed through:

- [`packages/contracts`](../packages/contracts)
- [`apps/web/lib/client-api.ts`](../apps/web/lib/client-api.ts)
- [`apps/web/lib/server-api.ts`](../apps/web/lib/server-api.ts)

This means:

- method, path, params, query, and body are explicit
- success responses are validated against shared Zod schemas
- structured error responses keep `statusCode`, `message`, `code`, `errors`, and `requestId`
- malformed or unexpected JSON fails as a contract error instead of being silently cast

### Allowed transport patterns

Allowed:

- contract-backed JSON requests for business endpoints
- explicit non-JSON handling for CSV or other file downloads

Not allowed:

- generic `fetch('/api/...')` business requests in app components
- schema-optional JSON parsing
- `payload as T` style success casting

### CSRF and idempotency at the client edge

The browser client is responsible for:

- fetching `GET /api/auth/csrf` when needed
- sending `X-CSRF-Token` on authenticated unsafe requests
- attaching `Idempotency-Key` on protected create/finalize POSTs
- retrying unsafe requests only when the API returns `code: 'csrf_invalid'`

Generic `403` responses must never trigger mutation replay.

## Cookie Forwarding

The server-side web client forwards only the configured session cookie to the API.

This is a hard boundary rule:

- do not serialize and forward the full browser cookie jar
- do not let unrelated cookies become implicit auth inputs

If a new server-side API call needs additional cookie semantics, document and justify that expansion explicitly.

## Protected Route Semantics

Protected routes must distinguish:

- `401`: not authenticated -> redirect to `/login`
- `403`: authenticated but forbidden -> render forbidden state
- `404`: not found -> render not-found state
- `5xx` / upstream errors -> render error boundary

Do not collapse these into a single "logged out" or fake `404` experience. That makes debugging harder and hides real outages.

## Role-Aware UI

Route and API authorization remain the real security boundary. The website adds a second alignment layer:

- privileged navigation is filtered in the UI
- members do not see admin navigation
- owners/admins do

This reduces confusion and avoids unnecessary forbidden-route traffic, but it must never replace route or API enforcement.

Role checks should flow through capability helpers in the web layer rather than repeated string comparisons across components.

## Auth Form Accessibility

Auth forms must preserve these behaviors:

- a persistent form-level error region with `aria-live="polite"`
- field-level errors associated to controls through stable IDs
- `aria-invalid` on invalid controls
- server and validation failures announced without relying on color only

This applies to:

- sign in
- sign up
- forgot password
- reset password

If new auth or onboarding forms are added later, they should reuse the same error-rendering pattern rather than inventing a new one.

## Customization Rules

When changing the website:

1. Update the contract first if the change affects a JSON endpoint.
2. Keep browser security headers owned in the app unless you are replacing them with an equally well-documented deployment guarantee.
3. Treat CSP changes as security changes, not visual tweaks.
4. Keep route/API authorization intact even if the UI hides a control.
5. Preserve accessible error semantics when restyling auth flows.

## Review Checklist

Use this checklist for any substantial web-platform change:

- Does production CSP stay strict without `unsafe-inline` for styles?
- Does the change keep the root nonce path working?
- Are new JSON calls going through `packages/contracts`?
- Are new file/download endpoints explicitly non-JSON?
- Are auth-sensitive reads still uncached?
- Are `401`, `403`, `404`, and `5xx` still handled distinctly?
- If UI visibility changed, is the route/API guard still present?
- If a third-party script/style was added, were CSP docs and tests updated too?
