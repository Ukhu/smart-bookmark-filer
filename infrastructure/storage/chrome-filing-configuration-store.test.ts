import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FILING_CONFIGURATION_VERSION } from '../../features/bookmark-filing/configuration';
import {
  ChromeFilingConfigurationStore,
  FILING_CONFIGURATION_STORAGE_KEY,
  type LocalStorageArea,
} from './chrome-filing-configuration-store';

const validDraft = {
  version: FILING_CONFIGURATION_VERSION,
  inboxFolderId: 'inbox',
  destinationRootIds: ['engineering'],
  model: 'gpt-5-mini',
  confidenceThreshold: 0.8,
};

function createStorageMock(initialValue?: unknown) {
  const values: Record<string, unknown> = {};
  if (initialValue !== undefined) {
    values[FILING_CONFIGURATION_STORAGE_KEY] = initialValue;
  }

  const storage: LocalStorageArea = {
    get: vi.fn(async (key: string) => ({ [key]: values[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete values[key];
    }),
  };

  return { storage, values };
}

describe('ChromeFilingConfigurationStore', () => {
  let storageMock: ReturnType<typeof createStorageMock>;
  let store: ChromeFilingConfigurationStore;

  beforeEach(() => {
    storageMock = createStorageMock();
    store = new ChromeFilingConfigurationStore(storageMock.storage);
  });

  it('saves a valid object with an explicit API-key replacement', async () => {
    const result = await store.save(validDraft, {
      kind: 'replace',
      apiKey: 'first-key',
    });

    expect(result.ok).toBe(true);
    await expect(store.load()).resolves.toEqual({
      ...validDraft,
      openAiApiKey: 'first-key',
    });
    expect(storageMock.storage.set).toHaveBeenCalledOnce();
  });

  it('preserves the configured API key while replacing other valid fields', async () => {
    await store.save(validDraft, { kind: 'replace', apiKey: 'preserved-key' });

    const result = await store.save(
      { ...validDraft, model: 'gpt-5.1-mini', confidenceThreshold: 0.9 },
      { kind: 'preserve' },
    );

    expect(result.ok).toBe(true);
    await expect(store.load()).resolves.toEqual({
      ...validDraft,
      model: 'gpt-5.1-mini',
      confidenceThreshold: 0.9,
      openAiApiKey: 'preserved-key',
    });
  });

  it('preserves the last valid object when a replacement is invalid', async () => {
    await store.save(validDraft, { kind: 'replace', apiKey: 'valid-key' });
    const validStoredValue =
      storageMock.values[FILING_CONFIGURATION_STORAGE_KEY];

    const result = await store.save(
      { ...validDraft, confidenceThreshold: 2 },
      { kind: 'replace', apiKey: 'new-key' },
    );

    expect(result.ok).toBe(false);
    expect(storageMock.values[FILING_CONFIGURATION_STORAGE_KEY]).toBe(
      validStoredValue,
    );
    expect(storageMock.storage.set).toHaveBeenCalledOnce();
  });

  it('explicitly clears the API key and leaves filing inactive', async () => {
    await store.save(validDraft, { kind: 'replace', apiKey: 'key-to-clear' });

    await store.clearApiKey();

    expect(storageMock.storage.remove).toHaveBeenCalledWith(
      FILING_CONFIGURATION_STORAGE_KEY,
    );
    await expect(store.load()).resolves.toBeNull();
  });

  it('restores a valid configuration after the store is recreated', async () => {
    await store.save(validDraft, { kind: 'replace', apiKey: 'reloaded-key' });

    const reloadedStore = new ChromeFilingConfigurationStore(
      storageMock.storage,
    );

    await expect(reloadedStore.load()).resolves.toEqual({
      ...validDraft,
      openAiApiKey: 'reloaded-key',
    });
  });

  it.each([
    null,
    'not-an-object',
    { ...validDraft, openAiApiKey: 42 },
    { ...validDraft, openAiApiKey: 'key', confidenceThreshold: 4 },
  ])(
    'never returns malformed stored settings as usable',
    async (storedValue) => {
      const staleStorage = createStorageMock(storedValue);
      const staleStore = new ChromeFilingConfigurationStore(
        staleStorage.storage,
      );

      await expect(staleStore.load()).resolves.toBeNull();
    },
  );

  it('does not treat a stale object as a source for key preservation', async () => {
    const staleValue = {
      ...validDraft,
      openAiApiKey: 'stale-key',
      confidenceThreshold: 3,
    };
    const staleStorage = createStorageMock(staleValue);
    const staleStore = new ChromeFilingConfigurationStore(staleStorage.storage);

    const result = await staleStore.save(validDraft, { kind: 'preserve' });

    expect(result.ok).toBe(false);
    expect(staleStorage.storage.set).not.toHaveBeenCalled();
    expect(staleStorage.values[FILING_CONFIGURATION_STORAGE_KEY]).toBe(
      staleValue,
    );
  });

  it('can replace the key to recover from stale stored data', async () => {
    const staleStorage = createStorageMock({ malformed: true });
    const staleStore = new ChromeFilingConfigurationStore(staleStorage.storage);

    const result = await staleStore.save(validDraft, {
      kind: 'replace',
      apiKey: 'replacement-key',
    });

    expect(result.ok).toBe(true);
    await expect(staleStore.load()).resolves.toEqual({
      ...validDraft,
      openAiApiKey: 'replacement-key',
    });
  });
});
