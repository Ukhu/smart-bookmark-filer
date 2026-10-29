# Smart Bookmark Filer

Smart Bookmark Filer is a personal Chrome extension for organizing newly
created bookmarks. Its options page stores the local folder boundaries and
OpenAI settings used by automatic filing.

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

| Command                | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `pnpm dev`             | Start WXT's Chrome development build in watch mode  |
| `pnpm build`           | Create a production Chrome build                    |
| `pnpm zip`             | Create a production Chrome build and zip package    |
| `pnpm openspec:review` | Open the local OpenSpec review site                 |
| `pnpm format`          | Format project source and configuration files       |
| `pnpm format:check`    | Check formatting without changing files             |
| `pnpm lint`            | Run ESLint                                          |
| `pnpm typecheck`       | Run strict TypeScript checks without emitting files |
| `pnpm test`            | Run grouped unit tests in Node                      |
| `pnpm validate`        | Run formatting, linting, type checking, and tests   |

## Local Excalidraw Diagramming

This repository provides project-local Excalidraw support for OpenCode agents,
using a loopback-only canvas and pinned tooling. See the
[Excalidraw guide](docs/excalidraw.md) for installation, operation, security,
troubleshooting, upgrades, and rollback.

## Review OpenSpec Artifacts

Run `pnpm openspec:review` to start the VitePress review site and open it in your
browser. The development server uses VitePress's localhost-only default binding;
the project does not configure remote network access.

Edits to existing OpenSpec Markdown content reload live. Restart
`pnpm openspec:review` after structural changes, such as creating, moving,
renaming, or archiving artifacts, so the filesystem-derived navigation is
rebuilt.

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

## Configure Bookmark Filing

After loading the extension, open `chrome://extensions`, select **Details** for
Smart Bookmark Filer, and select **Extension options**. Configure every field:

1. Select one **Inbox folder**. New bookmarks must be created directly in this
   folder to be eligible for filing.
2. Select one or more **Destination roots**. Use Ctrl (Windows/Linux) or Command
   (macOS) while selecting to choose multiple roots. A selected root and its
   descendant folders are eligible destinations.
3. Enter the **OpenAI model** to use.
4. Set the **Confidence threshold** to a number from `0` through `1`. Higher
   values require greater model confidence before a bookmark can be moved.
5. Enter an **OpenAI API key**, then select **Save settings**.

When a key is already configured, the options page reports that state without
displaying the saved key. Leave the password field blank when saving to preserve
the existing key, or enter a value to replace it. **Clear API key** removes the
locally stored filing configuration and leaves automatic filing inactive until
a complete valid configuration and key are saved again.

Invalid values or folder selections are reported without replacing the last
valid saved configuration. If a selected folder is deleted, the options page
identifies the missing selection; choose an existing replacement before saving.

### Folder boundaries

The Inbox must remain separate from every destination root:

- The Inbox cannot also be a destination root.
- A destination root cannot be inside the Inbox subtree.
- The Inbox cannot be inside a destination-root subtree.
- Destination roots may overlap each other. Overlapping roots do not make a
  folder eligible more than once.

### Automatic filing behavior

Automatic filing considers only new URL bookmarks created directly inside the
configured Inbox. It ignores folders, bookmarks created elsewhere, and
bookmarks created in folders below the Inbox. Filing remains inactive while the
configuration is missing or refers to deleted folders.

For an eligible bookmark, the extension requests one classification against
the currently allowed destinations. It moves the bookmark only when the result
selects an eligible folder and its confidence is equal to or greater than the
configured threshold. Low-confidence results, provider or network failures,
timeouts, invalid responses, and unavailable destinations are unresolved: the
bookmark remains unchanged in the Inbox.

Before moving, the extension checks the bookmark, configuration, and selected
destination again. It takes no further action if the bookmark was deleted or
manually moved, the configuration changed, or the destination was deleted or
left the allowed roots while classification was running.

Unresolved bookmarks are not retried automatically. Review and file them
manually. Adding or importing many URL bookmarks directly into the Inbox can
start a separate paid OpenAI request for each eligible bookmark, including
overlapping requests. Avoid bulk additions unless that API usage and cost are
intentional.

### Recent filing activity

The options page's **Recent activity** section shows up to 50 eligible bookmarks
processed by automatic filing, newest first. History is stored only in
`chrome.storage.local` for the current Chrome profile and survives options-page,
background-worker, browser, and extension restarts. It is not synchronized to
other profiles or browser installations.

Each item can include the bookmark ID and title, created and updated times,
processing or terminal outcome, a closed safe-reason category, accepted
confidence, and the destination folder ID and contextual path used at filing
time. Destination information is a historical snapshot; later folder renames or
deletions do not rewrite it. Activity never stores or displays bookmark URLs,
API keys, authorization headers, provider response bodies, or raw exception
text.

**Processing** means automatic filing is in progress or was interrupted before
a terminal result could be stored, for example because the background worker
stopped. Success, unresolved, below-threshold, canceled, and sanitized extension
error outcomes explain the last recorded result. If no eligible bookmark has
entered filing evaluation, the section says, **No eligible bookmarks have been
processed yet.**

Select **Clear history** and confirm to remove the activity currently stored.
This does not change filing settings or credentials, move or delete bookmarks,
or clear the API key. Work already in progress can write a later terminal item
after history is cleared. Activity is diagnostic only: the extension does not
send browser notifications, retry unresolved bookmarks, or offer automatic or
manual reclassification from the activity list.

### Local API-key storage

Settings, including the OpenAI API key, are stored in `chrome.storage.local` for
this Chrome profile. They are not synchronized with `chrome.storage.sync` and
must be configured separately in another profile or browser installation. The
key is protected only by Chrome's local profile storage; anyone with profile or
extension-debug access may be able to read it.

Use a restricted personal key where available. Enter the key only through the
extension options page: never add it to source files, configuration files,
commits, build artifacts, or documentation.

### OpenAI data, privacy, and cost

Classification requests go directly from the extension to the OpenAI Responses
API using the configured model and personal API key. The key is sent only in the
authorization header; it is not included in the classification prompt.

For each bookmark submitted for classification, the prompt contains only:

- the bookmark title;
- the bookmark's full URL, including any path, query string, or fragment; and
- each currently eligible destination folder's Chrome folder ID and contextual
  path beneath the selected destination roots.

The request also contains classification instructions and a strict response
schema requiring one candidate folder ID and a confidence value. It does not
send page content, page metadata or favicons, open-tab data, browsing history,
the source bookmark ID, the Inbox folder ID, bookmark timestamps or positions,
bookmarks outside the eligible destination set, or unrelated saved settings.
The extension does not fetch the bookmarked page for classification.

Titles, URLs, and destination paths can themselves contain private information.
Review them before using automatic filing and avoid placing sensitive data in
folder names or bookmark URLs. OpenAI processes the disclosed data under the
terms, privacy controls, and retention settings applicable to the API account;
this extension does not add a proxy or project-operated backend between the
browser and OpenAI.

Requests use the user's personal OpenAI API account and may incur usage charges.
Cost depends on the configured model, current OpenAI pricing, and request size;
larger destination trees send more folder IDs and paths and therefore use more
input tokens. Monitor API usage and billing in the OpenAI account and choose the
model and destination roots accordingly.

## Project Boundaries

- `entrypoints/`: thin browser lifecycle and UI entrypoints
- `features/bookmark-filing/`: filing workflow, feature-owned ports, and domain
  types
- `infrastructure/bookmarks/`: Chrome bookmark-tree and bookmark-event adapters
- `infrastructure/storage/`: Chrome local-storage adapters
- `infrastructure/openai/`: direct OpenAI classification adapter
- `shared/`: small domain-neutral types and utilities
- `public/`: static extension assets

Directories are added only when they contain real code. Unit tests remain
outside production directories: feature tests belong under
`features/tests/<feature>/`, and infrastructure tests belong under
`infrastructure/tests/<area>/`. Feature code depends on feature-owned interfaces
rather than infrastructure implementations. Entrypoints may compose the feature
but must not import OpenAI or storage implementation details directly; ESLint
enforces both dependency rules.
