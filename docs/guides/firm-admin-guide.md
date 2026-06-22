# Prism for firm admins | Running the practice

You are the firm admin: the person who sets the firm's look, manages the
advisor team, owns the fee schedules and billing, sets firm-wide workflow
rules, and answers to the regulator with the audit trail. This guide is the
control-room tour, organized by job rather than by week. It is available in
the app under **Help**, and as a printable PDF you can keep on file.

Everything here lives in **Firm admin** (top bar). If you also carry your own
book of clients, use **Open advisor workspace** at the top of the firm-admin
view to switch between the two hats without signing out.

## Brand the firm

Firm settings, **Branding** (white-label). What you set here paints the whole
workspace, including every client's portal:

- **Logo.** Upload your firm's mark. It is stored with the firm record and
  shown across the advisor app and the client portals. Keep it under 200 KB.
- **Accent color.** Pick the firm's color; it becomes the accent on buttons,
  highlights, and headers everywhere, in both light and dark mode.
- **Powered by Prism.** Optional attribution line. Turn it off if you would
  rather the workspace read as fully your own.

The static sign-in and landing pages stay Prism-branded before a user logs in;
branding takes over the moment they are inside the app or a client opens the
portal.

## Build your advisor team

The **Advisor roster** lists everyone in the firm. From here you:

- **See each advisor** with their client count and role.
- **Set roles.** Flip an advisor between *advisor* and *admin* inline, no SQL
  and no support ticket. Admins get this firm-admin view; advisors do not.
- **Open advisor workspace** switches you into your own client-facing advisor
  app when you wear both hats.

New advisors are added through your account provisioning; once they exist in
the firm they appear here for you to role and manage.

## Set up fee schedules and run billing

The **Revenue and billing** section is your advisory-fee engine. Four tiles at
the top keep score: projected annual revenue (from assigned schedules),
realized fees year to date (approved plus paid), open invoices awaiting
approval, and how many fee schedules you have.

**1. Create a fee schedule.** *New schedule*, then set:

- **Name** (for example "Standard 1%").
- **Frequency**: quarterly, monthly, or annually.
- **Basis**: average daily balance or period-end balance.
- **Tiers**: one or more bands in basis points. Enter an "up to" dollar amount
  for each band and leave the top band's "up to" blank to mean "and above."
  Add as many tiers as the schedule needs.

**2. Assign schedules to clients.** The *Assign schedules to clients* table
lists every household with its AUM and a schedule dropdown. Assigning is inline
here, so you never have to open each client to set their fee.

**3. Run billing.** *Run billing now* generates draft invoices for every client
with an assigned schedule, for the current period.

**4. Approve invoices.** Each invoice shows the client, period, basis amount,
and computed fee. A draft can be **Approved** or **Voided**; an approved
invoice can be marked **Paid**; any invoice can be downloaded as a PDF. Clients
see only approved invoices, in their portal.

**CSV exports.** *Clients CSV* (households plus their fee assignments) and
*Invoices CSV* download the underlying data for your own records or accounting.

Your firm's own Prism subscription is billed separately through Stripe and is
not part of this advisory-fee flow.

## Set firm-wide workflow rules

The **Workflow** section holds firm-wide controls. The main one is the
**client ledger approval gate** (off by default). When you turn it on, any
edit a *client* makes to their own numbers arrives as a draft in the advisor's
"Client updates to review" inbox instead of saving straight away; the advisor
approves it or returns it with a note. Advisor edits are never gated. Turn this
on when you want a second set of eyes on client-entered data; leave it off for
a lighter-touch practice.

## Own compliance and the audit trail

The **Compliance audit trail** is append-only (SEC 17a-3): every mutation
anyone makes is recorded and nothing is ever edited or deleted out of it.

- **Filter and browse** the trail on screen, loading more as you go.
- **Export a window** as CSV (last 90 days, last 12 months, or full history).
- **Print the books-and-records packet.** One click assembles the exam-ready
  document: advisor roster, fee schedules, the client inventory with fee
  assignments, invoices, every acknowledgement with its e-sign state, the audit
  trail for the chosen window, and a retention statement. This is what you hand
  a regulator.

The audit trail is automatic. You do not maintain it; you read and export it.

## A monthly and quarterly rhythm

- **Monthly:** glance at the revenue tiles, clear any draft invoices awaiting
  approval, and skim the audit trail for anything unexpected.
- **Quarterly:** run billing for the period, approve the invoices, and confirm
  fee assignments are current for new households.
- **Annually, or before an exam:** print the books-and-records packet for the
  window you need, and review advisor roles and access.

## Where things live

| You want | Go to |
| --- | --- |
| Firm logo, accent color, attribution | Firm admin, Branding |
| Add or re-role advisors | Firm admin, Advisor roster |
| Create or edit a fee schedule | Firm admin, Revenue and billing, New schedule |
| Assign a fee to a client | Firm admin, Assign schedules to clients |
| Generate quarterly invoices | Firm admin, Run billing now |
| Approve or void an invoice | Firm admin, invoice row |
| Turn on the client approval gate | Firm admin, Workflow |
| Browse or export the audit trail | Firm admin, Compliance audit trail |
| The exam packet | Firm admin, Compliance, books-and-records |
| Switch to your own clients | Firm admin, Open advisor workspace |

## Getting help

Search this guide from the Help drawer (top bar). The advisor "first 30 days"
guide and the client portal tour live there too. Something missing or wrong?
Tell your Prism contact, the guides are regenerated from source on every
release, so fixes ship fast.
