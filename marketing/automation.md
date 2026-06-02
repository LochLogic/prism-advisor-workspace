# Prism marketing automation — drip-published content

A dozen B2B pages are **pre-written** in `content/pages.mjs` and go live automatically on a
staggered schedule. No runtime generation, no claude.ai dependency, no local machine, no secrets.

## How it works
1. **Each page has a `publishAt` date.** `build.mjs` only renders (and sitemaps) pages whose
   date has arrived — future ones are invisible: not in the HTML, not in the sitemap.
2. **`.github/workflows/scheduled-publish.yml`** runs daily (09:00 UTC). It calls
   `scripts/publish-due.mjs`, which compares `publishAt` dates to today against
   `content/published.json`.
3. When a page comes due, the script updates `published.json`; the workflow commits it. That
   push triggers Cloudflare's normal build, and `build.mjs` then renders the now-due page.
4. On days with nothing due, the workflow does nothing (no commit, no noise).

## Current queue (biweekly)
3 pages already live (publishAt 2026-05-30). The remaining 12 publish:
`06-16, 06-30, 07-14, 07-28, 08-11, 08-25, 09-08, 09-22, 10-06, 10-20, 11-03, 11-17` (2026).

## Add more / change cadence
- **More pages:** append page objects to `content/pages.mjs` with a future `publishAt`. Done.
- **Reschedule:** edit the `publishAt` values. Earlier date = sooner.
- **Publish one now:** set its `publishAt` to today (or past) and push.

## One-time check
The workflow pushes with the built-in `GITHUB_TOKEN`. If pushes fail, ensure
**Settings → Actions → General → Workflow permissions** is set to **Read and write**, and that
`main` has no branch protection blocking the Actions bot.

## Still optional (separate, not set up here)
- **SEO health monitor** (both sites) and **analytics/Search Console digest** — intended as
  claude.ai `/schedule` routines; see `FinFire/marketing/automation-routines.md`. The digest
  also needs analytics + GSC API connected first.
