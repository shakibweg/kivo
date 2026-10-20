import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getStorageClient } from './client';
import { PresignedUrlOptions } from './types';
import { ENV } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import logger from '../../logger/winston.logger';

/**
 * Generate a presigned URL to download/view an object from S3.
 */
export async function getPresignedDownloadUrl(options: PresignedUrlOptions): Promise<string> {
  const { key, expiresIn = 3600, bucket = ENV.STORAGE.BUCKET } = options;

  if (!key) {
    throw new ApiError(400, 'Storage key is required to generate presigned download URL');
  }

  const s3 = getStorageClient();

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn });
    logger.debug(
      `[Storage] Generated presigned download URL for '${key}' (expires: ${expiresIn}s)`
    );
    return url;
  } catch (error: any) {
    logger.error(`[Storage] Failed to generate download URL for '${key}': ${error.message}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Failed to generate download URL: ${error.message}`);
  }
}
