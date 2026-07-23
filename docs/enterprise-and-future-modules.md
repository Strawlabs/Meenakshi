# Enterprise & Future Modules Specification

**Status:** Planning / Post-MVP    
**Depends on:** Consumer MVP (Tasks 1–8) reaching stable production first  

---

## 1. Why this exists

Meenakshi's MVP is B2C — a personal AI companion for individuals. Everything in this document is B2B / enterprise scope, explicitly **NOT** part of the Genesis Cohort MVP. This document exists so future work has a pre-agreed shape, and so nobody accidentally pulls enterprise work into the MVP backlog.

---

## 2. Enterprise Use Cases

### AI Financial Relationship Manager (for banks/NBFCs/insurance/wealth firms)
- **User:** A bank RM, wealth advisor, or insurance agent — not the end consumer.
- **Use case:** RM opens a customer's profile and instantly sees an AI-generated summary of that customer's history, instead of digging through CRM notes, call logs, and policy documents manually.
- **Reuses:** The same Relationship Intelligence Engine already built for consumers (`relationshipService.ts` pattern) — just pointed at bank-customer data instead of personal contacts.
- **Key difference from consumer version:** Multi-tenant. One bank's RM must never see another bank's customers, or another RM's customers unless permitted. Needs proper tenant isolation, not just per-user RLS.

### AI SME Financial Copilot (for founders/small businesses)
- **User:** A founder or small business owner — closer to consumer MVP's "Founder / Business Owner" persona (Persona 2 in PRD), but scoped for business-level data (vendor payments, business cash flow) rather than personal finances.
- **Use case:** "What's my runway?", "Which vendors haven't I paid?", "Summarize this quarter's cash flow" — same Financial Intelligence Engine pattern, applied to business bank accounts/invoices instead of personal ones.
- **Note:** This is the closest of the three to being consumer-adjacent — could plausibly ship as a MVP+1 feature, not a full enterprise sales-cycle product.

---

## 3. SME Copilot vs Consumer MVP — Explicit Scope Separation

| Feature | Consumer MVP | SME Copilot |
|---|---|---|
| **User** | Individual (Persona 1) | Founder/business owner (Persona 2, business context) |
| **Data** | Personal Gmail, personal bank accounts | Business invoices, vendor emails, business bank accounts |
| **Financial Engine** | Personal financial health score | Cash flow / runway / vendor liability tracking |
| **Relationship Engine** | Personal contacts, business cards | Vendor relationship memory, customer relationship memory |
| **Build status** | Built (Tasks 1–6) | Not started — reuses same engines, different data scope and prompts |

> [!IMPORTANT]
> The SME Copilot is **not** a separate product — it's the same engines (Memory, Financial, Relationship, Document) with different system prompts and a business-context data model. Do **not** build a parallel codebase for it.

---

## 4. API Surfaces (future — not built)

These are the eventual external-facing APIs if Meenakshi becomes a platform other products can build on. Defining shape now, building nothing yet.

| API | Wraps | Consumer |
|---|---|---|
| **Memory Graph API** | `memoryService.ts` (`search_memories`, `entities`) | 3rd-party apps wanting AI memory |
| **Financial Timeline API** | `financialTimelineService.ts` | Bank/NBFC dashboards |
| **Relationship Intelligence API** | `relationshipService.ts` | CRM tools |
| **AI Reasoning API** | `geminiService.ts` + `systemPromptService.ts` context builder | Any product wanting grounded financial Q&A |
| **Document Intelligence API** | `documentService.ts`, `documentQAService.ts` | Document-heavy fintech products |

*Each would be a thin Edge Function wrapper around the existing service file, authenticated via API key (not user session) — this is a real build, but only once a real external consumer exists. No speculative API versioning, no public docs site, until then.*

---

## 5. Explicit Non-Goals (MVP Boundary)

- None of Section 2–4 is scheduled work. No ClickUp tickets should be created under Tasks 1–8 (consumer MVP) for any of this.
- No multi-tenant infrastructure exists yet — do not assume RLS-per-user extends safely to RLS-per-bank-per-RM without a real redesign.
- This document is reference material for when a bank/NBFC/enterprise deal is signed, or when SME Copilot is greenlit as a real roadmap item — not before.
