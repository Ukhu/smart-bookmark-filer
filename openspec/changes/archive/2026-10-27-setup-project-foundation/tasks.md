# Tasks

## 1. Repository and WXT Scaffold

- [x] 1.1 Initialize Git without creating a commit, add project-appropriate ignore rules for dependencies, WXT outputs, coverage, logs, local environment files, editor files, and OS files, and verify `git status --ignored` keeps `openspec/` and `.opencode/` trackable while generated or sensitive paths are ignored.
- [x] 1.2 Scaffold a framework-free WXT TypeScript extension into the existing repository without replacing OpenSpec or OpenCode files, add a behavior-free background entrypoint, and verify the WXT development command starts and emits a loadable Chrome development build.
- [x] 1.3 Configure the project as a private single pnpm package with a pinned package-manager declaration, supported Node version, WXT preparation hook, and committed lockfile; verify a frozen install succeeds after removing generated dependency state.

## 2. Static Analysis and Test Tooling

- [x] 2.1 Configure strict TypeScript checking against WXT's generated types and add a non-emitting type-check command; verify the command succeeds after WXT preparation.
- [x] 2.2 Add minimal ESLint flat configuration and Prettier configuration with non-overlapping responsibilities, expose lint, format, and format-check commands, and verify linting and formatting checks pass across tracked source and configuration files.
- [x] 2.3 Configure Vitest for Node-based colocated unit tests, add a test command that succeeds for the behavior-free scaffold, and verify Vitest exits successfully without requiring browser globals or a DOM environment.
- [x] 2.4 Add a single validation command that runs formatting checks, linting, type checking, and unit tests, and verify it fails when any constituent command fails and succeeds on the clean scaffold.

## 3. Build Workflow and Documentation

- [x] 3.1 Add production build and Chrome zip-package commands using WXT, then verify both commands succeed and place only generated artifacts in ignored output directories.
- [x] 3.2 Create `README.md` documenting the personal-extension scope, prerequisites, pnpm commands, Chrome development loading flow, production build loading flow, and planned module boundaries; verify every documented command matches `package.json` and runs as described.
- [x] 3.3 Run a clean-install integration check followed by the validation, production build, and packaging commands; verify the extension manifest and background worker are present in the generated Chrome artifact and `git status` contains no generated output or credential files.
