# DocuSign e-sign — operator setup

Prism's acknowledgements (migration 017) support two signing providers:

- **`prism`** — the client types their name in the portal (in-app acknowledgement).
- **`docusign`** — a legally-binding DocuSign envelope. The advisor escalates a
  pending acknowledgement to DocuSign from the client modal; the client signs via
  DocuSign's email ceremony; the `docusign-connect` webhook marks the row signed.

The code is in the repo and ships with the app. **DocuSign stays inert until the
steps below are done** — until then, "DocuSign" sends fail gracefully with a toast
and the in-portal typed-name path keeps working.

> **Security:** the integration key, user/account ids, and the RSA private key are
> **never** stored in the repo. They live only as Supabase Function secrets. The
> raw credential drop (`docs/DocuSign.txt`) is git-ignored — keep it off the repo.

---

## 1 · Apply the migration

Run `supabase/migrations/027_docusign_envelope.sql` in the Supabase SQL editor
(the project's migration model — see `deploy.yml` header). It adds
`provider / envelope_id / envelope_status / sent_at` to `acknowledgements`.

## 2 · Set the Function secrets

From the raw credential drop. Demo values shown; swap the OAuth/REST bases for
production (`account.docusign.com` / your prod base URI) when you go live.

```bash
supabase secrets set \
  DOCUSIGN_INTEGRATION_KEY=<integration key> \
  DOCUSIGN_USER_ID=<API user id GUID> \
  DOCUSIGN_ACCOUNT_ID=<API account id GUID> \
  DOCUSIGN_OAUTH_BASE=account-d.docusign.com \
  --project-ref phabxcijbbphfxvjedfj

# The RSA private key — from a file so the PEM newlines survive:
supabase secrets set DOCUSIGN_PRIVATE_KEY="$(cat docusign_private.pem)" \
  --project-ref phabxcijbbphfxvjedfj
```

Optional:
- `DOCUSIGN_REST_BASE` — pin the REST base (e.g. `https://demo.docusign.net`)
  instead of resolving it from `/oauth/userinfo`.
- `DOCUSIGN_CONNECT_HMAC_KEY` — the Connect HMAC key (see step 5). **Set this for
  production** — without it the webhook accepts unsigned posts (logs a warning).

## 3 · Grant JWT-grant consent (one-time)

JWT Grant impersonates the API user, which DocuSign requires consent for once.
Open this URL (demo) in a browser logged into the DocuSign account and approve:

```
https://account-d.docusign.com/oauth/auth?response_type=code
  &scope=signature%20impersonation
  &client_id=<integration key>
  &redirect_uri=https://prismaw.com
```

(Production: `account.docusign.com`.) Until this is done, token requests fail with
`consent_required` — the `docusign-envelope` toast will surface it.

## 4 · Deploy the edge functions

Trigger the manual **Deploy (manual)** workflow (Actions tab → type `deploy`). It
now includes `docusign-envelope` (JWT-verified) and `docusign-connect` (public,
HMAC-verified) — see `supabase/config.toml`.

## 5 · Configure DocuSign Connect (status webhook)

DocuSign Admin → **Connect** → add a custom configuration:

- **URL:** `https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/docusign-connect`
- **Format:** JSON (Aggregate)
- **Trigger events:** envelope *Completed* (Delivered/Declined/Voided optional —
  the handler maps them to `envelope_status`).
- **Include:** check **Recipients** so the webhook carries the signer's name
  (it populates "Signed by …"; without it the row still flips to Signed, just unnamed).
- **HMAC:** enable and copy the key into `DOCUSIGN_CONNECT_HMAC_KEY` (step 2).

## 6 · Smoke test

1. In the advisor app, open a **live** client → Acknowledgements → **Request** a
   short acknowledgement (or **Draft IPS**).
2. On the pending row, click **DocuSign**. The client (their `invite_email`, or
   their claimed login email) receives a DocuSign envelope; the row shows
   *Sent · awaiting signature*.
3. Sign as the client in DocuSign. Within seconds the Connect webhook flips the
   row to **Signed** (advisor view + client portal), with an `ack.docusign_completed`
   audit entry.

---

### Notes

- **Email signing, not embedded** — no DocuSign UI is framed in Prism, so no CSP
  `frame-src` change is needed. The client signs on DocuSign's own domain.
- The signer email comes from `clients.invite_email`, falling back to the claimed
  auth user's email. If neither exists the send returns a 422 ("no email on file").
- The acknowledgement document is generated from the title/body as HTML with a
  `/sig1/` anchor tab; DocuSign converts it to a PDF for signing and archival.
