# Project Design & Engineering Standards

## Purpose

This document defines the common engineering principles, architecture guidelines, design standards, and development conventions for all Straw Labs Genesis Cohort projects.

The goal is to ensure every project is maintainable, AI-native, scalable, and easy for both humans and AI agents to understand and extend.

---

## Development Philosophy

- Build working software quickly.
- Prefer simple solutions over complex abstractions.
- Ship small, iterative improvements.
- Optimize for maintainability.
- Document decisions, not just code.
- AI should accelerate development, not replace thinking.

---

## Design System (Single Source of Truth)

**IMPORTANT**

The canonical UI/UX reference for this project is the Stitch Design System.

AI agents and developers MUST:

- Follow the layouts, components, spacing, typography, and interaction patterns defined in Stitch.
- Reuse existing design components instead of inventing new UI patterns.
- Extend the design system only when absolutely necessary.
- Maintain visual consistency across all pages and modules.

When implementing a feature:

1. Refer to the latest Stitch design.
2. Match the design system as closely as possible.
3. If a design is missing, create a solution that follows the existing Stitch language.

The goal is to build a unified product experience rather than a collection of disconnected screens.

---

## Standard Technology Stack

### Frontend

- React
- Next.js
- TypeScript
- Tailwind CSS

### Backend

- Python (FastAPI) or Next.js API Routes
- REST-first architecture

### Database

- Supabase (PostgreSQL)
- Supabase Auth
- Supabase Storage

### Deployment

- Vercel
- Hetzner / Railway / Render
- Supabase Cloud

---

## Repository Structure

```text
/
├── README.md
├── AGENT.md
├── DESIGN.md
├── docs/
├── src/
├── components/
├── lib/
├── public/
└── tests/
```

---

## Documentation Standards

Every major feature should include:

- Problem Statement
- User Story
- Acceptance Criteria
- API Notes (if applicable)

Major architectural decisions should be documented under `/docs`.

---

## AI-First Development

AI should be used for:

- Product thinking
- UI generation
- Code generation
- Refactoring
- Documentation
- Test generation
- Pull request reviews

AI output should always be validated before merging.

---

## MCP (Model Context Protocol) Standards

Developers and AI agents should configure and use available MCP servers whenever possible.

### Recommended MCPs

#### Core

- GitHub MCP
- Filesystem MCP
- Browser MCP
- Sequential Thinking MCP

#### Product & Design

- Stitch MCP
- Figma MCP (if available)

#### Data & Backend

- Supabase MCP
- PostgreSQL MCP
- Documentation MCP

These MCPs should be treated as the preferred mechanism for gathering context instead of making assumptions.

---

## Token & Cost Optimization

AI usage should be efficient.

### Best Practices

- Use “caveman mode” first (simple solutions before complex reasoning).
- Reuse existing context.
- Read only the files necessary for the task.
- Keep files modular and well-structured.
- Cache architectural decisions in AGENT.md and DESIGN.md.
- Avoid regenerating large files unnecessarily.

The cheapest token is the one you never spend.

---

## Quality Standards

Before creating a Pull Request:

- Project builds successfully.
- No obvious linting issues.
- Naming conventions are followed.
- Acceptance criteria are satisfied.
- Documentation is updated if required.
- Implementation aligns with the Stitch design system.

---

## Goal

The objective is not to build the most sophisticated software.

The objective is to build reliable, maintainable, AI-native products that evolve quickly while maintaining a consistent user experience across the Straw Labs ecosystem.
