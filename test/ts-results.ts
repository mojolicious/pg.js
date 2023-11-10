import Pg from '../lib/pg.js';
import t from 'tap';

const skip = process.env.TEST_ONLINE === undefined ? {skip: 'set TEST_ONLINE to enable this test'} : {};

interface TestRecord {
  id: number;
  name: string;
}

t.test('Results', skip, async t => {
  // Isolate tests
  await using pg = new Pg(process.env.TEST_ONLINE, {searchPath: ['mojo_ts_results_test']});
  await using db = await pg.db();
  await db.query`DROP SCHEMA IF EXISTS mojo_ts_results_test CASCADE`;
  await db.query`CREATE SCHEMA mojo_ts_results_test`;

  await db.query`
    CREATE TABLE IF NOT EXISTS results_test (
      id   BIGSERIAL PRIMARY KEY,
      name TEXT
    )
  `;
  await db.query`INSERT INTO results_test (name) VALUES (${'foo'})`;
  await db.query`INSERT INTO results_test (name) VALUES (${'bar'})`;

  await t.test('Result methods', async t => {
    t.same(await db.query<TestRecord>`SELECT * FROM results_test`, [
      {id: 1, name: 'foo'},
      {id: 2, name: 'bar'}
    ]);
    t.same((await db.query<TestRecord>`SELECT * FROM results_test`).first, {id: 1, name: 'foo'});
    t.same((await db.query<TestRecord>`SELECT * FROM results_test`).count, 2);
  });

  await t.test('Transactions', async t => {
    let result;
    try {
      await using tx = await db.begin();
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await tx.commit();
    } catch (error) {
      result = error;
    }
    t.same(result, undefined);
    t.same(await db.query<TestRecord>`SELECT * FROM results_test WHERE name = ${'tx1'}`, [
      {id: 3, name: 'tx1'},
      {id: 4, name: 'tx1'}
    ]);

    try {
      await using tx2 = await db.begin();
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await db.query`does_not_exist`;
      await tx2.commit();
    } catch (error) {
      result = error;
    }
    t.match(result.message, /does_not_exist/);
    t.same(await db.query<TestRecord>`SELECT * FROM results_test WHERE name = ${'tx1'}`, [
      {id: 3, name: 'tx1'},
      {id: 4, name: 'tx1'}
    ]);
  });

  // Clean up once we are done
  await db.query`DROP SCHEMA mojo_ts_results_test CASCADE`;
});
