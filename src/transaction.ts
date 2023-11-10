import type {Database} from './database.js';

/**
 * PostgreSQL transaction class.
 */
export class Transaction {
  _db: Database;
  _finished = false;

  constructor(db: Database) {
    this._db = db;
  }

  async [Symbol.asyncDispose]() {
    await this.rollback();
  }

  /**
   * Commit transaction. Does nothing if `tx.rollback()` has been called first.
   */
  async commit(): Promise<void> {
    if (this._finished === true) return;
    await this._db.client.query('COMMIT');
    this._finished = true;
  }

  /**
   * Rollback transaction. Does nothing if `tx.commit()` has been called first.
   */
  async rollback(): Promise<void> {
    if (this._finished === true) return;
    await this._db.client.query('ROLLBACK');
    this._finished = true;
  }
}
