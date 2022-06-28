import type {Notification, PoolClient} from 'pg';
import {on} from 'events';
import {Base} from './base.js';
import {Results} from './results.js';
import {Transaction} from './transaction.js';

interface DatabaseEvents {
  end: (this: Database) => void;
  notification: (this: Database, message: Notification) => void;
}

declare interface Database {
  on: <T extends keyof DatabaseEvents>(event: T, listener: DatabaseEvents[T]) => this;
  once: <T extends keyof DatabaseEvents>(event: T, listener: DatabaseEvents[T]) => this;
  emit: <T extends keyof DatabaseEvents>(event: T, ...args: Parameters<DatabaseEvents[T]>) => boolean;
}

/**
 * PostgreSQL database connection class.
 */
class Database extends Base {
  /**
   * PostgreSQL client.
   */
  client: PoolClient;

  _channels: string[] = [];

  constructor(client: PoolClient) {
    super();
    this.client = client;
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

  /**
   * Start transaction.
   */
  async begin(): Promise<Transaction> {
    await this.client.query('BEGIN');
    return new Transaction(this);
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
   * Get backedn process id.
   */
  async pid(): Promise<number> {
    return (await this.query`select pg_backend_pid()`).first?.pg_backend_pid;
  }

  /**
   * Perform SQL query.
   */
  async query(parts: TemplateStringsArray, ...values: any[]): Promise<Results> {
    return new Results(await this.client.query(this.sql(parts, ...values).toQuery()));
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
    const results = await this.query`
      SELECT schemaname, tablename FROM pg_catalog.pg_tables
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'`;
    return results.all.map(row => `${row.schemaname}.${row.tablename}`);
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
