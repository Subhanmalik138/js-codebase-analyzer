'use strict';

const parser = require('./parser');

/**
 * Copy-paste detection. Each file is split into normalized lines (comments
 * stripped, whitespace collapsed, blank lines dropped), then every sliding
 * window of `windowSize` lines is hashed. A hash seen at two or more
 * locations is a duplicate block. Overlapping windows from the same block
 * are merged so one pasted chunk reports once, not once per line.
 */
function normalizeLines(content) {
  const clean = parser.stripCommentsAndStrings(content);
  const lines = [];
  clean.split('\n').forEach((raw, index) => {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line !== '') lines.push({ line, number: index + 1 });
  });
  return lines;
}

function findDuplicates(files, windowSize = 6) {
  const byHash = new Map(); // hash -> [{ file, startLine, endLine }]
  const crypto = require('crypto');

  for (const file of files) {
    const lines = normalizeLines(file.content);
    for (let i = 0; i + windowSize <= lines.length; i++) {
      const block = lines.slice(i, i + windowSize);
      const hash = crypto
        .createHash('sha1')
        .update(block.map((l) => l.line).join('\n'))
        .digest('hex');
      if (!byHash.has(hash)) byHash.set(hash, []);
      byHash.get(hash).push({
        file: file.relative,
        startLine: block[0].number,
        endLine: block[block.length - 1].number,
      });
    }
  }

  const groups = [];
  for (const occurrences of byHash.values()) {
    // Distinct locations only — the same window twice in one file still counts
    // if the line ranges differ.
    const unique = occurrences.filter(
      (occ, i, arr) =>
        arr.findIndex((o) => o.file === occ.file && o.startLine === occ.startLine) === i,
    );
    if (unique.length < 2) continue;
    groups.push({ lines: windowSize, occurrences: unique });
  }

  // Merge groups that are the same pasted chunk reported at adjacent offsets:
  // windows sliding one line along a pasted block share most of their lines,
  // so merge groups whose occurrences cover the same files with ranges that
  // overlap or touch, widening the range to the full pasted block.
  const sameFiles = (a, b) => {
    if (a.length !== b.length) return false;
    const filesA = a.map((o) => o.file).sort();
    const filesB = b.map((o) => o.file).sort();
    return filesA.every((f, i) => f === filesB[i]);
  };
  const rangesTouch = (a, b) => {
    const byFileA = new Map(a.map((o) => [o.file, o]));
    return b.every((o) => {
      const other = byFileA.get(o.file);
      return other && o.startLine <= other.endLine + 1 && other.startLine <= o.endLine + 1;
    });
  };
  const mergeTwo = (a, b) => {
    const byFile = new Map();
    for (const occ of [...a, ...b]) {
      const existing = byFile.get(occ.file);
      if (existing) {
        existing.startLine = Math.min(existing.startLine, occ.startLine);
        existing.endLine = Math.max(existing.endLine, occ.endLine);
      } else {
        byFile.set(occ.file, { ...occ });
      }
    }
    const occurrences = [...byFile.values()];
    const lines = Math.max(...occurrences.map((o) => o.endLine - o.startLine + 1));
    return { lines, occurrences };
  };

  let merged = groups;
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        if (
          sameFiles(merged[i].occurrences, merged[j].occurrences) &&
          rangesTouch(merged[i].occurrences, merged[j].occurrences)
        ) {
          merged[i] = mergeTwo(merged[i].occurrences, merged[j].occurrences);
          merged.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return merged.sort((a, b) => b.occurrences.length - a.occurrences.length);
}

module.exports = { findDuplicates, normalizeLines };
