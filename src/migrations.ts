import type {Database} from './database.ts';
import type Pg from './pg.ts';
import Path from '@mojojs/path';

interface MigrationOptions {
  name?: string;
}

interface Step {
  direction: 'down' | 'up';
  sql: string;
  version: number;
}

interface VersionResult {
  version: number;
}

type Steps = Step[];

const DEBUG = process.env.MOJO_MIGRATIONS_DEBUG === '1';

/**
 * PostgreSQL migrations class.
 */
export class Migrations {
  /**
   * Name for this set of migrations.
   */
  name = 'migrations';

  _pg: Pg;
  _steps: Steps = [];

  constructor(pg: Pg) {
    this._pg = pg;
  }

  /**
   * Currently active version.
   */
  async active(): Promise<number> {
    const db = await this._pg.db();
    return await this._active(db).finally(() => db.release());
  }

  /**
   * Extract migrations from a directory.
   */
  async fromDirectory(dir: string | Path, options: MigrationOptions = {}): Promise<void> {
    if (options.name !== undefined) this.name = options.name;

    const steps: Steps = [];
    const path = new Path(dir.toString());
    for await (const file of path.list({recursive: true, maxDepth: 2})) {
      const fileMatch = file.basename().match(/^(up|down)\.sql$/);
      if (fileMatch === null) continue;

      const dirMatch = file
        .dirname()
        .basename()
        .match(/^(\d+)$/);
      if (dirMatch === null) continue;

      steps.push({
        direction: fileMatch[1] === 'up' ? 'up' : 'down',
        sql: (await file.readFile('utf8')).toString(),
        version: parseInt(dirMatch[1])
      });
    }

    this._steps = steps;
  }

  /**
   * Extract migrations from a file.
   */
  async fromFile(file: string | Path, options?: MigrationOptions): Promise<void> {
    this.fromString((await new Path(file.toString()).readFile('utf8')).toString(), options);
  }

  /**
   * Extract migrations from string.
   */
  fromString(str: string, options: MigrationOptions = {}): void {
    if (options.name !== undefined) this.name = options.name;

    const steps: Steps = [];
    for (const line of str.split('\n')) {
      const match = line.match(/^\s*--\s*(\d+)\s*(up|down)/i);

      // Version line
      if (match !== null) {
        steps.push({direction: match[2].toLowerCase() === 'up' ? 'up' : 'down', sql: '', version: parseInt(match[1])});
      }

      // SQL
      else if (steps.length > 0) {
        steps[steps.length - 1].sql += line + '\n';
      }
    }

    this._steps = steps;
  }

  /**
   * Latest version.
   */
  get latest(): number {
    return this._steps.filter(step => step.direction === 'up').sort((a, b) => b.version - a.version)[0]?.version ?? 0;
  }

  /**
   * Migrate from `active` to a different version, up or down, defaults to using the `latest` version. All version
   * numbers need to be positive, with version `0` representing an empty database.
   */
  async migrate(target?: number): Promise<void> {
    const latest = this.latest;
    if (target === undefined) target = latest;
    const hasStep = this._steps.find(step => step.direction === 'up' && step.version === target) !== undefined;
    if (target !== 0 && hasStep === false) throw new Error(`Version ${target} has no migration`);

    const db = await this._pg.db();
    try {
      // Already the right version
      if ((await this._active(db)) === target) return;
      await db.query`
        CREATE TABLE IF NOT EXISTS mojo_migrations (
          name    TEXT PRIMARY KEY,
          version BIGINT NOT NULL CHECK (version >= 0)
        )
      `;

      const tx = await db.begin();
      try {
        // Lock migrations table and check version again
        await db.query`LOCK TABLE mojo_migrations IN EXCLUSIVE MODE`;
        const active = await this._active(db);
        if (active === target) return;

        // Newer version
        if (active > latest) throw new Error(`Active version ${active} is greater than the latest version ${latest}`);

        const sql = this.sqlFor(active, target);
        if (DEBUG) process.stderr.write(`-- Migrate (${active} -> ${target})\n${sql}\n`);
        const name = db.escapeLiteral(this.name);
        const migration = db.sqlUnsafe`
          ${sql}
          INSERT INTO mojo_migrations (name, version) VALUES (${name}, ${target})
          ON CONFLICT (name) DO UPDATE SET version = ${target};
        `;
        await db.query`${migration}`;
        await tx.commit();
      } finally {
        await tx.rollback();
      }
    } finally {
      await db.release();
    }
  }

  /**
   * Get SQL to migrate from one version to another, up or down.
   */
  sqlFor(from: number, to: number): string {
    // Up
    if (from < to) {
      return this._steps
        .filter(step => step.direction === 'up' && step.version > from && step.version <= to)
        .sort((a, b) => a.version - b.version)
        .map(step => step.sql)
        .join('');
    }

    // Down
    else {
      return this._steps
        .filter(step => step.direction === 'down' && step.version <= from && step.version > to)
        .sort((a, b) => b.version - a.version)
        .map(step => step.sql)
        .join('');
    }
  }

  async _active(db: Database): Promise<number> {
    try {
      const results = await db.query<VersionResult>`SELECT version FROM mojo_migrations WHERE name = ${this.name}`;
      const first = results.first;
      return first === undefined ? 0 : first.version;
    } catch (error: any) {
      if (error.code !== '42P01') throw error;
    }
    return 0;
  }
}
