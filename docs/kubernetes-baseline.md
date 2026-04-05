# Kubernetes Deployment Baseline

## Purpose

The authoritative production deployment story is now Kubernetes-first.

Local development:

- Docker Compose

Production baseline:

- `infra/k8s/base`
- `infra/k8s/overlays/staging`
- `infra/k8s/overlays/production`

## Assumptions

- `api` and `web` run as separate deployments
- PostgreSQL is external or separately governed
- TLS termination happens at the ingress layer
- metrics scraping is handled by platform tooling
- secrets are injected through Kubernetes-native or external secret management

## Included Controls

The base manifests include:

- non-root pods
- `RuntimeDefault` seccomp
- dropped Linux capabilities
- read-only root filesystems
- readiness, liveness, and startup probes
- resource requests and limits
- HPA for `api` and `web`
- PodDisruptionBudgets
- NetworkPolicies
- Prisma migration job

## Secret And Config Strategy

Use:

- `ConfigMap` for non-secret runtime config
- `Secret` or external secret provider for secret material

Do not keep production values in the example secret manifest. `secret-example.yaml` is only a structure reference.

## Promotion Model

The intended promotion model is:

1. build once
2. generate SBOM and scan the artifact
3. attest provenance
4. promote the same image digest between staging and production overlays

Do not rebuild different application artifacts per environment.

## Migration And Seed Policy

- run the migration job for every deploy that changes Prisma schema
- do not run seed in steady-state staging or production
- bootstrap owner creation happens once, then `BootstrapState` prevents silent rebinding

## Backup And Recovery Expectations

The template assumes platform operators define:

- backup schedule
- restore drill cadence
- RPO target
- RTO target

At minimum, document:

- database snapshot frequency
- restore test evidence
- who can run restore operations
- how application rollback coordinates with database rollback
