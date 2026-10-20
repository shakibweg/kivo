import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getStorageClient } from './client';
import { ENV } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import logger from '../../logger/winston.logger';

/**
 * Delete an object from S3.
 */
export async function deleteFile(key: string, bucket: string = ENV.STORAGE.BUCKET): Promise<void> {
  if (!key) {
    throw new ApiError(400, 'Storage key is required for deletion');
  }

  const s3 = getStorageClient();

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    logger.info(`[Storage] Deleted object '${key}' from bucket '${bucket}'`);
  } catch (error: any) {
    logger.error(`[Storage] Delete failed for key '${key}': ${error.message}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Failed to delete file from storage: ${error.message}`);
  }
}
