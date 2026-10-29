import {
  CLASSIFICATION_UNRESOLVED_CATEGORIES,
  type ClassificationUnresolvedCategory,
} from './classification';

export const FILING_ACTIVITY_VERSION = 1 as const;

export const FILING_CANCELLATION_REASONS = [
  'bookmark-changed',
  'configuration-changed',
  'destination-changed',
] as const;

export type FilingCancellationReason =
  (typeof FILING_CANCELLATION_REASONS)[number];

export interface ProcessingFilingActivityOutcome {
  readonly kind: 'processing';
}

export interface FiledFilingActivityOutcome {
  readonly kind: 'filed';
  readonly confidence: number;
  readonly destinationFolderId: string;
  readonly destinationPath: string;
}

export interface UnresolvedFilingActivityOutcome {
  readonly kind: 'unresolved';
  readonly reason: ClassificationUnresolvedCategory;
}

export interface BelowThresholdFilingActivityOutcome {
  readonly kind: 'below-threshold';
  readonly confidence: number;
}

export interface CanceledFilingActivityOutcome {
  readonly kind: 'canceled';
  readonly reason: FilingCancellationReason;
}

export interface UnexpectedFailureFilingActivityOutcome {
  readonly kind: 'unexpected-failure';
}

export type TerminalFilingActivityOutcome =
  | FiledFilingActivityOutcome
  | UnresolvedFilingActivityOutcome
  | BelowThresholdFilingActivityOutcome
  | CanceledFilingActivityOutcome
  | UnexpectedFailureFilingActivityOutcome;

export type FilingActivityOutcome =
  ProcessingFilingActivityOutcome | TerminalFilingActivityOutcome;

export interface FilingActivity {
  readonly version: typeof FILING_ACTIVITY_VERSION;
  readonly bookmarkId: string;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly outcome: FilingActivityOutcome;
}

export interface FilingActivityIdentity {
  readonly bookmarkId: string;
  readonly title: string;
}

export interface FilingActivityCompletion extends FilingActivityIdentity {
  readonly outcome: TerminalFilingActivityOutcome;
}

export type FilingActivityListener = (
  activity: readonly FilingActivity[],
) => void;

export interface FilingActivityWriter {
  start(identity: FilingActivityIdentity): Promise<void>;
  complete(completion: FilingActivityCompletion): Promise<void>;
}

export interface FilingActivityStore extends FilingActivityWriter {
  load(): Promise<readonly FilingActivity[]>;
  clear(): Promise<void>;
  observe(listener: FilingActivityListener): () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    actualKeys.every((key) => keys.includes(key))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isConfidence(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isOneOf<T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T {
  return (
    typeof value === 'string' && choices.some((choice) => choice === value)
  );
}

export function parseFilingActivityOutcome(
  value: unknown,
): FilingActivityOutcome | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return null;
  }

  switch (value.kind) {
    case 'processing':
      return hasExactlyKeys(value, ['kind']) ? { kind: 'processing' } : null;
    case 'filed':
      return hasExactlyKeys(value, [
        'kind',
        'confidence',
        'destinationFolderId',
        'destinationPath',
      ]) &&
        isConfidence(value.confidence) &&
        isNonEmptyString(value.destinationFolderId) &&
        isNonEmptyString(value.destinationPath)
        ? {
            kind: 'filed',
            confidence: value.confidence,
            destinationFolderId: value.destinationFolderId,
            destinationPath: value.destinationPath,
          }
        : null;
    case 'unresolved':
      return hasExactlyKeys(value, ['kind', 'reason']) &&
        isOneOf(value.reason, CLASSIFICATION_UNRESOLVED_CATEGORIES)
        ? { kind: 'unresolved', reason: value.reason }
        : null;
    case 'below-threshold':
      return hasExactlyKeys(value, ['kind', 'confidence']) &&
        isConfidence(value.confidence)
        ? { kind: 'below-threshold', confidence: value.confidence }
        : null;
    case 'canceled':
      return hasExactlyKeys(value, ['kind', 'reason']) &&
        isOneOf(value.reason, FILING_CANCELLATION_REASONS)
        ? { kind: 'canceled', reason: value.reason }
        : null;
    case 'unexpected-failure':
      return hasExactlyKeys(value, ['kind'])
        ? { kind: 'unexpected-failure' }
        : null;
    default:
      return null;
  }
}

export function parseFilingActivity(value: unknown): FilingActivity | null {
  if (
    !isRecord(value) ||
    !hasExactlyKeys(value, [
      'version',
      'bookmarkId',
      'title',
      'createdAt',
      'updatedAt',
      'outcome',
    ]) ||
    value.version !== FILING_ACTIVITY_VERSION ||
    !isNonEmptyString(value.bookmarkId) ||
    typeof value.title !== 'string' ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    value.createdAt < 0 ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt) ||
    value.updatedAt < value.createdAt
  ) {
    return null;
  }

  const outcome = parseFilingActivityOutcome(value.outcome);
  if (outcome === null) {
    return null;
  }

  return {
    version: FILING_ACTIVITY_VERSION,
    bookmarkId: value.bookmarkId,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    outcome,
  };
}

export function parseFilingActivityHistory(
  value: unknown,
): readonly FilingActivity[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.map(parseFilingActivity);
  return parsed.some((activity) => activity === null)
    ? null
    : (parsed as FilingActivity[]);
}
