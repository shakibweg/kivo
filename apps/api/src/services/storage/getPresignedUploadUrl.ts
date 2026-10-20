import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getStorageClient } from './client';
import { PresignedUploadUrlOptions, PresignedUploadUrlResult } from './types';
import { ENV } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import logger from '../../logger/winston.logger';

/**
 * Generate a presigned URL for direct client-side upload (PUT) to S3.
 */
export async function getPresignedUploadUrl(
  options: PresignedUploadUrlOptions
): Promise<PresignedUploadUrlResult> {
  const {
    key,
    expiresIn = 3600,
    contentType = 'application/octet-stream',
    bucket = ENV.STORAGE.BUCKET,
  } = options;

  if (!key) {
    throw new ApiError(400, 'Storage key is required to generate presigned upload URL');
  }

  const s3 = getStorageClient();

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn });
    logger.debug(`[Storage] Generated presigned upload URL for '${key}' (expires: ${expiresIn}s)`);

    return {
      url,
      key,
      bucket,
      expiresIn,
    };
  } catch (error: any) {
    logger.error(`[Storage] Failed to generate upload URL for '${key}': ${error.message}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Failed to generate upload URL: ${error.message}`);
  }
}
