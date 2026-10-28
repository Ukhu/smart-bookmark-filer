# Tasks

## 1. Project-local OpenCode integration

- [ ] 1.1 Add root `opencode.jsonc` using OpenCode V2 `mcp.servers` syntax to launch `mcp-excalidraw-server@2.1.2` on loopback with repository-scoped exports, and verify `opencode mcp list` reports the project server as connected without changing user-global configuration
- [ ] 1.2 Install the matching upstream `excalidraw-skill` under `.opencode/skills/`, record its upstream version, and verify OpenCode discovers its `SKILL.md` from this repository
- [ ] 1.3 Adapt the project skill to pin every package invocation, require source/design inspection plus a describe-and-render correction loop, export durable files under `docs/diagrams/`, and gate external sharing; verify searches find no unversioned invocation or unconditional share instruction
- [ ] 1.4 Document installation, first-run registry access, canvas startup, loopback security, MCP status checks, port-conflict diagnostics, package/skill upgrades, and rollback in `README.md`, and verify every documented command matches the project configuration

## 2. Durable diagram artifacts

- [ ] 2.1 Add `docs/diagrams/README.md` defining `.excalidraw` as the editable source of truth, same-basename PNG/SVG preview conventions, camelCase diagram naming, re-import-before-edit behavior, and temporary versus committed artifacts; verify the directory and guidance are present
- [ ] 2.2 Extend formatting or convention coverage to include the new root JSONC and diagram documentation where appropriate, and verify `pnpm format:check` plus `pnpm check:conventions` pass without rewriting vendored tool-required filenames
- [ ] 2.3 Exercise the documented continuation workflow by exporting a temporary editable scene, importing it, making a visible revision, and rendering it again; verify the revised source remains editable and the preview reflects the revision

## 3. Integration verification

- [ ] 3.1 Run a temporary smoke cycle that connects to the project MCP server, creates two labeled shapes and a bound arrow, describes the scene, renders a preview, and exports editable source; verify all expected elements and temporary artifacts exist without adding smoke outputs to `docs/diagrams/`
- [ ] 3.2 Confirm the canvas listens only on loopback and complete the documented no-sharing workflow; verify no hosted share URL is created and startup/export failures are reported rather than presented as success
- [ ] 3.3 Run `pnpm validate` and `openspec validate add-excalidraw-diagramming --strict`, and resolve every failure before marking the change implementation complete
