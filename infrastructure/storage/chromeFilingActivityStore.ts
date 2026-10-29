import {
  FILING_ACTIVITY_VERSION,
  parseFilingActivityHistory,
  type FilingActivity,
  type FilingActivityCompletion,
  type FilingActivityIdentity,
  type FilingActivityListener,
  type FilingActivityStore,
} from '../../features/bookmark-filing/filingActivity';

export const FILING_ACTIVITY_STORAGE_KEY = 'smartBookmarkFiler.filingActivity';
export const FILING_ACTIVITY_LIMIT = 50;
export const FILING_ACTIVITY_LOCK_NAME =
  'smartBookmarkFiler.filingActivity.mutation';

export interface FilingActivityStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface StorageChange {
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
}

export type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

export interface StorageChangeEvent {
  addListener(listener: StorageChangeListener): void;
  removeListener(listener: StorageChangeListener): void;
}

export interface FilingActivityLock {
  request<T>(name: string, operation: () => Promise<T>): Promise<T>;
}

type Clock = () => number;

const immediateLock: FilingActivityLock = {
  request: (_name, operation) => operation(),
};

function getDefaultLock(): FilingActivityLock {
  const locks = globalThis.navigator?.locks;
  if (locks === undefined) return immediateLock;

  return {
    request: async <T>(name: string, operation: () => Promise<T>): Promise<T> =>
      await locks.request(name, operation),
  };
}

function newestFirst(activity: readonly FilingActivity[]): FilingActivity[] {
  return [...activity].sort((first, second) => {
    if (second.updatedAt !== first.updatedAt) {
      return second.updatedAt - first.updatedAt;
    }
    return second.createdAt - first.createdAt;
  });
}

function normalizeHistory(value: unknown): FilingActivity[] {
  const parsed = parseFilingActivityHistory(value);
  return parsed === null
    ? []
    : newestFirst(parsed).slice(0, FILING_ACTIVITY_LIMIT);
}

export class ChromeFilingActivityStore implements FilingActivityStore {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: FilingActivityStorageArea,
    private readonly changes: StorageChangeEvent,
    private readonly clock: Clock = Date.now,
    private readonly lock: FilingActivityLock = getDefaultLock(),
  ) {}

  async start(identity: FilingActivityIdentity): Promise<void> {
    return this.mutate(async (activity) => {
      const timestamp = this.clock();
      const record: FilingActivity = {
        version: FILING_ACTIVITY_VERSION,
        bookmarkId: identity.bookmarkId,
        title: identity.title,
        createdAt: timestamp,
        updatedAt: timestamp,
        outcome: { kind: 'processing' },
      };

      return [
        record,
        ...activity.filter(
          ({ bookmarkId }) => bookmarkId !== identity.bookmarkId,
        ),
      ];
    });
  }

  async complete(completion: FilingActivityCompletion): Promise<void> {
    return this.mutate(async (activity) => {
      const timestamp = this.clock();
      const existing = activity.find(
        ({ bookmarkId }) => bookmarkId === completion.bookmarkId,
      );
      const record: FilingActivity = {
        version: FILING_ACTIVITY_VERSION,
        bookmarkId: completion.bookmarkId,
        title: completion.title,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        outcome: completion.outcome,
      };

      return [
        record,
        ...activity.filter(
          ({ bookmarkId }) => bookmarkId !== completion.bookmarkId,
        ),
      ];
    });
  }

  async load(): Promise<readonly FilingActivity[]> {
    const values = await this.storage.get(FILING_ACTIVITY_STORAGE_KEY);
    return normalizeHistory(values[FILING_ACTIVITY_STORAGE_KEY]);
  }

  async clear(): Promise<void> {
    return this.enqueueMutation(async () =>
      this.storage.remove(FILING_ACTIVITY_STORAGE_KEY),
    );
  }

  observe(listener: FilingActivityListener): () => void {
    const changeListener: StorageChangeListener = (changes, areaName) => {
      if (areaName !== 'local' || !(FILING_ACTIVITY_STORAGE_KEY in changes)) {
        return;
      }

      listener(
        normalizeHistory(changes[FILING_ACTIVITY_STORAGE_KEY]?.newValue),
      );
    };

    this.changes.addListener(changeListener);
    return () => this.changes.removeListener(changeListener);
  }

  private async mutate(
    update: (
      activity: readonly FilingActivity[],
    ) => Promise<readonly FilingActivity[]>,
  ): Promise<void> {
    return this.enqueueMutation(async () => {
      const activity = await this.load();
      const updated = newestFirst(await update(activity)).slice(
        0,
        FILING_ACTIVITY_LIMIT,
      );
      await this.storage.set({ [FILING_ACTIVITY_STORAGE_KEY]: updated });
    });
  }

  private enqueueMutation(operation: () => Promise<void>): Promise<void> {
    return this.enqueue(() =>
      this.lock.request(FILING_ACTIVITY_LOCK_NAME, operation),
    );
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.catch(() => undefined);
    return result;
  }
}

export function createChromeLocalFilingActivityStore(): ChromeFilingActivityStore {
  return new ChromeFilingActivityStore(
    browser.storage.local,
    browser.storage.onChanged,
  );
}
