# THE PATE STATE WRITING SYSTEM — START HERE
### Kit v4.2 · August 27, 2026 · The complete instruction system for Claude Code and the article agents

This kit is the entire system. It replaces every prior instruction file that has ever existed for this project — every voice manual, editorial core, wire prompt, production guide, playbook, patch, and one-off correction note. If any older document conflicts with anything here, **this kit wins and the old file is dead.** Do not load anything alongside these files. There is no version before this one that matters.

## The one idea behind this kit

The old system failed because every rule lived in three places and every task loaded everything. This kit has one rule: **every rule lives in exactly one file, and every task loads only what it needs.** The Constitution is short and always loaded. The Voice Bible owns everything about how writing sounds. The Playbook owns what gets written. The specs own how each product is built. Nothing is duplicated; when a spec needs a voice rule, it points to the Voice Bible instead of restating it. When you find yourself wanting to write a rule in a second place, that impulse is the bug — stop and point instead.

## The files

| # | File | Owns | Discipline |
|---|---|---|---|
| 01 | `01-constitution.md` | The non-negotiables and the precedence order | Short. Always loaded. |
| 02 | `02-voice-bible.md` | Everything about how writing sounds and reads | The single voice authority |
| 03 | `03-article-playbook.md` | What gets written: buckets, IDs, tiers, triggers | Commissioning reference |
| 04 | `04-spec-wire.md` | The Wire + autonomous news reaction (the no-approval lane) | Product spec |
| 05 | `05-spec-annual.md` | Preseason Annuals at every scale (Full / Standard / Capsule) | Product spec |
| 06 | `06-spec-features.md` | Josh-voice features, breakdowns, rankings, predictions (the approval lane) | Product spec |
| 07 | `07-current-state.md` | The dated snapshot of what's true right now + refresh protocol | Living, stamped, expiring |
| 08 | `08-design-system.md` | Tokens, chrome, modules, visual laws, the ship validator | Build authority |

## Load order per task

Every task loads in this order. Never load a spec for a product you aren't building.

1. `01-constitution.md` — always.
2. `02-voice-bible.md` — for any task that produces prose.
3. `03-article-playbook.md` — when deciding *what* to write or checking an ID.
4. The one product spec that matches the task (04, 05, or 06) — never two.
5. `07-current-state.md` — for any task that states a fact about the season, a ranking, or a Josh position. Check its stamp first.
6. `08-design-system.md` — for any task that produces or edits a page.

## Task routing

- Breaking news, news reaction, injury follow-ups, service pages → **04** (autonomous lane)
- Preseason annuals, team capsules → **05**
- Josh's Read, Notebook columns, game breakdowns, rankings pieces, predictions, mailbags → **06** (approval lane)
- Building or editing any HTML page → **08**, and copy chrome from `reference-builds/` verbatim

## The reference builds (the taste, embedded)

Claude Code doesn't interpret the standard — it opens it. The `reference-builds/` folder holds the approved pages. Chrome (head, CSS, mast, rail, footer) is copied byte-for-byte from these; only the article block is ever new.

- **`feature-three-boards-v3_1.html`** — **the gold standard** for Josh's Read / Notebook columns, and the ceiling: no future piece gets more conversational, more shorthand, or more "Josh-like" than this one. Signed off Aug 26, 2026 as the best voice yet. Voice Bible §0B and §12 document the laws it demonstrates.
- The folder's `README.md` lists the other approved builds (Ohio State annual print chrome, the Wire visual and voice standards, the commitment-story page) that ship alongside this kit. If any is missing from your copy, request it before building in that lane — never approximate chrome from memory.

## Two lanes, one gate

Breaking news publishes autonomously inside the Wire spec's absolute boundaries. Anything carrying Josh's byline or opinion drafts in first person and stops at the human approval gate — approval is a **publish gate**, never a drafting-style instruction. Both lanes are defined in the Constitution; the specs implement them.

---
*Kit v4.2 (Aug 27, 2026) — the complete from-scratch release: the full system, the Best Voice Yet standard, and Josh's Aug 27 corrections codified (Voice Bible v4.2; gold standard `feature-three-boards-v3_1.html`; second approved column included). Everything earlier is superseded in full.*
