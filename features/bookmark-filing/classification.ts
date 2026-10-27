import type { DestinationCandidate } from './candidateBuilder';

export interface BookmarkClassificationInput {
  readonly title: string;
  readonly url: string;
  readonly candidates: readonly DestinationCandidate[];
  readonly apiKey: string;
  readonly model: string;
}

export const CLASSIFICATION_UNRESOLVED_CATEGORIES = [
  'no-candidates',
  'missing-credentials',
  'authorization-error',
  'rate-limit',
  'provider-error',
  'network-error',
  'timeout',
  'invalid-response',
] as const;

export type ClassificationUnresolvedCategory =
  (typeof CLASSIFICATION_UNRESOLVED_CATEGORIES)[number];

export interface ClassificationSuccess {
  readonly kind: 'success';
  readonly folderId: string;
  readonly confidence: number;
}

export interface ClassificationUnresolved {
  readonly kind: 'unresolved';
  readonly category: ClassificationUnresolvedCategory;
}

export type BookmarkClassificationResult =
  ClassificationSuccess | ClassificationUnresolved;

export interface BookmarkClassifier {
  classify(
    input: BookmarkClassificationInput,
  ): Promise<BookmarkClassificationResult>;
}
