import { Request, Response } from 'express';
import {
  generateText as generateTextService,
  streamText as streamTextService,
  runPageAgent,
  generateInlineContent,
} from '../services/ai';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ENV } from '../config/env';
import { DEFAULT_GEMINI_MODEL, SUPPORTED_GEMINI_MODELS } from '../constants/ai.constants';

const MAX_MESSAGE_CHARS = 4000;
const MAX_PAGE_CONTENT_CHARS = 30_000;
const MAX_DOCUMENT_TEXT_CHARS = 30_000;

const optionalString = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

import {
  listChats as listChatsService,
  getChatWithMessages,
  createChat as createChatService,
  updateChatTitle as updateChatTitleService,
  deleteChat as deleteChatService,
  addChatMessage,
  deriveChatTitle,
} from '../services/chat.service';

/**
 * Controller for the AI sidebar agent (can create, update and delete pages, with session persistence).
 */
export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { message, currentPage, previousInteractionId, chatId } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'Field "message" is required and must be a non-empty string.');
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    throw new ApiError(400, `Message is too long (max ${MAX_MESSAGE_CHARS} characters).`);
  }

  const userId = ((req as any).user as { id?: string } | undefined)?.id ?? null;

  // Retrieve or create chat session
  let activeChat: { id: string; title: string; createdAt?: string; updatedAt?: string } | null = null;
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (typeof chatId === 'string' && chatId.trim()) {
    const existingChat = await getChatWithMessages(chatId.trim(), userId);
    if (existingChat) {
      activeChat = existingChat;
      history = existingChat.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    }
  }

  if (!activeChat) {
    const initialTitle = deriveChatTitle(message.trim());
    activeChat = await createChatService({
      userId,
      title: initialTitle,
    });
  } else if (activeChat.title === 'New AI chat') {
    // If it was newly opened with placeholder title, update to first user prompt
    const updatedTitle = deriveChatTitle(message.trim());
    await updateChatTitleService(activeChat.id, updatedTitle, userId);
    activeChat.title = updatedTitle;
  }

  // Record user message
  await addChatMessage({
    chatId: activeChat.id,
    role: 'user',
    content: message.trim(),
  });

  const page =
    currentPage && typeof currentPage === 'object' && typeof currentPage.id === 'string' && currentPage.id
      ? {
          id: currentPage.id.slice(0, 100),
          title: optionalString(currentPage.title, 300),
          content: optionalString(currentPage.content, MAX_PAGE_CONTENT_CHARS),
        }
      : undefined;

  const isStreaming = Boolean(
    req.body?.stream ||
    req.headers.accept === 'text/event-stream' ||
    req.query?.stream === 'true'
  );

  if (isStreaming) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.flushHeaders?.();

    res.write(
      `data: ${JSON.stringify({
        type: 'chat',
        chat: {
          id: activeChat.id,
          title: activeChat.title,
          updatedAt: new Date().toISOString(),
        },
      })}\n\n`
    );

    try {
      const result = await runPageAgent({
        message: message.trim(),
        userId,
        currentPage: page,
        previousInteractionId: optionalString(previousInteractionId, 200) || undefined,
        history,
        onAction: (action) => {
          res.write(`data: ${JSON.stringify({ type: 'action', action })}\n\n`);
        },
        onChunk: (chunk) => {
          const parts = chunk.split(/(\s+)/);
          for (const part of parts) {
            if (part) {
              res.write(`data: ${JSON.stringify({ type: 'chunk', text: part })}\n\n`);
            }
          }
        },
      });

      await addChatMessage({
        chatId: activeChat.id,
        role: 'assistant',
        content: result.reply,
        actions: result.actions,
      });

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          reply: result.reply,
          actions: result.actions,
          chat: {
            id: activeChat.id,
            title: activeChat.title,
            updatedAt: new Date().toISOString(),
          },
        })}\n\n`
      );
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Streaming failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
  }

  const result = await runPageAgent({
    message: message.trim(),
    userId,
    currentPage: page,
    previousInteractionId: optionalString(previousInteractionId, 200) || undefined,
    history,
  });

  // Record assistant message
  await addChatMessage({
    chatId: activeChat.id,
    role: 'assistant',
    content: result.reply,
    actions: result.actions,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        ...result,
        chat: {
          id: activeChat.id,
          title: activeChat.title,
          updatedAt: new Date().toISOString(),
        },
      },
      'AI response generated successfully'
    )
  );
});

/**
 * List all saved AI chats for the user.
 */
export const listUserChats = asyncHandler(async (req: Request, res: Response) => {
  const userId = ((req as any).user as { id?: string } | undefined)?.id ?? null;
  const chats = await listChatsService(userId);
  return res.status(200).json(new ApiResponse(200, chats, 'Chats retrieved successfully'));
});

/**
 * Get a specific chat session with its full message history.
 */
export const getChatById = asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params.chatId;
  const chatId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!chatId) throw new ApiError(400, 'Chat ID is required');

  const userId = ((req as any).user as { id?: string } | undefined)?.id ?? null;
  const chatData = await getChatWithMessages(chatId, userId);
  if (!chatData) {
    throw new ApiError(404, 'Chat not found');
  }
  return res.status(200).json(new ApiResponse(200, chatData, 'Chat retrieved successfully'));
});

/**
 * Create a new chat session explicitly.
 */
export const createNewChat = asyncHandler(async (req: Request, res: Response) => {
  const userId = ((req as any).user as { id?: string } | undefined)?.id ?? null;
  const { title } = req.body ?? {};
  const chatData = await createChatService({
    userId,
    title: typeof title === 'string' && title.trim() ? title.trim() : 'New AI chat',
  });
  return res.status(201).json(new ApiResponse(201, chatData, 'Chat created successfully'));
});

/**
 * Delete a chat session.
 */
export const deleteUserChat = asyncHandler(async (req: Request, res: Response) => {
  const rawId = req.params.chatId;
  const chatId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!chatId) throw new ApiError(400, 'Chat ID is required');

  const userId = ((req as any).user as { id?: string } | undefined)?.id ?? null;
  const success = await deleteChatService(chatId, userId);
  if (!success) {
    throw new ApiError(404, 'Chat not found or already deleted');
  }
  return res.status(200).json(new ApiResponse(200, { success: true }, 'Chat deleted successfully'));
});

/**
 * Controller for the inline "Edit with AI" prompt in the editor (returns HTML to insert).
 */
export const inlineContent = asyncHandler(async (req: Request, res: Response) => {
  const { prompt, pageTitle, documentText } = req.body ?? {};

  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new ApiError(400, 'Field "prompt" is required and must be a non-empty string.');
  }
  if (prompt.length > MAX_MESSAGE_CHARS) {
    throw new ApiError(400, `Prompt is too long (max ${MAX_MESSAGE_CHARS} characters).`);
  }

  const result = await generateInlineContent({
    prompt: prompt.trim(),
    pageTitle: optionalString(pageTitle, 300),
    documentText: optionalString(documentText, MAX_DOCUMENT_TEXT_CHARS),
  });

  return res.status(200).json(new ApiResponse(200, result, 'AI content generated successfully'));
});

/**
 * Controller for generating text using Gemini AI models.
 */
export const generateText = asyncHandler(async (req: Request, res: Response) => {
  const {
    prompt,
    model = DEFAULT_GEMINI_MODEL,
    systemInstruction,
    thinkingLevel,
    temperature,
    maxOutputTokens,
    previousInteractionId,
  } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    throw new ApiError(400, 'Field "prompt" is required and must be a string.');
  }

  const result = await generateTextService({
    prompt,
    model,
    systemInstruction,
    thinkingLevel,
    temperature,
    maxOutputTokens,
    previousInteractionId,
  });

  return res.status(200).json(new ApiResponse(200, result, 'Text generated successfully'));
});

/**
 * Controller for streaming text response using Gemini AI models.
 */
export const streamText = asyncHandler(async (req: Request, res: Response) => {
  const {
    prompt,
    model = DEFAULT_GEMINI_MODEL,
    systemInstruction,
    thinkingLevel,
    temperature,
    maxOutputTokens,
    previousInteractionId,
  } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    throw new ApiError(400, 'Field "prompt" is required and must be a string.');
  }

  const stream = await streamTextService({
    prompt,
    model,
    systemInstruction,
    thinkingLevel,
    temperature,
    maxOutputTokens,
    previousInteractionId,
  });

  // Setup SSE stream headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const chunk of stream as any) {
      let textChunk = '';
      if (chunk.event_type === 'step.delta' && chunk.delta?.type === 'text') {
        textChunk = chunk.delta.text || '';
      } else if (chunk.text) {
        textChunk = typeof chunk.text === 'function' ? chunk.text() : chunk.text;
      }

      if (textChunk) {
        res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
      }
    }
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message || 'Stream failed' })}\n\n`);
    res.end();
  }
});

/**
 * Controller to get current AI configuration status.
 */
export const getAiStatus = asyncHandler(async (_req: Request, res: Response) => {
  const isConfigured = Boolean(ENV.GEMINI.API_KEY);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        configured: isConfigured,
        defaultModel: DEFAULT_GEMINI_MODEL,
        supportedModels: SUPPORTED_GEMINI_MODELS,
      },
      'AI status retrieved successfully'
    )
  );
});
