# Security Policy

## Supported Versions

This repository is maintained against the `main` branch.

| Version                     | Supported |
| --------------------------- | --------- |
| `main`                      | Yes       |
| older commits and snapshots | No        |

## Reporting A Vulnerability

Do not open public issues for suspected security vulnerabilities.

Use GitHub's private vulnerability reporting for this repository when possible.
If private reporting is unavailable for any reason, contact the maintainer
directly and include:

- a clear description of the issue
- affected routes, pages, or files
- reproduction steps or a proof of concept
- impact assessment
- any suggested remediation

Please avoid public disclosure until the issue has been reviewed and a fix or
mitigation plan is in place.

## Response Expectations

Best effort targets:

- initial triage within 5 business days
- status update after reproduction or impact confirmation
- coordinated disclosure after remediation is available

## Scope

Security reports are especially relevant for:

- authentication and session handling
- CSRF, origin, and cookie protections
- role and authorization boundaries
- idempotency and state-changing endpoints
- dependency or supply-chain issues in shipped code

Out-of-scope items may still be accepted, but reports with a direct impact on
confidentiality, integrity, or availability will be prioritized first.
