const kRowCount = Symbol('rowCount');

/**
 * PostgreSQL query result class.
 */
export class Results<T> extends Array<T> {
  [kRowCount]: number | null = null;

  constructor(rowCount: number | null, ...values: any[]) {
    super(...values);
    this[kRowCount] = rowCount;
  }

  /**
   * Get first returned row.
   */
  get first(): T | null {
    return this[0] ?? null;
  }

  /**
   * Get last returned row.
   */
  get last(): T | null {
    return this.length > 0 ? this[this.length - 1] : null;
  }

  /**
   * Get number of rows affected by query.
   */
  get rowCount(): number | null {
    return this[kRowCount];
  }
}
