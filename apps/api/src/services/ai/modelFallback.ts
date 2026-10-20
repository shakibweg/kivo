import { getAiClient } from './client';
import { GEMINI_MODEL_PRIORITY } from '../../constants/ai.constants';
import logger from '../../logger/winston.logger';

/**
 * Returns the models to try, in order. A supported `preferred` model goes first;
 * unsupported values are ignored so clients can never pick an arbitrary model.
 */
export function getModelCandidates(preferred?: string): string[] {
  const rest = GEMINI_MODEL_PRIORITY.filter((model) => model !== preferred);
  return preferred && GEMINI_MODEL_PRIORITY.includes(preferred) ? [preferred, ...rest] : [...GEMINI_MODEL_PRIORITY];
}

/**
 * Runs `operation` with each candidate model until one succeeds (primary -> fallback).
 * Throws the last error if every model fails.
 */
export async function withModelFallback<T>(
  operation: (model: string) => Promise<T>,
  preferred?: string
): Promise<{ result: T; model: string }> {
  const candidates = getModelCandidates(preferred);
  let lastError: unknown;

  for (let index = 0; index < candidates.length; index += 1) {
    const model = candidates[index];
    try {
      return { result: await operation(model), model };
    } catch (error: any) {
      lastError = error;
      const next = candidates[index + 1];
      if (next) {
        logger.warn(`[AiService] Model '${model}' failed (${error?.status ?? ''} ${error?.message || error}); routing to '${next}'.`);
      }
    }
  }

  throw lastError;
}

/**
 * Creates a Gemini interaction, falling back to the secondary model if the primary fails.
 * The `model` field of `payload` is set by this helper.
 */
export async function createInteractionWithFallback(
  payload: Record<string, unknown>,
  preferred?: string
): Promise<{ interaction: any; model: string }> {
  const ai = getAiClient();
  const { result, model } = await withModelFallback(
    (model) => ai.interactions.create({ ...payload, model } as any),
    preferred
  );
  return { interaction: result, model };
}
