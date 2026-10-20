import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { testDatabaseConnection } from '../config/database';
import { testStorageConnection } from '../services/storage';
import { ENV } from '../config/env';

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  let dbStatus: { connected: boolean; latencyMs?: number; error?: string } = {
    connected: false,
  };

  let storageStatus: { connected: boolean; bucket?: string; latencyMs?: number; error?: string } = {
    connected: false,
  };

  if (ENV.DATABASE.URL) {
    dbStatus = await testDatabaseConnection();
  }

  if (ENV.STORAGE.ACCESS_KEY_ID && ENV.STORAGE.SECRET_ACCESS_KEY) {
    storageStatus = await testStorageConnection();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          configured: Boolean(ENV.DATABASE.URL),
          connected: dbStatus.connected,
          latencyMs: dbStatus.latencyMs,
          error: dbStatus.error,
        },
        storage: {
          configured: Boolean(ENV.STORAGE.ACCESS_KEY_ID && ENV.STORAGE.SECRET_ACCESS_KEY),
          bucket: ENV.STORAGE.BUCKET,
          connected: storageStatus.connected,
          latencyMs: storageStatus.latencyMs,
          error: storageStatus.error,
        },
      },
      'API service is healthy'
    )
  );
});
