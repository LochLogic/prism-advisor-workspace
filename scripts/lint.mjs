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
import { readFileSync } from 'fs';
import { allFiles } from '../build-files.mjs';

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
