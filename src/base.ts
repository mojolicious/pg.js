import EventEmitter from 'events';
import {Fragment} from './fragment.js';
import {escapeIdentifier, escapeLiteral} from './util.js';

export class Base extends EventEmitter {
  /**
   * Escape PostgreSQL identifier.
   */
  escapeIdentifier(identifier: string): string {
    return escapeIdentifier(identifier);
  }

  /**
   * Escape PostgreSQL literal.
   */
  escapeLiteral(literal: string): string {
    return escapeLiteral(literal);
  }

  /**
   * Create new SQL query or partial query.
   */
  sql(parts: TemplateStringsArray, ...values: any[]): Fragment {
    return Fragment.sql(parts, ...values);
  }

  /**
   * Create new SQL query or partial query without safe placeholders.
   */
  sqlUnsafe(parts: TemplateStringsArray, ...values: any[]): Fragment {
    return Fragment.sqlUnsafe(parts, ...values);
  }
}
