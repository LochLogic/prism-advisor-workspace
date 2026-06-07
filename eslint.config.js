// Prism ESLint config (flat). The app's source files concatenate into a single
// shared scope at runtime (bare-name globals across files — see build.mjs), so
// scripts/lint.mjs feeds ESLint the esbuild-transformed concatenation rather than
// the individual files. That (a) resolves cross-file references for `no-undef`,
// and (b) turns JSX into React.createElement() calls so intrinsic tags like <div>
// are string literals — only real component/identifier typos remain as references.
//
// Scope is deliberately narrow: correctness rules that catch the failure modes the
// bare-global architecture invites (a typo'd identifier, a name collision, a dead
// branch), NOT style. No formatting churn, no noisy unused-vars on a 1-file blob.
import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,      // calc-core.cjs guards on `module`/`require`
        React: 'readonly',
        ReactDOM: 'readonly',
        Plaid: 'readonly',    // loaded from Plaid's CDN at runtime
      },
    },
    rules: {
      'no-undef': 'error',          // the headline rule — catches typo'd globals
      'no-redeclare': 'error',      // top-level name collision across files = real bug
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-cond-assign': ['error', 'always'],
      'no-func-assign': 'error',
      'no-obj-calls': 'error',
      'no-unsafe-negation': 'error',
      'no-self-assign': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
    },
  },
];
