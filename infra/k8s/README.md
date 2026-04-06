# Kubernetes Baseline

This directory is the cloud-neutral production baseline for the template.

Assumptions:

- `api` and `web` run in Kubernetes.
- PostgreSQL is managed outside the cluster or by a separately governed stateful data platform.
- Secrets are injected through Kubernetes `Secret` objects or an external secret manager.
- The application still supports Docker Compose for local development only.

Structure:

- `base/`: shared production-safe manifests
- `overlays/staging/`: staging-specific hostnames, scaling, and relaxed reporting endpoints
- `overlays/production/`: production hostnames, autoscaling, and stricter ingress defaults

Operational expectations:

- Run the Prisma migration job before promoting a new API release.
- Do not run the seed job in steady-state staging or production.
- Replace `secret-example.yaml` with Sealed Secrets, External Secrets, Vault, or a cloud KMS-backed secret flow before production.
- Keep `APP_ENV=staging` or `APP_ENV=production` in cluster config so local-only auth and reset toggles cannot leak upward.
