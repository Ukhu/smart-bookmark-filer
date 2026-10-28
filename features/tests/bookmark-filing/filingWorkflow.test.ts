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
): CandidateFolderSnapshot {
  return {
    enumerateFolders: () => [],
    findStaleFolderIds: (folderIds) =>
      folderIds.filter((folderId) => staleFolderIds.includes(folderId)),
    isFolderAncestor: () => false,
  };
}

function createDependencies(
  overrides: Partial<FilingWorkflowDependencies> = {},
): FilingWorkflowDependencies {
  return {
    configuration: { load: vi.fn(async () => configuration) },
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
      kind: 'ready-to-file',
      bookmarkId: 'bookmark-1',
      folderId: 'engineering',
      confidence: 0.9,
    });
    expect(dependencies.classifier.classify).toHaveBeenCalledWith({
      title: 'TypeScript',
      url: 'https://www.typescriptlang.org/',
      candidates,
      apiKey: 'secret-key',
      model: 'gpt-test',
    });
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
  });
});

describe('FilingWorkflow confidence gate', () => {
  it.each([
    {
      confidence: 0.79,
      expected: {
        kind: 'unresolved',
        reason: 'below-confidence-threshold',
      },
    },
    {
      confidence: 0.8,
      expected: {
        kind: 'ready-to-file',
        bookmarkId: 'bookmark-1',
        folderId: 'engineering',
        confidence: 0.8,
      },
    },
    {
      confidence: 0.81,
      expected: {
        kind: 'ready-to-file',
        bookmarkId: 'bookmark-1',
        folderId: 'engineering',
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
    },
  );
});
