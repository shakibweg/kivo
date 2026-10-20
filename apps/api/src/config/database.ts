import { Pool, QueryResult, QueryResultRow } from 'pg';
import { ENV } from './env';
import logger from '../logger/winston.logger';

let pool: Pool | null = null;

/**
 * Returns the singleton PostgreSQL Pool instance.
 */
export function getDatabasePool(): Pool {
  if (!pool) {
    const connectionString = ENV.DATABASE.URL;

    if (!connectionString) {
      logger.warn('[Database] DATABASE_URL is not set. Database operations will fail.');
    }

    pool = new Pool({
      connectionString,
      ssl:
        connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('connect', () => {
      logger.info('[Database] New PostgreSQL client connected to the pool');
    });

    pool.on('error', (err: Error) => {
      logger.error(`[Database] Unexpected error on idle PostgreSQL client: ${err.message}`);
    });
  }

  return pool;
}

/**
 * Execute a SQL query using the connection pool.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const currentPool = getDatabasePool();
  try {
    const result = await currentPool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug(
      `[Database] Executed query: ${text} | Duration: ${duration}ms | Rows: ${result.rowCount}`
    );
    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    logger.error(
      `[Database] Query error: ${error.message} | Query: ${text} | Duration: ${duration}ms`
    );
    throw error;
  }
}

/**
 * Tests the PostgreSQL connection and returns status + latency.
 */
export async function testDatabaseConnection(): Promise<{
  connected: boolean;
  version?: string;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const result = await query('SELECT version() AS version, NOW() AS current_time');
    const latencyMs = Date.now() - start;
    const version = result.rows[0]?.version || 'Unknown';
    logger.info(`[Database] Connection test successful (${latencyMs}ms)`);
    return {
      connected: true,
      version,
      latencyMs,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;
    logger.error(`[Database] Connection test failed: ${error.message}`);
    return {
      connected: false,
      latencyMs,
      error: error.message,
    };
  }
}

/**
 * Closes the database connection pool gracefully.
 */
export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('[Database] Connection pool closed');
  }
}

export const db = {
  getPool: getDatabasePool,
  query,
  testConnection: testDatabaseConnection,
  close: closeDatabasePool,
};

export default db;
