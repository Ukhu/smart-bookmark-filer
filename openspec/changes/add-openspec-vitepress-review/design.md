# Design

## Context

The repository uses pnpm and Node.js 24, and its OpenSpec planning home contains active changes, archived changes, and eventually durable capability specs. OpenSpec requires those documents to remain in their existing Markdown locations and formats. See `proposal.md` for the review problem this viewer addresses.

VitePress resolves configuration from the project root and can use `openspec/` as its Markdown source directory. Keeping that source inside the VitePress project root avoids unsupported external-source layouts while allowing OpenSpec and VitePress to read the same files directly.

## Goals / Non-Goals

**Goals:**

- Present every OpenSpec Markdown artifact through a readable local browser interface.
- Derive navigation from the current OpenSpec directory structure instead of maintaining a second manual inventory.
- Make active work prominent while retaining access to durable specs and archived history.
- Keep the viewer isolated from extension runtime code and OpenSpec's artifact processing.
- Integrate viewer configuration into the repository's existing formatting and validation conventions.

**Non-Goals:**

- Hosting, deployment, remote access, or committing generated HTML.
- Editing OpenSpec artifacts from the browser.
- Replacing OpenSpec Markdown, interpreting OpenSpec semantics independently, or changing archive/sync behavior.
- Building a custom VitePress theme or an OpenSpec-specific application backend.

## Decisions

### Use stable VitePress with the default theme

Pin VitePress 1.6.4 as a development dependency and use its default theme, local search provider, appearance toggle, live development reload, and heading outline. This provides the desired review experience with minimal project-owned UI code.

Alternatives considered:

- A zero-configuration Markdown server is lighter, but provides a filesystem browser rather than the intentional review hierarchy and search experience desired here.
- A custom viewer would offer richer OpenSpec-specific behavior but would add routing, rendering, security, and maintenance work that is unnecessary for personal review.
- VitePress 2 is pre-release and does not justify adopting alpha behavior for this small tool.

### Use the repository as the VitePress root and `openspec/` as `srcDir`

Place VitePress configuration in `.vitepress/config.mts`, run VitePress with the repository root, and configure `srcDir: './openspec'`. Add `openspec/index.md` as a minimal landing page. OpenSpec ignores this root-level page, while VitePress receives a valid `/` route without copying or generating planning documents.

An isolated viewer root with `openspec/` outside its project root was rejected because external `srcDir` layouts have known VitePress build and resolution problems. Copying or symlinking artifacts into a viewer directory was rejected because it introduces stale or duplicate content.

### Generate navigation from the filesystem at configuration load

The VitePress configuration will scan only Markdown files under these OpenSpec areas:

- Active change directories directly under `openspec/changes/`, excluding `archive/`
- Durable capabilities under `openspec/specs/`
- Archived changes under `openspec/changes/archive/`

Navigation will use human-readable labels derived from path segments. Within each change, pages will be ordered as proposal, capability specs, design, and tasks. Active changes and durable specs will be expanded; archived changes will be grouped and collapsed. Entries and groups will be sorted deterministically where workflow ordering does not apply.

The scan will use Node filesystem APIs directly rather than adding a navigation plugin. Artifact content edits will live-reload; newly created, moved, or archived files may require restarting the viewer so configuration-derived navigation is rebuilt.

### Keep the server local and development-only

Add an `openspec:review` package script that starts `vitepress dev . --open`. VitePress's default localhost binding will be retained, and no build, preview, or deployment script will be added. The `.vitepress/cache/` and `.vitepress/dist/` directories will be ignored so accidental local output is not committed.

### Include viewer files in repository checks

Extend the existing formatting script globs to cover `.vitepress/**/*` and `openspec/index.md`. ESLint already scans repository JavaScript and TypeScript outside its ignored directories, so the configuration should pass the existing lint command. Verification will include repository validation plus a focused viewer startup check that confirms the landing page and representative active/archive artifact routes respond.

## Risks / Trade-offs

- [Navigation does not update when OpenSpec files are created or moved while the server is running] -> Document that structural changes require restarting `pnpm openspec:review`; ordinary content edits continue to live-reload.
- [VitePress interprets Markdown with Vue-aware extensions that OpenSpec does not] -> Keep OpenSpec files unchanged and verify all existing artifacts render; avoid viewer-only syntax in canonical artifacts.
- [Path-derived labels can be less descriptive than document headings] -> Convert kebab-case path segments to title case and use stable artifact labels such as Proposal, Design, and Tasks.
- [A VitePress dependency adds a second Vite version alongside WXT] -> Keep it development-only and pin the version; pnpm isolates incompatible transitive versions.
- [The viewer could accidentally become reachable beyond the local machine] -> Preserve VitePress's localhost default and do not add a host override.

## Migration Plan

1. Add the pinned VitePress dependency and local review command.
2. Add the configuration, generated-navigation logic, landing page, formatting coverage, and ignore entries.
3. Validate rendering against the repository's current active and archived OpenSpec artifacts.
4. Roll back by removing the viewer dependency, script, configuration, landing page, and ignore entries; no OpenSpec artifacts or application data require migration.
