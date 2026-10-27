# Proposal

## Why

OpenSpec artifacts are currently reviewed as raw Markdown files, which makes moving between active changes, durable specifications, and archived changes cumbersome. A local VitePress viewer would provide a more readable, searchable review experience without changing OpenSpec's Markdown source of truth.

## What Changes

- Add a local-only VitePress site that reads pages directly from `openspec/`.
- Generate review navigation from active changes, durable specifications, and archived changes, with archives collapsed by default.
- Provide local search, live reload, heading outlines, and light/dark appearance through the VitePress default theme.
- Add a minimal OpenSpec review landing page and a pnpm command that starts the viewer and opens it in the browser.
- Keep deployment, hosted publishing, generated HTML, and changes to OpenSpec artifact formats out of scope.

## Capabilities

### New Capabilities

None. This is a development-tooling and documentation presentation change with no product behavior change.

### Modified Capabilities

None.

## Impact

- Adds VitePress as a development dependency and updates `pnpm-lock.yaml`.
- Adds repository-local VitePress configuration, including filesystem-derived navigation.
- Adds `openspec/index.md`, an OpenSpec-ignored landing page used by VitePress.
- Adds a package script for starting the local review server and ignores VitePress cache/build output.
- Does not affect the Chrome extension runtime, OpenSpec validation, sync, archive behavior, or artifact contents.
