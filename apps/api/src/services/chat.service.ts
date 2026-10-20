import { query } from '../config/database';
import { ApiChat, ApiChatMessage, ApiChatWithMessages } from '../types/chat';
import logger from '../logger/winston.logger';

let chatTablesInitialized = false;

/**
 * Ensures the chats and chat_messages tables and indexes exist in PostgreSQL.
 */
export async function ensureChatTables(): Promise<void> {
  if (chatTablesInitialized) return;
  try {
    const createTablesSql = `
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        title VARCHAR(500) NOT NULL DEFAULT 'New AI chat',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
      CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(255) PRIMARY KEY,
        chat_id VARCHAR(255) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        actions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at ASC);
    `;
    await query(createTablesSql);
    chatTablesInitialized = true;
    logger.info('[Database] Chats and ChatMessages tables verified / initialized in PostgreSQL');
  } catch (error: any) {
    logger.error(`[Database] Failed to ensure chats tables: ${error.message}`);
    throw error;
  }
}

function mapRowToChat(row: any): ApiChat {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || 'New AI chat',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

function mapRowToMessage(row: any): ApiChatMessage {
  let actions: any[] = [];
  if (row.actions) {
    try {
      actions = typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions;
    } catch {
      actions = [];
    }
  }

  return {
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    content: row.content || '',
    actions,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Derives a clean, concise title from the user's initial prompt.
 */
export function deriveChatTitle(message: string): string {
  if (!message || !message.trim()) return 'New AI chat';

  // Strip leading greetings, markdown symbols, extra whitespaces
  let cleaned = message
    .replace(/^[#*\-=>\s]+/, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  // Strip "Please ", "Can you ", "Help me "
  cleaned = cleaned.replace(/^(please\s+|can you\s+|could you\s+|help me\s+)/i, '');

  if (cleaned.length > 45) {
    cleaned = cleaned.slice(0, 42).trim() + '...';
  }

  // Capitalize first character
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) || 'New AI chat';
}

/**
 * List all chats for a given user or all guest chats, ordered by most recent activity.
 */
export async function listChats(userId?: string | null): Promise<ApiChat[]> {
  await ensureChatTables();
  let sql: string;
  let params: any[];

  if (userId) {
    sql = `SELECT * FROM chats WHERE user_id = $1 OR user_id IS NULL ORDER BY updated_at DESC LIMIT 100`;
    params = [userId];
  } else {
    sql = `SELECT * FROM chats ORDER BY updated_at DESC LIMIT 100`;
    params = [];
  }

  const result = await query(sql, params);
  return result.rows.map(mapRowToChat);
}

/**
 * Fetch a single chat by ID, including its full message thread in chronological order.
 */
export async function getChatWithMessages(
  chatId: string,
  userId?: string | null
): Promise<ApiChatWithMessages | null> {
  await ensureChatTables();

  let chatSql: string;
  let params: any[];

  if (userId) {
    chatSql = `SELECT * FROM chats WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`;
    params = [chatId, userId];
  } else {
    chatSql = `SELECT * FROM chats WHERE id = $1`;
    params = [chatId];
  }

  const chatResult = await query(chatSql, params);
  if (chatResult.rows.length === 0) return null;

  const chat = mapRowToChat(chatResult.rows[0]);

  const msgSql = `SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`;
  const msgResult = await query(msgSql, [chatId]);
  const messages = msgResult.rows.map(mapRowToMessage);

  return {
    ...chat,
    messages,
  };
}

/**
 * Creates a new chat session.
 */
export async function createChat(data: {
  id?: string;
  userId?: string | null;
  title?: string;
}): Promise<ApiChat> {
  await ensureChatTables();
  const id = data.id || `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const title = (data.title && data.title.trim()) || 'New AI chat';
  const userId = data.userId || null;

  const sql = `
    INSERT INTO chats (id, user_id, title, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *;
  `;
  const result = await query(sql, [id, userId, title]);
  return mapRowToChat(result.rows[0]);
}

/**
 * Updates the title of a chat.
 */
export async function updateChatTitle(
  chatId: string,
  title: string,
  userId?: string | null
): Promise<ApiChat | null> {
  await ensureChatTables();
  let sql: string;
  let params: any[];

  if (userId) {
    sql = `
      UPDATE chats
      SET title = $1, updated_at = NOW()
      WHERE id = $2 AND (user_id = $3 OR user_id IS NULL)
      RETURNING *;
    `;
    params = [title.trim(), chatId, userId];
  } else {
    sql = `
      UPDATE chats
      SET title = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    params = [title.trim(), chatId];
  }

  const result = await query(sql, params);
  if (result.rows.length === 0) return null;
  return mapRowToChat(result.rows[0]);
}

/**
 * Deletes a chat session and all cascading messages.
 */
export async function deleteChat(chatId: string, userId?: string | null): Promise<boolean> {
  await ensureChatTables();
  let sql: string;
  let params: any[];

  if (userId) {
    sql = `DELETE FROM chats WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`;
    params = [chatId, userId];
  } else {
    sql = `DELETE FROM chats WHERE id = $1`;
    params = [chatId];
  }

  const result = await query(sql, params);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Inserts a new chat message into an existing conversation.
 */
export async function addChatMessage(data: {
  id?: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions?: any[];
}): Promise<ApiChatMessage> {
  await ensureChatTables();
  const id = data.id || `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const actionsJson = JSON.stringify(data.actions || []);

  const msgSql = `
    INSERT INTO chat_messages (id, chat_id, role, content, actions, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *;
  `;
  const msgResult = await query(msgSql, [
    id,
    data.chatId,
    data.role,
    data.content,
    actionsJson,
  ]);

  // Touch the chat's updated_at
  await query(`UPDATE chats SET updated_at = NOW() WHERE id = $1`, [data.chatId]);

  return mapRowToMessage(msgResult.rows[0]);
}
