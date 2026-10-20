import { query } from '../config/database';
import { ApiPage } from '../types/page';
import logger from '../logger/winston.logger';

let tableInitialized = false;

/**
 * Ensures the pages table and indexes exist in PostgreSQL.
 */
export async function ensurePageTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS pages (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        parent_id VARCHAR(255) REFERENCES pages(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL DEFAULT 'Untitled',
        icon VARCHAR(100),
        cover_image TEXT,
        quote TEXT,
        content TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
      CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
    `;
    await query(createTableSql);
    tableInitialized = true;
    logger.info('[Database] Pages table verified / initialized in PostgreSQL');
  } catch (error: any) {
    logger.error(`[Database] Failed to ensure pages table: ${error.message}`);
    throw error;
  }
}

function mapRowToPage(row: any): ApiPage {
  return {
    id: row.id,
    userId: row.user_id,
    parentId: row.parent_id,
    title: row.title || 'Untitled',
    icon: row.icon || null,
    coverImage: row.cover_image || null,
    quote: row.quote || null,
    content: row.content || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    children: [],
  };
}

/**
 * Builds a hierarchical tree from a flat list of pages.
 */
export function buildPageHierarchy(flatPages: ApiPage[]): ApiPage[] {
  const map = new Map<string, ApiPage>();

  flatPages.forEach((page) => {
    map.set(page.id, { ...page, children: [] });
  });

  const rootPages: ApiPage[] = [];

  flatPages.forEach((page) => {
    const current = map.get(page.id)!;
    if (page.parentId && map.has(page.parentId)) {
      map.get(page.parentId)!.children!.push(current);
    } else {
      rootPages.push(current);
    }
  });

  return rootPages;
}

export const pageService = {
  async getPages(userId?: string | null): Promise<ApiPage[]> {
    await ensurePageTable();
    let sql: string;
    let params: unknown[];

    if (userId) {
      sql = `SELECT * FROM pages WHERE user_id = $1 ORDER BY created_at ASC`;
      params = [userId];
    } else {
      sql = `SELECT * FROM pages WHERE user_id IS NULL ORDER BY created_at ASC`;
      params = [];
    }

    const result = await query(sql, params);
    const flatPages = result.rows.map(mapRowToPage);

    return buildPageHierarchy(flatPages);
  },

  async getPageById(id: string, userId?: string | null): Promise<ApiPage | null> {
    await ensurePageTable();
    let sql: string;
    let params: unknown[];

    if (userId) {
      sql = `SELECT * FROM pages WHERE id = $1 AND user_id = $2 LIMIT 1`;
      params = [id, userId];
    } else {
      sql = `SELECT * FROM pages WHERE id = $1 AND user_id IS NULL LIMIT 1`;
      params = [id];
    }

    const result = await query(sql, params);
    if (result.rows.length === 0) return null;
    return mapRowToPage(result.rows[0]);
  },

  async createPage(data: {
    id?: string;
    userId?: string | null;
    parentId?: string | null;
    title?: string;
    icon?: string | null;
    coverImage?: string | null;
    quote?: string | null;
    content?: string | null;
  }): Promise<ApiPage> {
    await ensurePageTable();
    const id = data.id || `pg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const title = data.title || 'Untitled';
    const content = data.content ?? '';

    const sql = `
      INSERT INTO pages (id, user_id, parent_id, title, icon, cover_image, quote, content, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;

    const params = [
      id,
      data.userId || null,
      data.parentId || null,
      title,
      data.icon || null,
      data.coverImage || null,
      data.quote || null,
      content,
    ];

    const result = await query(sql, params);
    return mapRowToPage(result.rows[0]);
  },

  async updatePage(
    id: string,
    updates: Partial<ApiPage>,
    userId?: string | null
  ): Promise<ApiPage | null> {
    await ensurePageTable();
    const existing = await this.getPageById(id, userId);
    if (!existing) return null;

    const fields: string[] = [];
    const params: unknown[] = [id];
    let index = 2;

    if (updates.title !== undefined) {
      fields.push(`title = $${index++}`);
      params.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push(`content = $${index++}`);
      params.push(updates.content);
    }
    if (updates.quote !== undefined) {
      fields.push(`quote = $${index++}`);
      params.push(updates.quote);
    }
    if (updates.icon !== undefined) {
      fields.push(`icon = $${index++}`);
      params.push(updates.icon);
    }
    if (updates.coverImage !== undefined) {
      fields.push(`cover_image = $${index++}`);
      params.push(updates.coverImage);
    }
    if (updates.parentId !== undefined) {
      fields.push(`parent_id = $${index++}`);
      params.push(updates.parentId);
    }

    fields.push(`updated_at = NOW()`);

    const sql = `
      UPDATE pages
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(sql, params);
    if (result.rows.length === 0) return null;
    return mapRowToPage(result.rows[0]);
  },

  async deletePage(id: string, userId?: string | null): Promise<boolean> {
    await ensurePageTable();
    let sql: string;
    let params: unknown[];

    if (userId) {
      sql = `DELETE FROM pages WHERE id = $1 AND user_id = $2`;
      params = [id, userId];
    } else {
      sql = `DELETE FROM pages WHERE id = $1 AND user_id IS NULL`;
      params = [id];
    }

    const result = await query(sql, params);
    return (result.rowCount ?? 0) > 0;
  },

  async searchPages(keyword: string, userId?: string | null): Promise<ApiPage[]> {
    await ensurePageTable();
    const term = `%${keyword.trim()}%`;
    let sql: string;
    let params: unknown[];

    if (userId) {
      sql = `
        SELECT * FROM pages
        WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $2)
        ORDER BY updated_at DESC
        LIMIT 20
      `;
      params = [userId, term];
    } else {
      sql = `
        SELECT * FROM pages
        WHERE user_id IS NULL AND (title ILIKE $1 OR content ILIKE $1)
        ORDER BY updated_at DESC
        LIMIT 20
      `;
      params = [term];
    }

    const result = await query(sql, params);
    return result.rows.map(mapRowToPage);
  },
};
