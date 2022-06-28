const kRowCount = Symbol('rowCount');

/**
 * PostgreSQL query result class.
 */
export class Results extends Array {
  [kRowCount]: number | null = null;

  constructor(rowCount: number | null, ...values: any[]) {
    super(...values);
    this[kRowCount] = rowCount;
  }

  /**
   * Get all returned rows.
   */
  get all(): this {
    return this;
  }

  /**
   * Get first returned row.
   */
  get first(): Record<string, any> | null {
    return this[0] ?? null;
  }

  /**
   * Get last returned row.
   */
  get last(): Record<string, any> | null {
    return this.length > 0 ? this[this.length - 1] : null;
  }

  /**
   * Get number of rows affected by query.
   */
  get rowCount(): number | null {
    return this[kRowCount];
  }
}
