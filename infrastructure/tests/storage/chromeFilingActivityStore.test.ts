import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FILING_ACTIVITY_VERSION } from '../../../features/bookmark-filing/filingActivity';
import {
  ChromeFilingActivityStore,
  FILING_ACTIVITY_LIMIT,
  FILING_ACTIVITY_STORAGE_KEY,
  type FilingActivityStorageArea,
  type StorageChangeEvent,
  type StorageChangeListener,
} from '../../storage/chromeFilingActivityStore';

function createStorageMock(initialValue?: unknown) {
  const values: Record<string, unknown> = {
    configuration: { preserved: true },
  };
  if (initialValue !== undefined) {
    values[FILING_ACTIVITY_STORAGE_KEY] = initialValue;
  }

  const listeners = new Set<StorageChangeListener>();
  const storage: FilingActivityStorageArea = {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete values[key];
    }),
  };
  const changes: StorageChangeEvent = {
    addListener: vi.fn((listener) => listeners.add(listener)),
    removeListener: vi.fn((listener) => listeners.delete(listener)),
  };

  return { storage, changes, listeners, values };
}

function createClock(start = 1_000) {
  let current = start;
  return () => current++;
}

describe('ChromeFilingActivityStore', () => {
  let storageMock: ReturnType<typeof createStorageMock>;
  let store: ChromeFilingActivityStore;

  beforeEach(() => {
    storageMock = createStorageMock();
    store = new ChromeFilingActivityStore(
      storageMock.storage,
      storageMock.changes,
      createClock(),
    );
  });

  it('persists processing activity across store instances', async () => {
    await store.start({ bookmarkId: 'bookmark-1', title: 'First' });

    const reloaded = new ChromeFilingActivityStore(
      storageMock.storage,
      storageMock.changes,
    );

    await expect(reloaded.load()).resolves.toEqual([
      {
        version: FILING_ACTIVITY_VERSION,
        bookmarkId: 'bookmark-1',
        title: 'First',
        createdAt: 1_000,
        updatedAt: 1_000,
        outcome: { kind: 'processing' },
      },
    ]);
  });

  it('updates one record to its terminal outcome without duplication', async () => {
    await store.start({ bookmarkId: 'bookmark-1', title: 'First' });
    await store.complete({
      bookmarkId: 'bookmark-1',
      title: 'First',
      outcome: {
        kind: 'filed',
        confidence: 0.91,
        destinationFolderId: 'typescript',
        destinationPath: 'Engineering / TypeScript',
      },
    });

    await expect(store.load()).resolves.toEqual([
      expect.objectContaining({
        bookmarkId: 'bookmark-1',
        createdAt: 1_000,
        updatedAt: 1_001,
        outcome: expect.objectContaining({ kind: 'filed' }),
      }),
    ]);
  });

  it('keeps at most 50 records in newest-first order', async () => {
    for (let index = 0; index < FILING_ACTIVITY_LIMIT + 2; index += 1) {
      await store.start({ bookmarkId: `bookmark-${index}`, title: `${index}` });
    }

    const activity = await store.load();

    expect(activity).toHaveLength(FILING_ACTIVITY_LIMIT);
    expect(activity[0]?.bookmarkId).toBe('bookmark-51');
    expect(activity.at(-1)?.bookmarkId).toBe('bookmark-2');
  });

  it('clears activity without modifying other local storage', async () => {
    await store.start({ bookmarkId: 'bookmark-1', title: 'First' });

    await store.clear();

    await expect(store.load()).resolves.toEqual([]);
    expect(storageMock.values.configuration).toEqual({ preserved: true });
    expect(storageMock.storage.remove).toHaveBeenCalledWith(
      FILING_ACTIVITY_STORAGE_KEY,
    );
  });

  it('serializes overlapping starts so neither record is lost', async () => {
    let releaseFirstSet: (() => void) | undefined;
    const firstSetBlocked = new Promise<void>((resolve) => {
      releaseFirstSet = resolve;
    });
    vi.mocked(storageMock.storage.set)
      .mockImplementationOnce(async (items) => {
        await firstSetBlocked;
        Object.assign(storageMock.values, items);
      })
      .mockImplementation(async (items) => {
        Object.assign(storageMock.values, items);
      });

    const first = store.start({ bookmarkId: 'bookmark-1', title: 'First' });
    const second = store.start({ bookmarkId: 'bookmark-2', title: 'Second' });
    await vi.waitFor(() =>
      expect(storageMock.storage.set).toHaveBeenCalledOnce(),
    );
    releaseFirstSet?.();
    await Promise.all([first, second]);

    await expect(store.load()).resolves.toEqual([
      expect.objectContaining({ bookmarkId: 'bookmark-2' }),
      expect.objectContaining({ bookmarkId: 'bookmark-1' }),
    ]);
  });

  it('serializes an overlapping completion with another start', async () => {
    await store.start({ bookmarkId: 'bookmark-1', title: 'First' });

    await Promise.all([
      store.complete({
        bookmarkId: 'bookmark-1',
        title: 'First',
        outcome: { kind: 'unresolved', reason: 'network-error' },
      }),
      store.start({ bookmarkId: 'bookmark-2', title: 'Second' }),
    ]);

    const activity = await store.load();
    expect(activity).toHaveLength(2);
    expect(activity).toEqual([
      expect.objectContaining({ bookmarkId: 'bookmark-2' }),
      expect.objectContaining({
        bookmarkId: 'bookmark-1',
        outcome: { kind: 'unresolved', reason: 'network-error' },
      }),
    ]);
  });

  it.each([undefined, null, {}, [{ malformed: true }]])(
    'loads absent or invalid stored data as empty activity',
    async (value) => {
      const invalidStorage = createStorageMock(value);
      const invalidStore = new ChromeFilingActivityStore(
        invalidStorage.storage,
        invalidStorage.changes,
      );

      await expect(invalidStore.load()).resolves.toEqual([]);
    },
  );

  it('observes valid local activity changes and can unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = store.observe(listener);
    const storedActivity = [
      {
        version: FILING_ACTIVITY_VERSION,
        bookmarkId: 'bookmark-1',
        title: 'First',
        createdAt: 1_000,
        updatedAt: 1_000,
        outcome: { kind: 'processing' },
      },
    ];
    const [changeListener] = [...storageMock.listeners];

    changeListener?.(
      { [FILING_ACTIVITY_STORAGE_KEY]: { newValue: storedActivity } },
      'local',
    );
    changeListener?.(
      { [FILING_ACTIVITY_STORAGE_KEY]: { newValue: 'invalid' } },
      'sync',
    );

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(storedActivity);

    unsubscribe();
    expect(storageMock.changes.removeListener).toHaveBeenCalledWith(
      changeListener,
    );
  });
});
