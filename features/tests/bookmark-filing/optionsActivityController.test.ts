import { describe, expect, it, vi } from 'vitest';

import {
  FILING_ACTIVITY_VERSION,
  type FilingActivity,
  type FilingActivityListener,
  type FilingActivityStore,
} from '../../bookmark-filing/filingActivity';
import { OptionsActivityController } from '../../bookmark-filing/optionsActivityController';

function activity(
  bookmarkId: string,
  updatedAt: number,
  outcome: FilingActivity['outcome'],
): FilingActivity {
  return {
    version: FILING_ACTIVITY_VERSION,
    bookmarkId,
    title: `Bookmark ${bookmarkId}`,
    createdAt: Math.min(10, updatedAt),
    updatedAt,
    outcome,
  };
}

function createHarness(initial: readonly FilingActivity[] = []) {
  let records = initial;
  let listener: FilingActivityListener | undefined;
  const configuration = { model: 'gpt-5-mini', apiKey: 'preserved-secret' };
  const store: FilingActivityStore = {
    start: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    load: vi.fn(async () => records),
    clear: vi.fn(async () => {
      records = [];
    }),
    observe: vi.fn((nextListener) => {
      listener = nextListener;
      return vi.fn();
    }),
  };

  return {
    controller: new OptionsActivityController(store),
    store,
    configuration,
    publish: (nextRecords: readonly FilingActivity[]) =>
      listener?.(nextRecords),
  };
}

describe('OptionsActivityController', () => {
  it('loads newest-first display items without exposing activity-only identifiers', async () => {
    const { controller } = createHarness([
      activity('older', 20, { kind: 'processing' }),
      activity('newer', 30, {
        kind: 'filed',
        confidence: 0.91,
        destinationFolderId: 'private-folder-id',
        destinationPath: 'Work/Research',
      }),
    ]);

    const state = await controller.load();

    expect(state).toMatchObject({
      kind: 'activity',
      items: [
        {
          bookmarkId: 'newer',
          label: 'Filed',
          detail: 'Filed to Work/Research with 91% confidence.',
        },
        { bookmarkId: 'older', label: 'Processing' },
      ],
    });
    expect(state).not.toHaveProperty('destinationFolderId');
  });

  it.each([
    ['no-candidates', 'No eligible destination folders were available.'],
    ['missing-credentials', 'OpenAI credentials were not configured.'],
    ['authorization-error', 'OpenAI authorization failed.'],
    ['rate-limit', 'OpenAI rate-limited the request.'],
    ['provider-error', 'OpenAI could not complete the request.'],
    ['network-error', 'The network request failed.'],
    ['timeout', 'The classification request timed out.'],
    ['invalid-response', 'OpenAI returned an invalid classification response.'],
  ] as const)(
    'maps the %s unresolved reason to safe text',
    async (reason, detail) => {
      const { controller } = createHarness([
        activity('bookmark', 20, { kind: 'unresolved', reason }),
      ]);

      await expect(controller.load()).resolves.toMatchObject({
        items: [{ label: 'Unresolved', detail }],
      });
    },
  );

  it.each([
    ['bookmark-changed', 'The bookmark changed before filing finished.'],
    [
      'configuration-changed',
      'Filing settings changed before filing finished.',
    ],
    ['destination-changed', 'The destination changed before filing finished.'],
  ] as const)(
    'maps the %s cancellation reason to safe text',
    async (reason, detail) => {
      const { controller } = createHarness([
        activity('bookmark', 20, { kind: 'canceled', reason }),
      ]);

      await expect(controller.load()).resolves.toMatchObject({
        items: [{ label: 'Canceled', detail }],
      });
    },
  );

  it('maps below-threshold and unexpected failures without raw errors', async () => {
    const { controller } = createHarness([
      activity('threshold', 30, { kind: 'below-threshold', confidence: 0.42 }),
      activity('failure', 20, { kind: 'unexpected-failure' }),
    ]);

    await expect(controller.load()).resolves.toMatchObject({
      items: [
        {
          label: 'Below confidence threshold',
          detail: 'The 42% confidence result was not accepted.',
        },
        {
          label: 'Extension error',
          detail:
            'Automatic filing stopped because of an unexpected extension error.',
        },
      ],
    });
  });

  it('returns explicit empty and sanitized error states', async () => {
    const emptyHarness = createHarness();
    const failingHarness = createHarness();
    vi.mocked(failingHarness.store.load).mockRejectedValueOnce(
      new Error('raw storage failure with secret'),
    );

    await expect(emptyHarness.controller.load()).resolves.toEqual({
      kind: 'empty',
      items: [],
    });
    await expect(failingHarness.controller.load()).resolves.toEqual({
      kind: 'error',
      message: 'Recent activity could not be loaded.',
    });
  });

  it('maps live updates and returns the store unsubscribe function', () => {
    const { controller, publish, store } = createHarness();
    const listener = vi.fn();
    const unsubscribe = controller.observe(listener);
    const storeUnsubscribe = vi.mocked(store.observe).mock.results[0]?.value;

    publish([activity('live', 20, { kind: 'processing' })]);
    unsubscribe();

    expect(listener).toHaveBeenCalledWith({
      kind: 'activity',
      items: [
        expect.objectContaining({ bookmarkId: 'live', label: 'Processing' }),
      ],
    });
    expect(storeUnsubscribe).toHaveBeenCalledOnce();
  });

  it('requires confirmation before clearing and preserves configuration', async () => {
    const { controller, store, configuration } = createHarness([
      activity('bookmark', 20, { kind: 'processing' }),
    ]);

    await expect(controller.clear(false)).resolves.toMatchObject({
      kind: 'activity',
    });
    expect(store.clear).not.toHaveBeenCalled();

    await expect(controller.clear(true)).resolves.toEqual({
      kind: 'empty',
      items: [],
    });
    expect(store.clear).toHaveBeenCalledOnce();
    expect(configuration).toEqual({
      model: 'gpt-5-mini',
      apiKey: 'preserved-secret',
    });
  });

  it('returns a section-local error when clearing fails', async () => {
    const { controller, store } = createHarness();
    vi.mocked(store.clear).mockRejectedValueOnce(new Error('raw error'));

    await expect(controller.clear(true)).resolves.toEqual({
      kind: 'error',
      message: 'Recent activity could not be cleared.',
    });
  });
});
