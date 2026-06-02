# Prism B2B page backlog

The content-engine routine consumes this list **top-down**: take the first item, write a
full page in `content/pages.mjs` following the existing object pattern (slug, title,
description, keywords, updated, h1, lede, body HTML, faq[2]), build, verify, commit/push,
then **delete the consumed line from this file** in the same commit. One item per run.

Quality bar: accurate to Prism's real features (lifecycle roadmaps, account aggregation via
secure bank linking, performance reporting, compliance-grade audit trail + SEC 17a-4 WORM
archive, profile versioning, CRM workflow, MFA, row-level security, realtime collaboration).
B2B tone. Internal links to sibling pages + CTAs to /app (demo) and /signup.html. Never
duplicate an existing slug (see pages.mjs).

## Queue
1. slug: account-aggregation-for-advisors | "Account Aggregation for Financial Advisors" | kw: account aggregation, advisor account aggregation, plaid for advisors
2. slug: performance-reporting-for-rias | "Performance Reporting Software for RIAs" | kw: performance reporting software, RIA performance reports, advisor reporting
3. slug: client-lifecycle-planning | "Client Lifecycle Planning for Financial Advisors" | kw: lifecycle planning, financial planning software, client roadmaps
4. slug: why-advisors-outgrow-spreadsheets | "Why Advisors Outgrow Spreadsheets (and What Comes Next)" | kw: financial advisor spreadsheets, advisor software vs excel
5. slug: ria-software-security | "Security in RIA Software: MFA, RLS, and Audit Trails" | kw: RIA software security, advisor data security, financial advisor MFA
6. slug: realtime-client-collaboration | "Realtime Client Collaboration for Advisors" | kw: client collaboration, advisor client portal collaboration
