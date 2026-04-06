# ADR 003: Kubernetes Production Baseline

## Status

Accepted

## Decision

Docker Compose remains the local-development workflow, but Kustomize-managed Kubernetes is the authoritative production baseline.

## Rationale

- enterprise environments usually standardize on orchestrated runtime controls
- Kubernetes gives the template a neutral production shape without forcing a single cloud vendor
- Kustomize keeps the baseline readable and digest-promotion-friendly without chart abstraction overhead
- readiness, autoscaling, disruption budgets, and network policy belong in the baseline

## Consequences

- more deployment assets to maintain
- more documentation needed for secrets, migrations, and ingress
- clearer separation between local convenience and production-grade operations
