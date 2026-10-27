export const FILING_CONFIGURATION_VERSION = 1 as const;

export interface FilingConfigurationV1 {
  readonly version: typeof FILING_CONFIGURATION_VERSION;
  readonly inboxFolderId: string;
  readonly destinationRootIds: readonly string[];
  readonly openAiApiKey: string;
  readonly model: string;
  readonly confidenceThreshold: number;
}

export type FilingConfiguration = FilingConfigurationV1;

export type ConfigurationField =
  | 'configuration'
  | 'version'
  | 'inboxFolderId'
  | 'destinationRootIds'
  | 'openAiApiKey'
  | 'model'
  | 'confidenceThreshold';

export type ConfigurationIssueCode =
  | 'invalid-type'
  | 'required'
  | 'unsupported-version'
  | 'out-of-range'
  | 'duplicate'
  | 'source-destination-overlap';

export interface ConfigurationIssue {
  readonly field: ConfigurationField;
  readonly code: ConfigurationIssueCode;
  readonly message: string;
}

export type ConfigurationParseResult =
  | { readonly ok: true; readonly value: FilingConfiguration }
  | { readonly ok: false; readonly issues: readonly ConfigurationIssue[] };

export type IsFolderAncestor = (
  ancestorFolderId: string,
  descendantFolderId: string,
) => boolean;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(
  record: Record<string, unknown>,
  field: Extract<
    ConfigurationField,
    'inboxFolderId' | 'openAiApiKey' | 'model'
  >,
  issues: ConfigurationIssue[],
): string | undefined {
  const value = record[field];

  if (typeof value !== 'string') {
    issues.push({
      field,
      code: 'invalid-type',
      message: `${field} must be a string.`,
    });
    return undefined;
  }

  if (value.trim().length === 0) {
    issues.push({
      field,
      code: 'required',
      message: `${field} is required.`,
    });
    return undefined;
  }

  return value;
}

function readDestinationRootIds(
  value: unknown,
  issues: ConfigurationIssue[],
): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({
      field: 'destinationRootIds',
      code: 'invalid-type',
      message: 'destinationRootIds must be an array of folder IDs.',
    });
    return undefined;
  }

  if (value.length === 0) {
    issues.push({
      field: 'destinationRootIds',
      code: 'required',
      message: 'At least one destination root is required.',
    });
    return undefined;
  }

  if (value.some((folderId) => typeof folderId !== 'string')) {
    issues.push({
      field: 'destinationRootIds',
      code: 'invalid-type',
      message: 'Every destination root ID must be a string.',
    });
    return undefined;
  }

  const folderIds = value as string[];
  if (folderIds.some((folderId) => folderId.trim().length === 0)) {
    issues.push({
      field: 'destinationRootIds',
      code: 'required',
      message: 'Destination root IDs cannot be empty.',
    });
    return undefined;
  }

  if (new Set(folderIds).size !== folderIds.length) {
    issues.push({
      field: 'destinationRootIds',
      code: 'duplicate',
      message: 'Destination root IDs must be unique.',
    });
    return undefined;
  }

  return [...folderIds];
}

export function parseFilingConfiguration(
  value: unknown,
): ConfigurationParseResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [
        {
          field: 'configuration',
          code: 'invalid-type',
          message: 'Filing configuration must be an object.',
        },
      ],
    };
  }

  const issues: ConfigurationIssue[] = [];

  if (value.version !== FILING_CONFIGURATION_VERSION) {
    issues.push({
      field: 'version',
      code: 'unsupported-version',
      message: `Configuration version must be ${FILING_CONFIGURATION_VERSION}.`,
    });
  }

  const inboxFolderId = readRequiredString(value, 'inboxFolderId', issues);
  const destinationRootIds = readDestinationRootIds(
    value.destinationRootIds,
    issues,
  );
  const openAiApiKey = readRequiredString(value, 'openAiApiKey', issues);
  const model = readRequiredString(value, 'model', issues);
  const confidenceThreshold = value.confidenceThreshold;

  if (typeof confidenceThreshold !== 'number') {
    issues.push({
      field: 'confidenceThreshold',
      code: 'invalid-type',
      message: 'confidenceThreshold must be a number.',
    });
  } else if (
    !Number.isFinite(confidenceThreshold) ||
    confidenceThreshold < 0 ||
    confidenceThreshold > 1
  ) {
    issues.push({
      field: 'confidenceThreshold',
      code: 'out-of-range',
      message: 'confidenceThreshold must be a finite number from 0 through 1.',
    });
  }

  if (
    issues.length > 0 ||
    inboxFolderId === undefined ||
    destinationRootIds === undefined ||
    openAiApiKey === undefined ||
    model === undefined ||
    typeof confidenceThreshold !== 'number'
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      version: FILING_CONFIGURATION_VERSION,
      inboxFolderId,
      destinationRootIds,
      openAiApiKey,
      model,
      confidenceThreshold,
    },
  };
}

export function validateSourceDestinationBoundaries(
  configuration: FilingConfiguration,
  isFolderAncestor: IsFolderAncestor,
): readonly ConfigurationIssue[] {
  const overlappingRootIds = configuration.destinationRootIds.filter(
    (destinationRootId) =>
      destinationRootId === configuration.inboxFolderId ||
      isFolderAncestor(configuration.inboxFolderId, destinationRootId) ||
      isFolderAncestor(destinationRootId, configuration.inboxFolderId),
  );

  if (overlappingRootIds.length === 0) {
    return [];
  }

  return [
    {
      field: 'destinationRootIds',
      code: 'source-destination-overlap',
      message: `The Inbox and destination roots must be separate. Overlapping root IDs: ${overlappingRootIds.join(', ')}.`,
    },
  ];
}
