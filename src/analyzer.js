'use strict';

const scanner = require('./scanner');
const metrics = require('./metrics');
const graph = require('./graph');
const duplicates = require('./duplicates');

/**
 * Run the full analysis over a directory. Pure orchestration: scan the tree,
 * parse every file once, then derive the graph, metrics and duplicates from
 * that single pass.
 */
function analyze(root, options = {}) {
  const opts = {
    minComplexity: options.minComplexity ?? 10,
    minDuplicateLines: options.minDuplicateLines ?? 6,
    extraIgnored: options.extraIgnored ?? [],
  };

  const files = scanner.scan(root, opts.extraIgnored);
  const { graph: depGraph, parsed } = graph.buildGraph(files);

  const fileMetrics = files.map((file) => metrics.analyzeFile(file));
  const cycles = graph.findCycles(depGraph);
  const orphans = graph.findOrphans(depGraph);
  const deadExports = graph.findDeadExports(depGraph, parsed);
  const duplicateGroups = duplicates.findDuplicates(files, opts.minDuplicateLines);

  const totalLines = fileMetrics.reduce((sum, f) => sum + f.lines, 0);
  const totalComplexity = fileMetrics.reduce((sum, f) => sum + f.complexity, 0);
  const hotspots = fileMetrics
    .filter((f) => f.complexity >= opts.minComplexity)
    .sort((a, b) => b.complexity - a.complexity);

  return {
    root,
    generatedAt: new Date().toISOString(),
    summary: {
      files: files.length,
      totalLines,
      totalComplexity,
      avgComplexity: files.length > 0 ? +(totalComplexity / files.length).toFixed(2) : 0,
      cycles: cycles.length,
      orphans: orphans.length,
      deadExports: deadExports.length,
      duplicateGroups: duplicateGroups.length,
      hotspots: hotspots.length,
    },
    files: fileMetrics,
    cycles,
    orphans,
    deadExports,
    duplicates: duplicateGroups,
    hotspots,
  };
}

module.exports = { analyze };
