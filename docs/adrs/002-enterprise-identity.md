# ADR 002: Enterprise Identity Baseline

## Status

Accepted

## Decision

The template adopts an enterprise-first identity model:

- OIDC Authorization Code + PKCE
- SAML SP-initiated login
- SCIM provisioning
- local auth only for bootstrap, local development, and break-glass

## Rationale

- enterprise customers expect SSO and provisioning as baseline capabilities
- local-password-only SaaS templates do not meet large-enterprise procurement expectations
- keeping `owner` manual/local avoids uncontrolled external elevation

## Consequences

- more environment and secret management complexity
- more audit and provisioning state in the data model
- stronger production posture and better enterprise adoption path
