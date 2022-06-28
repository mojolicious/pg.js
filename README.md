<p align="center">
  <a href="https://mojojs.org">
    <img src="https://github.com/mojolicious/mojo.js/blob/main/docs/images/logo.png?raw=true" style="margin: 0 auto;">
  </a>
</p>

[![](https://github.com/mojolicious/pg.js/workflows/test/badge.svg)](https://github.com/mojolicious/pg.js/actions)
[![Coverage Status](https://coveralls.io/repos/github/mojolicious/pg.js/badge.svg?branch=main)](https://coveralls.io/github/mojolicious/pg.js?branch=main)
[![npm](https://img.shields.io/npm/v/@mojojs/pg.svg)](https://www.npmjs.com/package/@mojojs/pg)

A tiny wrapper around [pg](https://www.npmjs.com/package/pg) with some very convenient APIs. Written in TypeScript.

```js
import Pg from '@mojojs/pg';

// Use standard PostgreSQL connection URIs
const pg = new Pg('postgres://user:password@localhost:5432/database');

// Single query with safe placeholder
const results = await pg.query`SELECT ${'One'} AS one`;
for (const row of results.all) {
  console.log(row.one);
}

// Multiple queries on the same connection
const db = await pg.db();
const results = await db.query`SELECT 2`;
const results = await db.query`SELECT 3`;
await db.release();
```

Tagged template literals are used everywhere to protect from SQL injection attacks and to make syntax highlighting
easy.

## SQL building

For easier SQL query building with partials, there are also `pg.sql` and `db.sql` tagged template literals. They can be
used recursively to build complex queries securely.

```js
// Build safe SQL query with placeholder and partial SQL query
const role = 'admin';
const partialQuery = pg.sql`AND role = ${role}`;
const name = 'root';
const results = await pg.query`SELECT * FROM users WHERE name = ${name} ${partialQuery}`;
```

But if you need a little more control over the generated SQL query, you can of course also bypass safety features with
the tagged template literals `pg.sqlUnsafe` and `db.sqlUnsafe`.

```js
const role = 'role = ' + pg.escapeLiteral('power user');
const partialQuery = pg.sqlUnsafe`AND ${role}`;
const name = 'root';
const results = await pg.query`SELECT * FROM users WHERE name = ${name} ${partialQuery}`;
```

But make sure to use methods like `pg.escapeLiteral()` to escape unsafe values yourself.

## Transactions

It's best to use `try`/`finally` blocks whenever you dequeue a connection with `pg.db()`, to ensure efficient resource
mangement.

```js
try {
  const db = await pg.db();
  const tx = await db.begin();

  try {
    for (const user of ['Daniel', 'Isabell']) {
      await db.query`INSERT INTO users (name) VALUES (${user})`;
    }
    await tx.commit();

  } finally {
    await tx.rollback();
  }
} finally {
  await db.release();
}
```

The `tx.rollback()` call does nothing if `tx.commit()` has been called first.

## Notifications

You can use events as well as async iterators for notifications.

```js
// Send notifications
const db = await pg.db();
await db.notify('foo', 'just a message');

// Use an iterator to wait for incoming notifications
await db.listen('foo');
for await (const message of db) {
  console.log(`${message.channel}: ${message.payload}`);
  break;
}
await db.unlisten('foo');
```

## Future

This package is designed to be compatible with the
[explicit resource management proposal](https://github.com/tc39/proposal-explicit-resource-management) and will support
it as soon as the `using` keyword is available in Node.js.

```js
// Multiple queries on the same connection (with automatic resource management)
using const db = await pg.db();
const results = await db.query`SELECT 2`;
const results = await db.query`SELECT 3`;
```

## Installation

All you need is Node.js 16.0.0 (or newer).

```
$ npm install @mojojs/pg
```
