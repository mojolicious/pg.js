import {Base} from './base.js';
import {Database} from './database.js';
import {Migrations} from './migrations.js';
import {Results} from './results.js';
import {urlSplit} from '@mojojs/util';
import pg from 'pg';

export type PgConfig = string | pg.PoolConfig | Pg;

export interface PgOptions extends pg.PoolConfig {
  searchPath?: string[];
}

export type {Database, Migrations, Results};

const DEBUG = process.env.MOJO_PG_DEBUG === '1';

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
  _doNotEnd = false;

  constructor(config: PgConfig, options: PgOptions = {}) {
    super();

    if (config instanceof Pg) {
      this.pool = config.pool;
      this._doNotEnd = true;
    } else {
      this.pool = new pg.Pool({allowExitOnIdle: true, ...options, ...Pg.parseConfig(config)});
    }

    if (options.searchPath !== undefined) this.searchPath = options.searchPath;

    // Convert BIGINT to number (even if not all 64bit are usable)
    pg.types.setTypeParser(20, parseInt);

    this.pool.on('connect', client => {
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
    if (this._doNotEnd === false) await this.pool.end();
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
   * @example
   * // Query with placeholder
   * const results = await pg.query`SELECT * FROM users WHERE name = ${'Sara'}`;
   *
   * // Query with result type
   * const results = await pg.query<User>`SELECT * FROM users`;
   */
  async query<T extends Record<string, any>>(parts: TemplateStringsArray, ...values: any[]): Promise<Results<T>> {
    return this.rawQuery(this.sql(parts, ...values).toQuery());
  }

  /**
   * Perform raw SQL query.
   * @example
   * // Simple query with placeholder
   * const results = await pg.rawQuery('SELECT * FROM users WHERE name = $1', 'Sara'});
   *
   * // Query with result type
   * const results = await db.rawQuery<User>('SELECT * FROM users');
   *
   * // Query with results as arrays
   * const results = await pg.rawQuery({text: 'SELECT * FROM users', rowMode: 'array'});
   */
  async rawQuery<T = any>(query: string | pg.QueryConfig, ...values: any[]): Promise<Results<T>> {
    if (typeof query === 'string') query = {text: query, values};
    if (DEBUG === true) process.stderr.write(`-- Query\n${query.text}\n`);
    const result = await this.pool.query(query);
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
