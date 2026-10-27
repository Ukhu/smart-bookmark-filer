import type {
  BookmarkClassificationInput,
  BookmarkClassificationResult,
  BookmarkClassifier,
} from '../../features/bookmark-filing/classification';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_TIMEOUT_MS = 15_000;

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface OpenAiResponsesClassifierOptions {
  readonly fetchImplementation?: FetchImplementation;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOutputText(responseBody: unknown): string | undefined {
  if (!isRecord(responseBody) || !Array.isArray(responseBody.output)) {
    return undefined;
  }

  for (const outputItem of responseBody.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (
        isRecord(contentItem) &&
        contentItem.type === 'output_text' &&
        typeof contentItem.text === 'string'
      ) {
        return contentItem.text;
      }
    }
  }

  return undefined;
}

function parseClassification(
  responseBody: unknown,
  candidateIds: ReadonlySet<string>,
): BookmarkClassificationResult {
  const outputText = readOutputText(responseBody);

  if (outputText === undefined) {
    return { kind: 'unresolved', category: 'invalid-response' };
  }

  try {
    const classification: unknown = JSON.parse(outputText);

    if (
      !isRecord(classification) ||
      Object.keys(classification).length !== 2 ||
      typeof classification.folderId !== 'string' ||
      !candidateIds.has(classification.folderId) ||
      typeof classification.confidence !== 'number' ||
      !Number.isFinite(classification.confidence) ||
      classification.confidence < 0 ||
      classification.confidence > 1
    ) {
      return { kind: 'unresolved', category: 'invalid-response' };
    }

    return {
      kind: 'success',
      folderId: classification.folderId,
      confidence: classification.confidence,
    };
  } catch {
    return { kind: 'unresolved', category: 'invalid-response' };
  }
}

function providerFailure(status: number): BookmarkClassificationResult {
  if (status === 401 || status === 403) {
    return { kind: 'unresolved', category: 'authorization-error' };
  }

  if (status === 429) {
    return { kind: 'unresolved', category: 'rate-limit' };
  }

  return { kind: 'unresolved', category: 'provider-error' };
}

export class OpenAiResponsesClassifier implements BookmarkClassifier {
  private readonly fetchImplementation: FetchImplementation;
  private readonly timeoutMs: number;

  constructor(options: OpenAiResponsesClassifierOptions = {}) {
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new RangeError(
        'The OpenAI request timeout must be positive and finite.',
      );
    }
  }

  async classify(
    input: BookmarkClassificationInput,
  ): Promise<BookmarkClassificationResult> {
    if (input.candidates.length === 0) {
      return { kind: 'unresolved', category: 'no-candidates' };
    }

    if (input.apiKey.trim() === '' || input.model.trim() === '') {
      return { kind: 'unresolved', category: 'missing-credentials' };
    }

    const candidateIds = new Set(
      input.candidates.map((candidate) => candidate.folderId),
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImplementation(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: 'Classify the bookmark into exactly one supplied candidate folder. Use folder IDs for selection and paths only as context.',
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify({
                    title: input.title,
                    url: input.url,
                    candidates: input.candidates.map(({ folderId, path }) => ({
                      folderId,
                      path,
                    })),
                  }),
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'bookmark_classification',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  folderId: { type: 'string', enum: [...candidateIds] },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                },
                required: ['folderId', 'confidence'],
                additionalProperties: false,
              },
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return providerFailure(response.status);
      }

      let responseBody: unknown;

      try {
        responseBody = await response.json();
      } catch {
        return {
          kind: 'unresolved',
          category: controller.signal.aborted ? 'timeout' : 'invalid-response',
        };
      }

      return parseClassification(responseBody, candidateIds);
    } catch {
      return {
        kind: 'unresolved',
        category: controller.signal.aborted ? 'timeout' : 'network-error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
