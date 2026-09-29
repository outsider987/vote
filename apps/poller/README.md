# CEC poller

Node 24, npm workspaces, TypeScript via `tsx`. Commands below run from the repository root after `npm install`.

## Rehearse with the 2022 finals

In one terminal:

```sh
npm run mock-cec -w @vote/poller -- --port 8787 --duration-ms 600000
```

In another:

```sh
npm run poll -w @vote/poller -- --config poller.mock.json --cycles 2
```

The mock starts counting when it starts. Use `--duration-ms 1` to replay the final result immediately. Its default markup follows the raw 2022 class-based pages; add `--layout 2025` to use id-based containers around the same content. It serves 22 mayor county pages, 368 mayor town pages, 215 council district pages, and all 22 SC plus 22 ST county turnout pages. It honors ETag and Last-Modified. `poll` writes `apps/poller/out/results.json` atomically and prints requests, 304s, errors, and elapsed time for each cycle. `--once` runs a single cycle.

## Prepare the 2026 run

Copy `apps/poller/poller.config.example.json` to `apps/poller/poller.config.json`. Set an identifying `contact`, the announced 2026 count `countBaseUrl`, and the actual page `prefixes`. The example host is a placeholder. Optionally set `treeUrl` to the live menu JSON URL. URLs, output and cache paths, 60-second polling interval, town refresh frequency, concurrency, timeout, retry count, per-URL minimum interval, and circuit break time are configurable. The minimum interval defaults to half the polling interval (30 seconds); calls inside it use the cached body immediately. Paths are relative to the config file.

After the candidate lists appear, run:

```sh
npm run import-candidates -w @vote/poller -- --config poller.config.json
npm run import-candidates -w @vote/poller -- --config poller.config.json --photos
```

`--year 2022` and `--base-url https://.../` override the candidate import settings. A 404 from an unpublished candidate list prints a message and exits without replacing `candidates.json`. The optional portraits go under `out/photos/` and are referenced relative to `candidates.json`. Council districts come from this election's imported file unless `districts` is explicitly set to an array; `"2022"` is valid only with year 2022. Mayor town codes default to the 368 codes in `data/mayor-2022-towns.json`; set `towns` to an array if the 2026 portal reports changes.

About a week before 28 November, verify from a Taiwan-located machine:

1. Confirm the 2026 host, tree path and TC/T1/T2/T3/SC/ST prefixes in config.
2. Import candidates and check that the mayor lists cover 22 counties and that council district types and counts match the portal.
3. Run `npm run probe -w @vote/poller -- --config poller.config.json`. It checks the tree when configured, parses a candidate page for each vote prefix, and parses SC/ST turnout rows. Resolve every failure before polling.
4. Run `npm run poll -w @vote/poller -- --config poller.config.json --once`, inspect `out/results.json`, then start the continuous command below.

On election night:

```sh
npm run poll -w @vote/poller -- --config poller.config.json
```

For local frontend development, leave `outDir` at `./out`: the web dev server (`npm run dev`) serves this folder at `/live/`, so open `http://127.0.0.1:5188/?source=live&poll=5`. Never write live data into `apps/web/public/`, because a stale `results.json` would then ship inside the production build. On election night, run `node scripts/publish-live.mjs` from the repository root next to the poller. It deploys `out/results.json` (and `candidates.json`) to the `vote-live` Cloudflare Worker within seconds of each write; see the root README. Run the poller on a Taiwan-located machine because the CEC may geo-limit. Keep the default concurrency of four and the 60-second poll cycle unless the CEC publishes different guidance. Conditional requests, cached reads within the minimum interval, short retry delays and a host circuit breaker reduce load. Set `NODE_EXTRA_CA_CERTS=/path/to/cec-chain.pem` if a CEC host serves an incomplete certificate chain; obtain and verify the missing CA certificate first. Do not disable TLS verification.

Every cycle fetches the 22 TC county pages, 215 council district pages, and 44 SC/ST turnout pages. Mayor town vote pages refresh on the first cycle and every fifth cycle by default. SC town rows are matched by name within their county using the 2022 town list; unmatched rows are logged and skipped.

## Fixture status

Raw Wayback copies of seven 2022 count pages, the tree, and Taipei `cand/C1/63000.json` are in `test/fixtures/2022/`; the live 2025 referendum fragment is in `test/fixtures/current/`. Tests cover every count fixture, all 22 mayor and 215 council final tallies and turnout rows, all 368 town turnout rows, and both markup layouts. Recheck real 2026 fragments with `probe` before election night. The count parser sets `womenQuota` only for a candidate marked ●.
