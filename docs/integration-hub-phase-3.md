# Integration Hub — Phase 3 Specification

**Status:** Planning / Pre-implementation   
**Depends on:** Phase 2 (Account Aggregator) reaching production stability first  

---

## 1. Scope

Phase 3 connects Meenakshi to India's broader financial data ecosystem beyond user-uploaded documents and AA-linked bank accounts:
- Unified Lending Interface (ULI)
- Credit Bureau partners (CIBIL, Experian, CRIF, Equifax)
- Banking / NBFC APIs (direct, non-AA)
- Insurance and Wealth platform sync

*Note: None of this is built. This document exists so that when a vendor is chosen, implementation follows a pre-agreed shape instead of ad-hoc integration per vendor.*

---

## 2. ULI & Partner Integration Requirements

### What ULI actually is
ULI (RBI's Unified Lending Interface) is a lending-data rail, conceptually similar to UPI but for credit — it standardizes how lenders pull borrower data (land records, income, existing loans) from multiple sources for faster underwriting. Meenakshi's role here is NOT to originate or underwrite loans — that's explicitly out of scope per your PRD guardrails. Meenakshi's role is to *explain* ULI-sourced lending communications and events to the user.

### Requirements
- **R1:** Meenakshi does not need direct ULI lender-side integration. It needs to ingest and explain lending communications (approval, rejection, disbursal, rate change) — these will most plausibly arrive via Gmail (already built) or a future ULI-consent-based data pull once a specific ULI-enabled partner is selected.
- **R2:** No lending decision, eligibility check, or origination logic — guardrail from Section 10 of your Technical Design doc stays in force.
- **R3:** Any future ULI data ingestion must reuse the existing consent-manager pattern already built for Setu AA (`integration_consents` table, `aa-create-consent` / `aa-consent-webhook` edge function shape) rather than inventing a parallel consent system.
- **R4:** Partner selection is a business decision requiring: (a) confirmed RBI/ULI sandbox access, (b) a signed partner agreement, (c) confirmed data schema. None of these exist yet — this is the actual blocker, not code.

---

## 3. Credit Profile Synchronization Path

Reuses the Phase 2 credit report pattern (`creditReportService.ts`, `credit_reports` table) as the target data model. The sync path when a bureau partner (CIBIL/Experian/CRIF) is selected:
User consent (per-bureau, via integration_consents)
→ Bureau API pull (server-side only, via a new Edge Function
e.g. bureau-fetch-report)
→ Store raw response in Supabase Storage (bureau_reports_bucket)
→ Parse via same Gemini extraction pattern as creditReportService.ts
→ Populate credit_reports table (status: pending → parsed | failed)
→ Same status/error_message pattern already enforced in Phase 2 — no
silent success


Key decision already made by precedent: **never call bureau APIs from the
client.** API keys for bureaus are higher-stakes than Setu's — this must be
an Edge Function, matching your existing rule that Setu keys are
server-side only.

## 4. Banking / NBFC API Integration Approach

- Primary path remains Account Aggregator (Phase 2) — this is the RBI-blessed,
  consent-driven route and should stay the default for all bank data.
- Direct bank/NBFC API integration (bypassing AA) is only justified for
  NBFCs not yet AA-participating. This is a narrow, vendor-specific case —
  do not build a generic "banking API" abstraction speculatively.
- If a specific NBFC is contracted, integrate it as its own service file
  (e.g. `services/nbfcXyzSyncService.ts`) following the same shape as
  `contactsSyncService.ts` / `calendarSyncService.ts`: token refresh,
  `integration_consents` status tracking, `last_sync_error` on failure.

## 5. Insurance & Wealth Platform Sync — Privacy/Consent Constraints

- Same consent model as everything else: row in `integration_consents`,
  explicit user opt-in, revocable, `data usage purpose` shown at connect time
  (per Technical Design doc Section 9 — "Consent Management").
- Insurance/wealth data is sensitive financial data — apply the same masking
  rule already used for account numbers in Document Intelligence (masked in
  entity extraction) to any policy/portfolio numbers surfaced in chat or UI.
- No trade execution, no investment recommendation — same AI guardrail as
  Section 10 of Technical Design, extended explicitly to wealth platforms.
- Data retention: policy documents and portfolio snapshots follow the same
  deletion/export rules as Document Vault (Phase 1) — no separate retention
  policy needed, reuse what's built.


## 6. Explicit Non-Goals for Phase 3
- No loan origination, no investment execution, no eligibility scoring.
- No new consent architecture — reuse Setu AA's `integration_consents` +
  edge-function pattern for every future partner.
- No speculative "generic banking API" abstraction until a second real
  partner exists to prove the abstraction is correct.