import { describe, expect, it, vi } from 'vitest';

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

describe('OpenAiResponsesClassifier request contract', () => {
  it('sends only the configured model and privacy-bounded classification input', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(successfulResponse('research', 0.91));
    const classifier = new OpenAiResponsesClassifier({ fetchImplementation });

    const result = await classifier.classify({
      title: 'Structured outputs guide',
      url: 'https://platform.openai.com/docs/guides/structured-outputs',
      candidates: [
        { folderId: 'engineering', path: 'Engineering' },
        { folderId: 'research', path: 'Engineering/Research papers' },
      ],
      apiKey: 'personal-secret-key',
      model: 'configured-model',
    });

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
          reject(new DOMException('Request aborted', 'AbortError'));
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

    await expect(resultPromise).resolves.toEqual({
      kind: 'unresolved',
      category: 'timeout',
    });
    vi.useRealTimers();
  });
});
