// Prism — file outline for AI sessions (token saver #2, 2026-06-10).
// Prints the top-level structure of a source file — declarations, components,
// window.* exports, and section banners — with line numbers, so a 2,000-line
// file can be navigated from a ~50-line outline instead of a full read.
//
// Usage:
//   node scripts/outline.mjs src/store.jsx [src/db.jsx ...]
//   node scripts/outline.mjs --all          # every file in build-files.mjs
//
// Zero-dependency and regex-based on purpose: the src/ files are concatenated
// globals (no imports), so top-level shape is reliably line-anchored.

import { readFileSync } from 'fs';
import { allFiles } from '../build-files.mjs';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/outline.mjs <file...> | --all');
  process.exit(1);
}
const files = args.includes('--all') ? allFiles : args;

// One matcher per outline-worthy line shape. Only TOP-LEVEL (no indentation)
// declarations are captured, plus window.* exports and ── section banners ──
// wherever they appear (the codebase uses banners to mark logical sections).
const MATCHERS = [
  [/^(?:async )?function\s+([A-Za-z_$][\w$]*)/, (m) => `function ${m[1]}()`],
  [/^const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|[\w$,{ ]*=>|function)/, (m) => `const ${m[1]} = fn`],
  [/^const\s+([A-Z0-9_]{2,})\s*=/, (m) => `const ${m[1]}`],                  // exported-style constants
  [/^class\s+([A-Za-z_$][\w$]*)/, (m) => `class ${m[1]}`],
  [/^\s*window\.([\w$]+)\s*=/, (m) => `→ window.${m[1]}`],
  [/^\s*Object\.assign\(window/, () => '→ Object.assign(window, …)'],
  [/^\s*(?:\/\*|\/\/)\s*([─═]{1,4}|─{1,4})?\s*(.*?[─═─]{3,}.*)$/, (m) => `§ ${m[2].replace(/[─═─/*]+/g, '').trim()}`],
];

for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { console.error(`✗ cannot read ${file}`); continue; }
  const lines = text.split('\n');
  console.log(`\n${file} (${lines.length} lines)`);
  lines.forEach((line, i) => {
    for (const [re, fmt] of MATCHERS) {
      const m = line.match(re);
      if (m) {
        const label = fmt(m);
        if (label && label !== '§') console.log(`  ${String(i + 1).padStart(5)}  ${label}`);
        break;
      }
    }
  });
}
