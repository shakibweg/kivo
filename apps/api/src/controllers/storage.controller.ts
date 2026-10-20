import { Request, Response } from 'express';
import {
  testStorageConnection,
  getPresignedDownloadUrl as getDownloadUrlService,
  getPresignedUploadUrl as getUploadUrlService,
  uploadFile as uploadFileService,
  deleteFile as deleteFileService,
} from '../services/storage';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ENV } from '../config/env';

/**
 * Controller to get current Storage status and configuration.
 */
export const getStorageStatus = asyncHandler(async (_req: Request, res: Response) => {
  const isConfigured = Boolean(ENV.STORAGE.ACCESS_KEY_ID && ENV.STORAGE.SECRET_ACCESS_KEY);

  let connectionStatus: { connected: boolean; latencyMs?: number; error?: string } = {
    connected: false,
  };

  if (isConfigured) {
    connectionStatus = await testStorageConnection();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        configured: isConfigured,
        bucket: ENV.STORAGE.BUCKET,
        region: ENV.STORAGE.REGION,
        endpoint: ENV.STORAGE.ENDPOINT || 'AWS Default',
        connected: connectionStatus.connected,
        latencyMs: connectionStatus.latencyMs,
        error: connectionStatus.error,
      },
      'Storage status retrieved successfully'
    )
  );
});

/**
 * Controller to generate a presigned download/view URL.
 */
export const getPresignedDownloadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { key, expiresIn, bucket } = req.body;

  if (!key || typeof key !== 'string') {
    throw new ApiError(400, 'Field "key" is required and must be a string.');
  }

  const url = await getDownloadUrlService({
    key,
    expiresIn: expiresIn ? Number(expiresIn) : 3600,
    bucket,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        url,
        key,
        bucket: bucket || ENV.STORAGE.BUCKET,
        expiresIn: expiresIn ? Number(expiresIn) : 3600,
      },
      'Presigned download URL generated successfully'
    )
  );
});

/**
 * Controller to generate a presigned upload URL (for direct client PUT).
 */
export const getPresignedUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { key, expiresIn, contentType, bucket } = req.body;

  if (!key || typeof key !== 'string') {
    throw new ApiError(400, 'Field "key" is required and must be a string.');
  }

  const result = await getUploadUrlService({
    key,
    expiresIn: expiresIn ? Number(expiresIn) : 3600,
    contentType: contentType || 'application/octet-stream',
    bucket,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Presigned upload URL generated successfully'));
});

/**
 * Controller to upload content directly from the backend.
 */
export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  const { key, content, contentType, bucket } = req.body;

  if (!key || typeof key !== 'string') {
    throw new ApiError(400, 'Field "key" is required and must be a string.');
  }

  if (content === undefined || content === null) {
    throw new ApiError(400, 'Field "content" is required.');
  }

  const body = typeof content === 'string' ? content : JSON.stringify(content);

  const result = await uploadFileService({
    key,
    body,
    contentType: contentType || 'text/plain',
    bucket,
  });

  return res.status(201).json(new ApiResponse(201, result, 'File uploaded successfully'));
});

/**
 * Controller to delete a file from storage.
 */
export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  const { key, bucket } = req.body;

  if (!key || typeof key !== 'string') {
    throw new ApiError(400, 'Field "key" is required and must be a string.');
  }

  await deleteFileService(key, bucket);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { key, bucket: bucket || ENV.STORAGE.BUCKET },
        'File deleted successfully'
      )
    );
});
