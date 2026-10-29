# Tasks

## 1. Worker-safe OpenAI transport

- [x] 1.1 Replace the unbound default fetch dependency in `infrastructure/openai/openAiResponsesClassifier.ts` with a worker-global receiver-preserving wrapper while leaving injected implementations unchanged; verify existing classifier tests still pass.
- [x] 1.2 Add a regression case in `infrastructure/tests/openai/openAiResponsesClassifier.test.ts` that constructs the default classifier against a branded synthetic global fetch, asserts `this === globalThis`, restores the global after the test, and verifies no live network request is made.

## 2. Extension verification

- [x] 2.1 Run formatting, linting, type checking, classifier tests, and the production build; verify the generated manifest retains only the intended OpenAI host permission and the production background bundle builds successfully.
- [x] 2.2 Reload the unpacked production extension and perform a controlled Inbox smoke test; verify the service worker issues an OpenAI request rather than throwing `WorkerGlobalScope: Illegal invocation`, while recording any independent model or authorization response separately.
