export interface DestinationCandidate {
  readonly folderId: string;
  readonly path: string;
}

export interface CandidateFolder {
  readonly id: string;
  readonly path: string;
}

export interface CandidateFolderSnapshot {
  enumerateFolders(): readonly CandidateFolder[];
  isFolderAncestor(
    ancestorFolderId: string,
    descendantFolderId: string,
  ): boolean;
  findStaleFolderIds(folderIds: readonly string[]): readonly string[];
}

export interface CandidateBookmarkTree {
  loadSnapshot(): Promise<CandidateFolderSnapshot>;
}

export type DestinationCandidateBuildResult =
  | {
      readonly ok: true;
      readonly candidates: readonly DestinationCandidate[];
    }
  | {
      readonly ok: false;
      readonly reason: 'stale-destination-roots';
      readonly staleRootIds: readonly string[];
    };

export class DestinationCandidateBuilder {
  constructor(private readonly bookmarkTree: CandidateBookmarkTree) {}

  async build(
    destinationRootIds: readonly string[],
  ): Promise<DestinationCandidateBuildResult> {
    const snapshot = await this.bookmarkTree.loadSnapshot();
    const staleRootIds = snapshot.findStaleFolderIds(destinationRootIds);

    if (staleRootIds.length > 0) {
      return {
        ok: false,
        reason: 'stale-destination-roots',
        staleRootIds,
      };
    }

    const candidates: DestinationCandidate[] = [];
    const includedFolderIds = new Set<string>();

    for (const folder of snapshot.enumerateFolders()) {
      const isEligible = destinationRootIds.some(
        (rootId) =>
          rootId === folder.id || snapshot.isFolderAncestor(rootId, folder.id),
      );

      if (!isEligible || includedFolderIds.has(folder.id)) {
        continue;
      }

      includedFolderIds.add(folder.id);
      candidates.push({ folderId: folder.id, path: folder.path });
    }

    return { ok: true, candidates };
  }
}
