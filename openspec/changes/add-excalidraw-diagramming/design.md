# Design

## Context

The repository already carries project-scoped OpenCode commands and skills under `.opencode/`, but it has no `opencode.json(c)`, diagram tooling, or `docs/` directory. OpenCode V2 expects local MCP servers under `mcp.servers`, while the selected Excalidraw workbench can expose the same local canvas through MCP and a CLI. Node.js 24 is already a project prerequisite and satisfies the workbench's Node.js 20 minimum. See `proposal.md` for motivation and `specs/agent-diagramming/spec.md` for required behavior.

The official Excalidraw MCP is optimized for an interactive MCP App embedded in compatible chat clients. The coding-agent use case instead needs element-level updates, scene descriptions, screenshots, editable file import/export, and a live local canvas.

## Goals / Non-Goals

**Goals:**

- Make the integration reproducible from project-owned OpenCode configuration.
- Give agents both direct canvas tools and task guidance for a draw-inspect-correct-export loop.
- Keep transient canvas state local while treating exported `.excalidraw` files as the durable source of truth.
- Pin the third-party package version so a new upstream release cannot silently change tool behavior.
- Make local-only and optional external network behavior visible to users and agents.

**Non-Goals:**

- Add diagram generation to the Chrome extension or its production dependencies.
- Operate a shared, remotely reachable, or authenticated canvas service.
- Automatically keep diagrams synchronized with source changes.
- Require every feature to have a diagram.
- Build or maintain a custom Excalidraw server.

## Decisions

### Use the coding-agent Excalidraw workbench rather than the official MCP App

Use the MIT-licensed `mcp-excalidraw-server` package, pinned initially to `2.1.2`. It provides element CRUD, structured scene inspection, headless screenshots, editable import/export, and a browser-visible loopback canvas, which directly support the required iterative workflow.

The official `excalidraw/excalidraw-mcp` was rejected for this change because its primary output is an MCP App view and it does not provide the same repository-artifact and iterative scene-inspection workflow. Building a custom integration was rejected because it would duplicate maintained canvas, rendering, and MCP functionality.

### Configure MCP at project scope using OpenCode V2 syntax

Add a root `opencode.jsonc` with an `mcp.servers.excalidraw` local server whose command runs the exact pinned package through `npx`. Do not use the package README's older `mcp.excalidraw`/`enabled` example; OpenCode V2 nests named servers under `mcp.servers` and treats an absent `disabled` field as enabled.

Keep OpenCode's default Code Mode behavior so the server's large tool catalog does not permanently occupy the model's native tool list. The MCP process and canvas inherit the project working directory, allowing exports to be constrained to the repository. Legacy MCP initialization is sufficient because the server supports it; no forced protocol revision is needed.

A global MCP registration was rejected because the user selected project-only scope. CLI-only operation was rejected as the sole integration because direct MCP discovery gives agents typed, purpose-specific tools; the CLI remains useful to the bundled skill and for verification.

### Vendor project-local drawing guidance

Install the package's `excalidraw-skill` into `.opencode/skills/`, then review and adapt it for this repository. Preserve the exact `SKILL.md` filename required by OpenCode. Pin command examples to the selected package version and add project-specific rules:

- inspect relevant source and design artifacts before drawing;
- plan the diagram's information hierarchy before creating elements;
- inspect scene structure and a rendered image, then correct defects;
- export durable sources to `docs/diagrams/`;
- update existing editable sources rather than redrawing from previews;
- never invoke external sharing without an explicit user request.

Referencing an unversioned remote skill was rejected because it would not be reviewable or reproducible. Writing only a short custom prompt was rejected because the upstream skill already captures tool-specific layout and verification practices.

### Make diagramming an exploration instrument, not a separate workflow phase

Adapt the project-local `/opsx-explore` guidance so it may invoke the Excalidraw skill when a visual model would help the user and agent investigate architecture, compare alternatives, or clarify a proposal. The exploration stance remains in control: the agent continues asking grounded questions, challenging assumptions, and inspecting relevant project context while the diagram skill supplies canvas-specific operations.

Treat local in-memory canvas mutations as transient exploratory state rather than implementation or repository file changes. An explicit user request to create or revise a diagram authorizes that transient drawing session, including repeated describe-render-correct cycles. It does not authorize an export, a hosted share, an OpenSpec artifact edit, or any other repository change.

Before persisting a diagram, the agent must identify the proposed `.excalidraw` source and any preview files, explain that they will become durable repository artifacts, and obtain explicit user approval. Capturing resulting decisions in `proposal.md`, `design.md`, specs, or tasks remains a separate action governed by the existing exploration confirmation rules. This allows visual thinking to remain fluid without silently converting a sketch into project state.

A workflow that forces users to leave `/opsx-explore` before drawing was rejected because it discards the constructive discovery instructions that make the visual iteration useful. Automatically exporting every exploratory canvas was rejected because early sketches may be incomplete, misleading, or disposable.

### Treat `.excalidraw` as source and rendered images as review artifacts

Create `docs/diagrams/` with a short README that defines naming and lifecycle conventions. The editable `.excalidraw` file is authoritative. A PNG or SVG with the same basename may be committed when it improves repository browsing or documentation, but agents must update it from the editable source.

Do not enable durable canvas-server state initially. In-memory state avoids generated runtime files in the repository, and explicit export makes persistence intentional and reviewable. A persistent data directory can be added later if repeated loss of unexported work proves problematic.

Storing only rendered images was rejected because agents and humans could not reliably continue editing them. Treating server snapshots as durable artifacts was rejected because default snapshots disappear with in-memory server state.

### Keep the service loopback-only and gate external sharing

Use the package's default `127.0.0.1` binding and do not set `HOST=0.0.0.0`. Document that the local API has no authentication and must not be exposed to the network. Normal creation, inspection, headless rendering, import, and export remain local; the canvas browser may fetch fonts from its documented CDN, while the optional share command uploads encrypted scene data. The skill must require explicit user intent before sharing.

Fully self-hosting fonts or the share backend was rejected as unnecessary for the current local development workflow. Claiming fully offline browser operation was rejected because the selected version's canvas UI fetches fonts from a CDN, although headless rendering uses bundled fonts.

### Validate both connection and behavior

Validation will check that OpenCode recognizes the project MCP server and that a temporary smoke scene can complete this cycle:

```text
start/connect --> create two labeled shapes --> connect them
      --> describe --> render --> export --> verify artifacts
```

The smoke output should use an approved temporary directory rather than `docs/diagrams/`, so validation does not leave a sample artifact that could be mistaken for project architecture. Documentation validation should also search for unpinned package invocations and outdated OpenCode MCP syntax.

## Risks / Trade-offs

- **[A third-party package executes through `npx`]** -> Pin an exact reviewed version, keep configuration project-local, and document an explicit review-and-upgrade procedure.
- **[The first run requires package-registry access]** -> Document the requirement and the resulting local cache; report startup failure rather than claiming diagram completion.
- **[The copied skill can drift from the package]** -> Record its upstream package version and update the config and skill together after reviewing upstream changes.
- **[The default canvas is in-memory]** -> Make `.excalidraw` export part of the completion workflow and clearly identify unexported state as temporary.
- **[Port 3000 may already be occupied]** -> Include status and health diagnostics and document how to select a loopback alternative consistently if needed.
- **[Large MCP catalogs consume agent context]** -> Retain OpenCode's default Code Mode grouping rather than exposing all tools directly.
- **[Manual browser edits and agent state can diverge]** -> Instruct users and agents to synchronize and export before closing, and re-import the saved source when resuming.

## Migration Plan

1. Add the project-local OpenCode V2 MCP configuration with the exact pinned package version.
2. Install and adapt the matching project-local Excalidraw skill.
3. Add `docs/diagrams/` conventions and README setup/troubleshooting guidance.
4. Verify OpenCode server discovery and run the temporary draw-inspect-render-export smoke test.
5. Restart or reload OpenCode as needed so the new project configuration and skill are discovered.

Rollback removes the project MCP server entry, the vendored Excalidraw skill, and diagramming documentation. Existing `.excalidraw` files remain standard editable artifacts and do not require migration.
