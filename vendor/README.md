## Vendored Security Patches

This directory contains temporary vendored copies of upstream Nest packages
whose published manifests still pin vulnerable transitive dependencies.

- `nestjs-config`
  - source: `@nestjs/config@4.0.3`
  - patched dependency: `lodash` `4.18.1`
- `nestjs-swagger`
  - source: `@nestjs/swagger@11.2.6`
  - patched dependencies: `lodash` `4.18.1`, `path-to-regexp` `8.4.2`

The repo installs these patches from committed local tarballs:

- `nestjs-config-4.0.3.tgz`
- `nestjs-swagger-11.2.6.tgz`

The tarballs avoid the relative-symlink behavior of `file:` directory
dependencies, which breaks Linux and Docker builds.

Only package manifests were changed. The built runtime files in `dist/` are the
upstream package contents.

Remove these vendored packages once upstream releases versions that include the
same dependency fixes.
