# Governance And Compliance Guide

## Target Posture

This repo is now shaped toward an audit-ready enterprise baseline aligned with the style of:

- SOC 2 controls
- ISO 27001 operational expectations

It is not a complete compliance program by itself. It provides application, deployment, and CI evidence points that a larger governance program can consume.

## Audit Trail

`AuditLog` now stores:

- event category
- outcome
- auth mechanism
- request ID
- source IP
- user agent
- legal-hold flag
- previous-entry hash
- entry hash

The `previousHash` and `entryHash` fields form a tamper-evident chain so downstream export or warehousing systems can verify continuity.

## Access Policy Events

`AccessPolicyEvent` records identity and privilege decisions that matter beyond simple CRUD audit lines:

- JIT provisioning
- SCIM provisioning
- group mapping
- break-glass login
- owner step-up completion
- provider configuration changes

## Data Retention

The governance module runs legal-hold-aware cleanup for:

- audit logs
- expired sessions
- password reset tokens
- idempotency records

Retention controls:

- `AUDIT_LOG_RETENTION_DAYS`
- `SESSION_RETENTION_DAYS`
- `PASSWORD_RESET_RETENTION_DAYS`
- `IDEMPOTENCY_RETENTION_DAYS`

Legal hold:

- audit rows marked `legalHold=true` are excluded from automated cleanup
- this is the application hook; the operational process for setting or clearing holds belongs in your security/legal runbook

## Disabled Instead Of Deleted

Enterprise-provisioned users are disabled on deprovision rather than hard-deleted by default. This preserves:

- audit continuity
- historical ownership and project references
- incident-investigation traceability

## Secret Loading

The application no longer assumes all secrets must be inline env strings. `SecretService` supports:

- direct env values
- `${NAME}_FILE` file-backed values

This makes the template compatible with:

- Kubernetes Secrets
- External Secrets operators
- Vault sidecar/file injections
- cloud secret-manager mount patterns

## Evidence Map

The repo now produces compliance-relevant evidence from:

- CI runs
  - format, lint, typecheck, tests, build, dependency review, CodeQL
- release workflows
  - SBOM generation
  - image scanning
  - provenance attestation
- runtime records
  - audit logs
  - access-policy events
  - Prometheus metrics
- deployment assets
  - Kubernetes manifests
  - explicit secret/config separation
- operational runbooks
  - deployment
  - environment catalog
  - operations guide
  - enterprise identity guide

## Remaining Organization-Level Work

This template does not replace:

- organization-wide access reviews
- HR joiner/mover/leaver process controls
- ticketing and approval workflows
- SIEM retention policy
- formal risk register management
- legal review of retention and deletion requirements
