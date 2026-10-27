import {
  FILING_CONFIGURATION_VERSION,
  parseFilingConfiguration,
  validateSourceDestinationBoundaries,
  type ConfigurationParseResult,
  type FilingConfiguration,
} from './configuration';

export interface OptionsFolder {
  readonly id: string;
  readonly title: string;
  readonly path: string;
}

export interface OptionsFolderSnapshot {
  enumerateFolders(): readonly OptionsFolder[];
  isFolderAncestor(
    ancestorFolderId: string,
    descendantFolderId: string,
  ): boolean;
  findStaleFolderIds(folderIds: readonly string[]): readonly string[];
}

export interface OptionsBookmarkTree {
  loadSnapshot(): Promise<OptionsFolderSnapshot>;
}

export type OptionsApiKeyUpdate =
  | { readonly kind: 'preserve' }
  | { readonly kind: 'replace'; readonly apiKey: string };

export interface OptionsConfigurationStore {
  load(): Promise<FilingConfiguration | null>;
  save(
    draft: unknown,
    apiKeyUpdate: OptionsApiKeyUpdate,
  ): Promise<ConfigurationParseResult>;
  clearApiKey(): Promise<void>;
}

export interface OptionsViewState {
  readonly folders: readonly OptionsFolder[];
  readonly inboxFolderId: string;
  readonly destinationRootIds: readonly string[];
  readonly model: string;
  readonly confidenceThreshold: number;
  readonly hasConfiguredApiKey: boolean;
  readonly staleInboxFolderId: string | null;
  readonly staleDestinationRootIds: readonly string[];
}

export interface OptionsSaveInput {
  readonly inboxFolderId: string;
  readonly destinationRootIds: readonly string[];
  readonly model: string;
  readonly confidenceThreshold: number;
  readonly apiKeyReplacement: string;
}

export type OptionsSaveResult =
  | { readonly ok: true; readonly state: OptionsViewState }
  | { readonly ok: false; readonly errors: readonly string[] };

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;

function createViewState(
  configuration: FilingConfiguration | null,
  snapshot: OptionsFolderSnapshot,
): OptionsViewState {
  const staleFolderIds = configuration
    ? snapshot.findStaleFolderIds([
        configuration.inboxFolderId,
        ...configuration.destinationRootIds,
      ])
    : [];
  const staleFolderIdSet = new Set(staleFolderIds);

  return {
    folders: snapshot.enumerateFolders(),
    inboxFolderId: configuration?.inboxFolderId ?? '',
    destinationRootIds: configuration?.destinationRootIds ?? [],
    model: configuration?.model ?? '',
    confidenceThreshold:
      configuration?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD,
    hasConfiguredApiKey: configuration !== null,
    staleInboxFolderId:
      configuration && staleFolderIdSet.has(configuration.inboxFolderId)
        ? configuration.inboxFolderId
        : null,
    staleDestinationRootIds:
      configuration?.destinationRootIds.filter((folderId) =>
        staleFolderIdSet.has(folderId),
      ) ?? [],
  };
}

function staleFolderErrors(
  input: OptionsSaveInput,
  snapshot: OptionsFolderSnapshot,
): readonly string[] {
  const staleFolderIds = snapshot.findStaleFolderIds([
    input.inboxFolderId,
    ...input.destinationRootIds,
  ]);

  if (staleFolderIds.length === 0) {
    return [];
  }

  return [
    `Selected folders no longer exist. Choose replacements for: ${staleFolderIds.join(', ')}.`,
  ];
}

export class FilingOptionsController {
  constructor(
    private readonly store: OptionsConfigurationStore,
    private readonly bookmarkTree: OptionsBookmarkTree,
  ) {}

  async load(): Promise<OptionsViewState> {
    const [configuration, snapshot] = await Promise.all([
      this.store.load(),
      this.bookmarkTree.loadSnapshot(),
    ]);

    return createViewState(configuration, snapshot);
  }

  async save(input: OptionsSaveInput): Promise<OptionsSaveResult> {
    const [currentConfiguration, snapshot] = await Promise.all([
      this.store.load(),
      this.bookmarkTree.loadSnapshot(),
    ]);
    const folderErrors = staleFolderErrors(input, snapshot);

    if (folderErrors.length > 0) {
      return { ok: false, errors: folderErrors };
    }

    const apiKeyUpdate: OptionsApiKeyUpdate =
      input.apiKeyReplacement.length === 0
        ? { kind: 'preserve' }
        : { kind: 'replace', apiKey: input.apiKeyReplacement };
    const candidate = {
      version: FILING_CONFIGURATION_VERSION,
      inboxFolderId: input.inboxFolderId,
      destinationRootIds: [...input.destinationRootIds],
      openAiApiKey:
        apiKeyUpdate.kind === 'replace'
          ? apiKeyUpdate.apiKey
          : (currentConfiguration?.openAiApiKey ?? ''),
      model: input.model,
      confidenceThreshold: input.confidenceThreshold,
    };
    const parsedCandidate = parseFilingConfiguration(candidate);

    if (!parsedCandidate.ok) {
      return {
        ok: false,
        errors: parsedCandidate.issues.map(({ message }) => message),
      };
    }

    const boundaryIssues = validateSourceDestinationBoundaries(
      parsedCandidate.value,
      (ancestorFolderId, descendantFolderId) =>
        snapshot.isFolderAncestor(ancestorFolderId, descendantFolderId),
    );

    if (boundaryIssues.length > 0) {
      return {
        ok: false,
        errors: boundaryIssues.map(({ message }) => message),
      };
    }

    const saveResult = await this.store.save(candidate, apiKeyUpdate);

    if (!saveResult.ok) {
      return {
        ok: false,
        errors: saveResult.issues.map(({ message }) => message),
      };
    }

    return {
      ok: true,
      state: createViewState(saveResult.value, snapshot),
    };
  }

  async clearApiKey(): Promise<OptionsViewState> {
    await this.store.clearApiKey();
    return this.load();
  }
}
