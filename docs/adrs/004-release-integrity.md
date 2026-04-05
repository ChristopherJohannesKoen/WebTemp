# ADR 004: Release Integrity And Supply Chain Controls

## Status

Accepted

## Decision

The template adds release-integrity workflows for:

- dependency review on pull requests
- SBOM generation
- image vulnerability scanning
- provenance attestation

## Rationale

- enterprise readiness requires evidence about what was built and what was shipped
- application security is incomplete without artifact-level visibility
- these controls fit naturally in the repo and CI layer

## Consequences

- release workflows are heavier than code-only CI
- artifact publication and attestation need platform credentials
- teams gain a practical baseline for large-enterprise security reviews
