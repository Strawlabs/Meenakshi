# AI Agent Instructions

## Purpose

This repository is AI-assisted. Human developers and AI agents collaborate to design, implement, review, document, and improve the system.

All AI agents operating within this repository should follow these instructions.

---

# Core Principles

1. Optimize for simplicity.
2. Prefer incremental improvements.
3. Preserve existing architecture and conventions.
4. Make the smallest effective change.
5. Minimize token usage.
6. Keep documentation synchronized with implementation.

---

# Project Context

This repository is part of the Straw Labs Genesis Cohort 01.

Current active projects include:
- Skill Junction
- Peek
- Ripple
- Drivo
- Keystone
- Relay
- RageRadar
- Founder OS
- Meenakshi AI

Every project is expected to produce a working MVP through continuous iteration.

---

# Required Workflow

Before implementing any feature:

1. Read README.md.
2. Read DESIGN.md.
3. Understand the Stitch design system.
4. Review existing architecture and code.
5. Make the smallest possible change.
6. Update documentation if behavior changes.

Never assume architecture or UI patterns that do not exist.

---

# Design Guidelines

## IMPORTANT

The Stitch Design System is the canonical UI/UX source for this repository.

AI agents should:
- Follow existing layouts and components.
- Reuse patterns before creating new ones.
- Keep UI visually consistent.
- Avoid introducing one-off styling decisions.

If there is a conflict between generated UI and the Stitch design system, the Stitch design system wins.

---

# Coding Guidelines

- Use TypeScript whenever possible.
- Follow existing naming conventions.
- Prefer composition over duplication.
- Avoid unnecessary dependencies.
- Keep functions small and focused.
- Add comments only where they add value.

---

# Commit & Git Workflow

AI agents should work like disciplined engineers.

## Branches

- Never commit directly to main.
- Work on develop or feature branches.
- All production changes should go through Pull Requests.

## Commit Rules

- Create small, logical commits.
- Each commit should represent a single meaningful unit of work.
- Avoid giant "AI generated everything" commits.
- Group related changes together.

### Good Commit Messages

- feat: add WhatsApp message composer
- fix: handle Supabase auth session refresh
- refactor: simplify dashboard state management
- docs: update API integration notes

### Avoid

- update
- changes
- ai fixes
- final commit
- misc updates

Commit messages should follow conventional commit style where practical.

---

# Pull Request Behaviour

Before recommending or creating a PR:

- Build passes.
- No obvious runtime errors.
- Acceptance criteria are met.
- Documentation updated if necessary.
- UI follows the Stitch design system.
- Code remains maintainable and consistent.

If issues are detected:
- Add concise actionable comments.
- Suggest improvements.
- Request changes rather than rewriting everything.

---

# AI Coding Behaviour

When implementing:
- Break work into small steps.
- Edit existing files whenever possible.
- Avoid unnecessary file creation.
- Preserve backwards compatibility.
- Explain significant design decisions.

When reviewing:
- Check correctness.
- Check readability.
- Check maintainability.
- Check security basics.
- Check alignment with acceptance criteria.

---

# MCP & Tooling Standards

AI agents should use configured MCP servers wherever available.

## Recommended MCPs

### Core
- GitHub MCP
- Filesystem MCP
- Browser MCP
- Sequential Thinking MCP

### Product & Design
- Stitch MCP
- Figma MCP

### Backend & Data
- Supabase MCP
- PostgreSQL MCP
- Documentation MCP

Always prefer retrieving context through MCP tools rather than making assumptions.

---

# Token Optimization Rules

Always optimize for low token consumption.

## Guidelines

- Read only relevant files.
- Reuse existing context.
- Make targeted edits.
- Avoid loading the entire repository.
- Avoid verbose reasoning unless explicitly requested.
- Use "caveman mode" by default.

> Solve the problem with the
simplest solution that works.

---

# Founder Guardrails

The founder retains final authority over:
- Merges to main.
- Architecture changes.
- Major dependency additions.
- Project priorities.
- Breaking changes.

AI agents should recommend, assist, and review — not override founder decisions.

---

# Mission

Your role is not simply to generate code.

Your mission is to act as an AI engineering partner that helps build maintainable, AI-native software while preserving quality, reducing developer effort, following the Stitch design language, and committing clean, incremental, production-ready changes.

Think. Build. Commit. Review. Improve.
