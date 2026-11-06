'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan } = require('../src/scanner');
const { analyzeFile } = require('../src/metrics');
const { findDuplicates } = require('../src/duplicates');
const { analyze } = require('../src/analyzer');
const { formatText, formatJson } = require('../src/reporters');

function tempProject(structure) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer-test-'));
  for (const [rel, content] of Object.entries(structure)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

describe('scanner', () => {
  it('finds source files and skips node_modules and dot-dirs', () => {
    const dir = tempProject({
      'src/a.js': 'const a = 1;',
      'src/b.ts': 'const b: number = 2;',
      'node_modules/pkg/index.js': 'const c = 3;',
      '.git/config': 'x',
      'README.md': '# hi',
    });
    const found = scan(dir).map((f) => f.relative);
    assert.deepEqual(found, ['src/a.js', 'src/b.ts']);
  });
});

describe('analyzeFile', () => {
  it('counts lines, comments and complexity', () => {
    const m = analyzeFile({
      relative: 'a.js',
      size: 0,
      content: '// comment\nconst x = 1;\n\nif (x) {\n  console.log(x);\n}\n',
    });
    assert.equal(m.lines, 6);
    assert.equal(m.commentLines, 1);
    assert.equal(m.blankLines, 1);
    assert.equal(m.codeLines, 4);
    assert.equal(m.complexity, 2);
  });
});

describe('findDuplicates', () => {
  it('finds a block pasted in two files', () => {
    const block = Array.from({ length: 7 }, (_, i) => `const v${i} = ${i};`).join('\n');
    const groups = findDuplicates(
      [
        { relative: 'a.js', content: `${block}\nconst uniqueA = 1;` },
        { relative: 'b.js', content: `const uniqueB = 2;\n${block}` },
      ],
      6,
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0].occurrences.length, 2);
  });

  it('finds nothing when files share only short snippets', () => {
    const groups = findDuplicates(
      [
        { relative: 'a.js', content: 'const x = 1;\nconst y = 2;' },
        { relative: 'b.js', content: 'const x = 1;\nconst y = 2;' },
      ],
      6,
    );
    assert.deepEqual(groups, []);
  });
});

describe('analyze (end to end)', () => {
  it('reports the cycle, dead export and duplicate in the sample project', () => {
    const dir = path.join(__dirname, '..', 'examples', 'sample-project');
    const report = analyze(dir, { minComplexity: 15 });
    assert.equal(report.summary.files, 4);
    assert.equal(report.summary.cycles, 1);
    assert.deepEqual(report.cycles, [['src/a.js', 'src/b.js']]);
    assert.deepEqual(report.deadExports, [{ file: 'src/a.js', name: 'unusedHelper' }]);
    assert.equal(report.summary.duplicateGroups, 1);
    assert.equal(report.hotspots.length, 1);
    assert.equal(report.hotspots[0].path, 'src/b.js');
  });

  it('is clean on a tidy project', () => {
    const dir = tempProject({
      'index.js': "import { greet } from './greet';\nconsole.log(greet('x'));",
      'greet.js': 'export function greet(n) { return `hi ${n}`; }',
    });
    const report = analyze(dir);
    assert.equal(report.summary.cycles, 0);
    assert.equal(report.summary.deadExports, 0);
    assert.equal(report.summary.duplicateGroups, 0);
    assert.equal(report.summary.orphans, 0);
  });
});

describe('reporters', () => {
  it('text output mentions every finding section', () => {
    const dir = path.join(__dirname, '..', 'examples', 'sample-project');
    const text = formatText(analyze(dir));
    assert.match(text, /Dependency cycles/);
    assert.match(text, /Complexity hotspots/);
    assert.match(text, /Dead exports/);
    assert.match(text, /Duplicate code blocks/);
  });

  it('JSON output round-trips', () => {
    const dir = path.join(__dirname, '..', 'examples', 'sample-project');
    const parsed = JSON.parse(formatJson(analyze(dir)));
    assert.equal(parsed.summary.files, 4);
  });
});
