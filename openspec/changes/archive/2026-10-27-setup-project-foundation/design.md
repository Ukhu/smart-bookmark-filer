# Design

## Context

The repository currently contains only OpenSpec and OpenCode workflow files. There is no Git metadata, package manifest, application source, test harness, or build configuration. The local environment already provides Git, Node.js 24, Corepack, and pnpm 11. See `proposal.md` for the motivation and scope.

This foundation must support a Manifest V3 Chrome extension whose later architecture will include a background entrypoint, configuration UI, browser integrations, and an OpenAI adapter. This change must prepare for those modules without implementing or prematurely scaffolding their behavior.

## Goals / Non-Goals

**Goals:**

- Use established WXT conventions so extension entrypoints, generated artifacts, and browser-specific commands are recognizable to contributors familiar with WXT.
- Make package installation and command execution reproducible through a committed pnpm lockfile and pinned package-manager declaration.
- Provide one-command development, validation, testing, production build, and packaging workflows.
- Define module boundaries that keep browser lifecycle code separate from application and provider logic as those areas are introduced.
- Keep the initial scaffold loadable and buildable while minimizing placeholder code and directories.

**Non-Goals:**

- Implement bookmark permissions, listeners, classification, movement, options, storage, or OpenAI calls.
- Add a UI framework, component library, backend service, environment-secret system, or multi-package workspace.
- Support browsers other than Chrome in the first foundation, even though WXT may make later support possible.
- Establish release automation or Chrome Web Store publishing.

## Decisions

### Use a single pnpm package

The extension will start as one package rather than a monorepo. `package.json` will declare the package manager version, Node compatibility, project scripts, and private package status; `pnpm-lock.yaml` will be committed.

A monorepo was considered but rejected because there is currently one deliverable and no shared package or backend. Workspace boundaries can be introduced later if a second independently built component appears.

### Use WXT with TypeScript and no UI framework

The scaffold will use WXT's TypeScript-oriented, framework-free setup. WXT will own extension manifest generation, development loading, production output, and zip packaging. TypeScript will use strict checking and WXT-generated browser types.

A hand-built Vite setup was rejected because it would require maintaining extension manifest and packaging behavior. React or another UI framework is deferred until a UI demonstrates enough state or component complexity to justify it.

### Follow WXT entrypoint conventions and add domain boundaries as needed

The repository will retain WXT's conventional root-level `entrypoints/` and `public/` locations instead of adding a custom source-root override. A minimal background entrypoint will prove that the extension can load, but it will contain no bookmark behavior.

As product code is added, it will follow these boundaries:

```text
entrypoints/       Browser lifecycle and UI entrypoints; keep thin
features/          Product workflows grouped by feature
infrastructure/    Chrome APIs, persistence, and external provider adapters
shared/            Small domain-neutral types and utilities
public/            Static extension assets
```

Directories will be created only when they contain real code; empty placeholder trees will not be committed. Tests will be colocated with the modules they exercise using `*.test.ts`, while any cross-module fixtures may live under `tests/` when needed.

An undifferentiated `src/` tree and technical folders such as `services/` were considered but rejected because they obscure WXT conventions or tend to accumulate unrelated responsibilities.

### Separate fast tools by responsibility and provide a single validation command

- ESLint will enforce TypeScript and import/code-quality rules using flat configuration.
- Prettier will own formatting, avoiding stylistic duplication in ESLint.
- TypeScript will perform strict static type checking without emitting files.
- Vitest will run unit tests in a Node environment by default.
- A top-level validation script will run formatting checks, linting, type checking, and tests for local and future CI use.

Tests that later require Chrome APIs will use explicit mocks rather than a browser-like test environment for every test. End-to-end extension testing is deferred until meaningful behavior exists.

### Keep generated and sensitive files out of version control

Git ignore rules will cover dependencies, WXT preparation and output directories, coverage, logs, local environment files, and common editor or operating-system artifacts. OpenSpec and OpenCode project files remain tracked. The initial repository history will not contain credentials; later API keys will be stored by the running extension rather than in repository files.

### Document the supported workflow at the repository root

`README.md` will identify the project as a personal Chrome extension, list prerequisites, document pnpm commands, explain how to load development and production builds, and describe the intended module boundaries. Tool-specific configuration should remain in its native configuration file rather than being duplicated in documentation.

## Risks / Trade-offs

- **[Tooling overhead exceeds the initial code size]** -> Keep configuration minimal and use standard presets rather than extensive custom rule sets.
- **[Latest dependency releases are incompatible with Node.js 24 or each other]** -> Resolve a compatible set during scaffolding, record it in the lockfile, and verify all commands from a clean install.
- **[A minimal background entrypoint is mistaken for product behavior]** -> Keep it behavior-free and document that bookmark filing belongs to a later change.
- **[Proposed module boundaries become speculative]** -> Create only directories required by current files and treat the documented boundaries as guidance that may evolve with concrete features.
- **[Direct use of generated WXT configuration makes type checking order-sensitive]** -> Include WXT's preparation command in installation/setup scripts and validate from a clean checkout.

## Migration Plan

1. Initialize Git without creating a commit so the user retains control over repository history.
2. Scaffold WXT into the existing repository without replacing the `openspec/` or `.opencode/` directories.
3. Normalize package metadata, TypeScript settings, and pnpm configuration.
4. Add quality tools, scripts, ignore rules, and documentation.
5. Run a clean dependency installation followed by formatting, linting, type checking, tests, production build, and packaging.

If the scaffold cannot be validated, remove only files introduced by this change and retain the existing OpenSpec and OpenCode files. No user data or runtime migration is involved.
