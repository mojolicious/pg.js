import type {Query} from './types.js';

/**
 * SQL statement class.
 */
export class Statement {
  parts: string[] = [];
  values: any[] = [];

  constructor(parts: ReadonlyArray<string>, values: any[]) {
    const mergedParts = this.parts;
    const mergedValues = this.values;

    let mergeNext = false;
    for (let i = 0; i < parts.length; i++) {
      if (mergeNext === true) {
        const index = mergedParts.length - 1;
        mergedParts[index] = mergedParts[index] + parts[i];
        mergeNext = false;
      } else {
        mergedParts.push(parts[i]);
      }

      if (parts[i + 1] === undefined) continue;

      const value = values[i];
      if (value instanceof Statement) {
        const valueParts = value.parts;
        const index = mergedParts.length - 1;
        mergedParts[index] = mergedParts[index] + valueParts[0];
        mergedParts.push(...valueParts.slice(1));
        mergedValues.push(...value.values);
        mergeNext = true;
      } else {
        mergedValues.push(values[i]);
      }
    }
  }

  /**
   * Create new SQL query or partial query.
   */
  static sql(parts: TemplateStringsArray, ...values: any[]): Statement {
    return new Statement(parts, values);
  }

  /**
   * Create new SQL query or partial query without safe placeholders.
   */
  static sqlUnsafe(parts: TemplateStringsArray, ...values: any[]): Statement {
    const merged: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      merged.push(parts[i]);
      if (values[i] !== undefined) merged.push(values[i]);
    }
    return new Statement([merged.join('')], []);
  }

  /**
   * Convert SQL statement to query with placeholders.
   */
  toQuery(): Query {
    return {text: this.toString(), values: this.values};
  }

  /**
   * Convert SQL statement to string.
   */
  toString(): string {
    const query = [];

    const parts = this.parts;
    for (let i = 1; i <= parts.length; i++) {
      query.push(parts[i - 1]);
      if (parts[i] !== undefined) query.push(`$${i}`);
    }

    return query.join('');
  }
}
