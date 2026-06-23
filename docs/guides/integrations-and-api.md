# Prism integrations and API | Connect your stack

Prism has a small, firm-scoped REST API so you can wire it into the rest of your
tools: Zapier, Make, n8n, or your own scripts. Use it to pull new clients,
meetings, and tasks into another system, or to create clients and tasks in Prism
from one. This guide is for firm admins (you mint the keys) and whoever builds
the automation. It is available under **Help** and as a printable PDF.

## What you can do today

The first version covers the events most firms want to automate:

| You want | How |
| --- | --- |
| Notice a new household and act on it elsewhere | Read recent clients |
| Log a meeting somewhere else when one happens in Prism | Read recent meetings |
| Mirror Prism to-dos into another task system | Read recent tasks |
| Create a household in Prism from a web form or CRM | Create a client |
| Drop a follow-up into Prism from anywhere | Create a task |

Everything is scoped to your firm. A key can only ever see and change your
firm's data, never another firm's.

## Step 1: mint an API key

In **Firm admin → API and integrations**:

1. Type a name you will recognize later, for example "Zapier" or "Website form".
2. Leave **Allow write** on if the integration needs to create clients or tasks;
   turn it off for a read-only key (recommended when a tool only needs to read).
3. Click **Create key**.

The full key is shown **once**, right after you create it. Copy it immediately
and store it in your password manager or the integration's secret field. For
your security Prism keeps only a fingerprint of the key, so it can never be shown
again. Lost a key? Revoke it and mint a new one, it takes a few seconds.

Only firm admins can mint or revoke keys, because a key grants firm-wide access.
You can keep up to 25 active keys; revoke the ones you no longer use.

## Step 2: call the API

The base URL is shown in the same panel. Every request sends the key in a header,
either `Authorization: Bearer YOUR_KEY` or `X-Api-Key: YOUR_KEY`.

Start with the connection test: a `GET` to `/ping` returns your firm name and the
key's scopes. If that works, the key is good.

**Read endpoints** (need a read-enabled key). Each returns the newest items first
and accepts two optional query parameters: `limit` (1 to 100, default 25) and
`since` (an ISO timestamp, to fetch only items at or after that time).

- `GET /clients` returns households: `id`, `household_name`, `short_name`, `tag`,
  `phase`, `aum`, `created_at`, `updated_at`.
- `GET /meetings` returns meetings: `id`, `client_id`, `met_at`, `duration_min`,
  `status`, `notes`, `created_at`.
- `GET /tasks` returns CRM tasks: `id`, `client_id`, `title`, `detail`,
  `priority`, `status`, `due_at`, `created_at`.

**Write endpoints** (need a write-enabled key, sent as JSON in a `POST` body).

- `POST /clients` creates a household. Required: `household_name`. Optional:
  `short_name`, `household_tag`, `current_phase` (0 to 6). The new household is
  assigned to the advisor who owns the key.
- `POST /tasks` creates a task. Required: `title`. Optional: `detail`, `priority`
  (`low`, `normal`, or `high`), `due_at` (ISO timestamp), and `client_id` to
  attach it to a household. A `client_id` that is not in your firm is rejected.

Every created client and task is written to your firm's audit trail, just like
one made in the app, with the key noted as the source.

## Step 3: wire it into Zapier (or Make, or n8n)

Prism speaks plain REST, so any tool that can call a URL with a header works. In
Zapier, the **Webhooks by Zapier** app is the quickest path:

- For a **trigger** ("when a new client appears in Prism"), use a *Retrieve Poll*
  webhook pointed at `GET /clients`, with the key in the headers. Zapier keeps
  track of which `id` values it has already seen, so each household triggers once.
- For an **action** ("create a task in Prism"), use a *Custom Request* (POST) to
  `/tasks` with the key in the headers and the fields as JSON.

Make and n8n have the same two building blocks (an HTTP module and a polling
trigger); point them at the same URLs and header.

## Keeping it safe

- **Treat a key like a password.** Anyone holding it can read and (if write is
  on) change your firm's data. Store it only in the integration's secret field.
- **Use read-only keys** for anything that only needs to read.
- **Name keys per integration** so you can revoke one without breaking the rest.
- **Revoke immediately** if a key may have leaked, or when you stop using a tool.
  Revoking takes effect at once; nothing else is affected.
- Keys never expire on their own. Review your active keys now and then and prune
  the ones you no longer recognize.

## Where things live

| You want | Go to |
| --- | --- |
| Create or revoke a key | Firm admin, API and integrations |
| The base URL | Firm admin, API and integrations |
| Confirm a key works | Call `GET /ping` with the key |
| See what an integration did | Firm admin, Compliance audit trail |

Need an endpoint we do not have yet? Tell your Prism contact what you are trying
to automate, the API grows from real firm requests.
