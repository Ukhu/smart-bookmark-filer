import { describe, expect, it, vi } from 'vitest';

import type { CandidateFolderSnapshot } from '../../bookmark-filing/candidateBuilder';
import { CLASSIFICATION_UNRESOLVED_CATEGORIES } from '../../bookmark-filing/classification';
import {
  FILING_CONFIGURATION_VERSION,
  type FilingConfiguration,
} from '../../bookmark-filing/configuration';
import {
  FilingWorkflow,
  type FilingWorkflowDependencies,
} from '../../bookmark-filing/filingWorkflow';

const configuration: FilingConfiguration = {
  version: FILING_CONFIGURATION_VERSION,
  inboxFolderId: 'inbox',
  destinationRootIds: ['destinations'],
  openAiApiKey: 'secret-key',
  model: 'gpt-test',
  confidenceThreshold: 0.8,
};

const candidates = [
  { folderId: 'destinations', path: 'Destinations' },
  { folderId: 'engineering', path: 'Destinations/Engineering' },
] as const;

function createSnapshot(
  staleFolderIds: readonly string[] = [],
  isFolderAncestor: CandidateFolderSnapshot['isFolderAncestor'] = (
    ancestorFolderId,
    descendantFolderId,
  ) =>
    ancestorFolderId === 'destinations' && descendantFolderId === 'engineering',
): CandidateFolderSnapshot {
  return {
    enumerateFolders: () => [],
    findStaleFolderIds: (folderIds) =>
      folderIds.filter((folderId) => staleFolderIds.includes(folderId)),
    isFolderAncestor,
  };
}

function createDependencies(
  overrides: Partial<FilingWorkflowDependencies> = {},
): FilingWorkflowDependencies {
  return {
    configuration: { load: vi.fn(async () => configuration) },
    bookmarks: {
      getBookmark: vi.fn(async () => ({
        id: 'bookmark-1',
        title: 'Current bookmark',
        parentId: 'inbox',
        url: 'https://example.com',
      })),
      moveBookmark: vi.fn(async () => undefined),
    },
    folderTree: { loadSnapshot: vi.fn(async () => createSnapshot()) },
    candidateBuilder: {
      build: vi.fn(async () => ({ ok: true as const, candidates })),
    },
    classifier: {
      classify: vi.fn(async () => ({
        kind: 'success' as const,
        folderId: 'engineering',
        confidence: 0.9,
      })),
    },
    activity: {
      start: vi.fn(async () => undefined),
      complete: vi.fn(async () => undefined),
    },
    ...overrides,
  };
}

describe('FilingWorkflow initial eligibility', () => {
  it('classifies a URL bookmark created directly in a valid configured Inbox', async () => {
    const dependencies = createDependencies();
    const workflow = new FilingWorkflow(dependencies);

    await expect(
      workflow.processCreatedBookmark({
        id: 'bookmark-1',
        title: 'TypeScript',
        parentId: 'inbox',
        url: 'https://www.typescriptlang.org/',
      }),
    ).resolves.toEqual({
      kind: 'filed',
      bookmarkId: 'bookmark-1',
      folderId: 'engineering',
      destinationPath: 'Destinations/Engineering',
      confidence: 0.9,
    });
    expect(dependencies.classifier.classify).toHaveBeenCalledWith({
      title: 'TypeScript',
      url: 'https://www.typescriptlang.org/',
      candidates,
      apiKey: 'secret-key',
      model: 'gpt-test',
    });
    expect(dependencies.activity.start).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'TypeScript',
    });
    expect(dependencies.activity.complete).toHaveBeenCalledOnce();
    expect(dependencies.activity.complete).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'TypeScript',
      outcome: {
        kind: 'filed',
        confidence: 0.9,
        destinationFolderId: 'engineering',
        destinationPath: 'Destinations/Engineering',
      },
    });
    expect(
      vi.mocked(dependencies.activity.start).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(dependencies.classifier.classify).mock.invocationCallOrder[0]!,
    );
  });

  it('does not classify a bookmark created outside the configured Inbox', async () => {
    const dependencies = createDependencies();
    const workflow = new FilingWorkflow(dependencies);

    await expect(
      workflow.processCreatedBookmark({
        id: 'bookmark-1',
        title: 'Already filed',
        parentId: 'engineering',
        url: 'https://example.com',
      }),
    ).resolves.toEqual({ kind: 'ineligible' });
    expect(dependencies.classifier.classify).not.toHaveBeenCalled();
    expect(dependencies.folderTree.loadSnapshot).not.toHaveBeenCalled();
    expect(dependencies.activity.start).not.toHaveBeenCalled();
    expect(dependencies.activity.complete).not.toHaveBeenCalled();
  });

  it('does not classify a folder or other node without a URL', async () => {
    const dependencies = createDependencies();
    const workflow = new FilingWorkflow(dependencies);

    await expect(
      workflow.processCreatedBookmark({
        id: 'folder-1',
        title: 'New folder',
        parentId: 'inbox',
      }),
    ).resolves.toEqual({ kind: 'ineligible' });
    expect(dependencies.configuration.load).not.toHaveBeenCalled();
    expect(dependencies.classifier.classify).not.toHaveBeenCalled();
    expect(dependencies.activity.start).not.toHaveBeenCalled();
  });

  it('does not classify when the configuration is missing or incomplete', async () => {
    const dependencies = createDependencies({
      configuration: { load: vi.fn(async () => null) },
    });
    const workflow = new FilingWorkflow(dependencies);

    await expect(
      workflow.processCreatedBookmark({
        id: 'bookmark-1',
        title: 'Unconfigured',
        parentId: 'inbox',
        url: 'https://example.com',
      }),
    ).resolves.toEqual({ kind: 'ineligible' });
    expect(dependencies.classifier.classify).not.toHaveBeenCalled();
    expect(dependencies.activity.start).not.toHaveBeenCalled();
  });

  it.each(['inbox', 'destinations'])(
    'does not classify when configured folder %s is stale',
    async (staleFolderId) => {
      const dependencies = createDependencies({
        folderTree: {
          loadSnapshot: vi.fn(async () => createSnapshot([staleFolderId])),
        },
      });
      const workflow = new FilingWorkflow(dependencies);

      await expect(
        workflow.processCreatedBookmark({
          id: 'bookmark-1',
          title: 'Stale configuration',
          parentId: 'inbox',
          url: 'https://example.com',
        }),
      ).resolves.toEqual({ kind: 'ineligible' });
      expect(dependencies.candidateBuilder.build).not.toHaveBeenCalled();
      expect(dependencies.classifier.classify).not.toHaveBeenCalled();
      expect(dependencies.activity.start).not.toHaveBeenCalled();
    },
  );

  it('does not classify when destinations become stale or empty during candidate construction', async () => {
    const dependencies = createDependencies({
      candidateBuilder: {
        build: vi.fn(async () => ({
          ok: false as const,
          reason: 'stale-destination-roots' as const,
          staleRootIds: ['destinations'],
        })),
      },
    });
    const workflow = new FilingWorkflow(dependencies);

    await expect(
      workflow.processCreatedBookmark({
        id: 'bookmark-1',
        title: 'Stale candidates',
        parentId: 'inbox',
        url: 'https://example.com',
      }),
    ).resolves.toEqual({ kind: 'ineligible' });
    expect(dependencies.classifier.classify).not.toHaveBeenCalled();
    expect(dependencies.activity.start).not.toHaveBeenCalled();
  });

  it('does not classify when the saved source and destination boundaries overlap', async () => {
    const overlappingSnapshot: CandidateFolderSnapshot = {
      ...createSnapshot(),
      isFolderAncestor: (ancestorFolderId, descendantFolderId) =>
        ancestorFolderId === 'inbox' && descendantFolderId === 'destinations',
    };
    const dependencies = createDependencies({
      folderTree: { loadSnapshot: vi.fn(async () => overlappingSnapshot) },
    });
    const workflow = new FilingWorkflow(dependencies);

    await expect(
      workflow.processCreatedBookmark({
        id: 'bookmark-1',
        title: 'Invalid boundaries',
        parentId: 'inbox',
        url: 'https://example.com',
      }),
    ).resolves.toEqual({ kind: 'ineligible' });
    expect(dependencies.classifier.classify).not.toHaveBeenCalled();
    expect(dependencies.activity.start).not.toHaveBeenCalled();
  });
});

describe('FilingWorkflow confidence gate', () => {
  it.each([
    {
      confidence: 0.79,
      expected: {
        kind: 'unresolved',
        reason: 'below-confidence-threshold',
        confidence: 0.79,
      },
    },
    {
      confidence: 0.8,
      expected: {
        kind: 'filed',
        bookmarkId: 'bookmark-1',
        folderId: 'engineering',
        destinationPath: 'Destinations/Engineering',
        confidence: 0.8,
      },
    },
    {
      confidence: 0.81,
      expected: {
        kind: 'filed',
        bookmarkId: 'bookmark-1',
        folderId: 'engineering',
        destinationPath: 'Destinations/Engineering',
        confidence: 0.81,
      },
    },
  ])(
    'evaluates confidence $confidence against the inclusive threshold',
    async ({ confidence, expected }) => {
      const dependencies = createDependencies({
        classifier: {
          classify: vi.fn(async () => ({
            kind: 'success' as const,
            folderId: 'engineering',
            confidence,
          })),
        },
      });
      const workflow = new FilingWorkflow(dependencies);

      await expect(
        workflow.processCreatedBookmark({
          id: 'bookmark-1',
          title: 'Threshold test',
          parentId: 'inbox',
          url: 'https://example.com',
        }),
      ).resolves.toEqual(expected);
      expect(dependencies.activity.start).toHaveBeenCalledOnce();
      expect(dependencies.activity.complete).toHaveBeenCalledOnce();
      expect(dependencies.activity.complete).toHaveBeenCalledWith({
        bookmarkId: 'bookmark-1',
        title: 'Threshold test',
        outcome:
          confidence < configuration.confidenceThreshold
            ? { kind: 'below-threshold', confidence }
            : {
                kind: 'filed',
                confidence,
                destinationFolderId: 'engineering',
                destinationPath: 'Destinations/Engineering',
              },
      });
    },
  );

  it.each(CLASSIFICATION_UNRESOLVED_CATEGORIES)(
    'leaves the bookmark unresolved for classifier category %s',
    async (category) => {
      const dependencies = createDependencies({
        classifier: {
          classify: vi.fn(async () => ({
            kind: 'unresolved' as const,
            category,
          })),
        },
      });
      const workflow = new FilingWorkflow(dependencies);

      await expect(
        workflow.processCreatedBookmark({
          id: 'bookmark-1',
          title: 'Unresolved classification',
          parentId: 'inbox',
          url: 'https://example.com',
        }),
      ).resolves.toEqual({ kind: 'unresolved', reason: category });
      expect(dependencies.activity.complete).toHaveBeenCalledOnce();
      expect(dependencies.activity.complete).toHaveBeenCalledWith({
        bookmarkId: 'bookmark-1',
        title: 'Unresolved classification',
        outcome: { kind: 'unresolved', reason: category },
      });
    },
  );

  it('sanitizes an unexpected accepted-event failure and leaves the bookmark unchanged', async () => {
    const dependencies = createDependencies({
      classifier: {
        classify: vi.fn(async () => {
          throw new Error('raw provider response and secret-key');
        }),
      },
    });

    await expect(
      new FilingWorkflow(dependencies).processCreatedBookmark({
        id: 'bookmark-1',
        title: 'Unexpected failure',
        parentId: 'inbox',
        url: 'https://example.com/private',
      }),
    ).resolves.toEqual({ kind: 'unexpected-failure' });
    expect(dependencies.bookmarks.moveBookmark).not.toHaveBeenCalled();
    expect(dependencies.activity.complete).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'Unexpected failure',
      outcome: { kind: 'unexpected-failure' },
    });
  });
});

describe('FilingWorkflow movement revalidation', () => {
  const createdBookmark = {
    id: 'bookmark-1',
    title: 'TypeScript',
    parentId: 'inbox',
    url: 'https://www.typescriptlang.org/',
  } as const;

  it('moves the same bookmark after fresh state remains valid', async () => {
    const dependencies = createDependencies();
    const workflow = new FilingWorkflow(dependencies);

    await expect(
      workflow.processCreatedBookmark(createdBookmark),
    ).resolves.toEqual({
      kind: 'filed',
      bookmarkId: 'bookmark-1',
      folderId: 'engineering',
      destinationPath: 'Destinations/Engineering',
      confidence: 0.9,
    });
    expect(dependencies.configuration.load).toHaveBeenCalledTimes(2);
    expect(dependencies.folderTree.loadSnapshot).toHaveBeenCalledTimes(2);
    expect(dependencies.bookmarks.getBookmark).toHaveBeenCalledWith(
      'bookmark-1',
    );
    expect(dependencies.bookmarks.moveBookmark).toHaveBeenCalledWith(
      'bookmark-1',
      'engineering',
    );
  });

  it('does not move a bookmark manually moved during classification', async () => {
    const dependencies = createDependencies({
      bookmarks: {
        getBookmark: vi.fn(async () => ({
          ...createdBookmark,
          parentId: 'manually-filed',
        })),
        moveBookmark: vi.fn(async () => undefined),
      },
    });

    await expect(
      new FilingWorkflow(dependencies).processCreatedBookmark(createdBookmark),
    ).resolves.toEqual({ kind: 'bookmark-changed' });
    expect(dependencies.bookmarks.moveBookmark).not.toHaveBeenCalled();
    expect(dependencies.activity.complete).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'TypeScript',
      outcome: { kind: 'canceled', reason: 'bookmark-changed' },
    });
  });

  it('does not move anything when the bookmark was deleted', async () => {
    const dependencies = createDependencies({
      bookmarks: {
        getBookmark: vi.fn(async () => null),
        moveBookmark: vi.fn(async () => undefined),
      },
    });

    await expect(
      new FilingWorkflow(dependencies).processCreatedBookmark(createdBookmark),
    ).resolves.toEqual({ kind: 'bookmark-changed' });
    expect(dependencies.bookmarks.moveBookmark).not.toHaveBeenCalled();
    expect(dependencies.activity.complete).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'TypeScript',
      outcome: { kind: 'canceled', reason: 'bookmark-changed' },
    });
  });

  it('does not move when configuration changed during classification', async () => {
    const changedConfiguration = { ...configuration, confidenceThreshold: 0.9 };
    const load = vi
      .fn<FilingWorkflowDependencies['configuration']['load']>()
      .mockResolvedValueOnce(configuration)
      .mockResolvedValueOnce(changedConfiguration);
    const dependencies = createDependencies({ configuration: { load } });

    await expect(
      new FilingWorkflow(dependencies).processCreatedBookmark(createdBookmark),
    ).resolves.toEqual({ kind: 'configuration-changed' });
    expect(dependencies.bookmarks.moveBookmark).not.toHaveBeenCalled();
    expect(dependencies.activity.complete).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'TypeScript',
      outcome: { kind: 'canceled', reason: 'configuration-changed' },
    });
  });

  it('does not move when the selected destination was deleted', async () => {
    const loadSnapshot = vi
      .fn<FilingWorkflowDependencies['folderTree']['loadSnapshot']>()
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot(['engineering']));
    const dependencies = createDependencies({ folderTree: { loadSnapshot } });

    await expect(
      new FilingWorkflow(dependencies).processCreatedBookmark(createdBookmark),
    ).resolves.toEqual({ kind: 'destination-changed' });
    expect(dependencies.bookmarks.moveBookmark).not.toHaveBeenCalled();
    expect(dependencies.activity.complete).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'TypeScript',
      outcome: { kind: 'canceled', reason: 'destination-changed' },
    });
  });

  it('does not move when the selected destination leaves the allowed roots', async () => {
    const loadSnapshot = vi
      .fn<FilingWorkflowDependencies['folderTree']['loadSnapshot']>()
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(createSnapshot([], () => false));
    const dependencies = createDependencies({ folderTree: { loadSnapshot } });

    await expect(
      new FilingWorkflow(dependencies).processCreatedBookmark(createdBookmark),
    ).resolves.toEqual({ kind: 'destination-changed' });
    expect(dependencies.bookmarks.moveBookmark).not.toHaveBeenCalled();
    expect(dependencies.activity.complete).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'TypeScript',
      outcome: { kind: 'canceled', reason: 'destination-changed' },
    });
  });
});

describe('FilingWorkflow accepted-event failures', () => {
  const createdBookmark = {
    id: 'bookmark-1',
    title: 'TypeScript',
    parentId: 'inbox',
    url: 'https://www.typescriptlang.org/',
  } as const;

  it.each([
    'classification',
    'bookmark revalidation',
    'configuration revalidation',
    'destination revalidation',
    'movement',
  ] as const)('records a sanitized failure when %s throws', async (stage) => {
    const dependencies = createDependencies();
    const failure = new Error('raw URL, credential, or provider detail');

    switch (stage) {
      case 'classification':
        vi.mocked(dependencies.classifier.classify).mockRejectedValue(failure);
        break;
      case 'bookmark revalidation':
        vi.mocked(dependencies.bookmarks.getBookmark).mockRejectedValue(
          failure,
        );
        break;
      case 'configuration revalidation':
        vi.mocked(dependencies.configuration.load)
          .mockResolvedValueOnce(configuration)
          .mockRejectedValueOnce(failure);
        break;
      case 'destination revalidation':
        vi.mocked(dependencies.folderTree.loadSnapshot)
          .mockResolvedValueOnce(createSnapshot())
          .mockRejectedValueOnce(failure);
        break;
      case 'movement':
        vi.mocked(dependencies.bookmarks.moveBookmark).mockRejectedValue(
          failure,
        );
        break;
    }

    await expect(
      new FilingWorkflow(dependencies).processCreatedBookmark(createdBookmark),
    ).resolves.toEqual({ kind: 'unexpected-failure' });
    expect(dependencies.activity.start).toHaveBeenCalledOnce();
    expect(dependencies.activity.complete).toHaveBeenCalledOnce();
    expect(dependencies.activity.complete).toHaveBeenCalledWith({
      bookmarkId: 'bookmark-1',
      title: 'TypeScript',
      outcome: { kind: 'unexpected-failure' },
    });
  });
});
