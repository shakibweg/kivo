export interface GenerateTextOptions {
  prompt: string;
  model?: string;
  systemInstruction?: string;
  thinkingLevel?: 'low' | 'medium' | 'high';
  temperature?: number;
  maxOutputTokens?: number;
  previousInteractionId?: string;
}

export interface GenerateTextResult {
  text: string;
  interactionId?: string;
  model: string;
  thinkingLevel?: string;
}

/** A change the page agent made or page found in the user's workspace. */
export type AiActionType = 'created' | 'updated' | 'deleted' | 'found';

export interface AiAction {
  type: AiActionType;
  pageId: string;
  title: string;
}

export interface AiCurrentPage {
  id: string;
  title?: string;
  /** Rich-text HTML of the page as currently shown in the editor. */
  content?: string;
}

export interface PageAgentOptions {
  message: string;
  userId: string | null;
  currentPage?: AiCurrentPage;
  previousInteractionId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  onAction?: (action: AiAction) => void;
  onChunk?: (chunk: string) => void;
}

export interface PageAgentResult {
  reply: string;
  actions: AiAction[];
  interactionId?: string;
  model: string;
}

export interface InlineContentOptions {
  prompt: string;
  pageTitle?: string;
  documentText?: string;
}

export interface InlineContentResult {
  html: string;
  model: string;
}
