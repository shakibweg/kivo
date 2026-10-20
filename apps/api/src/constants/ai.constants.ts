/**
 * Google Gemini AI constants and model configurations.
 *
 * Only these two models are used. They are tried in order: if a request to the first one fails,
 * it is automatically routed to the next one (see services/ai/modelFallback.ts).
 */
export const GEMINI_MODELS = {
  FLASH_LITE_3_5: 'gemini-3.5-flash-lite',
  FLASH_LITE_3_1: 'gemini-3.1-flash-lite',
} as const;

/** Models in priority order (primary first, fallback after). */
export const GEMINI_MODEL_PRIORITY: readonly string[] = [
  GEMINI_MODELS.FLASH_LITE_3_5,
  GEMINI_MODELS.FLASH_LITE_3_1,
];

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS.FLASH_LITE_3_5;

export const SUPPORTED_GEMINI_MODELS: string[] = [...GEMINI_MODEL_PRIORITY];

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

export const THINKING_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[keyof typeof THINKING_LEVELS];
