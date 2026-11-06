'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
  '__pycache__',
]);

/** Recursively collect source files under `root`, skipping ignored dirs. */
function scan(root, extraIgnored = []) {
  const ignored = new Set([...IGNORED_DIRS, ...extraIgnored]);
  const files = [];
  const absoluteRoot = path.resolve(root);

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory: skip, don't crash the whole run
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name) && !entry.name.startsWith('.')) walk(full);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push({
          absolute: full,
          relative: path.relative(absoluteRoot, full).split(path.sep).join('/'),
          content: fs.readFileSync(full, 'utf8'),
          size: fs.statSync(full).size,
        });
      }
    }
  };

  walk(absoluteRoot);
  files.sort((a, b) => a.relative.localeCompare(b.relative));
  return files;
}

module.exports = { scan, SOURCE_EXTENSIONS, IGNORED_DIRS };
