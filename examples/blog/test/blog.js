import {app} from '../index.js';
import Pg from '@mojojs/pg';
import t from 'tap';

const skip = process.env.TEST_ONLINE === undefined ? {skip: 'set TEST_ONLINE to enable this test'} : {};

t.test('Blog', skip, async t => {
  // Isolate tests
  const pg = new Pg(process.env.TEST_ONLINE, {searchPath: ['blog_test']});
  await pg.query`DROP SCHEMA IF EXISTS blog_test CASCADE`;
  await pg.query`CREATE SCHEMA blog_test`;

  app.models.pg = pg;

  const ua = await app.newTestUserAgent({tap: t, maxRedirects: 10});

  await t.test('No posts yet', async () => {
    (await ua.getOk('/'))
      .statusIs(200)
      .textLike('title', /Blog/)
      .textLike('body > a', /New post/)
      .elementExistsNot('h2');
  });

  await t.test('Create a new post', async () => {
    (await ua.getOk('/posts/create'))
      .statusIs(200)
      .textLike('title', /New post/)
      .elementExists('form input[name=title]')
      .elementExists('form textarea[name=body]');
    (await ua.postOk('/posts', {form: {title: 'Testing', body: 'This is a test.'}}))
      .statusIs(200)
      .textLike('title', /Testing/)
      .textLike('h2', /Testing/)
      .textLike('p', /This is a test/);
  });

  await t.test('Read the post', async () => {
    (await ua.getOk('/'))
      .statusIs(200)
      .textLike('title', /Blog/)
      .textLike('h2 a', /Testing/)
      .textLike('p', /This is a test/);
    (await ua.getOk('/posts/1'))
      .statusIs(200)
      .textLike('title', /Testing/)
      .textLike('h2', /Testing/)
      .textLike('p', /This is a test/)
      .textLike('body > a', /Edit/);
  });

  await t.test('Update the post', async () => {
    (await ua.getOk('/posts/1/edit'))
      .statusIs(200)
      .textLike('title', /Edit post/)
      .elementExists('form input[name=title][value=Testing]')
      .textLike('form textarea[name=body]', /This is a test/)
      .elementExists('form input[value=Remove]');
    (await ua.postOk('/posts/1?_method=PUT', {form: {title: 'Again', body: 'It works.'}}))
      .statusIs(200)
      .textLike('title', /Again/)
      .textLike('h2', /Again/)
      .textLike('p', /It works/);
    (await ua.getOk('/posts/1'))
      .statusIs(200)
      .textLike('title', /Again/)
      .textLike('h2', /Again/)
      .textLike('p', /It works/);
  });

  await t.test('Delete the post', async () => {
    (await ua.postOk('/posts/1?_method=DELETE')).statusIs(200).textLike('title', /Blog/).elementExistsNot('h2');
  });

  await ua.stop();

  // Clean up once we are done
  await pg.query`DROP SCHEMA blog_test CASCADE`;

  await pg.end();
});
