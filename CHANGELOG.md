
# Changelog

This package strictly follows [Semantic Versioning](https://semver.org).

## v2.0.0 (2026-10-24)

### Breaking Changes

  * Removed support for Node.js versions older than 22.18.
  * The search path is now only set for connections of pools created by a `Pg` object itself,
    `new Pg(pg, {searchPath: [...]})` no longer changes the search path of the shared pool.

### Bug Fixes

  * Fixed a bug where TypeScript applications needed to install `@types/pg` themselves.
  * Fixed a bug where the search path was set without waiting for it, causing a `DeprecationWarning` with `pg` 8.23
    when the first query of a new connection overlapped with it.

## v1.2.0 (2023-11-10)

### Features

  * Added support for explicit resource management for TypeScript with `await using` to `Pg`, `Database` and
    `Transaction` classes.

## v1.1.0 (2022-08-09)

### Features

  * Extracted SQL generation features into [@mojojs/sql](https://www.npmjs.com/package/@mojojs/sql).

## v1.0.0 (2022-08-04)

First major release.
