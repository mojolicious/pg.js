import Pg from '../lib/pg.js';
import t from 'tap';

const skip = process.env.TEST_ONLINE === undefined ? {skip: 'set TEST_ONLINE to enable this test'} : {};

t.test('Results', skip, async t => {
  // Isolate tests
  const pg = new Pg(process.env.TEST_ONLINE, {searchPath: ['mojo_results_test']});
  const db = await pg.db();
  await db.query`DROP SCHEMA IF EXISTS mojo_results_test CASCADE`;
  await db.query`CREATE SCHEMA mojo_results_test`;

  await db.query`
    CREATE TABLE IF NOT EXISTS results_test (
      id   BIGSERIAL PRIMARY KEY,
      name TEXT
    )
  `;
  await db.query`INSERT INTO results_test (name) VALUES (${'foo'})`;
  await db.query`INSERT INTO results_test (name) VALUES (${'bar'})`;

  await t.test('Tables', async t => {
    t.same((await db.tables()).includes('mojo_results_test.results_test'), true);
    t.same((await db.tables()).includes('information_schema.tables'), false);
    t.same((await db.tables()).includes('pg_catalog.pg_tables'), false);
  });

  await t.test('Result methods', async t => {
    t.same(await db.query`SELECT * FROM results_test`, [
      {id: 1, name: 'foo'},
      {id: 2, name: 'bar'}
    ]);
    t.same((await db.query`SELECT * FROM results_test`).first, {id: 1, name: 'foo'});
    t.same((await db.query`SELECT * FROM results_test`).last, {id: 2, name: 'bar'});
    t.same(await db.query`SELECT * FROM results_test WHERE name = ${'baz'}`, []);
    t.same((await db.query`SELECT * FROM results_test WHERE name = ${'baz'}`).first, null);
    t.same((await db.query`SELECT * FROM results_test WHERE name = ${'baz'}`).last, null);
    t.same(await db.query`SELECT * FROM results_test WHERE name = ${'bar'}`, [{id: 2, name: 'bar'}]);
    t.same((await db.query`SELECT * FROM results_test`).rowCount, 2);
    t.same((await db.query`SHOW SERVER_VERSION`).rowCount, null);
  });

  await t.test('JSON', async t => {
    t.same((await db.query`SELECT ${{bar: 'baz'}}::JSON AS foo`).first, {foo: {bar: 'baz'}});
  });

  await t.test('Transactions', async t => {
    const tx = await db.begin();
    try {
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await tx.commit();
    } finally {
      await tx.rollback();
    }
    t.same(await db.query`SELECT * FROM results_test WHERE name = ${'tx1'}`, [
      {id: 3, name: 'tx1'},
      {id: 4, name: 'tx1'}
    ]);

    const tx2 = await db.begin();
    try {
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
    } finally {
      await tx2.rollback();
    }
    t.same(await db.query`SELECT * FROM results_test WHERE name = ${'tx1'}`, [
      {id: 3, name: 'tx1'},
      {id: 4, name: 'tx1'}
    ]);

    let result;
    const tx3 = await db.begin();
    try {
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await db.query`INSERT INTO results_test (name) VALUES ('tx1')`;
      await db.query`does_not_exist`;
      await tx3.commit();
    } catch (error) {
      result = error;
    } finally {
      await tx3.rollback();
    }
    t.match(result.message, /does_not_exist/);
    t.same(await db.query`SELECT * FROM results_test WHERE name = ${'tx1'}`, [
      {id: 3, name: 'tx1'},
      {id: 4, name: 'tx1'}
    ]);
  });

  // Clean up once we are done
  await db.query`DROP SCHEMA mojo_results_test CASCADE`;

  await db.release();
  await pg.end();
});
