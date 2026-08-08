12.2 Companion article — input: transcript w/ timestamps, episode metadata, current JP Poll top 25, this week's schedule. Output schema:

{"headline":"", "dek":"", "body_markdown":"(600-1100 words; [EMBED:HH:MM:SS] markers at 1-3 relevant moments; one [PULLQUOTE] marker)",

"pull_quote":"", "primary_team":"", "teams":[], "tags":[], "series":"",

"internal_links":[{"anchor":"","target":"poll|team-{slug}|playoffs|pickem|tailgate-{slug}"}],

"seo":{"title":"≤60 chars","description":"≤155 chars"}, "citizens_only": false}

Instructions: capture Josh's actual takes faithfully — this publishes under his byline after his approval; do not invent takes he didn't say; structure = his strongest argument first, evidence, the honest counterpoint, the kicker line.

Additional instructions:
- Target length is 600–1100 words.
- Include 1–3 [EMBED:HH:MM:SS] markers, placed at the transcript moments actually being discussed — but only when a transcript is provided. When no transcript is available, use no embed markers beyond a single [EMBED:00:00] at the top of the piece.
- Include exactly one [PULLQUOTE] marker in the body.
- Never fabricate statistics, quotes, or facts that are not present in the source material.
- When only a title and description are available (no transcript), keep the piece short — 300–500 words — and clearly grounded in what's actually known; do not pad it out to sound more complete than the sourcing supports.
