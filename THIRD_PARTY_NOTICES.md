# Third-Party Notices

This repository includes third-party materials that remain subject to their
original licenses. Those materials are not relicensed under this repository's
custom noncommercial license.

## Vendored Nest Security Patches

### `vendor/nestjs-config`

- upstream package: `@nestjs/config`
- upstream version: `4.0.3`
- source project: NestJS
- upstream license: `MIT`
- repository purpose: temporary vendored security patch for published manifest
  dependency constraints
- local modifications: package-manifest dependency updates only
- runtime code status: upstream build output retained

Included repository materials:

- `vendor/nestjs-config/`
- `vendor/nestjs-config-4.0.3.tgz`

License note:

- see `vendor/nestjs-config/LICENSE`

### `vendor/nestjs-swagger`

- upstream package: `@nestjs/swagger`
- upstream version: `11.2.6`
- source project: NestJS
- upstream license: `MIT`
- repository purpose: temporary vendored security patch for published manifest
  dependency constraints
- local modifications: package-manifest dependency updates only
- runtime code status: upstream build output retained

Included repository materials:

- `vendor/nestjs-swagger/`
- `vendor/nestjs-swagger-11.2.6.tgz`

License note:

- see `vendor/nestjs-swagger/LICENSE`

## How To Read These Notices

- The root [`LICENSE`](./LICENSE) applies to the original work owned by the
  maintainer.
- Third-party materials listed here remain governed by their own upstream
  licenses.
- Nothing in this repository claims exclusive ownership over third-party
  vendored materials.

## Dependency Inventory

Most runtime and development dependencies are installed through the package
manager and are not redistributed as repo-owned source files. For dependency
summary checks, see the repo's license-audit workflow and generated dependency
reports in CI.
