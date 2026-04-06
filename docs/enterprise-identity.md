# Enterprise Identity Guide

## Purpose

This template now supports an enterprise-first access model:

- OIDC Authorization Code + PKCE
- SAML SP-initiated login
- SCIM 2.0 user and group provisioning
- audited break-glass local login
- owner step-up confirmation for privileged admin changes

The production posture is provider-first. Local email/password remains for bootstrap, local development, and explicit break-glass scenarios only.

For staging and production, the intended baseline is:

- OIDC configured and preferred as the default provider
- SAML enabled only when a customer or deployment requires it
- SCIM enabled only when lifecycle automation is required
- local password auth suppressed from the normal login UX

## Provider Model

The API stores active provider metadata in `IdentityProviderConfig` and synchronizes it from environment-backed configuration at startup.

Current template assumptions:

- single-tenant
- one active default enterprise provider is typical
- when OIDC is configured, it is the default provider for staging and production
- `owner` stays manual/local by design
- group mappings can assign `admin` and `member`

## OIDC

OIDC uses:

- discovery document lookup when explicit endpoints are not supplied
- Authorization Code + PKCE
- encrypted state and nonce
- issuer and audience validation through `jose`
- verified email-domain allowlisting

Environment inputs:

- `OIDC_PROVIDER_SLUG`
- `OIDC_PROVIDER_DISPLAY_NAME`
- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET` or `OIDC_CLIENT_SECRET_FILE`
- optional explicit endpoint overrides
- `OIDC_VERIFIED_DOMAINS`
- `OIDC_GROUP_ROLE_MAPPINGS`
- `ENTERPRISE_DEFAULT_PROVIDER_SLUG`

Recommended production posture:

- configure OIDC first
- set `ENTERPRISE_DEFAULT_PROVIDER_SLUG` to the OIDC provider slug
- use local auth only for bootstrap and audited recovery

## SAML

SAML is supported, but it is optional in the baseline. Enable it only when a
target enterprise deployment requires SAML instead of OIDC.

SAML uses:

- SP-initiated redirect flow
- encrypted relay state
- XML signature verification against the configured IdP certificate
- issuer, audience, time-window, and claim extraction checks
- verified email-domain allowlisting

Environment inputs:

- `SAML_PROVIDER_SLUG`
- `SAML_PROVIDER_DISPLAY_NAME`
- `SAML_SSO_URL`
- `SAML_ENTITY_ID`
- `SAML_CERTIFICATE_PEM` or `SAML_CERTIFICATE_PEM_FILE`
- `SAML_VERIFIED_DOMAINS`
- `SAML_GROUP_ROLE_MAPPINGS`

## SCIM

SCIM is optional and should be enabled only when the deployment needs automated
joiner/mover/leaver provisioning or group synchronization.

SCIM endpoints live under `/api/scim/v2`.

Supported baseline operations:

- `GET /Users`
- `POST /Users`
- `PUT /Users/:id`
- `DELETE /Users/:id`
- `GET /Groups`
- `POST /Groups`
- `PUT /Groups/:id`

Provisioning behavior:

- enterprise identities are linked through `UserIdentity`
- groups are stored in `UserGroup`
- memberships are synchronized in `UserGroupMembership`
- mapped roles come from `GroupRoleMapping`
- deactivation disables the local user instead of hard-deleting it

The template guards SCIM with a bearer token loaded from `SCIM_BEARER_TOKEN` or `SCIM_BEARER_TOKEN_FILE`.

## Break-Glass

Break-glass is controlled through:

- `BREAK_GLASS_LOCAL_LOGIN_ENABLED`

Behavior:

- disabled by default outside local/test
- owner-only in the current template
- always audited
- intended for emergency recovery when the external IdP is unavailable

Route:

- `POST /api/auth/break-glass/login`

Operational posture:

- break-glass is not the normal login path
- the login UI should expose it only through an explicit operator-controlled mode
- recovery guidance should live in the incident runbook, not in ordinary end-user instructions
- the documented operator entry point is `/login?mode=break-glass`

## Owner Step-Up

Privileged owner actions now require a fresh confirmation window.

Current implementation:

- route: `POST /api/auth/step-up`
- local owner password re-check
- short-lived `stepUpAt` marker stored on the session
- admin role changes reject with `step_up_required` when the window is missing or expired

The owner step-up window is controlled by `OWNER_STEP_UP_WINDOW_MS`.

## User Linking Rules

The template links enterprise users in this order:

1. existing `UserIdentity` by provider + external subject
2. existing local user by verified email
3. new local user creation

Role mapping rules:

- existing `owner` stays `owner`
- mapped groups can assign `admin`
- everyone else defaults to `member`

## Audit And Access Policy Events

Enterprise identity emits both audit logs and access-policy events for:

- provider startup sync
- SSO login success
- SCIM user/group provisioning
- group-role application
- break-glass login
- owner step-up completion

These records are intended to support operator review and downstream compliance evidence.
