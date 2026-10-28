import type { CandidateFolderSnapshot } from './candidateBuilder';
import type {
  BookmarkClassifier,
  BookmarkClassificationResult,
  ClassificationUnresolvedCategory,
} from './classification';
import {
  validateSourceDestinationBoundaries,
  type FilingConfiguration,
} from './configuration';
import type {
  DestinationCandidate,
  DestinationCandidateBuildResult,
} from './candidateBuilder';

export interface CreatedBookmark {
  readonly id: string;
  readonly title: string;
  readonly parentId?: string;
  readonly url?: string;
}

export interface FilingConfigurationReader {
  load(): Promise<FilingConfiguration | null>;
}

export interface FilingFolderTree {
  loadSnapshot(): Promise<CandidateFolderSnapshot>;
}

export interface FilingBookmarkAccess {
  getBookmark(bookmarkId: string): Promise<CreatedBookmark | null>;
  moveBookmark(bookmarkId: string, destinationFolderId: string): Promise<void>;
}

export interface FilingCandidateBuilder {
  build(
    destinationRootIds: readonly string[],
  ): Promise<DestinationCandidateBuildResult>;
}

export type FilingWorkflowResult =
  | { readonly kind: 'ineligible' }
  | {
      readonly kind: 'unresolved';
      readonly reason:
        'below-confidence-threshold' | ClassificationUnresolvedCategory;
    }
  | {
      readonly kind: 'filed';
      readonly bookmarkId: string;
      readonly folderId: string;
      readonly confidence: number;
    };

export interface FilingWorkflowDependencies {
  readonly configuration: FilingConfigurationReader;
  readonly bookmarks: FilingBookmarkAccess;
  readonly folderTree: FilingFolderTree;
  readonly candidateBuilder: FilingCandidateBuilder;
  readonly classifier: BookmarkClassifier;
}

function hasValidConfiguredFolders(
  configuration: FilingConfiguration,
  snapshot: CandidateFolderSnapshot,
): boolean {
  const configuredFolderIds = [
    configuration.inboxFolderId,
    ...configuration.destinationRootIds,
  ];

  if (snapshot.findStaleFolderIds(configuredFolderIds).length > 0) {
    return false;
  }

  return (
    validateSourceDestinationBoundaries(
      configuration,
      snapshot.isFolderAncestor.bind(snapshot),
    ).length === 0
  );
}

function hasCandidates(result: DestinationCandidateBuildResult): result is {
  readonly ok: true;
  readonly candidates: readonly DestinationCandidate[];
} {
  return result.ok && result.candidates.length > 0;
}

function configurationsMatch(
  first: FilingConfiguration,
  second: FilingConfiguration,
): boolean {
  return (
    first.version === second.version &&
    first.inboxFolderId === second.inboxFolderId &&
    first.openAiApiKey === second.openAiApiKey &&
    first.model === second.model &&
    first.confidenceThreshold === second.confidenceThreshold &&
    first.destinationRootIds.length === second.destinationRootIds.length &&
    first.destinationRootIds.every(
      (rootId, index) => rootId === second.destinationRootIds[index],
    )
  );
}

function isEligibleDestination(
  folderId: string,
  configuration: FilingConfiguration,
  snapshot: CandidateFolderSnapshot,
): boolean {
  if (snapshot.findStaleFolderIds([folderId]).length > 0) {
    return false;
  }

  return configuration.destinationRootIds.some(
    (rootId) =>
      rootId === folderId || snapshot.isFolderAncestor(rootId, folderId),
  );
}

export class FilingWorkflow {
  constructor(private readonly dependencies: FilingWorkflowDependencies) {}

  async processCreatedBookmark(
    bookmark: CreatedBookmark,
  ): Promise<FilingWorkflowResult> {
    if (bookmark.url === undefined) {
      return { kind: 'ineligible' };
    }

    const configuration = await this.dependencies.configuration.load();

    if (
      configuration === null ||
      bookmark.parentId !== configuration.inboxFolderId
    ) {
      return { kind: 'ineligible' };
    }

    const snapshot = await this.dependencies.folderTree.loadSnapshot();

    if (!hasValidConfiguredFolders(configuration, snapshot)) {
      return { kind: 'ineligible' };
    }

    const candidateResult = await this.dependencies.candidateBuilder.build(
      configuration.destinationRootIds,
    );

    if (!hasCandidates(candidateResult)) {
      return { kind: 'ineligible' };
    }

    const result = await this.dependencies.classifier.classify({
      title: bookmark.title,
      url: bookmark.url,
      candidates: candidateResult.candidates,
      apiKey: configuration.openAiApiKey,
      model: configuration.model,
    });

    const evaluated = evaluateClassification(
      bookmark.id,
      configuration,
      result,
    );

    if (evaluated.kind !== 'ready-to-file') {
      return evaluated;
    }

    const currentBookmark = await this.dependencies.bookmarks.getBookmark(
      bookmark.id,
    );
    if (currentBookmark?.parentId !== configuration.inboxFolderId) {
      return { kind: 'ineligible' };
    }

    const currentConfiguration = await this.dependencies.configuration.load();
    if (
      currentConfiguration === null ||
      !configurationsMatch(configuration, currentConfiguration)
    ) {
      return { kind: 'ineligible' };
    }

    const currentSnapshot = await this.dependencies.folderTree.loadSnapshot();
    if (
      !hasValidConfiguredFolders(currentConfiguration, currentSnapshot) ||
      !isEligibleDestination(
        evaluated.folderId,
        currentConfiguration,
        currentSnapshot,
      )
    ) {
      return { kind: 'ineligible' };
    }

    await this.dependencies.bookmarks.moveBookmark(
      bookmark.id,
      evaluated.folderId,
    );

    return { ...evaluated, kind: 'filed' };
  }
}

type ClassificationEvaluation =
  | Exclude<FilingWorkflowResult, { readonly kind: 'filed' }>
  | {
      readonly kind: 'ready-to-file';
      readonly bookmarkId: string;
      readonly folderId: string;
      readonly confidence: number;
    };

function evaluateClassification(
  bookmarkId: string,
  configuration: FilingConfiguration,
  result: BookmarkClassificationResult,
): ClassificationEvaluation {
  if (result.kind === 'unresolved') {
    return { kind: 'unresolved', reason: result.category };
  }

  if (result.confidence < configuration.confidenceThreshold) {
    return { kind: 'unresolved', reason: 'below-confidence-threshold' };
  }

  return {
    kind: 'ready-to-file',
    bookmarkId,
    folderId: result.folderId,
    confidence: result.confidence,
  };
}
