import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { getStorageClient } from './client';
import { StorageConnectionStatus } from './types';
import { ENV } from '../../config/env';
import logger from '../../logger/winston.logger';

/**
 * Tests connection to S3 storage bucket.
 */
export async function testStorageConnection(): Promise<StorageConnectionStatus> {
  const start = Date.now();
  const bucket = ENV.STORAGE.BUCKET;

  try {
    const s3 = getStorageClient();
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    const latencyMs = Date.now() - start;
    logger.info(`[Storage] Storage bucket '${bucket}' verified successfully (${latencyMs}ms)`);
    return {
      connected: true,
      bucket,
      latencyMs,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    logger.error(
      `[Storage] Storage connection check failed for bucket '${bucket}': ${error.message}`
    );
    return {
      connected: false,
      bucket,
      latencyMs,
      error: error.message,
    };
  }
}
