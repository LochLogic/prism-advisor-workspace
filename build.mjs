// Prism build — concatenates all source files in load order, then runs
// esbuild to transform JSX and minify into dist/bundle.js.
// No module bundling needed: files share the global scope via window.X.

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';

const files = [
  'src/supabase-client.js',
  'src/icons.jsx',
  'src/data.jsx',
  'src/db.jsx',
  'src/store.jsx',
  'src/auth.jsx',
  'src/components.jsx',
  'src/calculators.jsx',
  'src/numbers-panel.jsx',
  'src/client-portal.jsx',
  'src/advisor-dashboard.jsx',
  'src/app.jsx',
];

const combined = files.map(f => readFileSync(f, 'utf8')).join('\n\n');
const tmp = 'src/_entry.jsx';
writeFileSync(tmp, combined);

try {
  mkdirSync('dist', { recursive: true });
  await esbuild.build({
    entryPoints: [tmp],
    bundle: false,
    outfile: 'dist/bundle.js',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    minify: false,
  });
  console.log('✓ dist/bundle.js built');
} finally {
  unlinkSync(tmp);
}
