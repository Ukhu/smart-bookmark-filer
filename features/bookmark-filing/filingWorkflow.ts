import type { CandidateFolderSnapshot } from './candidateBuilder';
import type {
  BookmarkClassifier,
  BookmarkClassificationResult,
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

export interface FilingCandidateBuilder {
  build(
    destinationRootIds: readonly string[],
  ): Promise<DestinationCandidateBuildResult>;
}

export type InitialFilingResult =
  | { readonly kind: 'ineligible' }
  | {
      readonly kind: 'classified';
      readonly result: BookmarkClassificationResult;
    };

export interface FilingWorkflowDependencies {
  readonly configuration: FilingConfigurationReader;
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

export class FilingWorkflow {
  constructor(private readonly dependencies: FilingWorkflowDependencies) {}

  async processCreatedBookmark(
    bookmark: CreatedBookmark,
  ): Promise<InitialFilingResult> {
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

    return { kind: 'classified', result };
  }
}
