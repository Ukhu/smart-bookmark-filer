# Proposal

## Why

The project currently has no source scaffold, package metadata, version-control setup, or shared development conventions. Establishing a small, consistent foundation now will make the Chrome extension straightforward to navigate, develop, test, and evolve without mixing setup decisions into the bookmark-filing implementation.

## What Changes

- Initialize the project as a Git repository with appropriate ignore rules.
- Scaffold a pnpm-managed WXT project using TypeScript and Manifest V3 conventions.
- Establish a directory structure that keeps browser entrypoints thin and separates feature, infrastructure, and shared code.
- Configure formatting, linting, type checking, unit testing, development, build, and packaging commands.
- Add foundational documentation covering prerequisites, common commands, and project organization.
- Keep the scaffold intentionally minimal: no bookmark detection, OpenAI integration, filing behavior, or unnecessary UI framework is included.

## Capabilities

### New Capabilities

None. This change establishes development tooling and repository structure without adding product behavior.

### Modified Capabilities

None.

## Impact

- Introduces Git metadata and root-level project configuration.
- Adds Node.js development dependencies managed by pnpm, including WXT, TypeScript, linting, formatting, and test tooling.
- Establishes the source and test locations that later bookmark-filing changes will extend.
- Adds a minimal loadable extension scaffold solely to verify the development and production toolchains.
