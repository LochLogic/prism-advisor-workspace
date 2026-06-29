# Prism AI assistant | A guide for advisors

Prism carries an AI assistant that drafts the writing around your practice: a reply
to a client message, the talking points before a review, the narrative on a QBR
packet, the first read on which households need attention this week. It works from
the data already on each household's file, so its output is specific to the client
in front of you, never generic. This guide is the map: what each AI action does,
where it lives, and the one rule that keeps it safe to lean on. It is available
under **Help** and as a printable PDF.

A note up front, because it is the whole design: **the AI writes the prose, never
the math.** Every number a client sees still comes from the deterministic planning
engine, the same seeded, line-explainable tools described in the planning-tools
guide. The assistant drafts the words around those numbers. It does not compute a
projection, invent a figure, or replace a calculator. That separation is on
purpose, and it is what makes the AI safe to use in a regulated practice.

## The one rule: you are the author

Nothing the assistant produces is sent, saved, or shown to a client on its own.
Every action returns a draft into a field you control. You read it, edit it, and
decide whether it goes out. The AI is a fast first draft, not an autopilot. A reply
you would not have written yourself should not be sent because the assistant wrote
it first.

This is also why the assistant is **advisor-only.** It lives in the advisor
workspace and is not part of the slim client portal at all, so a client never talks
to a model and never sees a draft before you have approved it.

## What it can do, and where each lives

### Draft a reply to a client message

In any household's **Messages** thread, the composer carries a draft-reply action.
It reads the recent thread and the household context and proposes a reply in your
voice. Edit and send, or clear it and write your own. The point is to clear an
inbox faster, not to outsource the relationship.

### Draft a reply to a flagged question

When a client flags a milestone for discussion, it lands in your dashboard inbox
with its context. The inbox carries its own draft action that answers *that*
question against *that* household's plan, so the reply is grounded in their actual
numbers rather than a general answer.

### Summarize a household

From a household's quick view, **Household summary** turns the full file into a
short, readable brief: where they are on the roadmap, what stands out, what is
open. It is the thirty-second catch-up before a call, drawn from the same ledger
the tools read.

### Build review talking points

Next to the summary, **Review talking points** drafts the agenda for a client
conversation: the items worth raising this quarter, in plain language. Use it as
the starting outline, then shape it to the meeting you actually want to have.

### Narrate a QBR packet

When you print the **QBR** (quarterly business review) packet, you can ask the
assistant to write the narrative that frames the numbers. The deterministic plan
flags (a concentrated equity position, a projected first RMD, the 1040
observations) are still computed by the tools and printed as-is; the AI writes the
connective prose so the packet reads like a document, not a data dump.

### Triage your book: "who needs attention?"

On the dashboard, the AI triage answers the Monday-morning question. It scans your
book and surfaces the few households where a small action now protects trust: a
large idle cash balance against an on-track plan, an unanswered flagged question, a
quarter with no logged meeting. It is a prioritized starting point for your week,
not a replacement for your judgment about your own clients.

### Read a W-2

In the **Numbers** drawer, you can hand the assistant a W-2 (an image or a PDF) and
it extracts the box values into the tax fields, so you confirm rather than type.
You review the parsed numbers before they are saved; nothing is captured silently.
This is the one action that reads a document, and it still ends in your
confirmation.

## What it will not do

- **It will not move money or change a plan.** Drafting a reply or a summary never
  edits the ledger, sends a message, or files anything. Actions that change state
  remain explicit clicks you make.
- **It will not compute the numbers.** Bracket headroom, funded percentages, Monte
  Carlo success, Social Security break-even: all still come from the deterministic
  engine. If a figure appears in an AI draft, it traces to a tool you can point at.
- **It will not see what you have not connected.** The assistant reads the
  household file you have built. A sparse file yields a thin draft; a complete one
  yields a sharp draft. Garbage in is still garbage in.

## How it stays accountable

Every AI call runs through one server-side function with the model key held
server-side, never in the browser. Each call returns its result together with
telemetry (the token counts and the latency), and that telemetry is recorded, so
the assistant's usage is measurable and auditable rather than a black box bolted on
the side. As with the planning tools, the design choice is the same: fast, but
inspectable.

## Getting the best drafts

- **Feed it a full file.** The Numbers drawer is the assistant's source. A complete
  household ledger is the single biggest lever on draft quality.
- **Treat the first draft as a draft.** The fastest workflow is generate, then
  edit, not generate and ship. Your edits are also what keep the voice yours.
- **Pair it with the tools, not against them.** Let the calculators settle the
  number in the room, then let the assistant write it up. That division is where it
  earns its keep.

## Where things live

| You want | Go to |
| --- | --- |
| Draft a message reply | Quick view, Messages, the composer |
| Draft a flagged-question reply | Dashboard inbox, the flagged question |
| A quick brief on a household | Quick view, Household summary |
| An agenda for a review | Quick view, Review talking points |
| The narrative on a QBR | Print the QBR packet, with narrative |
| Who to call this week | Dashboard, the AI triage |
| Read a W-2 into the file | Numbers drawer, W-2 upload |

## Getting help

Search this guide from the Help drawer (top bar). The advisor onboarding, client
portal, firm-admin, integrations, compliance, and planning-tools guides live there
too. Something missing or wrong? Tell your Prism contact; the guides are regenerated
from source on every release, so fixes ship fast.
