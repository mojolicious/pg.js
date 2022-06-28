const kCount = Symbol('kCount');

/**
 * PostgreSQL query result class.
 */
export class Results<T> extends Array<T> {
  [kCount]: number | null = null;

  constructor(count: number | null, ...values: any[]) {
    super(...values);
    this[kCount] = count;
  }

  /**
   * Get number of rows affected by query.
   */
  get count(): number | null {
    return this[kCount];
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
}
