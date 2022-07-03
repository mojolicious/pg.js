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
  get first(): T {
    return this[0];
  }

  /**
   * Get last returned row.
   */
  get last(): T {
    return this[this.length - 1];
  }
}
