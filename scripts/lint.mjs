// Prism linter. The app's source files share one scope at runtime (bare-name
// globals across concatenated files), so we lint them the way they actually run:
// concatenate in load order, esbuild-transform JSX → React.createElement(), then
// run ESLint over the result. This resolves cross-file references for `no-undef`
// and removes JSX-identifier ambiguity (intrinsic tags become string literals).
//
// A failure prints the offending identifier; locations index into the combined
// blob, so grep the source for the reported name. Run: `npm run lint`.
import { ESLint } from 'eslint';
import * as esbuild from 'esbuild';
import { readFileSync, readdirSync } from 'fs';
import { allFiles, sourceFiles, portalFiles } from '../build-files.mjs';

// ── Bundle-structure guards (run before the slow ESLint pass) ───────────────
// The bare-global concat model is load-order- and membership-fragile; these
// asserts catch the two ways it silently breaks.
let structureErrors = 0;
const structFail = (m) => { console.error(`✗ structure: ${m}`); structureErrors++; };

// 1 · Coverage — every bundleable src/ file must be listed in build-files.mjs
//     (a file added to src/ but not to the load order ships nowhere).
const STANDALONE = new Set([
  'src/brand-boot.js',   // pre-auth boot script, copied by build.mjs by design
  'src/portal-sw.js',    // portal service worker (push) — copied by build.mjs, never bundled
]);
const onDisk = readdirSync('src').filter(f => /\.(jsx|cjs|js)$/.test(f)).map(f => `src/${f}`);
const listed = new Set(allFiles);
for (const f of onDisk) {
  if (!listed.has(f) && !STANDALONE.has(f)) structFail(`${f} exists in src/ but is not in build-files.mjs`);
}
for (const f of allFiles) {
  if (!onDisk.includes(f)) structFail(`${f} is listed in build-files.mjs but missing from src/`);
}

// 2 · Portal isolation — the /portal bundle must never reference a top-level
//     name declared only in an advisor-only file (it would be undefined at
//     runtime for clients, and would mean advisor code is load-bearing there).
const advisorOnly = sourceFiles.filter(f => !portalFiles.includes(f));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const declRe = /^(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
const advisorNames = new Set();
for (const f of advisorOnly) {
  const src = stripComments(readFileSync(f, 'utf8'));
  for (const m of src.matchAll(declRe)) advisorNames.add(m[1]);
}
for (const f of portalFiles) {
  const src = stripComments(readFileSync(f, 'utf8'));
  for (const name of advisorNames) {
    if (new RegExp(`\\b${name}\\b`).test(src)) structFail(`portal file ${f} references advisor-only global "${name}"`);
  }
}

if (structureErrors) {
  console.error(`\n✗ ${structureErrors} bundle-structure error(s) — fix build-files.mjs / the offending reference.`);
  process.exit(1);
}
console.log('✓ bundle structure: src/ coverage + portal isolation hold.');

const combined = allFiles
  .map(f => `/* ==== ${f} ==== */\n` + readFileSync(f, 'utf8'))
  .join('\n\n');

// Match the build's JSX transform so the linted code mirrors the shipped bundle.
const { code } = await esbuild.transform(combined, {
  loader: 'jsx',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: false,
});

const eslint = new ESLint();
const results = await eslint.lintText(code, { filePath: 'dist/_lint.js' });
const output = await (await eslint.loadFormatter('stylish')).format(results);
if (output.trim()) console.log(output);

const errors = results.reduce((n, r) => n + r.errorCount, 0);
if (errors > 0) {
  console.error(`\n✗ ESLint found ${errors} error(s). The locations index into the ` +
    `concatenated bundle — grep the source for the reported identifier.`);
  process.exit(1);
}
console.log('✓ ESLint: no errors across the concatenated app sources.');
