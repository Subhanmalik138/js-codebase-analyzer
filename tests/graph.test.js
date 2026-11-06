'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildGraph, findCycles, findOrphans, findDeadExports } = require('../src/graph');

function files(specs) {
  return specs.map(([relative, content]) => ({ relative, content }));
}

describe('findCycles', () => {
  it('detects a two-file cycle and reports it once', () => {
    const { graph } = buildGraph(
      files([
        ['a.js', "const b = require('./b');"],
        ['b.js', "const a = require('./a');"],
        ['c.js', "const a = require('./a');"],
      ]),
    );
    assert.deepEqual(findCycles(graph), [['a.js', 'b.js']]);
  });

  it('finds a three-file cycle', () => {
    const { graph } = buildGraph(
      files([
        ['a.js', "import './b';"],
        ['b.js', "import './c';"],
        ['c.js', "import './a';"],
      ]),
    );
    assert.deepEqual(findCycles(graph), [['a.js', 'b.js', 'c.js']]);
  });

  it('returns no cycles for a DAG', () => {
    const { graph } = buildGraph(
      files([
        ['a.js', "import './b'; import './c';"],
        ['b.js', "import './c';"],
        ['c.js', ''],
      ]),
    );
    assert.deepEqual(findCycles(graph), []);
  });
});

describe('findOrphans', () => {
  it('flags files nothing imports, except entry points and tests', () => {
    const { graph } = buildGraph(
      files([
        ['index.js', "import './used';"],
        ['used.js', ''],
        ['forgotten.js', ''],
        ['helper.test.js', ''],
      ]),
    );
    assert.deepEqual(findOrphans(graph), ['forgotten.js']);
  });
});

describe('findDeadExports', () => {
  it('flags exported names no other file imports', () => {
    const { graph, parsed } = buildGraph(
      files([
        ['index.js', "import { used } from './lib';"],
        ['lib.js', 'export function used() {}\nexport function dead() {}\n'],
      ]),
    );
    assert.deepEqual(findDeadExports(graph, parsed), [{ file: 'lib.js', name: 'dead' }]);
  });

  it('resolves extensionless and index imports', () => {
    const { graph, parsed } = buildGraph(
      files([
        ['index.js', "import { thing } from './pkg';"],
        ['pkg/index.js', 'export const thing = 1;\nexport const other = 2;\n'],
      ]),
    );
    assert.deepEqual(findDeadExports(graph, parsed), [{ file: 'pkg/index.js', name: 'other' }]);
  });
});
