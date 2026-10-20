import { PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { getStorageClient } from './client';
import { UploadFileOptions, UploadFileResult } from './types';
import { ENV } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import logger from '../../logger/winston.logger';

/**
 * Upload an object / file buffer directly to S3 bucket.
 */
export async function uploadFile(options: UploadFileOptions): Promise<UploadFileResult> {
  const {
    key,
    body,
    contentType = 'application/octet-stream',
    bucket = ENV.STORAGE.BUCKET,
  } = options;

  if (!key) {
    throw new ApiError(400, 'Storage key is required for upload');
  }

  const s3 = getStorageClient();

  try {
    const commandInput: PutObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    };

    const response = await s3.send(new PutObjectCommand(commandInput));
    logger.info(`[Storage] Uploaded object '${key}' to bucket '${bucket}'`);

    return {
      key,
      bucket,
      eTag: response.ETag,
    };
  } catch (error: any) {
    logger.error(`[Storage] Upload failed for key '${key}': ${error.message}`);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Storage upload failed: ${error.message}`);
  }
}
