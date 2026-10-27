# Proposal

## Why

New bookmarks require repeated manual sorting, especially when their domains are unfamiliar. A personal extension can use the bookmark's title and URL with the user's own OpenAI account to select an appropriate folder while retaining safe, user-controlled boundaries.

## What Changes

- Add an options page for configuring an Inbox folder, multiple allowed destination roots, an OpenAI API key and model, and an automatic-filing confidence threshold.
- Detect URL bookmarks created in the configured Inbox while ignoring bookmarks created elsewhere and non-URL bookmark nodes.
- Build eligible destination candidates from the configured roots and their descendant folders, represented by stable Chrome folder IDs and contextual paths.
- Ask OpenAI to classify only the bookmark title and URL into one of those existing destination folders using a structured response.
- Validate model output locally before moving a bookmark.
- Automatically move only valid, sufficiently confident classifications; leave uncertain, invalid, or failed classifications in the Inbox.
- Keep the MVP personal and local-first except for the explicit OpenAI classification request; no backend or page-content collection is introduced.
- Require the `setup-project-foundation` change to be implemented before this change.

## Capabilities

### New Capabilities

- `filing-configuration`: Configure and persist the Inbox, eligible destination roots, OpenAI credentials and model, and confidence threshold with folder and value validation.
- `bookmark-classification`: Construct privacy-bounded classification requests, obtain structured OpenAI selections, and validate the returned folder and confidence.
- `automatic-bookmark-filing`: Observe eligible new bookmarks and safely move confident classifications while preserving unresolved bookmarks in the Inbox.

### Modified Capabilities

None.

## Impact

- Extends the WXT background entrypoint and adds a framework-free options entrypoint.
- Introduces modules for filing workflows, Chrome bookmark and storage access, and direct OpenAI API access.
- Adds Chrome `bookmarks` and `storage` permissions plus network access limited to the OpenAI API.
- Stores personal configuration and the API key in `chrome.storage.local`; the key is not included in source control or extension bundles.
- Adds OpenAI request mocking and Chrome API mocking to the unit-test suite.
