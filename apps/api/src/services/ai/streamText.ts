import { getAiClient } from './client';
import { GenerateTextOptions } from './types';
import { DEFAULT_GEMINI_MODEL } from '../../constants/ai.constants';
import { ApiError } from '../../utils/ApiError';
import logger from '../../logger/winston.logger';

/**
 * Streams text response using the Gemini Interactions API.
 */
export async function streamText(options: GenerateTextOptions) {
  const {
    prompt,
    model = DEFAULT_GEMINI_MODEL,
    systemInstruction,
    thinkingLevel,
    temperature,
    maxOutputTokens,
    previousInteractionId,
  } = options;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new ApiError(400, 'Prompt string is required');
  }

  const ai = getAiClient();

  try {
    logger.info(`[AiService] Streaming text with model '${model}'...`);

    const generationConfig: Record<string, unknown> = {};
    if (thinkingLevel) generationConfig.thinking_level = thinkingLevel;
    if (typeof temperature === 'number') generationConfig.temperature = temperature;
    if (typeof maxOutputTokens === 'number') generationConfig.max_output_tokens = maxOutputTokens;

    const payload: Record<string, unknown> = {
      model,
      input: prompt.trim(),
      stream: true,
    };

    if (systemInstruction) payload.system_instruction = systemInstruction;
    if (Object.keys(generationConfig).length > 0) payload.generation_config = generationConfig;
    if (previousInteractionId) payload.previous_interaction_id = previousInteractionId;

    if (ai.interactions && typeof ai.interactions.create === 'function') {
      return await ai.interactions.create(payload as any);
    }

    if (ai.models && typeof ai.models.generateContentStream === 'function') {
      return await ai.models.generateContentStream({
        model,
        contents: prompt.trim(),
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens,
        },
      } as any);
    }

    throw new ApiError(500, 'Streaming is not supported by current SDK client');
  } catch (error: any) {
    logger.error(`[AiService] Streaming failed: ${error.message || error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || 'Failed to stream response from Gemini API');
  }
}
