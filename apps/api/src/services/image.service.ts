import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import { query } from '../config/database';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import logger from '../logger/winston.logger';
import { getStorageClient, getPresignedUploadUrl, getPresignedDownloadUrl } from './storage';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

export interface ImageRecord {
  id: string;
  userId: string | null;
  key: string;
  fileName: string | null;
  contentType: string;
  size: number;
  createdAt: string;
}

let tableInitialized = false;

async function ensureImageTable(): Promise<void> {
  if (tableInitialized) return;
  await query(`
    CREATE TABLE IF NOT EXISTS images (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(255),
      storage_key TEXT NOT NULL UNIQUE,
      file_name VARCHAR(500),
      content_type VARCHAR(100) NOT NULL,
      size_bytes BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
  `);
  tableInitialized = true;
  logger.info('[Database] Images table verified / initialized in PostgreSQL');
}

function mapRow(row: any): ImageRecord {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.storage_key,
    fileName: row.file_name,
    contentType: row.content_type,
    size: Number(row.size_bytes),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function ownerPrefix(userId: string | null): string {
  return `images/${userId || 'anonymous'}/`;
}

function validateImage(contentType: unknown, size: unknown): { contentType: string; size: number } {
  if (typeof contentType !== 'string' || !ALLOWED_CONTENT_TYPES[contentType]) {
    throw new ApiError(400, 'Unsupported image type. Use PNG, JPEG, GIF, WebP or AVIF.');
  }
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new ApiError(400, 'Field "size" must be a positive number of bytes.');
  }
  if (bytes > MAX_IMAGE_BYTES) {
    throw new ApiError(413, `Image is too large. Maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
  }
  return { contentType, size: bytes };
}

export const imageService = {
  /**
   * Step 1: create a storage key and hand the client a pre-signed PUT URL.
   * Nothing is stored in the database until the client confirms the upload.
   */
  async createUploadTarget(
    userId: string | null,
    input: { fileName?: string; contentType?: string; size?: number }
  ) {
    const { contentType } = validateImage(input.contentType, input.size);
    const ext = ALLOWED_CONTENT_TYPES[contentType]!;
    const base = path
      .basename(input.fileName || 'image', path.extname(input.fileName || ''))
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 60);
    const key = `${ownerPrefix(userId)}${randomUUID()}-${base || 'image'}${ext}`;

    const result = await getPresignedUploadUrl({ key, contentType, expiresIn: 600 });
    return {
      uploadUrl: result.url,
      key: result.key,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      expiresIn: result.expiresIn,
    };
  },

  /**
   * Step 2: after the client PUT the file to storage, verify it exists and
   * persist a record in PostgreSQL.
   */
  async confirmUpload(
    userId: string | null,
    input: { key?: string; fileName?: string; contentType?: string }
  ): Promise<ImageRecord> {
    const { key } = input;
    if (!key || typeof key !== 'string' || !key.startsWith(ownerPrefix(userId)) || key.includes('..')) {
      throw new ApiError(400, 'Invalid storage key.');
    }

    let head;
    try {
      head = await getStorageClient().send(
        new HeadObjectCommand({ Bucket: ENV.STORAGE.BUCKET, Key: key })
      );
    } catch {
      throw new ApiError(400, 'Uploaded file was not found in storage. Upload it before confirming.');
    }

    const { contentType, size } = validateImage(head.ContentType, head.ContentLength);

    await ensureImageTable();
    const id = randomUUID();
    const result = await query(
      `INSERT INTO images (id, user_id, storage_key, file_name, content_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (storage_key) DO UPDATE SET file_name = EXCLUDED.file_name
       RETURNING *`,
      [id, userId, key, input.fileName?.slice(0, 500) || null, contentType, size]
    );
    return mapRow(result.rows[0]);
  },

  async getImage(id: string): Promise<ImageRecord | null> {
    await ensureImageTable();
    const result = await query('SELECT * FROM images WHERE id = $1', [id]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  /** Short-lived signed URL used to actually serve the image. */
  async getViewUrl(image: ImageRecord): Promise<string> {
    return getPresignedDownloadUrl({ key: image.key, expiresIn: 3600 });
  },
};
