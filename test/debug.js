process.env.MOJO_PG_DEBUG = '1';

import {captureOutput} from '@mojojs/util';
import t from 'tap';

const {default: Pg} = await import('../lib/pg.js');

const skip = process.env.TEST_ONLINE === undefined ? {skip: 'set TEST_ONLINE to enable this test'} : {};

t.test('Debug', skip, async t => {
  const pg = new Pg(process.env.TEST_ONLINE);

  await t.test('Select (ad-hoc query)', async t => {
    const output = await captureOutput(
      async () => {
        await pg.query`SELECT 1 AS one`;
      },
      {stderr: true, stdout: false}
    );
    t.match(output.toString(), /SELECT 1 AS one/s);
  });

  await t.test('Select (with database object)', async t => {
    const output = await captureOutput(
      async () => {
        const db = await pg.db();
        await db.query`SELECT 2 AS two`;
        await db.release();
      },
      {stderr: true, stdout: false}
    );
    t.match(output.toString(), /SELECT 2 AS two/s);
  });

  await pg.end();
});
