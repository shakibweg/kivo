import { getAiClient } from './client';
import { GenerateTextOptions, GenerateTextResult } from './types';
import { DEFAULT_GEMINI_MODEL } from '../../constants/ai.constants';
import { ApiError } from '../../utils/ApiError';
import logger from '../../logger/winston.logger';

/**
 * Generates text response from a prompt using Gemini Interactions API.
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
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
    logger.info(`[AiService] Generating text with model '${model}'...`);

    const generationConfig: Record<string, unknown> = {};
    if (thinkingLevel) generationConfig.thinking_level = thinkingLevel;
    if (typeof temperature === 'number') generationConfig.temperature = temperature;
    if (typeof maxOutputTokens === 'number') generationConfig.max_output_tokens = maxOutputTokens;

    const payload: Record<string, unknown> = {
      model,
      input: prompt.trim(),
    };

    if (systemInstruction) {
      payload.system_instruction = systemInstruction;
    }

    if (Object.keys(generationConfig).length > 0) {
      payload.generation_config = generationConfig;
    }

    if (previousInteractionId) {
      payload.previous_interaction_id = previousInteractionId;
    }

    // 1. Try modern Interactions API
    if (ai.interactions && typeof ai.interactions.create === 'function') {
      const interaction = await ai.interactions.create(payload as any);
      const outputText =
        (interaction as any).output_text ||
        (interaction as any).outputText ||
        (interaction as any).steps?.[0]?.content?.[0]?.text ||
        '';

      return {
        text: outputText,
        interactionId: (interaction as any).id,
        model,
        thinkingLevel,
      };
    }

    // 2. Fallback to models.generateContent
    if (ai.models && typeof ai.models.generateContent === 'function') {
      const response = await ai.models.generateContent({
        model,
        contents: prompt.trim(),
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens,
        },
      } as any);

      return {
        text: (response as any).text || '',
        model,
        thinkingLevel,
      };
    }

    throw new ApiError(500, 'Unable to find compatible Gemini generation method on SDK client');
  } catch (error: any) {
    logger.error(`[AiService] Text generation failed: ${error.message || error}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error.message || 'Failed to generate text from Gemini API');
  }
}
