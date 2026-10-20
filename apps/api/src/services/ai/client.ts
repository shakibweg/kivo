import { GoogleGenAI } from '@google/genai';
import { ENV } from '../../config/env';
import { ApiError } from '../../utils/ApiError';

let client: GoogleGenAI | null = null;

/**
 * Returns the singleton GoogleGenAI client instance.
 */
export function getAiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = ENV.GEMINI.API_KEY;
    if (!apiKey) {
      throw new ApiError(
        500,
        'GEMINI_API_KEY is not configured in the environment. Please add it to your .env file.'
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
