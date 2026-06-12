# Quik! Field Taxonomy & API | Research Notes

> Public-docs research pass, 2026-06-12. No API key used; everything below comes from
> Quik!'s public Confluence (efficienttech.atlassian.net), support site, and partner docs.
> Consumed by `src/paperwork.jsx` (the `_qf` mappings at each field + the payload `quik`
> block + `PAPERWORK_PACKAGES`). The gating next step is the sales contact
> (customer id + API key) - see TODO round-23 blanks.

## 1. The field naming convention

Quik! field names are `<n><role>.<Base>`:

- `<n>` - instance counter for the role (1 = first, 2 = second; up to the role's max).
- `<role>` - the "Parent (Level 1) field": the entity the data belongs to (`own`, `acc`, `ben`, `rep`...).
- `<Base>` - the "Base (Level 2/3) field": the datum itself (`FName`, `LName`, `SSN`...). Base names
  can have period-separated segments, e.g. the home/legal address book prefix `H.` (`H.Addr1`, `H.FullAddr`).

Examples straight from their docs:

| Field name | Meaning |
|---|---|
| `1own.FName` | First owner, first name |
| `2own.LName` | Second owner, last name |
| `1own.SSN` | First owner, Social Security number |
| `1own.H.Addr1` | First owner, home/legal address line 1 |
| `1own.H.FullAddr` | First owner, full home address (one-line) |
| `1acc.Reg` | Account registration / title |
| `1acc.RegType` | Registration type (lookup-coded checkbox, see §3) |
| `1own.12345.2.sign` | Owner 1's second signature field on form 12345 |

This is the entire economy of the integration: map Prism's household model to roles + the
common base set once, and the same mapping prefills any of the ~43k forms in their library.
The marketing "1.2M field names" figure is role-instance x base combinations; the real
surface is ~100 roles x ~3,400 base fields.

## 2. Roles (Parent fields) Prism cares about

Full list: ~100 roles ("Parent Field List" page, Confluence QFDV2V space). The ones relevant
to account opening at Schwab/Fidelity:

| Role | Meaning | Max | Prism source |
|---|---|---|---|
| `own` | Account owner | 50 | household members (primary first) |
| `acc` | Account information | 25 | registration selection |
| `macc` | Master account information | 10 | likely home of the Schwab G-number (confirm) |
| `ben` / `cben` | Beneficiary / contingent | 20 | profile beneficiaries (future capture) |
| `min` / `cus` | Minor / custodian | 20 / 6 | UTMA registrations |
| `trust` / `tte` | Trust entity / trustee | 10 / 20 | trust registrations |
| `rep` | Rep / advisor of record | 20 | advisor record |
| `ria` | Registered Investment Advisor | 6 | firm record |
| `oacc` | Account at other institution | 10 | ACAT transfers (future) |
| `bnk` | Bank account (depositor) | 6 | ACH / MoneyLink (future) |
| `poa` | Power of attorney | 10 | future |
| `spou` | Spouse of owner | 10 | household members |

## 3. Checkbox / radio lookup values

Choice fields carry coded export values, not free text:

- Yes/No boxes: `YES` / `NO`. True/False boxes: `1` / `2`.
- Other single-select groups (e.g. `1acc.RegType`): one field name, positional values
  (1, 2, 3... top-to-bottom, left-to-right; 0 = "other"). Values are per-form - read them
  from the form's field dictionary, never hardcode across forms.
- Multi-select groups: each box is its own field name with value `1`.
- In generated HTML, radio names appear as `QuikRadio<FormID>.1acc.RegType`; strip the
  `QuikRadio<FormID>.` prefix when prefilling.

## 4. The two API surfaces

**Metadata API (QFEM v2000)** - `https://websvcs.quikforms.com/rest/qfem/v2000`
(swagger at `/swagger/index.html`; Bearer license auth). Read-only lookups:
`GET /forms/search` (find Form IDs by dealer/category/keyword), `GET /forms/fields?FormIds=`
(the per-form field dictionary - this is what confirms our provisional names),
`GET /fields/{id}/lookupvalue`, `GET /fields/esign`, `GET /forms/roles/*`, `GET /forms/firstpage`
(preview images).

**Forms Engine (generation)** - `https://websvcs.quikforms.com/rest/quikformsengine`
(UAT: `https://uatwebsvcs.quikforms.com/rest/quikformsengine`; customer OAuthToken in headers).

- `POST /qfe/execute/html` - interactive HTML form (HTMLSettings).
- `POST /qfe/execute/pdf` - filled PDF (PDFSettings). Signable PDF when `ForSign: true`
  and `PrintEditablePDF: false`.

Request body (only `QuikFormID` is required):

```json
{
  "QuikFormID": "12",
  "FormFields": [
    { "FieldName": "1own.FName", "FieldValue": "John" },
    { "FieldName": "1own.LName", "FieldValue": "Doe" }
  ],
  "HostFormOnQuik": true
}
```

`TestDataMode: true` generates the form with every field showing its own field name -
useful for visual mapping checks once credentialed.

## 5. E-sign hand-off (decision input for TODO "E-sign routing")

Quik! integrates DocuSign and SIGNiX but is "not a re-seller": the customer brings their
own provider account. Two models:

- **Self Service** - full control: Quik! returns the generated, signable PDF plus signing
  metadata (field/recipient data from `GET /fields/esign`); the customer's own code creates
  the DocuSign envelope with its own integrator key.
- **Pass Thru** - the customer's endpoint just relays to Quik!'s REST service, which builds
  the envelope; control only at the start of the transaction.

**Recommendation (unchanged, now evidence-backed):** Self Service. Prism already owns
DocuSign envelope plumbing (`docusign-envelope` / `docusign-connect`), so Quik! does
form-fill only and Prism keeps one signature audit trail. Confirm with sales that the
API tier includes the Forms Engine PDF endpoint + e-sign metadata.

## 6. Verified vs. provisional field names

Names seen verbatim in public docs (safe to emit): `FName`, `LName`, `SSN`, `H.Addr1`,
`H.FullAddr` (owner bases); `1acc.Reg`, `1acc.RegType`; signature pattern `<role>.<FormID>.<n>.sign`.

Names that follow the convention but are NOT yet confirmed (flagged `verified: false` in
`QUIK_FIELDS`, surfaced as `unverifiedFields` in the export payload): owner `DOB`,
citizenship, employment/occupation, suitability (annual income / net worth), state,
`1rep.*` advisor fields, `1macc.*` for the G-number, trust EIN. Confirm every one against
`GET /forms/fields` for the chosen Form IDs before live submission. Owner names: round 25
added real first/middle/last capture (`members[].identity`, Numbers drawer); the
best-effort split of the single name string remains only as the fallback for households
that have not filled the identity block in yet.

## 7. UX decision: action packages, not a forms list

Decided with the founder 2026-06-12: the advisor-facing picker is organized by
ACTION ("Open account", "Transfer assets in (ACAT)", "Update beneficiaries",
"Money movement"), each resolving to a bundle of Form IDs generated in one Execute
call (`QuikFormID` accepts a list). `PAPERWORK_PACKAGES` in `src/paperwork.jsx`
encodes the slots; real Form IDs come from `GET /forms/search` once credentialed,
and the full picker flow (multi-select, Create, PDF preview, DocuSign routing) is
deliberately deferred until then so it is built once against the real catalog.
Form search remains the long-tail fallback. Missing prefill data does not block
generation: Quik! fields can stay recipient-editable inside DocuSign, so clients
complete their own fields in the envelope.

## 8. What this unlocks / still blocks

Done now: payload exports Execute-shaped `FormFields`, the field map lives in code, e-sign
direction validated. Still blocked on the sales contact (TODO round-23): customer id +
API key (UAT first), Form ID selection via `/forms/search`, dictionary confirmation via
`/forms/fields`, the firm's G-number, and compliance sign-off on server-side SSN release
(`client-identifiers` edge fn releases directly into the edge-side Execute call; the full
value never reaches the browser and is never logged).

## Sources

- [Quik! Field Definition Overview](https://efficienttech.atlassian.net/wiki/spaces/QFDV2V/pages/4685856/Quik+Field+Definition+Overview) (+ child pages: Field Naming Convention, Parent Field List, Base Fields, Lookup Values)
- [Quik! API Guide](https://efficienttech.atlassian.net/wiki/spaces/QAG/overview) (Generate Forms, JSON Request Body Example, E-Signature Integration, Self Service / Pass Thru models, Where Can I Find Field Names)
- [QFEM v2000 swagger](https://websvcs.quikforms.com/rest/qfem/v2000/swagger/index.html)
- [Field Naming Conventions (support site)](https://support.quikforms.com/hc/en-us/articles/12216725247771-Field-Naming-Conventions)
- Field grid viewer: `admin.etiforms.com/qfdgrid.aspx` (datasets: Client, Acct, Rep, Signature...)
