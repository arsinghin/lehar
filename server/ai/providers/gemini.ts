/**
 * Google Gemini via the official @google/genai SDK.
 * The free-tier Flash models run with LOW thinking for latency, and with JSON-schema constrained output
 * so the response is machine-checkable.
 */
import { GoogleGenAI, ThinkingLevel, type GenerateContentParameters } from '@google/genai';

import { ProviderError, toProviderError, type AiProvider, type GenerateInput } from './types.js';

/** The slice of the SDK we use, which lets tests inject a fake client. */
export interface GeminiClientLike {
  models: {
    generateContent(
      params: GenerateContentParameters,
    ): Promise<{ readonly text?: string | undefined }>;
  };
}

export interface GeminiOptions {
  apiKey: string;
  model: string;
  client?: GeminiClientLike;
}

/** A Gemini provider. The SDK client is created on first use, so cold starts without a key stay cheap. */
export function createGeminiProvider({ apiKey, model, client }: GeminiOptions): AiProvider {
  let sdk: GeminiClientLike | undefined = client;
  return {
    id: `gemini:${model}`,
    source: 'gemini',
    model,
    async generate({
      system,
      prompt,
      jsonSchema,
      maxOutputTokens,
      signal,
    }: GenerateInput): Promise<string> {
      sdk ??= new GoogleGenAI({ apiKey });
      try {
        const response = await sdk.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            maxOutputTokens,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: signal,
          },
        });
        const text = response.text?.trim();
        if (!text) throw new ProviderError('Empty response from Gemini');
        return text;
      } catch (error) {
        throw toProviderError(error);
      }
    },
  };
}
