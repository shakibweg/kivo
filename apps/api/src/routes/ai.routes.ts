import { Router } from 'express';
import {
  generateText,
  streamText,
  getAiStatus,
  chat,
  inlineContent,
  listUserChats,
  getChatById,
  createNewChat,
  deleteUserChat,
} from '../controllers/ai.controller';
import { optionalAuth } from '../middlewares/auth.middleware';

const router = Router();

// 1. Status route
router.get('/status', getAiStatus);

// 2. Text generation route
router.post('/generate', generateText);
router.post('/text', generateText);

// 3. Streaming text route
router.post('/stream', streamText);

// 4. Chat sessions management
router.get('/chats', optionalAuth, listUserChats);
router.post('/chats', optionalAuth, createNewChat);
router.get('/chats/:chatId', optionalAuth, getChatById);
router.delete('/chats/:chatId', optionalAuth, deleteUserChat);

// 5. Page agent (sidebar) and inline editor prompt
router.post('/chat', optionalAuth, chat);
router.post('/inline', optionalAuth, inlineContent);

export default router;
