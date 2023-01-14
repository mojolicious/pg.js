<p align="center">
  <a href="https://mojojs.org">
    <img src="https://github.com/mojolicious/mojo.js/blob/main/docs/images/logo.png?raw=true" style="margin: 0 auto;">
  </a>
</p>

[![](https://github.com/mojolicious/pg.js/workflows/test/badge.svg)](https://github.com/mojolicious/pg.js/actions)
[![Coverage Status](https://coveralls.io/repos/github/mojolicious/pg.js/badge.svg?branch=main)](https://coveralls.io/github/mojolicious/pg.js?branch=main)
[![npm](https://img.shields.io/npm/v/@mojojs/pg.svg)](https://www.npmjs.com/package/@mojojs/pg)

A tiny wrapper around [pg](https://www.npmjs.com/package/pg) that makes [PostgreSQL](http://www.postgresql.org/) a lot
of fun to use. Written in TypeScript.

```js
import Pg from '@mojojs/pg';

// Use standard PostgreSQL connection URIs
const pg = new Pg('postgres://user:password@localhost:5432/database');

// Single query with safe placeholder
const results = await pg.query`SELECT ${'One'} AS one`;
for (const row of results) {
  console.log(row.one);
}

// Multiple queries on the same connection
const db = await pg.db();
const users = await db.query`SELECT * FROM users`;
const roles = await db.query`SELECT * FROM roles`;
await db.release();
```

Tagged template literals are used everywhere to protect from SQL injection attacks and to make syntax highlighting
easy.

### Examples

This distribution also contains a great example you can use for inspiration. The well-structured
[blog](https://github.com/mojolicious/pg.js/tree/main/examples/blog) application will show you how to apply the MVC
design pattern in practice.

### TypeScript

TypeScript is fully supported, just pass along a type with your query. This works for all query methods.

```ts
interface User {
  id: number;
  name: string;
}

const results = await pg.query<User>`SELECT * FROM users`;
for (const {id, name} of results) {
  console.log(`${id}: ${name}`);
}
```

### SQL building

For easier SQL query building with partials, there are also `pg.sql` and `db.sql` tagged template literals (provided by
[@mojojs/sql](https://www.npmjs.com/package/@mojojs/sql)). They can be used recursively to build complex queries
securely.

```js
// Build safe SQL query with placeholder and partial SQL query
const role = 'admin';
const partialQuery = pg.sql`AND role = ${role}`;
const name = 'root';
const results = await pg.query`SELECT * FROM users WHERE name = ${name} ${partialQuery}`;
```

But if you need a little more control over the generated SQL query, you can of course also bypass safety features with
the tagged template literals `pg.sqlUnsafe` and `db.sqlUnsafe`. But make sure to use methods like `pg.escapeLiteral()`
to escape unsafe values yourself.

```js
const role = 'role = ' + pg.escapeLiteral('power user');
const partialQuery = pg.sqlUnsafe`AND ${role}`;
const name = 'root';
const results = await pg.query`SELECT * FROM users WHERE name = ${name} ${partialQuery}`;
```

And if you want to do complex things like reusing the same placeholder in multiple places, there is also
`pg.rawQuery()` and `db.rawQuery()` available.

```js
const results = await pg.rawQuery('SELECT * FROM users WHERE name = $1 AND login = $1', 'Sara');
```

### Transactions

It's best to use `try`/`finally` blocks whenever you dequeue a connection with `pg.db()`, to ensure efficient resource
management.

```js
const db = await pg.db();
try {
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

### Migrations

To manage your database schema, there is also a minimal SQL based migration system built-in. A migration file is just a
collection of SQL blocks, with one or more statements, separated by comments of the form `-- VERSION UP/DOWN`.

```sql
-- 1 up
CREATE TABLE messages (message TEXT);
INSERT INTO messages VALUES ('I ♥ Mojolicious!');
-- 1 down
DROP TABLE messages;
 
-- 2 up (...you can comment freely here...)
CREATE TABLE stuff (whatever INT);
-- 2 down
DROP TABLE stuff;
```

The idea is to let you migrate from any version, to any version, up and down. Migrations are very safe, because they
are performed in transactions and only one can be performed at a time. If a single statement fails, the whole migration
will fail and get rolled back. Every set of migrations has a `name`, which is stored together with the currently active
version in an automatically created table named `mojo_migrations`.

```js
import Path from '@mojojs/path';

// Load migrations from "migrations/myapp.sql" and migrate to the latest version
await pg.migrations.fromFile(Path.currentFile().sibling('migrations', 'myapp.sql'), {name: 'myapp'});
await pg.migrations.migrate();

// Use migrations to drop and recreate the schema
await pg.migrations.migrate(0);
await pg.migrations.migrate();

// Load migrations from a string
pg.migrations.fromString('-- 1 up\n...', {name: 'my_other_app'});

// Load migrations from a directory
await pg.migrations.fromDirecory(Path.currentFile().sibling('migrations'), {name: 'yet_another_app'});
```

To store your individual migration steps in separate SQL files you can use a directory structure like this. These files
do not require special comments, because the version and migration direction are contained in the file names.

```
`--migrations
   |-- 1
   |   |-- up.sql
   |   `-- down.sql
   |-- 2
   |   `-- up.sql
   |-- 4
   |   |-- up.sql
   |   `-- down.sql
   `-- 5
       |-- up.sql
       `-- down.sql
```

Migrations are also compatible with [Mojo::Pg](https://metacpan.org/pod/Mojo::Pg), if you want to mix Perl and
JavaScript code.

### Notifications

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

// Use event to handle incoming notifications
await db.listen('bar');
db.on('notification', (message) => {
  console.log(`${message.channel}: ${message.payload}`);
});
await db.unlisten('bar');
```

### Errors

Since the default exceptions thrown by [pg](https://www.npmjs.com/package/pg) for query errors are often not very
helpful, we expand them with context information, like the position in the SQL query and the file/line the query
originated from.

```
$ node sql-error.js
/home/sri/pg.js/node_modules/pg-protocol/dist/parser.js:287
        const message = name === 'notice' ? new messages_1.NoticeMessage(length, messageValue) : new messages_1.DatabaseError(messageValue, length, name);
                                                                                                 ^

error: relation "users" does not exist
Line 1: SELECT * FROM users
                      ^ at sql-error.js line 4

    at Parser.parseErrorMessage (/home/sri/pg.js/node_modules/pg-protocol/dist/parser.js:287:98)
    at Parser.handlePacket (/home/sri/pg.js/node_modules/pg-protocol/dist/parser.js:126:29)
    at Parser.parse (/home/sri/pg.js/node_modules/pg-protocol/dist/parser.js:39:38)
    at Socket.<anonymous> (/home/sri/pg.js/node_modules/pg-protocol/dist/index.js:11:42)
    at Socket.emit (node:events:537:28)
    at addChunk (node:internal/streams/readable:324:12)
    at readableAddChunk (node:internal/streams/readable:297:9)
    at Readable.push (node:internal/streams/readable:234:10)
    at TCP.onStreamRead (node:internal/stream_base_commons:190:23) {
  length: 104,
  severity: 'ERROR',
  code: '42P01',
...
```

### Introspection

You can set the `MOJO_PG_DEBUG` environment variable to get all SQL queries printed to `STDERR`.

```
$ MOJO_PG_DEBUG=1 node myapp.js

INSERT INTO users (name) VALUES ($1)
...
```

### Future

This package is designed to be compatible with the
[explicit resource management proposal](https://github.com/tc39/proposal-explicit-resource-management) and will support
it as soon as the `using` keyword is available in Node.js.

```js
// Multiple queries on the same connection (with automatic resource management)
using await const db = await pg.db();
const users = await db.query`SELECT * FROM users`;
const roles = await db.query`SELECT * FROM roles`;
```

### Editor Support

* [Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=kraih.javascript-tmpl-support)

## Installation

All you need is Node.js 16.0.0 (or newer).

```
$ npm install @mojojs/pg
```
