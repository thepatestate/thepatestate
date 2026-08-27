# THE PATE STATE WRITING SYSTEM — START HERE
### v1.0 · August 2026 · The complete instruction kit for Claude Code and the article agents

This kit replaces every prior instruction file. If any older document (any prior voice manual, editorial core, wire prompt, production guide, or one-off correction note) conflicts with anything in this kit, **this kit wins and the old file is dead.** Do not load retired files alongside these.

## The one idea behind this kit

The old system failed because every rule lived in three places and every task loaded everything. This kit has one rule: **every rule lives in exactly one file, and every task loads only what it needs.** The Constitution is short and always loaded. The Voice Bible owns everything about how writing sounds. The Playbook owns what gets written. The specs own how each product is built. Nothing is duplicated; when a spec needs a voice rule, it points to the Voice Bible instead of restating it.

## The files

| # | File | Owns | Size discipline |
|---|---|---|---|
| 01 | `01-constitution.md` | The non-negotiables and the precedence order | Short. Always loaded. |
| 02 | `02-voice-bible.md` | Everything about how writing sounds and reads | The single voice authority |
| 03 | `03-article-playbook.md` | What gets written: IDs, tiers, triggers, templates | Commissioning reference |
| 04 | `04-spec-wire.md` | The Wire + autonomous news reaction (the no-approval lane) | Product spec |
| 05 | `05-spec-annual.md` | Preseason Annuals at every scale (Full / Standard / Capsule) | Product spec |
| 06 | `06-spec-features.md` | Josh-voice features, game breakdowns, rankings, predictions (the approval lane) | Product spec |
| 07 | `07-current-state.md` | The dated snapshot of what's true right now + the refresh protocol | Living, stamped, expiring |
| 08 | `08-design-system.md` | How every page looks: chrome, tokens, modules, the ship validator | Aesthetics authority |

## Load order per task

Every task loads in this order. Never load a spec for a product you aren't building.

1. **`01-constitution.md`** — always.
2. **`02-voice-bible.md`** — for any task that produces prose.
3. **The one relevant spec** — `04` for Wire/news-reaction, `05` for annuals/capsules, `06` for Josh-voice features and franchises — plus `08-design-system.md` for any task that produces a page. (`03-article-playbook.md` is loaded when *choosing* what to write; once the assignment has an ID, the spec is what you write from.)
4. **`07-current-state.md`** — check the stamp first. If stale or the task touches anything it covers, refresh per its protocol before writing.
5. **The consistency ledger** — machine-maintained; checked for any piece containing a prediction.
6. **Task-specific source material** — transcripts, reporting, the Josh file for the subject.

## Task routing

- "Breaking news just hit" → 01 + 02 + 04 (+ 07 if it touches rankings/predictions)
- "Write the What It Means follow-up" → 01 + 02 + 04 §7
- "Build the [team] annual" → 01 + 02 + 05 + 07 + fresh research file
- "Write the Game Breakdown / a ranking / Josh's picks" → 01 + 02 + 06 + 07 + ledger
- "What should we publish about X?" → 01 + 03 (the selection question), then route to the spec

## The reference builds (in `/reference-builds/` — the taste files AND the templates)

These are both the quality bar and the literal source of the page chrome (`08-design-system.md` §1). When a spec and a reference build seem to disagree on a judgment call, match the build — it's what Josh approved.

- **`annual-ohio-state-v6-print.html`** — the annual/definitive standard and the magazine chrome. Voice: excellent, per Josh.
- **`feature-three-boards-josh.html`** — the gold standard for Josh's Read / Notebook columns, frozen at Josh's 9.7 sign-off. Also the ceiling: no future piece gets more shorthand, more performative, or more "Josh-like" than this.
- **`wire-ohio-state-rowe-safety.html`** — the Wire injury-story standard, built under the complete rulebook (v3.5): Receipt-against-the-morning-column, numbers over adjectives, plain module titles.
- **`wire-texas-vandiver-center.html`** — second injury build, same rulebook.
- **`wire-article-page-v2.html`** (the Whitmore/Georgia commitment) — the Wire commitment-story standard and the canonical article-page chrome.

(The old Kansas State build's visual modules are folded into the shipped wire chrome; its prose drift is documented in Voice Bible §12 — don't source prose from it.)

## Maintenance rules

- Changes to any file require a version bump and a one-line changelog entry at the bottom of that file.
- A correction from Josh becomes a codified rule in the ONE file that owns that territory — never a patch note floating elsewhere.
- Once a season, prune: any rule that hasn't mattered in 90 days gets challenged.
- Never create a new instruction file without adding it to this README's table and routing.
