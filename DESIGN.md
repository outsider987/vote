---
name: 開票所
description: Election night as the polling-station counting room — ballot stacks on a desk, 正 tallies on a whiteboard, and a red 卜 stamp for every decided race.
colors:
  counting-board: "#F4F6F5"
  board-rule: "#DDE3E0"
  desk-sage: "#D9E0DC"
  desk-deep: "#C9D2CD"
  frame-gray: "#B9C2BE"
  ink: "#1B2226"
  ink-soft: "#4A545A"
  ink-faint: "#626C72"
  paper-white: "#FFFFFF"
  pending-outline: "#9AA4A9"
  dashed-rule: "#C3CCC7"
  track-gray: "#D3DAD6"
  well-gray: "#E3E8E5"
  scrollbar-gray: "#AAB4AF"
  ballot-paper: "#F4F5F3"
  receded-paper: "#CBD3CF"
  masking-tape: "#EFE6C4"
  tape-edge: "#D9CC9B"
  stamp-red: "#C4161C"
  kmt-blue: "#2A52BE"
  dpp-green: "#3B8A2A"
  tpp-teal: "#1592B8"
  npp-ochre: "#B38700"
  independent-gray: "#7A8288"
  other-party-violet: "#8067B7"
  highlighter-20: "#DDA24A"
  highlighter-10: "#CC873B"
  highlighter-5: "#B56C2E"
  highlighter-2: "#975221"
typography:
  display:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "0.04em"
  hand-headline:
    fontFamily: "Iansui, Noto Sans TC, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.15
  hand-callout:
    fontFamily: "Iansui, Noto Sans TC, sans-serif"
    fontSize: "50px"
    fontWeight: 400
    lineHeight: 1.12
  hand-name:
    fontFamily: "Iansui, Noto Sans TC, sans-serif"
    fontSize: "23px"
    fontWeight: 400
    lineHeight: 1.2
  numeral-stat:
    fontFamily: "Barlow Condensed, Noto Sans TC, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  numeral-votes:
    fontFamily: "Barlow Condensed, Noto Sans TC, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.05
    fontFeature: "tnum"
  body:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.4
  caption:
    fontFamily: "Noto Sans TC, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  badge: "3px"
  focus: "4px"
  paper: "6px"
  pill: "999px"
  round: "50%"
spacing:
  row: "12px"
  panel: "18px"
  gutter: "28px"
  gutter-mobile: "16px"
components:
  button-pill:
    backgroundColor: "{colors.counting-board}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  button-pill-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.counting-board}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "7px 16px"
  button-play:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.counting-board}"
    rounded: "{rounded.round}"
    size: "46px"
  tape-label:
    backgroundColor: "{colors.masking-tape}"
    textColor: "{colors.ink}"
    typography: "{typography.hand-name}"
    padding: "4px 8px 5px"
  seat-stamp:
    backgroundColor: "{colors.counting-board}"
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.round}"
    size: "40px"
  counting-board:
    backgroundColor: "{colors.counting-board}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "18px 20px 10px"
  won-badge:
    textColor: "{colors.stamp-red}"
    typography: "{typography.caption}"
    rounded: "{rounded.badge}"
    padding: "0 5px"
  close-race-card:
    backgroundColor: "{colors.counting-board}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "10px 12px 9px"
  party-chip:
    rounded: "{rounded.badge}"
    size: "10px"
---

# Design System: 開票所

## Overview

**Creative North Star: "The Counting Room"**

The results page is the polling-station counting room every Taiwanese voter has seen, under cool fluorescent light. Ballots pile up as white paper stacks on a pale sage desk. Each county's stack rises with the ballots counted and takes the leading party's marker ink on its top sheet. A whiteboard (the 計票板) fills with hand-drawn 正 strokes. When a race is decided, a red 卜 stamp comes down. The world is physical and familiar: paper, tape, marker, stamp. The spectacle comes from watching the count happen, not from glow or darkness.

Density is operational. On desktop, the first viewport holds the whole island, the focused race's board, the national seat stamps and the clock, because on election night people want everything at once. On mobile, the fixed header keeps the mode switch and decided-seat count visible while the party tally and seat stamps open on demand. A one-line close-race summary leads into the county vote board; the 3D island opens from that board and the source note expands on demand. Motion is driven by the count: stacks rise, strokes draw, rows re-rank, stamps press. Nothing moves just to decorate. The world explicitly rejects the dark-newsroom, neon-map, big-number-card default of results pages.

**Key Characteristics:**
- A light, cool, paper-and-desk palette. Color comes only from party marker inks, the closeness highlighter and the stamp.
- Three typographic voices: handwriting for what people write in the room, a sans for the interface, condensed numerals for counts.
- Soft ink-tinted shadows on the physical objects (board, cards, tape), and real-time three.js shadows under the stacks.
- A decision is always marked the same way: solid ink, a red 卜 stamp and a 當選 badge.

## Colors

A cool fluorescent-white room: sage desk, near-white board, graphite ink, with party inks and one red kept for decisions.

### Primary
- **Stamp Red** (`stamp-red`): the 卜 stamp, the 當選 badge, the 婦女保障 badge fill, and "當選確定" status text. It marks decided results and nothing else.

### Secondary
- **Party marker inks** (`kmt-blue`, `dpp-green`, `tpp-teal`, `npp-ochre`, `independent-gray`, `other-party-violet`): identity colors for parties. They appear on stack tops, 正 strokes, seat stamps, chips, the seat bar, gauge fills and the callout underline. KMT, DPP and TPP were validated as a categorical set (all pairs ΔE ≥ 16 and ≥ 3:1 on the board). The others always appear next to their party name. Every party not listed shares `other-party-violet` with its name spelled out.

### Tertiary
- **Highlighter ramp** (`highlighter-20` → `highlighter-2`): the closeness scale in 最接近 mode only. One hue, darker means closer: under 20%, 10%, 5% and 2% margin. It was validated as a monotone ordinal ramp whose light end holds ≥ 2:1 on the board.

### Neutral
- **Counting Board** (`counting-board`): the whiteboard, cards, buttons, footer and top bar surface.
- **Board Rule** (`board-rule`): the 34px ruled lines on the whiteboard and table dividers.
- **Desk Sage** / **Desk Deep** (`desk-sage`, `desk-deep`): the page background the 3D desk sits on, and its deeper tone.
- **Frame Gray** (`frame-gray`): hairline borders on pills, panels and the clock bar.
- **Ink** / **Ink Soft** / **Ink Faint** (`ink`, `ink-soft`, `ink-faint`): primary text, secondary text and captions. Also the play button and active pill fill.
- **Ballot Paper** (`ballot-paper`): an uncounted stack top, and the tone a leading party's ink is mixed toward before a decision.
- **Receded Paper** (`receded-paper`): counties behind an open county fade to this.
- **Paper White** (`paper-white`): hover fills, the gauge knot, the rings inside a party seal, and text on ink.
- **Pending Outline** (`pending-outline`): the dashed outline of anything not yet decided (seat stamps, seat dots, the pending chip) and the clock's hour ticks.
- **Dashed Rule** (`dashed-rule`): dashed dividers between board rows and leaderboard rows; the 拉鋸戰 card border.
- **Track Gray** / **Well Gray** (`track-gray`, `well-gray`): progress and scrub tracks; the recessed mode-switch well and the pending part of the seat bar.
- **Scrollbar Gray** (`scrollbar-gray`): thin scrollbar thumbs on the board and tab strips.
- **Masking Tape** / **Tape Edge** (`masking-tape`, `tape-edge`): the county and town labels in the scene.

### Named Rules
**The Stamp Rule.** Red means decided. Stamp red is never decoration, a party color, a warning, or a "live" signal. The live label is ink.

**The Pale-Until-Decided Rule.** A leader's color is its party ink mixed 62% toward ballot paper. Only a decided race gets full-strength ink, and it arrives with a stamp press.

**The Ink-Follows-the-Party Rule.** A party keeps its ink everywhere, regardless of rank. Text stays in ink tones. Party color appears as a mark beside the name (chip, stroke, underline), never as the text color.

## Typography

**Display Font:** Noto Sans TC (with system-ui)
**Handwriting Font:** Iansui (with Noto Sans TC)
**Numeral Font:** Barlow Condensed (with Noto Sans TC)

**Character:** The room's handwriting (Iansui) writes names, county names and tape labels the way a poll worker would. Noto Sans TC runs the interface. Barlow Condensed makes every count tabular, narrow and quick to compare.

### Hierarchy
- **Display** (900, 34px, 1.1, +0.04em): the 開票所 wordmark only.
- **Hand Headline** (Iansui 400, 34px, 1.15): the board's county or race title.
- **Hand Callout** (Iansui 400, 50px, 1.12): the winner's name in the 當選確定 band.
- **Hand Name** (Iansui 400, 23px, 1.2): candidate names on the board. Tape labels use the same voice at 15px.
- **Numeral Stat** (Barlow Condensed 700, 34px, 1): the national seat count, board stats and the clock.
- **Numeral Votes** (Barlow Condensed 600, 26px, 1.05): vote counts in board rows. Percentages sit under them at 15px in ink-soft.
- **Body** (400, 15px, 1.55): default text.
- **Label** (700, 13px): buttons, tabs, pills, tooltips.
- **Caption** (400–700, 12–12.5px): party names, legends, notes. Nothing smaller than 10px ships; 10–11.5px is reserved for the dense seat stamps and hour ticks.

### Named Rules
**The Three Voices Rule.** Handwriting is for things written in the room. Counts are always Barlow Condensed with tabular figures. Interface copy is always Noto Sans TC. Numbers are never handwritten; the 正 strokes are the handwritten form of a count.

## Layout

Desktop is a fixed, full-viewport room with no page scroll:
- a top bar (104px) holding the wordmark, the mode switch and the national tally
- the room: the 3D scene takes the flexible column, and the 計票板 takes `clamp(400px, 33vw, 500px)` on the right
- a 76px clock bar

The 拉鋸戰 column floats over the scene's right edge. The camera target shifts right to leave it room, so the island never sits under it. The scene legend sits bottom-left and the 文字版結果 toggle top-right.

At ≤ 1180px the top bar tightens. At ≤ 900px the room becomes a scrolling single column:
- a fixed, two-row top bar keeps the wordmark, mode switch and decided-seat count visible
- 查看席次 opens the party totals and a horizontally scrollable row of 44px county seat buttons below the bar; it starts closed and closes after a county is selected
- the county board comes first, with a native county picker; the 3D scene opens over the content on demand
- a compact close-race card stays above the board; a separate, temporary transparent broadcast alert names both candidates, points to the county on the 3D map, then disappears
- the replay clock uses two rows at the bottom; the live status bar stays compact
- before the 2026 count, a countdown and replay link replace the empty board on phones
- side gutters are 16px
- the text view is full width
- labels shrink to 13px

Nothing may overflow horizontally at 390px.

The spacing rhythm is 12px between board rows, 18px panel padding, 28px outer gutters on desktop and 16px on mobile. The whiteboard's 34px ruled lines set the board's vertical texture.

## Elevation & Depth

This is a physical room, so depth is literal:
- The 3D stacks cast real-time shadows from a key light onto the desk. The desk is a shadow-only plane at 11% opacity.
- Stack sides are paper: sheet seams every 0.09 units, a darker foot, and a party-ink band under the top sheet.
- In the DOM, objects that would sit on the desk (the board, cards, tape, pills) carry soft shadows tinted with ink (`rgba(27, 34, 38, …)`), never pure black.
- Flat surfaces (top bar, clock bar) don't lift.

### Shadow Vocabulary
- **Tape** (`box-shadow: 0 1px 2px rgba(27, 34, 38, .18)`): masking-tape labels lying on the map.
- **Pill** (`box-shadow: 0 2px 6px rgba(27, 34, 38, .12)`): floating scene controls (文字版結果, 返回全台).
- **Card** (`box-shadow: 0 8px 20px rgba(27, 34, 38, .14), 0 1px 3px rgba(27, 34, 38, .1)`): 拉鋸戰 cards.
- **Board** (`box-shadow: inset 0 0 0 1px #aeb8b3, 0 10px 24px rgba(27, 34, 38, .16), 0 2px 4px rgba(27, 34, 38, .1)`): the whiteboard inside its 7px aluminium-gray frame.
- **Band** (`box-shadow: 0 10px 22px rgba(27, 34, 38, .18), 0 2px 5px rgba(27, 34, 38, .1)`): the 當選確定 paper band.
- **Tooltip** (`box-shadow: 0 6px 16px rgba(27, 34, 38, .28)`): the dark scene tip.
- **Drawer** (`box-shadow: -12px 0 30px rgba(27, 34, 38, .18)`): the text view sliding over the room.

### Named Rules
**The Objects-Cast Rule.** Only things that would physically sit on the desk cast a shadow, and only with ink-tinted softness. Chrome and the page background stay flat.

## Shapes

Controls are pills (999px). Paper objects (the board, cards, tooltips, district seat groups) have gently rounded 6px corners. Badges and party chips use tight 3px corners. Seat stamps, ballot numbers, the play button and the gauge knot are circles.

Dashed lines mean "not yet": an unfilled seat stamp, the pending chip, the edges of torn tape, and row dividers on the board. They become solid when filled. Tape labels sit at a slight random tilt (±2.5°, ±2° for towns) and nudge up or down to avoid colliding.

## Components

### Buttons
- **Shape:** pill (999px). The play button is a 46px circle (40px on mobile).
- **Mode switch:** a pill track (`#e3e8e5`, 3px inset) holding label-weight buttons in ink-soft. The active mode fills with ink and white text.
- **Scene pills (文字版結果, 返回全台):** counting-board fill, 1px frame-gray border, pill shadow.
- **Hover / Focus:** background eases to white over 0.2s. The play button scales to 1.06 (0.96 pressed). Focus is a 2px ink outline 3px out, with 4px rounding. It is never a party ink.

### Chips
- **Party chip:** a 10px square, 3px corners, filled with the party ink. It always precedes a party name.
- **Pending chip:** transparent with a 1.5px dashed `#9aa4a9` border, for seats still counting.

### Cards / Containers
- **計票板 (board):** ruled whiteboard in a 7px `#c7cfcb` frame, 6px corners, board shadow, `18px 20px 10px` padding.
- **拉鋸戰 card:** counting-board fill, 1px `#c3ccc7` border, 6px corners, card shadow. It slides in on arrival and pulses on a lead change (「領先易主」/「排名互換」).

### Navigation
- **District tabs and 最接近 tabs:** pills with a 1px frame border and 13px label text. A selected tab fills with ink. A district tab gets a done state once it's decided.
- **Seat stamps (top bar):** 22 circles with a dashed outline and short county names. A decided seat fills with a 14% tint of the winner's ink and a solid 2px ink ring, and presses in. On mobile they appear in the expandable seat panel.

### Signature Components
- **Paper stacks (3D):** the county extrusions. Height is the ballots counted ÷ electors, so a finished stack stands at turnout. The top sheet is ballot paper, then a pale party ink while leading, then solid ink when decided. Kinmen and Matsu sit in dashed inset frames, which the scene legend explains (示意位置, enlarged 1.8×). Clicking a county drills down to its towns with the same grammar.
- **正 tally rows:** ballot number in a circle, the handwritten name, the party chip, and condensed votes and percentage. Below them is a strip of hand-jittered 正 strokes, one stroke per unit, and each new stroke draws itself in 0.32s. Rows re-rank by live votes with a 520ms FLIP.
- **當選確定 band:** a full-width paper band wipes in from the left (clip-path) carrying a 卜 stamp, the winner's handwritten name with a party-ink underline, and county・party. For a winner, the party emblem (KMT, DPP-flag and TPP marks, all public domain) or a text seal for other parties swells in behind a large 當選.
- **Tug-of-war gauge:** a track with a center zero line. A knot moves toward whoever leads, the fill runs from center to knot in the leader's ink, and it transitions over 0.45s.
- **Masking-tape labels:** handwritten county or town names on tape, with a mini 卜 stamp once the race is decided.
- **Live footer:** in live mode the transport gives way to the count site's timestamp, an ink 即時 label (dashed when the feed stalls), and a progress bar of polling stations reported. Before the count it reads 預備 with a dashed border, mirrors the countdown, and links to the 2022 replay.
- **Countdown notice (2026 開票前):** a paper notice taped to the desk, with a strip of masking tape at its top edge and a slight tilt. It takes the 拉鋸戰 column's place, since nothing is close before the count and the camera already keeps that area clear.
  - Content: a label (距離開票), stacked Barlow Condensed numerals (days, then HH:MM:SS) and the start time.
  - At 16:00 it turns into 開票開始 / 16:00 and waits for the first results.
  - Phones show the countdown in the fixed footer instead.

## Do's and Don'ts

### Do:
- **Do** keep the room light: cool counting-board surfaces on a sage desk, with ink for text.
- **Do** reserve stamp red (`#C4161C`) for decided results.
- **Do** pair every party ink with the party name, and keep each party's ink fixed across modes and ranks.
- **Do** set every count in Barlow Condensed with tabular figures, and every name in Iansui.
- **Do** tie motion to the count, with `cubic-bezier(.16, 1, .3, 1)` ease-out: stacks rise, strokes draw, rows FLIP, stamps press. Collapse all of it to instant under `prefers-reduced-motion`.
- **Do** mirror everything in the 文字版結果 table.

### Don't:
- **Don't** use a dark newsroom background, neon or glowing maps, or big-number KPI cards.
- **Don't** use red for alerts, live indicators or decoration.
- **Don't** color text with party inks, or encode identity with color alone.
- **Don't** show a leader in full-strength ink before the race is decided.
- **Don't** use the highlighter ramp outside 最接近 mode.
