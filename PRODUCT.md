# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Decided 2026-09-28 (the user asked for the drafts to become a formal project):
- An npm-workspaces monorepo. `apps/web` is a Vite + TypeScript + three.js static site on a CDN.
- `apps/poller` is a single Node/TypeScript poller that scrapes the CEC count site and publishes a normalized `results.json`. It also runs the candidate import and a local mock count site for rehearsals.
- `packages/shared` holds the data contract.
- The site is hosted on GitHub Pages; on election night each poller publish triggers a Pages deploy, about once a minute. Browsers read `results.json` about every 60 s with ETag revalidation. They never call the poller or the CEC. Visitor load stays on the CDN, and the poller's load on the CEC is constant.

## Users

The general public in Taiwan following the 2026 local election results on election night (2026-11-28, from 16:00 when polls close into the night), many on phones. The site is also the owner's personal portfolio piece.

## Product Purpose

A 3D live vote-counting site for Taiwan's 2026 local elections. It covers the 22 mayor/magistrate races (直轄市長、縣市長) and the councilor races (直轄市議員、縣市議員; 910 seats in 2022, 919 in 2026). Success means people can follow results quickly and accurately, and the experience is stunning. The owner's words: 「完美讓人驚豔」.

## Positioning

A self-published, visually striking 3D alternative to standard media results pages. It is not affiliated with the Central Election Commission (CEC). All numbers come from official CEC sources.

## Operating Context

- Before polling day: candidate lists (ballot numbers drawn 2026-10-23, official announcement 2026-11-17), with candidate photos and profiles expected on the CEC election portal JSON.
- On election night: the CEC count site updates about every 60s. It is HTML only, with no CORS.
- After the election: per-polling-station results files; winners announced 2026-12-04.
- A 核電 referendum runs on the same day.

## Capabilities and Constraints

- Data sources are documented in project memory and the research notes. Live data comes from the CEC count site (prefix codes TC/T1/T2/T3…), history from db.cec.gov.tw static JSON, and candidates/photos from `info.cec.gov.tw/vote2026/static/json/...`.
- Must represent both 當選 and 婦女保障名額 wins (db.cec `is_victor` `*` and `!`).
- Candidate names can contain rare characters that the CEC encodes as `@code@` (CNS11643 glyph images).
- Councilor districts changed for 2026: 竹北市 split into 2, and 彰化, 雲林, 基隆 and 新竹市 added indigenous districts. 新竹市 and 竹北 districts split towns by village.
- Until 2026 data exists, prototypes replay real 2022 results (`data/mayor-2022.json`, `data/council-2022.json`).

## Brand Commitments

None yet. The name is provisional (decided 2026-09-28: 「先用暫定名」).

## Evidence on Hand

- `data/mayor-2022.json`: 22 races, verified against known winners.
- `data/council-2022.json`: 215 districts, 910 seats, 1,677 candidates, with per-district seat counts verified.
- `data/taiwan-atlas-counties-10t.json` (taiwan-atlas, MIT).
- Not yet available, and must not be fabricated: 2026 results, 2026 candidate photos/profiles, brand assets, testimonials or usage numbers.

## Product Principles

1. Accuracy first. Every number traces to CEC data, and nothing is invented or embellished.
2. Legible at a glance. Spectacle never hides who is leading or who won.
3. Neutral voice. Treat parties evenly and use factual copy only. *(Inferred from the election-results context; not yet explicitly confirmed by the owner.)*
4. Election-night resilience. Static delivery, one poller, and graceful degradation on weak devices.

## Accessibility & Inclusion

A text/list view that mirrors the 3D state, `prefers-reduced-motion` support, and usable touch interaction at 390px phone width.
