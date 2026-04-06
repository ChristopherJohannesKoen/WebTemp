# Control And Evidence Matrix

## Purpose

This document maps the repo-owned controls to the evidence they generate. It is
intended for security reviews, release checklists, and audit preparation.

## Identity And Access

| Control area                 | Repo control                                                                                                      | Evidence                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Enterprise login posture     | OIDC-first `GET /api/auth/sso/providers`, enterprise-first `/login`, local auth suppression in staging/production | API response payloads, web tests, E2E auth flows     |
| Break-glass restriction      | `POST /api/auth/break-glass/login`, owner-only, env-gated                                                         | audit logs, access-policy events, identity metrics   |
| Owner-sensitive changes      | `POST /api/auth/step-up` and owner step-up enforcement on owner-sensitive role changes                            | API tests, admin E2E tests, audit logs               |
| Provisioned-user access loss | disabled enterprise users lose access on next request                                                             | session tests, session deletion metrics, audit trail |

## Governance And Data Protection

| Control area               | Repo control                                                                                  | Evidence                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Audit continuity           | tamper-evident `AuditLog` chain with `previousHash` and `entryHash`                           | database rows, audit export verification                              |
| Security event attribution | request ID, actor, target, auth mechanism, IP, and user agent on security-relevant audit rows | runtime audit records                                                 |
| Retention and legal hold   | governance cleanup jobs with legal-hold exclusion                                             | scheduled cleanup logs, audit entries, retention config               |
| Secret handling            | file-backed secrets and startup validation                                                    | environment validation tests, deployment manifests, operator runbooks |

## Delivery And Supply Chain

| Control area                 | Repo control                                                   | Evidence                                      |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| Protected branch baseline    | CI, CodeQL, dependency review, release-integrity lanes         | GitHub required checks                        |
| Kubernetes render safety     | `kubectl kustomize` validation for base and overlays           | CI logs                                       |
| Artifact visibility          | SBOM generation on release lane                                | uploaded SBOM artifacts                       |
| Image vulnerability scanning | Trivy scan in release-integrity lane                           | workflow logs                                 |
| Provenance and signing       | provenance attestation and Cosign signing on released images   | GitHub attestations, signed image metadata    |
| Immutable promotion model    | digest-based image references for staging/production promotion | release workflow outputs, deployment runbooks |

## Runtime Monitoring

| Control area                 | Repo control                                                              | Evidence                                        |
| ---------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| Auth and identity visibility | Prometheus metrics for SSO, SCIM, break-glass, and owner-floor events     | `/api/metrics`, Grafana dashboards, alert rules |
| Service health               | `/api/health` and application probes                                      | Kubernetes probe config, monitoring checks      |
| Security incident response   | runbooks for SSO outage, SCIM drift, break-glass, and database saturation | operations guide, incident records              |

## Operator Documents

The supporting runbooks are:

- [Enterprise Identity Guide](./enterprise-identity.md)
- [Governance And Compliance Guide](./governance-and-compliance.md)
- [Deployment Runbook](./deployment.md)
- [Operations Guide](./operations.md)
- [Kubernetes Deployment Baseline](./kubernetes-baseline.md)
