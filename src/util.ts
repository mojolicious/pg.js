import type {QueryConfig} from 'pg';
import StackUtils from 'stack-utils';

/**
 * Escape PostgreSQL identifier.
 */
export function escapeIdentifier(identifier: string): string {
  return '"' + identifier.replaceAll('"', '""') + '"';
}

/**
 * Escape PostgreSQL literal.
 */
export function escapeLiteral(literal: string): string {
  let result = '';
  let escapeString = false;

  for (let i = 0; i < literal.length; i++) {
    const char = literal[i];
    if (char === "'") {
      result += "''";
    } else if (char === '\\') {
      result += '\\\\';
      escapeString = true;
    } else {
      result += char;
    }
  }

  return escapeString === true ? ` E'${result}'` : `'${result}'`;
}

export function throwWithContext(error: any, query: QueryConfig): never {
  if (error.position !== undefined) {
    const pos = parseInt(error.position);
    let offset = 0;
    let line = 1;
    let lineOffset = 0;
    let fragment = '';

    const sql = query.text;
    for (let i = 0; i < sql.length; i++) {
      const c = sql[i];
      if (i < pos) {
        lineOffset++;
        if (c === '\n') {
          fragment = '';
          line++;
          offset += lineOffset;
          lineOffset = 0;
        } else {
          fragment += c;
        }
      } else {
        if (c === '\n') {
          break;
        } else {
          fragment += c;
        }
      }
    }

    // SQL context
    const prefix = `Line ${line}: `;
    let pointer = ' '.repeat(pos - offset + prefix.length - 1) + '^';

    // Try to find the caller file and line
    const stack = new StackUtils().capture();
    if (stack.length > 2) {
      const startFile = stack[1].getFileName();
      for (let i = 2; i < stack.length; i++) {
        const file = stack[i].getFileName();
        if (file !== undefined && /^node:/.test(file) === false && file !== startFile) {
          const line = stack[i].getLineNumber();
          pointer += ` at ${file} line ${line}`;
          break;
        }
      }
    }

    error.message = `${error.message}\n${prefix}${fragment}\n${pointer}\n`;
  }

  throw error;
}
