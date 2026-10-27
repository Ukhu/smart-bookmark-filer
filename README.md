# Smart Bookmark Filer

Smart Bookmark Filer is a personal Chrome extension intended to organize newly
created bookmarks automatically. The current scaffold contains no bookmark
filing or external API behavior; it establishes the development toolchain for
that later work.

## Prerequisites

- Node.js 24 or newer
- pnpm 11.24.0 (the version pinned in `package.json`)
- Google Chrome for loading the extension

Install dependencies with:

```sh
pnpm install --frozen-lockfile
```

Installation runs WXT's preparation hook and generates local TypeScript support
files under `.wxt/`.

## Commands

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `pnpm dev`          | Start WXT's Chrome development build in watch mode  |
| `pnpm build`        | Create a production Chrome build                    |
| `pnpm zip`          | Create a production Chrome build and zip package    |
| `pnpm format`       | Format project source and configuration files       |
| `pnpm format:check` | Check formatting without changing files             |
| `pnpm lint`         | Run ESLint                                          |
| `pnpm typecheck`    | Run strict TypeScript checks without emitting files |
| `pnpm test`         | Run colocated unit tests in Node                    |
| `pnpm validate`     | Run formatting, linting, type checking, and tests   |

## Load the Development Build

1. Run `pnpm dev` and leave it running while developing.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose `.output/chrome-mv3-dev`.
5. After source changes, let WXT rebuild and reload the extension if Chrome
   does not pick up the update automatically.

WXT does not launch a separate browser profile for this project; the generated
development extension is loaded manually into Chrome.

## Load a Production Build

1. Run `pnpm build`.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Select **Load unpacked** and choose `.output/chrome-mv3`.

Run `pnpm zip` when a packaged artifact is needed. WXT writes the zip file to
`.output/`. All `.output/` contents are generated and ignored by Git.

## Project Boundaries

- `entrypoints/`: thin browser lifecycle and UI entrypoints
- `features/bookmark-filing/`: filing workflow, feature-owned ports, and domain
  types
- `infrastructure/bookmarks/`: Chrome bookmark-tree and bookmark-event adapters
- `infrastructure/storage/`: Chrome local-storage adapters
- `infrastructure/openai/`: direct OpenAI classification adapter
- `shared/`: small domain-neutral types and utilities
- `public/`: static extension assets

Directories are added only when they contain real code. Unit tests are colocated
with the modules they cover as `*.test.ts`; shared fixtures may be added under
`tests/` when needed. Feature code depends on feature-owned interfaces rather
than infrastructure implementations. Entrypoints may compose the feature but
must not import OpenAI or storage implementation details directly; ESLint
enforces both dependency rules.
