'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../src/parser');

describe('parseImports', () => {
  it('finds ESM, require and dynamic imports', () => {
    const src = `
      import fs from 'fs';
      import { a, b } from './local';
      const x = require('../other');
      const y = await import('./lazy');
    `;
    const imports = parser.parseImports(src);
    assert.deepEqual(
      imports.map((i) => i.specifier).sort(),
      ['./lazy', './local', '../other', 'fs'].sort(),
    );
    assert.equal(imports.find((i) => i.specifier === 'fs').kind, 'import');
    assert.equal(imports.find((i) => i.specifier === '../other').kind, 'require');
    assert.equal(imports.find((i) => i.specifier === './lazy').kind, 'dynamic-import');
  });

  it('ignores imports inside comments', () => {
    const src = `
      // import { nope } from './fake';
      /* require('./also-fake') */
    `;
    assert.deepEqual(parser.parseImports(src), []);
  });

  // Documented heuristic: a require-looking string literal is treated as an
  // import, because the specifier itself lives inside a string. Real code
  // rarely contains such strings outside actual imports.
  it('treats a require-looking string as an import (documented heuristic)', () => {
    const src = `const s = "require('./also-fake')";`;
    assert.equal(parser.parseImports(src).length, 1);
  });

  it('deduplicates the same specifier loaded twice', () => {
    const src = `import './a';\nimport './a';`;
    assert.equal(parser.parseImports(src).length, 1);
  });
});

describe('parseExports', () => {
  it('collects named and list exports and detects a default export', () => {
    const src = `
      export function helper() {}
      export const VERSION = 1;
      const a = 1, b = 2;
      export { a, b as renamed };
      export default helper;
    `;
    const result = parser.parseExports(src);
    assert.deepEqual(result.named, ['VERSION', 'a', 'helper', 'renamed']);
    assert.equal(result.hasDefault, true);
  });

  it('returns an empty set for a module with no exports', () => {
    assert.deepEqual(parser.parseExports('const x = 1;'), { named: [], hasDefault: false });
  });
});

describe('countComplexity', () => {
  it('counts 1 plus the number of branch points', () => {
    const src = `
      function f(x) {
        if (x > 0 && x < 10) return 1;
        for (let i = 0; i < 3; i++) { if (i === 2) break; }
        return x ?? 0;
      }
    `;
    // if, &&, for, if, ??  => 1 + 5 = 6
    assert.equal(parser.countComplexity(src), 6);
  });

  it('is 1 for straight-line code', () => {
    assert.equal(parser.countComplexity('const x = 1 + 2;'), 1);
  });
});

describe('countFunctions', () => {
  it('counts declarations and arrow functions', () => {
    const src = `
      function a() {}
      const b = () => {};
      const c = async (x) => x;
    `;
    assert.equal(parser.countFunctions(src), 3);
  });
});

describe('stripCommentsAndStrings', () => {
  it('keeps line numbers aligned', () => {
    const src = "const a = 1; // hi\n/* multi\nline */\nconst b = 2;";
    const stripped = parser.stripCommentsAndStrings(src);
    assert.equal(stripped.split('\n').length, 4);
    assert.match(stripped, /const b = 2/);
    assert.doesNotMatch(stripped, /hi|multi/);
  });
});
