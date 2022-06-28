import type {QueryResult} from 'pg';

/**
 * PostgreSQL query result class.
 */
export class Results {
  _results: QueryResult;

  constructor(result: QueryResult) {
    this._results = result;
  }

  /**
   * Get all returned rows.
   */
  get all(): Array<Record<string, any>> {
    return this._results.rows;
  }

  /**
   * Get first returned row.
   */
  get first(): Record<string, any> | null {
    return this._results.rows[0] ?? null;
  }

  /**
   * Get last returned row.
   */
  get last(): Record<string, any> | null {
    const rows = this._results.rows;
    return rows.length > 0 ? rows[rows.length - 1] : null;
  }

  /**
   * Get number of rows affected by query.
   */
  get rowCount(): number {
    return this._results.rowCount;
  }
}
