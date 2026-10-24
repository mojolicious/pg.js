import assert from 'node:assert/strict';
import Pg from '@mojojs/pg';

const pg = new Pg('postgres://127.0.0.1:5432/javascript');
assert.equal(pg.pool.options.database, 'javascript');
await pg.end();

console.log('JavaScript consumer works');
