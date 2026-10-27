# Design

## Context

This change follows `setup-project-foundation`, which establishes a framework-free WXT and TypeScript extension with thin entrypoints and feature/infrastructure boundaries. The current repository has no implemented extension behavior, so that foundation must be applied first. See `proposal.md` for motivation and the three delta specs for observable behavior.

The extension is personal and unpacked rather than a distributed multi-user product. A direct OpenAI request with a user-supplied key is therefore acceptable, but the key remains sensitive and model output remains untrusted. Chrome Manifest V3 background work is asynchronous and can overlap with user bookmark actions, so movement must be based on fresh state rather than the state captured at event time.

## Goals / Non-Goals

**Goals:**

- Keep Chrome listeners and options-page event wiring thin while making filing logic unit-testable without Chrome or OpenAI.
- Limit both Chrome permissions and outbound classification data to what the MVP requires.
- Use stable folder IDs for actions and human-readable paths only as model context.
- Represent expected failures as safe unresolved results that leave bookmarks unchanged.
- Make saved settings versionable so later changes can migrate them deliberately.

**Non-Goals:**

- Calibrate model confidence scientifically, learn from manual moves, or create deterministic domain rules.
- Fetch page content, inspect open tabs, analyze browsing history, or synchronize configuration between profiles.
- Provide classification history, retry queues, notifications, bulk filing, or manual reclassification controls.
- Encrypt the API key beyond Chrome profile storage protections or introduce a backend credential proxy.
- Support providers other than OpenAI in the MVP.

## Decisions

### Organize around a filing workflow with replaceable infrastructure ports

The background entrypoint will register the bookmark-created listener and delegate to a filing workflow. The workflow will depend on narrow interfaces for configuration, bookmark-tree access, and classification rather than calling Chrome or OpenAI directly.

```text
entrypoints/background.ts
          |
          v
features/bookmark-filing/
  filingWorkflow.ts
  candidateBuilder.ts
  types.ts
          |
          +-------------------+--------------------+
          v                   v                    v
infrastructure/bookmarks  infrastructure/storage  infrastructure/openai
```

The framework-free options entrypoint will use the same configuration and bookmark-tree adapters. This keeps browser-specific details at the edges and allows unit tests to use in-memory fakes. A single all-purpose service was rejected because it would tightly couple event timing, storage, tree traversal, network calls, and movement.

### Codify naming and test placement before remaining implementation

Project-owned TypeScript filenames will use camelCase. Filenames whose exact form is required by tooling, including WXT entrypoint names, are exceptions. Production modules remain grouped by feature or infrastructure area, while tests will not be colocated with them: feature tests will preserve module grouping under `features/tests/<feature>/`, and infrastructure tests under `infrastructure/tests/<area>/`.

Before remaining feature work, the existing kebab-case TypeScript files will be renamed with their imports updated, and existing tests will be moved into those grouped test directories. Root `AGENTS.md` will document the conventions for repository-wide agent work, and `openspec/config.yaml` will provide equivalent apply guidance so OpenSpec implementation work follows the same rules. Formatting will cover project source and test paths, and automated filename and test-location checks will run as part of repository validation.

Colocating tests was rejected because it conflicts with the repository's desired separation between production and test code. Relying on written guidance alone was rejected because naming and placement drift is inexpensive to detect mechanically and otherwise easy to introduce during later implementation.

### Store one versioned configuration object in local extension storage

The configuration will be stored under one namespaced key and contain a schema version, Inbox folder ID, destination-root IDs, model, confidence threshold, and OpenAI API key. Reads will parse and validate unknown storage data before exposing a usable configuration. Writes will replace the object only after field and folder validation succeeds.

The options page will show whether a key is configured without placing the stored key into a normal text field. A blank replacement field preserves the existing key unless the user explicitly replaces or clears it. `chrome.storage.sync` was rejected because the secret and personal folder IDs should not be synchronized through the user's Chrome account.

### Use the live bookmark tree for options and classification candidates

The options page will load the Chrome bookmark tree and render folder-only selectors for one Inbox and multiple destination roots. Save validation will reject overlap between the Inbox subtree and any destination subtree.

For every eligible event, the candidate builder will obtain a fresh tree snapshot, verify every configured folder, traverse each selected root recursively, and deduplicate by folder ID. Each candidate will contain:

```text
folderId: stable Chrome bookmark folder ID
path: contextual folder path such as Engineering/Research papers
```

Selected roots themselves are valid candidates along with descendants. Overlapping destination roots are allowed because deduplication produces the same effective candidate set; this avoids imposing unnecessary configuration restrictions. Persisting a candidate cache was rejected because folder names and ancestry can change outside the extension.

### Call the OpenAI Responses API directly with strict structured output

The OpenAI adapter will use `fetch` rather than an SDK to keep the extension bundle and provider surface small. The manifest will allow connections only to the OpenAI API origin. The request will include a concise system instruction, bookmark title and URL, and the current candidate ID/path list. It will not fetch or include page content.

The response format will use a strict JSON schema with a candidate folder ID and numeric confidence. Parsing will produce a discriminated success-or-unresolved result. The adapter will apply a finite timeout and map authorization, rate-limit, provider, network, timeout, and schema failures to safe categories. Authorization headers and keys will never be included in thrown, logged, or user-visible messages.

Allowing unconstrained prose and extracting a folder name was rejected because names can be duplicated and model output can invent destinations. A provider-neutral abstraction will remain narrow enough for later replacement, but the MVP will implement only OpenAI.

### Treat confidence as a user-controlled safety gate

The model-reported confidence will be validated as finite and within 0 through 1, then compared inclusively with the saved threshold. It is a heuristic rather than a calibrated probability, so the default should favor leaving ambiguous bookmarks in the Inbox. The user can tune the threshold from options without changing code.

Adding a second model call or deterministic scoring layer was rejected for the MVP because it adds cost and complexity without first observing real classification quality.

### Revalidate immediately before movement

The workflow will capture the bookmark ID at event time, but after classification it will re-read the bookmark, configuration, and destination eligibility. It will move only the same existing bookmark if its current parent is still the Inbox and the selected folder remains within the configured destination set. Deletion, manual movement, configuration changes, or destination-tree changes end the workflow without another mutation.

Each event will have independent immutable request context. No durable job queue or retry is introduced: interruption or any expected failure leaves the bookmark visible in the Inbox, which is the safe recovery state.

### Keep permissions and entrypoints minimal

The WXT manifest configuration will request `bookmarks` for tree access and movement, `storage` for local settings, and host access only for the OpenAI API. The extension will add an options page and extend the existing background entrypoint. It will not add content scripts, active-tab access, broad host permissions, or a popup.

### Test policy at feature and adapter boundaries

Unit tests will cover configuration parsing and validation, tree traversal and path construction, candidate deduplication, request redaction, response validation, threshold boundaries, and movement revalidation. Tests will be kept outside production directories and grouped under `features/tests/<feature>/` or `infrastructure/tests/<area>/` according to the module boundary they exercise. Chrome APIs and `fetch` will be mocked at the infrastructure boundary. A build-level check will verify generated manifest permissions and both entrypoints; live OpenAI calls will not run in automated tests.

## Risks / Trade-offs

- **[Model confidence is not calibrated]** -> Use a conservative configurable threshold and preserve all rejected results in the Inbox.
- **[The locally stored key can be read by someone with profile or extension-debug access]** -> Document the limitation, avoid sync and source files, mask options UI state, and recommend a restricted personal key where supported.
- **[Large destination trees increase tokens, latency, and cost]** -> Send only selected subtrees and deduplicate candidates; defer ranking or batching until actual tree size demonstrates a need.
- **[Folder names alone may be semantically ambiguous]** -> Include complete contextual paths; defer custom folder descriptions until usage shows that paths are insufficient.
- **[Manifest V3 may interrupt background work]** -> Keep each operation short and failure-safe; an interrupted request leaves the bookmark in the Inbox rather than creating inconsistent state.
- **[Bulk creation in the Inbox can trigger many paid requests]** -> Document Inbox-only behavior and preserve independent processing; defer rate limits and queues until bulk workflows are intentionally supported.
- **[Direct provider API behavior changes]** -> Isolate request and response handling in one adapter and cover its contract with mocked fixtures.

## Migration Plan

1. Complete and validate `setup-project-foundation` before applying this change.
2. Before continuing feature implementation, document and automate the repository conventions, normalize existing TypeScript filenames and test locations, update affected imports and tooling, and run the complete validation suite.
3. Add the configuration model, validators, Chrome adapters, and options entrypoint before enabling bookmark-event processing.
4. Add candidate construction and the OpenAI adapter with mocked contract tests.
5. Wire the filing workflow into the background entrypoint only after safe failure and revalidation tests pass.
6. Build the extension, inspect generated permissions, load it unpacked, save personal settings, and perform controlled Inbox smoke tests.

Rollback consists of disabling or removing the unpacked extension. Existing bookmarks remain in their current folders; local extension settings can be cleared with the extension's site data, and no backend data requires migration.
