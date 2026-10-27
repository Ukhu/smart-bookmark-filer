import { describe, expect, it, vi } from 'vitest';

import {
  FILING_CONFIGURATION_VERSION,
  parseFilingConfiguration,
  type FilingConfiguration,
} from './configuration';
import {
  FilingOptionsController,
  type OptionsApiKeyUpdate,
  type OptionsConfigurationStore,
  type OptionsFolderSnapshot,
} from './options-controller';

const folders = [
  { id: 'root', title: '', path: '/' },
  { id: 'inbox', title: 'Inbox', path: 'Inbox' },
  { id: 'engineering', title: 'Engineering', path: 'Engineering' },
  {
    id: 'research',
    title: 'Research',
    path: 'Engineering/Research',
  },
] as const;

const validConfiguration: FilingConfiguration = {
  version: FILING_CONFIGURATION_VERSION,
  inboxFolderId: 'inbox',
  destinationRootIds: ['engineering'],
  openAiApiKey: 'stored-secret',
  model: 'gpt-5-mini',
  confidenceThreshold: 0.8,
};

function createHarness(
  initialConfiguration: FilingConfiguration | null = validConfiguration,
) {
  let configuration = initialConfiguration;
  const parentById = new Map([
    ['inbox', 'root'],
    ['engineering', 'root'],
    ['research', 'engineering'],
  ]);
  const snapshot: OptionsFolderSnapshot = {
    enumerateFolders: () => folders,
    findStaleFolderIds: (folderIds) => [
      ...new Set(
        folderIds.filter(
          (folderId) => !folders.some(({ id }) => id === folderId),
        ),
      ),
    ],
    isFolderAncestor: (ancestorFolderId, descendantFolderId) => {
      let parentId = parentById.get(descendantFolderId);
      while (parentId !== undefined) {
        if (parentId === ancestorFolderId) return true;
        parentId = parentById.get(parentId);
      }
      return false;
    },
  };
  const store: OptionsConfigurationStore = {
    load: vi.fn(async () => configuration),
    save: vi.fn(async (draft: unknown, apiKeyUpdate: OptionsApiKeyUpdate) => {
      const candidate = {
        ...(typeof draft === 'object' && draft !== null ? draft : {}),
        openAiApiKey:
          apiKeyUpdate.kind === 'replace'
            ? apiKeyUpdate.apiKey
            : (configuration?.openAiApiKey ?? ''),
      };
      const result = parseFilingConfiguration(candidate);
      if (result.ok) configuration = result.value;
      return result;
    }),
    clearApiKey: vi.fn(async () => {
      configuration = null;
    }),
  };
  const bookmarkTree = { loadSnapshot: vi.fn(async () => snapshot) };

  return {
    controller: new FilingOptionsController(store, bookmarkTree),
    store,
    getConfiguration: () => configuration,
  };
}

const validInput = {
  inboxFolderId: 'inbox',
  destinationRootIds: ['engineering'],
  model: 'gpt-5-mini',
  confidenceThreshold: 0.8,
  apiKeyReplacement: '',
};

describe('FilingOptionsController', () => {
  it('loads saved fields while exposing only masked API-key state', async () => {
    const { controller } = createHarness();

    const state = await controller.load();

    expect(state).toMatchObject({
      inboxFolderId: 'inbox',
      destinationRootIds: ['engineering'],
      model: 'gpt-5-mini',
      confidenceThreshold: 0.8,
      hasConfiguredApiKey: true,
    });
    expect(state).not.toHaveProperty('openAiApiKey');
    expect(state).not.toHaveProperty('apiKey');
  });

  it('saves a complete valid configuration', async () => {
    const { controller, getConfiguration } = createHarness(null);

    const result = await controller.save({
      ...validInput,
      destinationRootIds: ['engineering', 'research'],
      apiKeyReplacement: 'new-secret',
    });

    expect(result.ok).toBe(true);
    expect(getConfiguration()).toMatchObject({
      destinationRootIds: ['engineering', 'research'],
      openAiApiKey: 'new-secret',
    });
  });

  it('preserves the existing API key when the replacement is blank', async () => {
    const { controller, store, getConfiguration } = createHarness();

    await controller.save({ ...validInput, model: 'gpt-5.1-mini' });

    expect(store.save).toHaveBeenCalledWith(expect.anything(), {
      kind: 'preserve',
    });
    expect(getConfiguration()).toMatchObject({
      model: 'gpt-5.1-mini',
      openAiApiKey: 'stored-secret',
    });
  });

  it('replaces the API key only when a replacement is provided', async () => {
    const { controller, store, getConfiguration } = createHarness();

    await controller.save({
      ...validInput,
      apiKeyReplacement: 'replacement-secret',
    });

    expect(store.save).toHaveBeenCalledWith(expect.anything(), {
      kind: 'replace',
      apiKey: 'replacement-secret',
    });
    expect(getConfiguration()?.openAiApiKey).toBe('replacement-secret');
  });

  it('explicitly clears the API key and reports filing as unconfigured', async () => {
    const { controller, store } = createHarness();

    const state = await controller.clearApiKey();

    expect(store.clearApiKey).toHaveBeenCalledOnce();
    expect(state.hasConfiguredApiKey).toBe(false);
  });

  it('rejects overlapping Inbox and destination folders before saving', async () => {
    const { controller, store } = createHarness();

    const result = await controller.save({
      ...validInput,
      inboxFolderId: 'engineering',
      destinationRootIds: ['research'],
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors[0]).toContain('must be separate');
    expect(store.save).not.toHaveBeenCalled();
  });

  it('identifies stale saved selections and rejects stale save attempts', async () => {
    const staleConfiguration = {
      ...validConfiguration,
      inboxFolderId: 'deleted-inbox',
      destinationRootIds: ['engineering', 'deleted-root'],
    };
    const { controller, store } = createHarness(staleConfiguration);

    const state = await controller.load();
    const result = await controller.save({
      ...validInput,
      inboxFolderId: 'deleted-inbox',
      destinationRootIds: ['engineering', 'deleted-root'],
    });

    expect(state.staleInboxFolderId).toBe('deleted-inbox');
    expect(state.staleDestinationRootIds).toEqual(['deleted-root']);
    expect(result).toEqual({
      ok: false,
      errors: [
        'Selected folders no longer exist. Choose replacements for: deleted-inbox, deleted-root.',
      ],
    });
    expect(store.save).not.toHaveBeenCalled();
  });
});
