import {Statement} from '../lib/statement.js';
import t from 'tap';

t.test('Statement', t => {
  t.same(Statement.sql`SELECT 1`.toQuery(), {text: 'SELECT 1', values: []});
  t.same(Statement.sql`SELECT 1;`.toQuery(), {text: 'SELECT 1;', values: []});
  t.same(Statement.sql`SELECT ${1};`.toQuery(), {text: 'SELECT $1;', values: [1]});
  t.same(Statement.sql`SELECT ${1}, ${'2'}, ${[3]};`.toQuery(), {text: 'SELECT $1, $2, $3;', values: [1, '2', [3]]});

  const partial = Statement.sql`AND two = ${'Two'} AND three = ${3}`;
  t.same(Statement.sql`SELECT * FROM foo WHERE one = ${'One'} ${partial}`.toQuery(), {
    text: 'SELECT * FROM foo WHERE one = $1 AND two = $2 AND three = $3',
    values: ['One', 'Two', 3]
  });
  t.same(Statement.sql`SELECT * FROM foo WHERE one = ${'One'} ${partial} ${partial} AND four = ${4}`.toQuery(), {
    text: 'SELECT * FROM foo WHERE one = $1 AND two = $2 AND three = $3 AND two = $4 AND three = $5 AND four = $6',
    values: ['One', 'Two', 3, 'Two', 3, 4]
  });

  const empty = Statement.sql``;
  t.same(Statement.sql`SELECT 1 ${empty}`.toQuery(), {text: 'SELECT 1 ', values: []});

  t.test('From unsafe string', t => {
    const unsafe = Statement.sqlUnsafe`FROM bar WHERE ${'baz'} = '${'yada'}'`;
    t.same(Statement.sql`SELECT * ${unsafe} ORDER BY id`.toQuery(), {
      text: "SELECT * FROM bar WHERE baz = 'yada' ORDER BY id",
      values: []
    });
    t.end();
  });

  t.end();
});
