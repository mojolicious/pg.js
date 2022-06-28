import {escapeIdentifier, escapeLiteral} from '../lib/util.js';
import t from 'tap';

t.test('Util', async t => {
  t.test('escapeIdentifier', t => {
    t.equal(escapeIdentifier(''), '""');
    t.equal(escapeIdentifier('0'), '"0"');
    t.equal(escapeIdentifier("Ain't misbehaving "), `"Ain't misbehaving "`);
    t.equal(escapeIdentifier('NULL'), '"NULL"');
    t.equal(escapeIdentifier('some"identifier'), '"some""identifier"');
    t.end();
  });

  t.test('escapeLiteral', t => {
    t.equal(escapeLiteral(''), "''");
    t.equal(escapeLiteral('0'), "'0'");
    t.equal(escapeLiteral("Ain't misbehaving "), "'Ain''t misbehaving '");
    t.equal(escapeLiteral('NULL'), "'NULL'");
    t.equal(escapeLiteral('some"identifier'), `'some"identifier'`);
    t.equal(escapeLiteral(`backslash \\all' \the things`), ` E'backslash \\\\all'' \the things'`);
    t.end();
  });

  t.end();
});
