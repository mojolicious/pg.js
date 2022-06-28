import {Base} from './base.js';
import {Database} from './database.js';
import {Migrations} from './migrations.js';
import {Results} from './results.js';
import {urlSplit} from '@mojojs/util';
import pg from 'pg';

interface PgOptions {
  searchPath?: string[];
}

/**
 * PostgreSQL pool class.
 */
export default class Pg extends Base {
  /**
   * PostgreSQL connection pool.
   */
  pool: pg.Pool;
  /**
   * Search path.
   */
  searchPath: string[] = [];

  _migrations: Migrations | undefined;

  constructor(config: string | pg.PoolConfig, options: PgOptions = {}) {
    super();
    const pool = new pg.Pool(Pg.parseConfig(config));
    this.pool = pool;
    if (options.searchPath !== undefined) this.searchPath = options.searchPath;

    // Convert BIGINT to number (even if not all 64bit are usable)
    pg.types.setTypeParser(20, parseInt);

    pool.on('connect', client => {
      if (this.searchPath.length > 0) {
        const searchPath = this.searchPath.map(path => client.escapeIdentifier(path)).join(', ');
        client.query(`SET search_path TO ${searchPath}`);
      }
    });
  }

  /**
   * Get database connection from pool.
   */
  async db(): Promise<Database> {
    const client = await this.pool.connect();
    return new Database(client);
  }

  /**
   * Close all database connections in the pool.
   */
  async end(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Migrations.
   */
  get migrations(): Migrations {
    if (this._migrations === undefined) this._migrations = new Migrations(this);
    return this._migrations;
  }

  /**
   * Parse PostgreSQL connection URI.
   */
  static parseConfig(config: string | pg.PoolConfig): pg.PoolConfig {
    if (typeof config !== 'string') return config;
    const poolConfig: pg.PoolConfig = {};

    const url = urlSplit(config);
    if (url === null || (url.scheme !== 'postgres' && url.scheme !== 'postgresql')) {
      throw new Error(`Invalid connection string: ${config}`);
    }

    const authority = url.authority;
    if (authority !== undefined) {
      const hostParts = authority.split('@');

      const host = hostParts[hostParts.length - 1].split(':');
      if (host[0].length > 0) poolConfig.host = decodeURIComponent(host[0]);
      if (host[1] !== undefined) poolConfig.port = parseInt(host[1]);

      if (hostParts.length > 1) {
        const auth = hostParts[0].split(':');
        poolConfig.user = decodeURIComponent(auth[0]);
        if (auth[1] !== undefined) poolConfig.password = decodeURIComponent(auth[1]);
      }
    }

    const path = url.path;
    if (path !== undefined) poolConfig.database = decodeURIComponent(path.slice(1));

    const params = new URLSearchParams(url.query);
    const host = params.get('host');
    if (host !== null) poolConfig.host = host;

    return poolConfig;
  }

  /**
   * Perform SQL query.
   */
  async query(parts: TemplateStringsArray, ...values: any[]): Promise<Results> {
    const result = await this.pool.query(this.sql(parts, ...values).toQuery());
    const rows = result.rows;
    return rows === undefined ? new Results(result.rowCount) : new Results(result.rowCount, ...rows);
  }

  /**
   * Get all non-system tables.
   */
  async tables(): Promise<string[]> {
    const db = await this.db();
    return await db.tables().finally(() => db.release());
  }
}
