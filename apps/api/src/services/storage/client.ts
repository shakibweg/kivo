import { S3Client } from '@aws-sdk/client-s3';
import { ENV } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import logger from '../../logger/winston.logger';

let s3Client: S3Client | null = null;

/**
 * Returns the singleton S3Client instance.
 */
export function getStorageClient(): S3Client {
  if (!s3Client) {
    const { ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY, REGION } = ENV.STORAGE;

    if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
      throw new ApiError(
        500,
        'AWS S3 Storage credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are not configured.'
      );
    }

    s3Client = new S3Client({
      endpoint: ENDPOINT || undefined,
      region: REGION || 'ap-southeast-1',
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    logger.info(`[Storage] S3Client initialized with endpoint: ${ENDPOINT || 'AWS Default'}`);
  }

  return s3Client;
}
