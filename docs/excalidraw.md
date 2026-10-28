# Excalidraw Guide

This repository provides project-local Excalidraw support for OpenCode agents.
The connection is defined in `opencode.jsonc`, and its agent instructions are in
`.opencode/skills/excalidraw-skill/`. No user-global OpenCode configuration or
global npm package installation is required.

## Install and start

Clone the repository and run the normal `pnpm install --frozen-lockfile`
installation first. Then start OpenCode from the repository root. OpenCode reads
`opencode.jsonc` and launches the exact package version configured there:
`mcp-excalidraw-server@2.1.2`.

The first launch through `npx` requires access to the configured npm registry to
download version `2.1.2` if it is not already in the local npm cache. Later
launches can use that cache. A registry, DNS, proxy, or TLS failure means the MCP
server did not start; do not treat a missing or partial diagram as success.

OpenCode normally manages the MCP process. To start the same canvas explicitly
from the repository root, run:

```sh
HOST=127.0.0.1 PORT=3000 EXPRESS_SERVER_URL=http://127.0.0.1:3000 \
  npx -y mcp-excalidraw-server@2.1.2 start
```

The canvas is available at <http://127.0.0.1:3000>. Canvas-touching commands also
start it automatically. Opening the URL in a browser is optional for normal
agent drawing and headless rendering.

## Security and network boundary

The project configuration binds the unauthenticated canvas service to
`127.0.0.1`, not `0.0.0.0`. Keep it on loopback: do not expose port 3000 through
a public bind, port forward, tunnel, or reverse proxy. The configured export
directory is the repository root, while the project skill restricts durable
diagram exports to `docs/diagrams/`.

Normal drawing, inspection, rendering, import, and export remain local. The
browser canvas may fetch its fonts from a CDN. Creating an externally accessible
Excalidraw link is a separate operation that uploads encrypted scene data and
must only be performed after an explicit user request.

## Check the connection

Run these commands from the repository root:

```sh
opencode mcp list
npx -y mcp-excalidraw-server@2.1.2 status
curl --fail --silent --show-error http://127.0.0.1:3000/health
```

`opencode mcp list` should report `excalidraw` as connected. The CLI status and
health endpoint should report a reachable canvas. If startup, status, rendering,
or export fails, report that failure and the artifact that was not produced.

## Diagnose a port conflict

If the canvas cannot start or port 3000 is already in use, identify the listener
and check whether it is the expected canvas:

```sh
lsof -nP -iTCP:3000 -sTCP:LISTEN
curl --fail --silent --show-error http://127.0.0.1:3000/health
npx -y mcp-excalidraw-server@2.1.2 status
```

Stop the existing canvas cleanly with:

```sh
npx -y mcp-excalidraw-server@2.1.2 stop
```

The stop command identity-checks the service and does not terminate an unrelated
listener. If another application owns the port, stop or reconfigure that
application. Alternatively, choose another loopback port and update both `PORT`
and `EXPRESS_SERVER_URL` in `opencode.jsonc` to the same value, then restart
OpenCode. Use that same URL for standalone CLI diagnostics; for example, after
changing the configuration to port 3100:

```sh
HOST=127.0.0.1 PORT=3100 EXPRESS_SERVER_URL=http://127.0.0.1:3100 \
  npx -y mcp-excalidraw-server@2.1.2 status
```

Never solve a conflict by changing `HOST` to a non-loopback address.

## Upgrade the package and skill

Treat the MCP package, vendored skill, and documentation as one reviewed unit.
Do not use `latest` or an unversioned package invocation.

1. Review the target `mcp-excalidraw-server` release and choose an exact version.
2. Replace `2.1.2` in `opencode.jsonc` and every project-owned package command
   with that same exact version.
3. Install the matching skill into a temporary directory first. For the current
   pinned version, the review command is:

   ```sh
   review_dir="$(mktemp -d)"
   npx -y mcp-excalidraw-server@2.1.2 install-skill --dir "$review_dir"
   diff -ru .opencode/skills/excalidraw-skill \
     "$review_dir/excalidraw-skill"
   ```

4. Replace the vendored skill only after reviewing the diff. Reapply the project
   rules for source/design inspection, information hierarchy, repeated
   describe-and-render correction, `docs/diagrams/` exports, re-importing
   editable sources, and explicit approval before external sharing.
5. Update `.opencode/skills/excalidraw-skill/UPSTREAM.md` to record the exact new
   version and installation command.
6. Restart OpenCode, run the connection checks above, and complete a temporary
   draw-inspect-render-export smoke cycle before committing the upgrade.

`install-skill` replaces an existing copy, so running it directly against
`.opencode/skills/` without reviewing and reapplying the project adaptations can
silently remove required safeguards.

## Roll back diagramming support

1. Stop the local canvas with the pinned `stop` command above.
2. Revert the Excalidraw server entry in `opencode.jsonc`. Remove the file only
   if it has no other project configuration.
3. Revert `.opencode/skills/excalidraw-skill/` and the diagramming documentation.
4. Restart OpenCode and confirm `opencode mcp list` no longer lists the project
   `excalidraw` server.

Rollback does not require changing user-global OpenCode configuration because
the integration is project-local. Existing `.excalidraw` files are standard
editable documents and may remain in the repository.
