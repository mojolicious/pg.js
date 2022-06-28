import Pg from '../lib/pg.js';
import t from 'tap';

const skip = process.env.TEST_ONLINE === undefined ? {skip: 'set TEST_ONLINE to enable this test'} : {};

t.test('Database', skip, async t => {
  await t.test('Options', async t => {
    const pg = new Pg(process.env.TEST_ONLINE, {
      allowExitOnIdle: true,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 20000,
      max: 1
    });
    t.equal(pg.pool.options.allowExitOnIdle, true);
    t.equal(pg.pool.options.connectionTimeoutMillis, 10000);
    t.equal(pg.pool.options.idleTimeoutMillis, 20000);
    t.equal(pg.pool.options.max, 1);
    await pg.end();
  });

  await t.test('Close connection', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);

    const db = await pg.db();
    let count = 0;
    db.on('end', () => count++);
    await db.release();
    t.equal(count, 0);

    const db2 = await pg.db();
    db2.on('end', () => count++);
    await db2.end();
    t.equal(count, 1);
    await db2.release();

    await pg.end();
  });

  await t.test('Backend process id', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);
    const db = await pg.db();
    t.ok(typeof (await db.pid()) === 'number');
    await db.release();
    await pg.end();
  });

  await t.test('Select (ad-hoc)', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);

    const results = await pg.query`SELECT 1 AS one, 2 AS two, 3 AS three`;
    t.equal(results.count, 1);
    t.same(results, [{one: 1, two: 2, three: 3}]);

    const results2 = await pg.query`SELECT 1, 2, 3`;
    t.equal(results2.count, 1);
    t.same(results2, [{'?column?': 3}]);

    await pg.end();
  });

  await t.test('Select (with database object)', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);
    const db = await pg.db();
    const results = await db.query`SELECT 1 AS one, 2 AS two, 3 AS three`;
    t.equal(results.count, 1);
    t.same(results, [{one: 1, two: 2, three: 3}]);
    const results2 = await db.query`SELECT 1 AS one`;
    t.same(results2, [{one: 1}]);
    await db.release();
    await pg.end();
  });

  await t.test('Custom search path', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);
    pg.searchPath = ['$user', 'foo', 'bar'];
    const results = await pg.query`SHOW search_path`;
    t.same(results, [{search_path: '"$user", foo, bar'}]);
    await pg.end();
  });

  await t.test('Connection reuse', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);
    const db = await pg.db();
    await db.release();
    const db2 = await pg.db();
    t.ok(db.client === db2.client);
    await db2.release();
    await pg.end();
  });

  await t.test('Concurrent selects (ad-hoc)', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);

    const all = await Promise.all([pg.query`SELECT 1 AS one`, pg.query`SELECT 2 AS two`, pg.query`SELECT 3 AS three`]);
    t.same(
      all.map(results => results),
      [[{one: 1}], [{two: 2}], [{three: 3}]]
    );

    await pg.end();
  });

  await t.test('Concurrent selects (with database objects)', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);
    const db1 = await pg.db();
    const db2 = await pg.db();
    const db3 = await pg.db();

    const all = await Promise.all([
      db1.query`SELECT 1 AS one`,
      db2.query`SELECT 2 AS two`,
      db3.query`SELECT 3 AS three`
    ]);
    t.same(
      all.map(results => results),
      [[{one: 1}], [{two: 2}], [{three: 3}]]
    );

    await db1.release();
    await db2.release();
    await db3.release();
    await pg.end();
  });

  await t.test('JSON', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);
    const results = await pg.query`SELECT ${{test: ['works']}}::JSON AS foo`;
    t.same(results, [{foo: {test: ['works']}}]);
    await pg.end();
  });

  await t.test('Placeholders', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);
    const one = pg.sql`AS one`;
    const results = await pg.query`SELECT ${'One'} ${one}, ${2} AS two`;
    t.same(results, [{one: 'One', two: 2}]);
    await pg.end();
  });

  await t.test('Notifications (two database objects)', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);

    const db = await pg.db();
    const db2 = await pg.db();
    await db.listen('dbtest');
    await db2.listen('dbtest');

    process.nextTick(() => db.notify('dbtest', 'it works!'));
    const messages = await Promise.all([
      new Promise(resolve => db.once('notification', message => resolve(message))),
      new Promise(resolve => db2.once('notification', message => resolve(message)))
    ]);
    t.same(
      messages.map(message => [message.channel, message.payload]),
      [
        ['dbtest', 'it works!'],
        ['dbtest', 'it works!']
      ]
    );

    process.nextTick(() => db.notify('dbtest', 'it still works!'));
    const messages2 = await Promise.all([
      new Promise(resolve => db.once('notification', message => resolve(message))),
      new Promise(resolve => db2.once('notification', message => resolve(message)))
    ]);
    t.same(
      messages2.map(message => [message.channel, message.payload]),
      [
        ['dbtest', 'it still works!'],
        ['dbtest', 'it still works!']
      ]
    );

    process.nextTick(() => db2.notify('dbtest'));
    const message2 = await new Promise(resolve => db2.once('notification', message => resolve(message)));
    t.same([message2.channel, message2.payload], ['dbtest', '']);

    await db2.unlisten('dbtest');
    const tx = await db.begin();
    let result;
    try {
      process.nextTick(async () => {
        await db.notify('dbtest', 'from a transaction');
        await tx.commit();
      });
      const message3 = await new Promise(resolve => db.once('notification', message => resolve(message)));
      result = [message3.channel, message3.payload];
    } catch (error) {
      result = error;
      await tx.rollback();
    }
    t.same(result, ['dbtest', 'from a transaction']);

    await db.release();
    await db2.release();

    await pg.end();
  });

  await t.test('Notifications (iterator)', async t => {
    const pg = new Pg(process.env.TEST_ONLINE);

    const db = await pg.db();
    await db.listen('dbtest2');
    await db.listen('dbtest3');

    const messages = [];
    process.nextTick(() => db.notify('dbtest2', 'works'));
    for await (const message of db) {
      messages.push(message);
      break;
    }
    await db.unlisten('dbtest2');
    process.nextTick(async () => {
      await db.notify('dbtest3', 'maybe');
      await db.notify('dbtest2', 'failed');
      await db.notify('dbtest3', 'too');
    });
    for await (const message of db) {
      messages.push(message);
      if (messages.length > 2) break;
    }
    t.same(
      messages.map(message => [message.channel, message.payload]),
      [
        ['dbtest2', 'works'],
        ['dbtest3', 'maybe'],
        ['dbtest3', 'too']
      ]
    );

    await db.release();

    await pg.end();
  });
});
