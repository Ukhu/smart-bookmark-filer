# Tasks

## 1. Viewer Setup

- [ ] 1.1 Add VitePress 1.6.4 as an exact development dependency, add `pnpm openspec:review` to run `vitepress dev . --open`, update `pnpm-lock.yaml`, and verify `pnpm install --frozen-lockfile` succeeds.
- [ ] 1.2 Ignore `.vitepress/cache/` and `.vitepress/dist/`, extend the format scripts to cover `.vitepress/**/*` and `openspec/index.md`, and verify `pnpm format:check` evaluates the new files without reporting unmatched paths.

## 2. OpenSpec Review Site

- [ ] 2.1 Add `.vitepress/config.mts` with `openspec/` as the source directory, the default theme, local search, appearance switching, and an outline through scenario headings; add the minimal `openspec/index.md` landing page and verify `pnpm exec vitepress build .` renders the root page successfully.
- [ ] 2.2 Implement deterministic filesystem-derived navigation for active changes, durable capability specs, and archived changes, ordering each change as proposal, specs, design, and tasks while collapsing archives; verify the generated site contains links for the current active changes and `2026-10-27-setup-project-foundation` archive and handles an absent or empty durable-spec directory.
- [ ] 2.3 Document `pnpm openspec:review`, localhost-only access, live content reload, and the need to restart after structural OpenSpec changes in `README.md`; verify the command and behavior described match the package script and VitePress configuration.

## 3. Integrated Verification

- [ ] 3.1 Start the viewer on an explicit local test port without opening a browser, verify the landing page plus representative active-change and archived-artifact routes return rendered HTML, stop the server, and then run `pnpm validate` successfully.
