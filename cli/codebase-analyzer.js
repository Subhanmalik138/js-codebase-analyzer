#!/usr/bin/env node
'use strict';

const { analyze } = require('../src/analyzer');
const { formatText, formatJson } = require('../src/reporters');

function printHelp() {
  console.log(`codebase-analyzer — analyze a JavaScript/TypeScript codebase

Usage:
  codebase-analyzer [directory] [options]

Options:
  --json                   Output the full report as JSON
  --min-complexity <n>     Complexity at which a file counts as a hotspot (default: 10)
  --min-duplicate-lines <n>  Lines in a block before it counts as a duplicate (default: 6)
  --exclude <dirs>         Comma-separated extra directories to ignore
  --fail-on-cycle          Exit 1 when a dependency cycle is found
  --help                   Show this help

Examples:
  codebase-analyzer ./src
  codebase-analyzer . --json > report.json
  codebase-analyzer . --min-complexity 15 --fail-on-cycle`);
}

function parseArgs(argv) {
  const args = { target: '.', json: false, minComplexity: 10, minDuplicateLines: 6, extraIgnored: [], failOnCycle: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--fail-on-cycle') {
      args.failOnCycle = true;
    } else if (arg === '--min-complexity') {
      args.minComplexity = Number(argv[++i]);
    } else if (arg === '--min-duplicate-lines') {
      args.minDuplicateLines = Number(argv[++i]);
    } else if (arg === '--exclude') {
      args.extraIgnored = argv[++i].split(',').map((d) => d.trim()).filter(Boolean);
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    } else {
      args.target = arg;
    }
  }
  if (!Number.isFinite(args.minComplexity) || args.minComplexity < 1) {
    console.error('--min-complexity must be a positive number');
    process.exit(2);
  }
  if (!Number.isFinite(args.minDuplicateLines) || args.minDuplicateLines < 2) {
    console.error('--min-duplicate-lines must be at least 2');
    process.exit(2);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let report;
  try {
    report = analyze(args.target, {
      minComplexity: args.minComplexity,
      minDuplicateLines: args.minDuplicateLines,
      extraIgnored: args.extraIgnored,
    });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }
  process.stdout.write(args.json ? formatJson(report) : formatText(report));
  if (args.failOnCycle && report.summary.cycles > 0) process.exit(1);
}

main();
