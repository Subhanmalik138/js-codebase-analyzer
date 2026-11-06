'use strict';

function section(title) {
  return `\n${title}\n${'-'.repeat(title.length)}\n`;
}

function formatText(report) {
  const out = [];
  const s = report.summary;
  out.push(`Codebase analysis: ${report.root}`);
  out.push(`  ${s.files} files, ${s.totalLines} lines, avg complexity ${s.avgComplexity}`);
  out.push(`  ${s.cycles} cycle(s), ${s.orphans} orphan file(s), ${s.deadExports} dead export(s), ${s.duplicateGroups} duplicate block(s), ${s.hotspots} complexity hotspot(s)`);

  if (report.cycles.length > 0) {
    out.push(section('Dependency cycles'));
    for (const cycle of report.cycles) {
      out.push(`  ${cycle.join(' -> ')} -> ${cycle[0]}`);
    }
  }

  if (report.hotspots.length > 0) {
    out.push(section('Complexity hotspots'));
    for (const file of report.hotspots) {
      out.push(`  ${file.path} — complexity ${file.complexity}, ${file.functions} functions, max nesting ${file.maxNesting}`);
    }
  }

  if (report.orphans.length > 0) {
    out.push(section('Orphan files (imported by nothing)'));
    for (const file of report.orphans) out.push(`  ${file}`);
  }

  if (report.deadExports.length > 0) {
    out.push(section('Dead exports (exported, never imported)'));
    for (const dead of report.deadExports) {
      out.push(`  ${dead.file}: ${dead.name}`);
    }
  }

  if (report.duplicates.length > 0) {
    out.push(section('Duplicate code blocks'));
    for (const group of report.duplicates) {
      out.push(`  ${group.lines}-line block in ${group.occurrences.length} places:`);
      for (const occ of group.occurrences) {
        out.push(`    ${occ.file}:${occ.startLine}-${occ.endLine}`);
      }
    }
  }

  if (
    report.cycles.length === 0 &&
    report.hotspots.length === 0 &&
    report.orphans.length === 0 &&
    report.deadExports.length === 0 &&
    report.duplicates.length === 0
  ) {
    out.push('\nNo issues found.');
  }
  return out.join('\n') + '\n';
}

function formatJson(report) {
  return JSON.stringify(report, null, 2) + '\n';
}

module.exports = { formatText, formatJson };
