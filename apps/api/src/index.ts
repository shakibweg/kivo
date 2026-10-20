import { app } from './app';
import { ENV } from './config/env';
import { testDatabaseConnection } from './config/database';
import { testStorageConnection } from './services/storage';
import logger from './logger/winston.logger';

export const startServer = () => {
  try {
    const server = app.listen(ENV.PORT, async () => {
      logger.info(`🚀 Kivo API server running on http://localhost:${ENV.PORT}`);
      logger.info(`🔑 Google Auth Endpoint: http://localhost:${ENV.PORT}/api/auth/google`);
      logger.info(`🤖 AI Endpoints: http://localhost:${ENV.PORT}/api/ai`);
      logger.info(`📦 Storage Endpoints: http://localhost:${ENV.PORT}/api/storage`);
      logger.info(`🩺 Health Check: http://localhost:${ENV.PORT}/api/health`);

      if (ENV.DATABASE.URL) {
        const dbStatus = await testDatabaseConnection();
        if (dbStatus.connected) {
          logger.info(`🗄️ PostgreSQL database connected successfully (${dbStatus.latencyMs}ms)`);
          const { ensurePageTable } = await import('./services/page.service');
          await ensurePageTable().catch((err) =>
            logger.error(`[Database] Error initializing pages table: ${err.message}`)
          );
          const { ensureChatTables } = await import('./services/chat.service');
          await ensureChatTables().catch((err) =>
            logger.error(`[Database] Error initializing chats tables: ${err.message}`)
          );
        } else {
          logger.warn(`⚠️ PostgreSQL connection warning: ${dbStatus.error}`);
        }
      }

      if (ENV.STORAGE.ACCESS_KEY_ID && ENV.STORAGE.SECRET_ACCESS_KEY) {
        const storageStatus = await testStorageConnection();
        if (storageStatus.connected) {
          logger.info(
            `📦 S3 Storage bucket '${storageStatus.bucket}' verified successfully (${storageStatus.latencyMs}ms)`
          );
        } else {
          logger.warn(`⚠️ Storage connection warning: ${storageStatus.error}`);
        }
      }
    });
    return server;
  } catch (error) {
    logger.error(`Failed to start server: ${String(error)}`);
    process.exit(1);
  }
};

startServer();
