'use strict';

// Lightweight, dependency-free parser for JavaScript / TypeScript sources.
//
// The analyzer needs structural facts (imports, exports, branch counts), not
// a full AST, so this module works with targeted regular expressions over
// comment- and string-stripped source. That keeps it fast on large trees and
// dependency-free. Anything it cannot classify is ignored, never guessed at.

const IMPORT_RE = /import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_NAMED_RE =
  /export\s+(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/g;
const EXPORT_LIST_RE = /export\s*\{([^}]*)\}/g;
const BRANCH_RE = /\b(?:if|for|while|case|catch)\b|&&|\|\||\?\.|\?\?/g;
const FUNCTION_DECL_RE = /\bfunction\s*\*?\s*[A-Za-z_$][\w$]*\s*\(/g;
const ARROW_RE = /=>/g;

/**
 * Strip comments and string/template literals, replacing them with blanks so
 * line numbers stay aligned. Heuristic on purpose: a regex literal that
 * looks like a comment is a known, documented edge case.
 */
function stripCommentsAndStrings(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++;
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') i++;
        if (source[i] === '\n') out += '\n';
        i++;
      }
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** All module specifiers a file loads, with how each one is loaded. */
function parseImports(source) {
  const clean = stripCommentsAndStrings(source);
  const imports = [];
  const seen = new Set();
  const collect = (re, kind) => {
    for (const match of clean.matchAll(re)) {
      const specifier = match[1];
      const key = `${kind}:${specifier}`;
      if (!seen.has(key)) {
        seen.add(key);
        imports.push({ specifier, kind });
      }
    }
  };
  collect(IMPORT_RE, 'import');
  collect(REQUIRE_RE, 'require');
  collect(DYNAMIC_IMPORT_RE, 'dynamic-import');
  return imports;
}

/** Named imports per specifier, used to tell which exports are actually used. */
function parseNamedImports(source) {
  const clean = stripCommentsAndStrings(source);
  const bySpecifier = new Map();
  const listRe = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of clean.matchAll(listRe)) {
    const names = match[1]
      .split(',')
      .map((part) => part.trim().split(/\s+as\s+/).pop().trim())
      .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
    if (names.length > 0) {
      bySpecifier.set(match[2], names);
    }
  }
  const defaultRe = /import\s+([A-Za-z_$][\w$]*)\s*,?\s*(?:\{[^}]*\})?\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of clean.matchAll(defaultRe)) {
    const existing = bySpecifier.get(match[2]) || [];
    existing.push(`default:${match[1]}`);
    bySpecifier.set(match[2], existing);
  }
  return bySpecifier;
}

/** Exported names, plus whether the file has a default export. */
function parseExports(source) {
  const clean = stripCommentsAndStrings(source);
  const named = new Set();
  for (const match of clean.matchAll(EXPORT_NAMED_RE)) {
    named.add(match[1]);
  }
  for (const match of clean.matchAll(EXPORT_LIST_RE)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) named.add(name);
    }
  }
  const hasDefault = /export\s+default\b/.test(clean);
  return { named: [...named].sort(), hasDefault };
}

/** Cyclomatic complexity, approximated as 1 + the number of branch points. */
function countComplexity(source) {
  const clean = stripCommentsAndStrings(source);
  return 1 + (clean.match(BRANCH_RE) || []).length;
}

/** Rough count of function definitions (declarations + arrow functions). */
function countFunctions(source) {
  const clean = stripCommentsAndStrings(source);
  return (
    (clean.match(FUNCTION_DECL_RE) || []).length +
    (clean.match(ARROW_RE) || []).length
  );
}

module.exports = {
  stripCommentsAndStrings,
  parseImports,
  parseNamedImports,
  parseExports,
  countComplexity,
  countFunctions,
};
