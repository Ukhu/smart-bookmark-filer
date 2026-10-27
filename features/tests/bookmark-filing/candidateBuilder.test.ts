import { describe, expect, it, vi } from 'vitest';

import {
  DestinationCandidateBuilder,
  type CandidateFolder,
  type CandidateFolderSnapshot,
} from '../../bookmark-filing/candidateBuilder';

interface FolderFixture extends CandidateFolder {
  readonly parentId?: string;
}

function createSnapshot(
  folders: readonly FolderFixture[],
): CandidateFolderSnapshot {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));

  return {
    enumerateFolders: () => folders,
    findStaleFolderIds: (folderIds) =>
      [...new Set(folderIds)].filter((folderId) => !foldersById.has(folderId)),
    isFolderAncestor: (ancestorFolderId, descendantFolderId) => {
      const visited = new Set<string>();
      let current = foldersById.get(descendantFolderId);

      while (current?.parentId !== undefined) {
        if (current.parentId === ancestorFolderId) {
          return true;
        }

        if (visited.has(current.parentId)) {
          return false;
        }

        visited.add(current.parentId);
        current = foldersById.get(current.parentId);
      }

      return false;
    },
  };
}

const folders: readonly FolderFixture[] = [
  { id: 'root', path: '/' },
  { id: 'engineering', parentId: 'root', path: 'Engineering' },
  {
    id: 'engineering-research',
    parentId: 'engineering',
    path: 'Engineering/Research',
  },
  {
    id: 'engineering-web',
    parentId: 'engineering-research',
    path: 'Engineering/Research/Web',
  },
  { id: 'personal', parentId: 'root', path: 'Personal' },
  {
    id: 'personal-research',
    parentId: 'personal',
    path: 'Personal/Research',
  },
];

describe('DestinationCandidateBuilder', () => {
  it('includes selected roots and recursive descendants with contextual paths', async () => {
    const builder = new DestinationCandidateBuilder({
      loadSnapshot: vi.fn(async () => createSnapshot(folders)),
    });

    await expect(builder.build(['engineering'])).resolves.toEqual({
      ok: true,
      candidates: [
        { folderId: 'engineering', path: 'Engineering' },
        {
          folderId: 'engineering-research',
          path: 'Engineering/Research',
        },
        {
          folderId: 'engineering-web',
          path: 'Engineering/Research/Web',
        },
      ],
    });
  });

  it('deduplicates overlapping roots by stable folder ID', async () => {
    const builder = new DestinationCandidateBuilder({
      loadSnapshot: vi.fn(async () => createSnapshot(folders)),
    });

    const result = await builder.build(['engineering', 'engineering-research']);

    expect(result).toEqual({
      ok: true,
      candidates: [
        { folderId: 'engineering', path: 'Engineering' },
        {
          folderId: 'engineering-research',
          path: 'Engineering/Research',
        },
        {
          folderId: 'engineering-web',
          path: 'Engineering/Research/Web',
        },
      ],
    });
  });

  it('keeps duplicate folder names distinct through IDs and contextual paths', async () => {
    const builder = new DestinationCandidateBuilder({
      loadSnapshot: vi.fn(async () => createSnapshot(folders)),
    });

    const result = await builder.build(['engineering-research', 'personal']);

    expect(result).toEqual({
      ok: true,
      candidates: [
        {
          folderId: 'engineering-research',
          path: 'Engineering/Research',
        },
        {
          folderId: 'engineering-web',
          path: 'Engineering/Research/Web',
        },
        { folderId: 'personal', path: 'Personal' },
        {
          folderId: 'personal-research',
          path: 'Personal/Research',
        },
      ],
    });
  });

  it('returns no candidates for an empty tree with no selected roots', async () => {
    const builder = new DestinationCandidateBuilder({
      loadSnapshot: vi.fn(async () => createSnapshot([])),
    });

    await expect(builder.build([])).resolves.toEqual({
      ok: true,
      candidates: [],
    });
  });

  it('rejects all candidate construction when any selected root is stale', async () => {
    const builder = new DestinationCandidateBuilder({
      loadSnapshot: vi.fn(async () => createSnapshot(folders)),
    });

    await expect(
      builder.build(['engineering', 'deleted-root']),
    ).resolves.toEqual({
      ok: false,
      reason: 'stale-destination-roots',
      staleRootIds: ['deleted-root'],
    });
  });

  it('loads a fresh tree snapshot for every candidate build', async () => {
    const loadSnapshot = vi
      .fn<() => Promise<CandidateFolderSnapshot>>()
      .mockResolvedValueOnce(createSnapshot(folders))
      .mockResolvedValueOnce(createSnapshot([]));
    const builder = new DestinationCandidateBuilder({ loadSnapshot });

    await builder.build(['engineering']);
    await builder.build([]);

    expect(loadSnapshot).toHaveBeenCalledTimes(2);
  });
});
