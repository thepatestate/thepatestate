# FOR ISAAC — DEPLOYING THE PATE STATE WRITING SYSTEM
### Kit v4.2 · Aug 27, 2026 · From Josh

This folder is the complete, self-contained editorial and build system for thepatestate.com. It is not a patch, not an update to anything, and depends on nothing you don't have in your hands right now. Treat it as day one.

## Deploy (three steps)

1. **Drop this entire folder into the repo at `/prompts/pate-state-kit/`** (or your preferred instruction path). Keep the folder intact — the internal cross-references assume these filenames.
2. **Point Claude Code at `00-START-HERE.md`.** That file carries the load order and task routing; agents load the Constitution always, the Voice Bible for any prose, and exactly one product spec per task.
3. **Enforce the exclusivity rule:** nothing outside this folder may be loadable as writing instructions — no older manuals, guides, playbooks, or correction notes anywhere in an agent load path. If you find any, archive them outside the pipeline. This single rule is what prevents the conflicting-instruction drift that broke the old system.

## The one folder to complete

`reference-builds/` ships with the gold-standard column (`feature-three-boards-v3.html`). Its README lists four more approved builds (annual chrome, Wire standards, commitment page) that Josh supplies from the approved-builds archive — drop them in as you receive them. Agents are instructed to stop and request a missing reference build rather than approximate chrome, so nothing breaks in the meantime; those lanes just wait for their file.

## Context you'll want

- **Stack:** Next.js 14 on Vercel · Sanity CMS · Supabase (auth/citizen data) · Anthropic API (claude-sonnet-4-6) · CFBD API for sports data.
- **Your build surface:** the design system (`08-design-system.md`) is written to you as much as to the agents — React components from the reference chrome, Sanity schema with required-visual prompting, CFBD population, server-side PNG rendering for social, homepage dedup logic (§6).
- **The two lanes:** the Wire publishes autonomously inside hard boundaries; anything with Josh's byline stops at a human approval gate. Both are defined in `01-constitution.md`.
- **Quality gates are code:** both validators (Voice Bible §13, Design System §7) are written fail-closed and include drop-in assertions. Wire them into the pipeline so a page that fails its own laws cannot ship.

Questions route to Josh; the documents themselves are the answer to "how should this work" — if the docs and anyone's memory disagree, the docs win.
