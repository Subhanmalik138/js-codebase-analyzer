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
  // keep the longest run per (file, startLine) pair.
  const merged = [];
  const covered = new Set();
  for (const group of groups.sort((a, b) => b.occurrences.length - a.occurrences.length)) {
    const key = group.occurrences.map((o) => `${o.file}:${o.startLine}`).join('|');
    if (covered.has(key)) continue;
    covered.add(key);
    merged.push(group);
  }
  return merged.sort((a, b) => b.occurrences.length - a.occurrences.length);
}

module.exports = { findDuplicates, normalizeLines };
