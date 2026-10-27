import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BookmarkClassificationInput } from '../../../features/bookmark-filing/classification';

import { OpenAiResponsesClassifier } from '../../openai/openAiResponsesClassifier';

function successfulResponse(folderId: string, confidence: number): Response {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({ folderId, confidence }),
            },
          ],
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const validInput: BookmarkClassificationInput = {
  title: 'Structured outputs guide',
  url: 'https://platform.openai.com/docs/guides/structured-outputs',
  candidates: [
    { folderId: 'engineering', path: 'Engineering' },
    { folderId: 'research', path: 'Engineering/Research papers' },
  ],
  apiKey: 'personal-secret-key',
  model: 'configured-model',
};

function outputTextResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text }],
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function classificationResponse(classification: unknown): Response {
  return outputTextResponse(JSON.stringify(classification));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('OpenAiResponsesClassifier request contract', () => {
  it('sends only the configured model and privacy-bounded classification input', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(successfulResponse('research', 0.91));
    const classifier = new OpenAiResponsesClassifier({ fetchImplementation });

    const result = await classifier.classify(validInput);

    expect(result).toEqual({
      kind: 'success',
      folderId: 'research',
      confidence: 0.91,
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();

    const fetchCall = fetchImplementation.mock.calls[0];
    expect(fetchCall).toBeDefined();
    if (fetchCall === undefined) {
      throw new Error('Expected the classifier to call fetch.');
    }

    const [url, request] = fetchCall;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toEqual({
      Authorization: 'Bearer personal-secret-key',
      'Content-Type': 'application/json',
    });
    expect(request?.signal).toBeInstanceOf(AbortSignal);

    const body: unknown = JSON.parse(String(request?.body));
    expect(body).toEqual({
      model: 'configured-model',
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
                title: 'Structured outputs guide',
                url: 'https://platform.openai.com/docs/guides/structured-outputs',
                candidates: [
                  { folderId: 'engineering', path: 'Engineering' },
                  {
                    folderId: 'research',
                    path: 'Engineering/Research papers',
                  },
                ],
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
              folderId: {
                type: 'string',
                enum: ['engineering', 'research'],
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['folderId', 'confidence'],
            additionalProperties: false,
          },
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain('personal-secret-key');
  });

  it('aborts a request after the configured finite timeout', async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn<typeof fetch>((_url, request) => {
      return new Promise((_resolve, reject) => {
        request?.signal?.addEventListener('abort', () => {
          reject(
            new DOMException(
              'Bearer personal-secret-key Authorization',
              'AbortError',
            ),
          );
        });
      });
    });
    const classifier = new OpenAiResponsesClassifier({
      fetchImplementation,
      timeoutMs: 25,
    });

    const resultPromise = classifier.classify({
      title: 'Slow bookmark',
      url: 'https://example.com/slow',
      candidates: [{ folderId: 'inbox-target', path: 'Reading' }],
      apiKey: 'personal-secret-key',
      model: 'configured-model',
    });

    await vi.advanceTimersByTimeAsync(25);

    const result = await resultPromise;

    expect(result).toEqual({
      kind: 'unresolved',
      category: 'timeout',
    });
    expect(JSON.stringify(result)).not.toContain('personal-secret-key');
    expect(JSON.stringify(result)).not.toContain('Authorization');
  });
});

describe('OpenAiResponsesClassifier response validation', () => {
  it('accepts a valid candidate and finite confidence at either bound', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(successfulResponse('engineering', 0))
      .mockResolvedValueOnce(successfulResponse('research', 1));
    const classifier = new OpenAiResponsesClassifier({ fetchImplementation });

    await expect(classifier.classify(validInput)).resolves.toEqual({
      kind: 'success',
      folderId: 'engineering',
      confidence: 0,
    });
    await expect(classifier.classify(validInput)).resolves.toEqual({
      kind: 'success',
      folderId: 'research',
      confidence: 1,
    });
  });

  it('rejects an invented folder ID', async () => {
    const classifier = new OpenAiResponsesClassifier({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(successfulResponse('invented-folder', 0.99)),
    });

    await expect(classifier.classify(validInput)).resolves.toEqual({
      kind: 'unresolved',
      category: 'invalid-response',
    });
  });

  it.each([
    ['missing output', new Response(JSON.stringify({ output: [] }))],
    ['malformed HTTP JSON', new Response('not JSON')],
    ['malformed structured JSON', outputTextResponse('{not JSON')],
    ['missing confidence', classificationResponse({ folderId: 'research' })],
    [
      'additional fields',
      classificationResponse({
        folderId: 'research',
        confidence: 0.8,
        explanation: 'Not allowed',
      }),
    ],
    [
      'non-numeric confidence',
      classificationResponse({ folderId: 'research', confidence: '0.8' }),
    ],
  ])('rejects %s', async (_label, response) => {
    const classifier = new OpenAiResponsesClassifier({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(response as Response),
    });

    await expect(classifier.classify(validInput)).resolves.toEqual({
      kind: 'unresolved',
      category: 'invalid-response',
    });
  });

  it.each([
    ['below zero', '-0.01'],
    ['above one', '1.01'],
    ['non-finite', '1e999'],
  ])('rejects %s confidence', async (_label, confidence) => {
    const classifier = new OpenAiResponsesClassifier({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          outputTextResponse(
            `{"folderId":"research","confidence":${confidence}}`,
          ),
        ),
    });

    await expect(classifier.classify(validInput)).resolves.toEqual({
      kind: 'unresolved',
      category: 'invalid-response',
    });
  });
});

describe('OpenAiResponsesClassifier safe failures', () => {
  it.each([
    ['API key', { ...validInput, apiKey: '   ' }],
    ['model', { ...validInput, model: '' }],
  ])(
    'does not make a request when the %s is missing',
    async (_label, input) => {
      const fetchImplementation = vi.fn<typeof fetch>();
      const classifier = new OpenAiResponsesClassifier({ fetchImplementation });

      await expect(classifier.classify(input)).resolves.toEqual({
        kind: 'unresolved',
        category: 'missing-credentials',
      });
      expect(fetchImplementation).not.toHaveBeenCalled();
    },
  );

  it('does not make a request without destination candidates', async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const classifier = new OpenAiResponsesClassifier({ fetchImplementation });

    await expect(
      classifier.classify({ ...validInput, candidates: [] }),
    ).resolves.toEqual({ kind: 'unresolved', category: 'no-candidates' });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'authorization-error'],
    [403, 'authorization-error'],
    [429, 'rate-limit'],
    [400, 'provider-error'],
    [500, 'provider-error'],
  ] as const)('maps HTTP %s to %s', async (status, category) => {
    const classifier = new OpenAiResponsesClassifier({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('personal-secret-key Authorization', { status }),
        ),
    });

    const result = await classifier.classify(validInput);

    expect(result).toEqual({ kind: 'unresolved', category });
    expect(JSON.stringify(result)).not.toContain(validInput.apiKey);
    expect(JSON.stringify(result)).not.toContain('Authorization');
  });

  it('maps a network rejection to a redacted network failure', async () => {
    const classifier = new OpenAiResponsesClassifier({
      fetchImplementation: vi
        .fn<typeof fetch>()
        .mockRejectedValue(
          new Error(`Bearer ${validInput.apiKey} could not connect`),
        ),
    });

    const result = await classifier.classify(validInput);

    expect(result).toEqual({ kind: 'unresolved', category: 'network-error' });
    expect(JSON.stringify(result)).not.toContain(validInput.apiKey);
    expect(JSON.stringify(result)).not.toContain('Bearer');
  });
});
