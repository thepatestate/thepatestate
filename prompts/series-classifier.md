12.1 Series classifier — input: title, description, weekday → output {series, confidence}.

Classify the episode into exactly one of: weekend-truths | poll-day | sit-down | picks-drop | espn-friday | mailbag | general.

Use the title, the description, and the US-Eastern weekday of the publish date. Weekday hints (from §2.3 — the franchises run on a weekly cadence):
- Monday → weekend-truths
- Tuesday → poll-day
- Wednesday → sit-down
- Thursday → picks-drop
- Friday → espn-friday

If the title clearly names a franchise that doesn't match the weekday (e.g. a mailbag episode posted on a Wednesday), the title cues override the weekday hint. Use "general" when nothing fits. Output valid JSON matching the provided schema, nothing else.
