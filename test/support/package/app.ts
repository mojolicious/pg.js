import assert from 'node:assert/strict';
import Pg, {type PgOptions} from '@mojojs/pg';

const options: PgOptions = {searchPath: ['typescript']};
const pg = new Pg('postgres://127.0.0.1:5432/typescript', options);
assert.deepEqual(pg.searchPath, ['typescript']);
await pg.end();

console.log('TypeScript consumer works');
