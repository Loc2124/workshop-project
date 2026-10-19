import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

let sharedPool: Pool | undefined;

export function getPool(): Pool {
  if (!sharedPool) {
    const isTestEnvironment = process.env.NODE_ENV === 'test';
    const connectionString = isTestEnvironment
      ? (process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL)
      : process.env.DATABASE_URL;

    if (!connectionString) {
      const target = isTestEnvironment ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
      throw new Error(`${target} is required to connect to PostgreSQL.`);
    }
    assertDatabaseUrl(connectionString);
    sharedPool = new Pool({ connectionString });
  }

  return sharedPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(
  action: (client: PoolClient) => Promise<T>,
  pool: Pool = getPool(),
): Promise<T> {
  const client = await pool.connect();
  let transactionStarted = false;
  let releaseError: Error | undefined;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const result = await action(client);
    await client.query('COMMIT');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        releaseError =
          rollbackError instanceof Error
            ? rollbackError
            : new Error('Transaction rollback failed.');
        throw new AggregateError(
          [error, rollbackError],
          'Database operation failed and its transaction could not be rolled back.',
          { cause: rollbackError },
        );
      }
    }
    throw error;
  } finally {
    client.release(releaseError);
  }
}

export async function closePool(): Promise<void> {
  if (sharedPool) {
    const pool = sharedPool;
    sharedPool = undefined;
    await pool.end();
  }
}

function assertDatabaseUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.username
  ) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with a host and username.',
    );
  }
  if (url.port !== '5432') {
    throw new Error(
      'DATABASE_URL must use port 5432 (Direct or Session pooler).',
    );
  }
}
