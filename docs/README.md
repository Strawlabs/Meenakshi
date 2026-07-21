# docs/

Planning and specification documents for Meenakshi modules that are
**documented but not built**. These exist so future implementation work
starts from an agreed shape instead of ad-hoc decisions per vendor/feature.

## Files

| File | Covers | Status |
|---|---|---|
| `integration-hub-phase3.md` | ULI, credit bureau partners (CIBIL/Experian/CRIF), direct banking/NBFC APIs, insurance & wealth platform sync | Planning — no code |
| `enterprise-future-modules.md` | AI Financial Relationship Manager, AI SME Financial Copilot, AI Memory API Platform | Planning — no code |

## Why these exist as separate docs, not ClickUp tickets alone

Ticket descriptions get lost or edited over time. These files are the
durable version of record — committed, versioned, diffable. If a spec
changes, the diff shows what changed and when.

## What "done" means for files in this folder

Nothing in this folder is meant to become working code without a real
trigger first:
- Phase 3 → a signed vendor/partner agreement (ULI, a specific bureau, a
  specific NBFC)
- Enterprise & Future Modules → a signed enterprise deal, or SME Copilot
  being explicitly greenlit as a roadmap item

Until one of those triggers happens, these are reference material only.
Do not create implementation tickets against Tasks 1–8 (consumer MVP)
based on anything in this folder.

## Rule for future edits

If a vendor is picked or a deal is signed, update the relevant spec file
first, then open implementation tickets that link back to it — don't
skip straight to code and document afterward.