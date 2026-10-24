import t from 'tap';

const skip = process.env.TEST_ONLINE === undefined ? {skip: 'set TEST_ONLINE to enable this test'} : {};

// The "using" and "await using" syntax is not supported by Node.js 22
const skipUsing =
  parseInt(process.versions.node) < 24 ? {skip: 'explicit resource management requires Node.js 24'} : {};

t.test('Results', {...skip, ...skipUsing}, async t => {
  const {default: resultsTests} = await import('./support/results.ts');
  await resultsTests(t);
});
