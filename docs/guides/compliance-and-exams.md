# Prism for compliance and exams | The books-and-records tour

When a regulator asks what happened, when, and who did it, this is the guide. It
walks the compliance surfaces a firm admin owns: the audit trail, the
books-and-records packet, the data exports, and how acknowledgements are signed
and proven. It is available under **Help** and as a printable PDF you can keep on
file. Everything here lives in **Firm admin**.

A note up front: Prism keeps the record for you. The audit trail is automatic and
append-only, so the work at exam time is selecting a window and exporting, not
reconstructing history.

## The audit trail

The **Compliance audit trail** (Firm admin) is an append-only log in the spirit
of SEC Rule 17a-3: every material action anyone takes is recorded, and nothing in
it is ever edited or deleted. Each entry carries who acted, what they did, the
household it touched, a plain-language summary, and the timestamp.

- **Browse and filter** on screen. Type into the filter to narrow by person,
  action, or detail; load more as you scroll.
- **Export a window** as CSV: last 90 days, last 12 months, or full history. The
  export is formula-injection safe, so it opens cleanly in any spreadsheet.

You do not maintain the trail. You read it and export it.

## The books-and-records packet

One click assembles the exam-ready document. In **Firm admin → Compliance**,
choose a window (90 days, 12 months, or full history) and print the
**books-and-records packet**. It gathers, in one place:

- the advisor roster,
- the fee schedules,
- the client inventory with each household's fee assignment,
- the invoices,
- every acknowledgement with its e-sign state,
- the audit trail for the chosen window (with a note if it was truncated at the
  cap), and
- a retention statement.

Print it to PDF from your browser and hand it over. This is the single artifact
most exam requests come down to.

## Proving acknowledgements were signed

Disclosures and agreements (for example a fiduciary acknowledgement or an IPS)
are sent for signature and tracked to completion. Each acknowledgement shows its
state, and when it is escalated to a DocuSign envelope the signature event is
recorded back against it. The books-and-records packet lists every
acknowledgement with that e-sign state, so "was this disclosed and signed?" has a
documented answer.

## The data exports

Beyond the full packet, the firm-admin view offers focused CSVs for your own
records or your accountant:

- **Clients CSV**: households with advisor, AUM, and fee assignment.
- **Invoices CSV**: the advisory-fee invoices.
- **Audit CSV**: the audit trail for the selected window.

## Retention, by design

Prism is built so the record survives. Working data is soft-deleted (kept, marked
inactive) rather than erased, profile versions are immutable snapshots, and the
audit trail is append-only. A nightly export copies the audit log off-table for
retention. The result is that "show me the history" has an answer even for
records a user changed or removed in the app.

## A rhythm that keeps you exam-ready

- **Monthly:** skim the audit trail for anything unexpected; clear draft invoices.
- **Quarterly:** confirm fee assignments are current; check that acknowledgements
  for new households are signed.
- **Annually, or when an exam letter arrives:** print the books-and-records
  packet for the window requested, and review advisor roles and access.

## Where things live

| You want | Go to |
| --- | --- |
| Browse or filter the audit trail | Firm admin, Compliance audit trail |
| Export the audit trail as CSV | Firm admin, Compliance, audit window, Export |
| The full exam packet | Firm admin, Compliance, books-and-records |
| Clients or invoices CSV | Firm admin, Revenue and billing |
| Acknowledgement signature state | Firm admin, the books-and-records packet |
| Review who has access | Firm admin, Advisor roster |

## Getting help

Search this guide from the Help drawer (top bar). The firm-admin running-the-
practice guide and the advisor and client guides live there too. Something
missing or wrong? Tell your Prism contact; the guides are regenerated from source
on every release, so fixes ship fast.
