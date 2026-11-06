# codebase-analyzer

A zero-dependency Node.js CLI that finds the structural problems hiding in a
JavaScript or TypeScript codebase: dependency cycles, complexity hotspots,
duplicate code, orphan files, and dead exports.

```bash
npx codebase-analyzer ./src
```

```
Codebase analysis: ./src
  42 files, 8,314 lines, avg complexity 4.10
  1 cycle(s), 2 orphan file(s), 3 dead export(s), 1 duplicate block(s), 2 complexity hotspot(s)

Dependency cycles
-----------------
  src/a.js -> src/b.js -> src/a.js

Complexity hotspots
-------------------
  src/billing.js — complexity 24, 9 functions, max nesting 4
```

## Why this exists

Most code-quality tools either need a full parser and a plugin ecosystem or
only lint one file at a time. This tool answers four questions about the
*whole* codebase in one fast pass, with no install step beyond Node itself:

1. **Where are the cycles?** Circular imports make refactors risky and
   bundlers unpredictable. Every cycle is reported once, in canonical order.
2. **Where is the complexity?** Files above a complexity threshold are listed
   as hotspots so review time goes where it matters.
3. **What is pasted, not shared?** Copy-pasted blocks are found by hashing
   normalized sliding windows of lines, then merging overlapping windows so
   one pasted chunk reports once.
4. **What is dead?** Files nothing imports, and named exports nothing
   imports, are listed separately — entry points and test files are excluded
   from the orphan check because being unimported is expected for them.

## Install

Requires Node 18+ and nothing else — there are no dependencies.

```bash
npm install -g codebase-analyzer
# or run it in place:
node cli/codebase-analyzer.js ./src
```

## Usage

```bash
codebase-analyzer [directory] [options]
```

| Option | Default | Meaning |
| ------ | ------- | ------- |
| `--json` | off | Print the full report as JSON instead of text |
| `--min-complexity <n>` | 10 | Complexity at which a file counts as a hotspot |
| `--min-duplicate-lines <n>` | 6 | Lines in a block before it counts as a duplicate |
| `--exclude <dirs>` | — | Comma-separated extra directories to ignore |
| `--fail-on-cycle` | off | Exit 1 when a dependency cycle is found |
| `--help` | — | Show help |

Examples:

```bash
# Analyze the current directory
codebase-analyzer .

# Machine-readable report for CI
codebase-analyzer . --json > report.json

# Only care about severe complexity, and fail CI on cycles
codebase-analyzer . --min-complexity 15 --fail-on-cycle

# Ignore a generated directory
codebase-analyzer . --exclude generated,fixtures
```

Exit codes: `0` on success (or when `--fail-on-cycle` finds no cycles), `1`
when `--fail-on-cycle` finds a cycle, `2` for a usage error or an unreadable
target.

## Design decisions

- **Regex-based parsing, not a full AST.** The analyzer needs structural
  facts (imports, exports, branch counts), not a perfect parse tree. Regexes
  over comment-stripped source keep it fast on large trees and dependency-free.
  The trade-off is documented: a regex literal that looks like a comment, or
  a string that looks like a `require(...)`, can confuse it. Anything it
  cannot classify is ignored, never guessed at.
- **One pass, many reports.** The tree is scanned and each file parsed once;
  the graph, metrics, and duplicate detection all derive from that single
  pass, so adding a new check costs no extra I/O.
- **Cycles reported once, canonically rotated.** A DFS with an explicit stack
  finds cycles; each one is rotated so its lexicographically smallest file
  comes first, so the same cycle is never reported twice from different
  starting points.
- **Duplicate detection by normalized sliding windows.** Lines are stripped
  of comments, collapsed to single spaces, and hashed in windows of N lines.
  Overlapping windows from the same pasted chunk are merged into one report
  covering the full block.
- **Dead exports exclude default exports.** A default export is usually
  consumed by a name-agnostic import the parser cannot attribute reliably,
  so reporting it would be noise. Named exports are checked precisely.

## Limitations

- Import resolution covers relative paths, extension inference, and
  `index.js` directory imports. Bare package imports are ignored (they are
  external by definition) and path aliases (`@/…`, `tsconfig` paths) are not
  resolved.
- Cyclomatic complexity is approximated as 1 + branch points (`if`, `for`,
  `while`, `case`, `catch`, `&&`, `||`, `?.`, `??`). Nesting depth is brace
  depth, so object literals add depth too — both are hotspot signals, not
  precise measurements.
- TypeScript is parsed as text: types, interfaces, and decorators are handled
  only insofar as they do not confuse the import/export patterns.

## Running the tests

```bash
npm test
```

Tests use Node's built-in runner (`node:test`, no test framework to install)
and cover the parser, graph analysis, duplicate detection, and an end-to-end
run against the sample project in `examples/sample-project/`.

## Try it

`examples/sample-project/` is a deliberately messy four-file project: it has
a dependency cycle, a dead export, a complexity hotspot, and a block pasted
in two files. Run the analyzer on it to see every finding fire:

```bash
node cli/codebase-analyzer.js examples/sample-project
```

## License

MIT — see [LICENSE](LICENSE).
