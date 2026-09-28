---
version: 1
slug: "drafts-h-claude-index-html"
primary_target: "drafts/h-claude/index.html"
related_targets: ["apps/web/index.html"]
---

# Surface: H 開票所 (chosen direction, 2026-09-28)

Mode: Operate (the viewer follows live results), with an Experience-grade first viewport.
Audience/job: members of the Taiwanese public following election night on phones and laptops. The job is to see who is leading, what has been decided, and how far counting has gone.
Constraints: replays 2022 data exactly; neutral, factual copy; accessible text view; 390px mobile.

## Direction contract
THESIS: The results page IS the polling-station counting room every Taiwanese voter knows: ballots piling up, 正 tallies on the whiteboard, the red 卜 stamp. It refuses the dark-newsroom + neon-map + big-number-cards default.
OWN-WORLD: Cool fluorescent white board, pale gray-green desk. Ballots are white paper stacks with visible sheet lines. Party colors are marker inks. Stamp red is reserved for decisions. Masking-tape county labels. Iansui handwriting for names and tallies, Noto Sans TC for UI, Barlow Condensed for numerals.
STORY: The viewer takes in the whole island's counting at a glance, reads the leader from the top-sheet color, follows one county's 正 strokes accumulate, and sees races stamped decided.
FIRST VIEWPORT: The left ~62% is a tilted 3D Taiwan of ballot stacks on the desk, with tape labels. The right ~38% is the 計票板 for the focused county. The top strip holds the title, 22 seat stamps and party totals. The bottom holds a 16:00–23:30 clock scrubber with play/pause/speed.
FORM: 開票所 counting room, rank 1 of own list. Seed: none; the direction was pinned by the user's brief (「跑一個你的版本」), so concept-seed was skipped.
SCOPE ADDED BY THE USER: a 縣市長／議員 mode switch. In councilor mode, stack tops show the party with the most seats and are stamped when all of a county's seats are final. The top strip becomes a 910-seat stacked bar. The board shows county seat groups by district, district tabs and a district 正 board, with 當選 and 婦女保障 badges. A full-width center 「當選確定」 paper band (卜 stamp, handwritten name, county・party) appears when a race is decided; in councilor mode, 「議員席次確定」 appears when a county completes. Board rows are ranked by live votes and animate with FLIP.
PRODUCTION (2026-09-28): ported to apps/web (Vite + TypeScript) with a replay/live data-source layer. In live mode the footer transport gives way to the CEC data time, an ink 即時 badge and a polling-station progress bar. DESIGN.md at the repo root records the system.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
