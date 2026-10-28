# Proposal

## Why

Architecture and program-design discussions currently rely on prose and static text diagrams, which makes relationships harder to inspect and keep current while a feature evolves. A project-local Excalidraw integration would let users and OpenCode agents create, inspect, and refine diagrams together during exploration, then deliberately save useful diagrams alongside the repository without requiring a hosted diagramming service.

## What Changes

- Add a project-local OpenCode connection to a pinned Excalidraw canvas toolkit running on loopback.
- Add project-local agent guidance for creating diagrams, inspecting rendered results, correcting layout issues, and exporting editable source.
- Integrate that guidance with `/opsx-explore` so visual iteration retains its constructive discovery stance instead of requiring a separate, less-guided session.
- Distinguish transient exploratory canvas work from durable repository artifacts: drawing and revision may remain in local canvas state, while export requires explicit user approval.
- Establish a repository convention for durable `.excalidraw` sources and rendered previews under `docs/diagrams/`.
- Document setup, operation, artifact persistence, privacy boundaries, and package-upgrade steps.
- Add lightweight validation or smoke-test instructions that confirm OpenCode can reach the local canvas and complete a draw-inspect-export cycle.

## Capabilities

### New Capabilities

- `agent-diagramming`: Project-local agent creation, iterative inspection, and durable export of editable architecture and program-design diagrams through a local Excalidraw canvas.

### Modified Capabilities

None.

## Impact

- Adds project-owned OpenCode configuration and an Excalidraw agent skill under `.opencode/`.
- Introduces a pinned development-tool dependency executed locally through Node.js and OpenCode MCP/CLI integration.
- Adds documentation and a `docs/diagrams/` convention; generated transient canvas state remains outside version control.
- Does not alter extension runtime code, browser permissions, production bundles, or bookmark-filing behavior.
