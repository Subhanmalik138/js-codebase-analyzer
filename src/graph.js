'use strict';

const path = require('path');
const parser = require('./parser');

const ENTRY_BASENAMES = new Set(['index', 'main', 'cli', 'app', 'server']);

/**
 * Resolve a relative import specifier to a project file, or null when it is
 * external (bare package) or unresolvable. Handles missing extensions and
 * directory imports that land on an index file.
 */
function resolveImport(fromRelative, specifier, fileSet) {
  if (!specifier.startsWith('.')) return null; // bare package import
  const fromDir = path.posix.dirname(fromRelative);
  const base = path.posix.normalize(path.posix.join(fromDir, specifier));
  const candidates = [
    base,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.jsx`,
    `${base}/index.js`,
    `${base}/index.ts`,
    `${base}/index.jsx`,
    `${base}/index.tsx`,
  ];
  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

/** Build an adjacency map: file -> sorted list of project files it imports. */
function buildGraph(files) {
  const fileSet = new Set(files.map((f) => f.relative));
  const parsed = new Map();
  const graph = new Map();

  for (const file of files) {
    const imports = parser.parseImports(file.content);
    parsed.set(file.relative, {
      imports,
      exports: parser.parseExports(file.content),
      namedImports: parser.parseNamedImports(file.content),
    });
    const edges = new Set();
    for (const imp of imports) {
      const resolved = resolveImport(file.relative, imp.specifier, fileSet);
      if (resolved && resolved !== file.relative) edges.add(resolved);
    }
    graph.set(file.relative, [...edges].sort());
  }
  return { graph, parsed };
}

/** All dependency cycles, each reported once in canonical rotation. */
function findCycles(graph) {
  const cycles = [];
  const seen = new Set();
  const state = new Map(); // 0 = unvisited, 1 = on stack, 2 = done
  const stack = [];

  const visit = (node) => {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) || []) {
      if (state.get(next) === 1) {
        const at = stack.indexOf(next);
        const cycle = stack.slice(at);
        // Canonical rotation so the same cycle is never reported twice.
        const min = cycle.indexOf([...cycle].sort()[0]);
        const rotated = [...cycle.slice(min), ...cycle.slice(0, min)];
        const key = rotated.join('->');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(rotated);
        }
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 2);
  };

  for (const node of [...graph.keys()].sort()) {
    if (!state.has(node)) visit(node);
  }
  return cycles;
}

/**
 * Files nothing imports. Entry points (index/main/cli/...) and test files are
 * excluded — being unimported is expected for them.
 */
function findOrphans(graph) {
  const imported = new Set();
  for (const edges of graph.values()) {
    for (const target of edges) imported.add(target);
  }
  return [...graph.keys()]
    .filter((file) => !imported.has(file))
    .filter((file) => {
      const base = path.posix.basename(file, path.extname(file));
      if (ENTRY_BASENAMES.has(base)) return false;
      if (file.includes('.test.') || file.includes('.spec.')) return false;
      return true;
    })
    .sort();
}

/**
 * Named exports no other file imports. Default exports are excluded — they
 * are usually consumed by name-agnostic imports the regex parser cannot
 * attribute reliably, so reporting them would be noise.
 */
function findDeadExports(graph, parsed) {
  const usedNames = new Map(); // resolved file -> Set of imported names
  for (const [file, info] of parsed) {
    for (const [specifier, names] of info.namedImports) {
      const resolved = resolveImport(file, specifier, new Set(graph.keys()));
      if (!resolved) continue;
      if (!usedNames.has(resolved)) usedNames.set(resolved, new Set());
      for (const name of names) {
        if (!name.startsWith('default:')) usedNames.get(resolved).add(name);
      }
    }
  }

  const dead = [];
  for (const [file, info] of parsed) {
    const used = usedNames.get(file) || new Set();
    for (const name of info.exports.named) {
      if (!used.has(name)) dead.push({ file, name });
    }
  }
  return dead.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
}

module.exports = { resolveImport, buildGraph, findCycles, findOrphans, findDeadExports };
