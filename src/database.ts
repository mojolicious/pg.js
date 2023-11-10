import type {Notification, PoolClient, QueryConfig} from 'pg';
import {on} from 'events';
import {Base} from './base.js';
import {Results} from './results.js';
import {Transaction} from './transaction.js';
import {throwWithContext} from './util.js';

interface DatabaseEvents {
  end: (this: Database) => void;
  notification: (this: Database, message: Notification) => void;
}

declare interface DatabaseEventEmitter {
  on: <T extends keyof DatabaseEvents>(event: T, listener: DatabaseEvents[T]) => this;
  once: <T extends keyof DatabaseEvents>(event: T, listener: DatabaseEvents[T]) => this;
  emit: <T extends keyof DatabaseEvents>(event: T, ...args: Parameters<DatabaseEvents[T]>) => boolean;
}

interface DatabaseOptions {
  verboseErrors: boolean;
}

interface PidResult {
  pg_backend_pid: number;
}

interface TablesResult {
  schemaname: string;
  tablename: string;
}

const DEBUG = process.env.MOJO_PG_DEBUG === '1';

/**
 * PostgreSQL database connection class.
 */
class Database extends Base implements DatabaseEventEmitter {
  /**
   * PostgreSQL client.
   */
  client: PoolClient;
  /**
   * Show SQL context for errors.
   */
  verboseErrors = true;

  _channels: string[] = [];

  constructor(client: PoolClient, options: DatabaseOptions) {
    super();
    this.client = client;
    this.verboseErrors = options.verboseErrors;
    client.on('end', () => this.emit('end'));
    client.on('notification', message => this.emit('notification', message));
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<Notification> {
    const ac = new AbortController();
    this.once('end', () => ac.abort());

    try {
      for await (const [message] of on(this, 'notification', {signal: ac.signal})) {
        yield message;
      }
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
    }
  }

  async [Symbol.asyncDispose]() {
    await this.release();
  }

  /**
   * Start transaction.
   */
  async begin(): Promise<Transaction> {
    await this.client.query('BEGIN');
    return new Transaction(this);
  }

  /**
   * Close database connection.
   */
  async end(): Promise<void> {
    await (this.client as any).end();
  }

  /**
   * Listen for notifications.
   */
  async listen(channel: string): Promise<void> {
    const client = this.client;
    const escapedChannel = client.escapeIdentifier(channel);
    await this.client.query(`LISTEN ${escapedChannel}`);
    this._channels.push(channel);
  }

  /**
   * Send notification.
   */
  async notify(channel: string, payload?: string): Promise<void> {
    const client = this.client;
    const escapedChannel = client.escapeIdentifier(channel);

    // No payload
    if (payload === undefined) {
      await this.client.query(`NOTIFY ${escapedChannel}`);
    }

    // Payload
    else {
      const escapedPayload = client.escapeLiteral(payload);
      await this.client.query(`NOTIFY ${escapedChannel}, ${escapedPayload}`);
    }
  }

  /**
   * Get backend process id.
   */
  async pid(): Promise<number> {
    return (await this.query<PidResult>`SELECT pg_backend_pid()`)[0].pg_backend_pid;
  }

  /**
   * Perform SQL query.
   * @example
   * // Query with placeholder
   * const results = await db.query`SELECT * FROM users WHERE name = ${'Sara'}`;
   *
   * // Query with result type
   * const results = await db.query<User>`SELECT * FROM users`;
   */
  async query<T extends Record<string, any>>(parts: TemplateStringsArray, ...values: any[]): Promise<Results<T>> {
    return this.rawQuery(this.sql(parts, ...values).toQuery());
  }

  /**
   * Perform raw SQL query.
   * @example
   * // Simple query with placeholder
   * const results = await db.rawQuery('SELECT * FROM users WHERE name = $1', 'Sara'});
   *
   * // Query with result type
   * const results = await db.rawQuery<User>('SELECT * FROM users');
   *
   * // Query with results as arrays
   * const results = await db.rawQuery({text: 'SELECT * FROM users', rowMode: 'array'});
   */
  async rawQuery<T = any>(query: string | QueryConfig, ...values: any[]): Promise<Results<T>> {
    if (typeof query === 'string') query = {text: query, values};
    if (DEBUG === true) process.stderr.write(`\n${query.text}\n`);

    try {
      const result = await this.client.query(query);
      const rows = result.rows;
      return rows === undefined ? new Results(result.rowCount) : new Results(result.rowCount, ...rows);
    } catch (error) {
      if (this.verboseErrors === true) throwWithContext(error, query);
      throw error;
    }
  }

  /**
   * Release database connection back into the pool.
   */
  async release(): Promise<void> {
    const client = this.client;
    ['end', 'notification'].forEach(event => client.removeAllListeners(event));
    if (this._channels.length > 0) await this.unlisten();
    client.release();
  }

  /**
   * Get all non-system tables.
   */
  async tables(): Promise<string[]> {
    const results = await this.query<TablesResult>`
      SELECT schemaname, tablename FROM pg_catalog.pg_tables
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'`;
    return results.map(row => `${row.schemaname}.${row.tablename}`);
  }

  /**
   * Stop listenting for notifications.
   */
  async unlisten(channel?: string): Promise<void> {
    const client = this.client;

    // All channels
    if (channel === undefined) {
      await this.client.query('UNLISTEN *');
      this._channels = [];
    }

    // One channel
    else {
      const escapedChannel = client.escapeIdentifier(channel);
      await this.client.query(`UNLISTEN ${escapedChannel}`);
      this._channels = this._channels.filter(c => c !== channel);
    }
  }
}

export {Database};
