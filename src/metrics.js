'use strict';

const parser = require('./parser');

/**
 * Per-file metrics. Lines are counted on the raw source; complexity and
 * nesting come from the comment-stripped source. Nesting is brace depth, so
 * it is an approximation — object literals add depth too — and is reported
 * as a hotspot signal, not a precise measurement.
 */
function analyzeFile(file) {
  const lines = file.content.split('\n');
  let codeLines = 0;
  let commentLines = 0;
  let blankLines = 0;
  let inBlockComment = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      blankLines++;
      continue;
    }
    if (inBlockComment) {
      commentLines++;
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (line.startsWith('//')) {
      commentLines++;
    } else if (line.startsWith('/*')) {
      commentLines++;
      if (!line.includes('*/')) inBlockComment = true;
    } else {
      codeLines++;
    }
  }

  const total = lines.length;
  const complexity = parser.countComplexity(file.content);
  const functions = parser.countFunctions(file.content);

  // Maximum brace depth, tracked line by line on stripped source.
  const cleanLines = parser.stripCommentsAndStrings(file.content).split('\n');
  let depth = 0;
  let maxNesting = 0;
  for (const line of cleanLines) {
    for (const ch of line) {
      if (ch === '{') {
        depth++;
        if (depth > maxNesting) maxNesting = depth;
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
      }
    }
  }

  return {
    path: file.relative,
    size: file.size,
    lines: total,
    codeLines,
    commentLines,
    blankLines,
    commentRatio: total > 0 ? +(commentLines / total).toFixed(3) : 0,
    functions,
    complexity,
    maxNesting,
  };
}

module.exports = { analyzeFile };
