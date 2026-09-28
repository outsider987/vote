import { describe, expect, it } from "vitest";
import type { LiveResults, RaceTally } from "@vote/shared";
import { COUNT_STARTS_AT, partyLabel, partyOf } from "../src/config";
import { countdownParts } from "../src/util";
import { councilAggregate, duelOf } from "../src/model/analysis";
import type { CouncilFile, MayorFile } from "../src/model/data";
import { LiveSource, buildLive, liveUnit, stateFromTally } from "../src/model/live";
import { buildReplay, simState } from "../src/model/replay";
import { emptyState, type Race } from "../src/model/types";

const race = (seats: number, nos: number[], extra: Partial<Race> = {}): Race => ({
  kind: seats > 1 ? "district" : "mayor",
  key: "x",
  name: "x",
  candidates: nos.map((no) => ({ no, name: `c${no}`, party: "無" })),
  seats,
  electors: 100_000,
  castPerValid: 1.01,
  turnout: null,
  unit: 100,
  finalVotes: null,
  state: emptyState(nos.length),
  decidedPrev: false,
  sim: null,
  version: -1,
  ...extra,
});

const tally = (reported: number, total: number, rows: [number, number, RaceTally["candidates"][number]["mark"]?, boolean?][], seats = 1): RaceTally => ({
  stations: { reported, total },
  updatedAt: "2026-11-28T18:00:00+08:00",
  seats,
  candidates: rows.map(([no, votes, mark = null, womenQuota]) => ({ no, name: `c${no}`, party: "無", votes, pct: 0, mark, ...(womenQuota ? { womenQuota } : {}) })),
});

describe("stateFromTally", () => {
  it("aligns votes by ballot number, not by row order", () => {
    const s = stateFromTally(race(1, [1, 2, 3]), tally(10, 100, [[3, 300], [1, 100], [2, 200]]));
    expect(s.votes).toEqual([100, 200, 300]);
    expect(s.counted).toBe(600);
    expect(s.p).toBeCloseTo(0.1);
    expect(s.top).toEqual([2]);
    expect(s.decided).toBe(false);
    expect(s.winners).toEqual([]);
  });

  it("has no leader before any votes are counted", () => {
    const s = stateFromTally(race(1, [1, 2]), tally(0, 100, [[1, 0], [2, 0]]));
    expect(s.top).toEqual([]);
    expect(s.decided).toBe(false);
  });

  it("takes winners from the ◎ marks, including a women's-quota seat outside the top N", () => {
    // 3 seats; no. 4 (fourth by votes) wins the reserved seat and no. 3 is displaced
    const s = stateFromTally(race(3, [1, 2, 3, 4]), tally(50, 50, [[1, 900, "elected"], [2, 800, "elected"], [3, 700, "displaced"], [4, 600, "elected", true]], 3));
    expect(s.decided).toBe(true);
    expect(s.winners).toEqual([0, 1, 3]);
    expect(s.top).toEqual([0, 1, 3]);
  });

  it("decides a complete count without marks by votes, skipping candidates below the minimum", () => {
    const s = stateFromTally(race(1, [1, 2]), tally(20, 20, [[1, 10], [2, 30, "belowMin"]]));
    expect(s.decided).toBe(true);
    expect(s.winners).toEqual([0]);
  });

  it("holds a tie awaiting the lot draw undecided", () => {
    const s = stateFromTally(race(1, [1, 2]), tally(20, 20, [[1, 50, "tie"], [2, 50, "tie"]]));
    expect(s.decided).toBe(false);
    expect(s.tie).toBe(true);
  });

  it("returns an empty state for a race missing from results.json", () => {
    expect(stateFromTally(race(1, [1, 2]), undefined)).toEqual(emptyState(2));
  });
});

describe("liveUnit", () => {
  it("only ever raises the stroke unit, projecting from the share counted", () => {
    const r = race(1, [1, 2], { unit: 100 });
    r.state = { ...emptyState(2), p: 0.2, votes: [60_000, 40_000], counted: 100_000 };
    expect(liveUnit(r)).toBe(10_000);           // 60,000 / 0.2 / 50 = 6,000 → 10,000
    r.unit = 20_000;
    expect(liveUnit(r)).toBe(20_000);
  });
});

describe("replay", () => {
  const mayorFile: MayorFile = {
    election: "2022",
    counties: [{
      code: "10013", name: "屏東縣", type: "county", electors: 690_000, votesCast: 450_000, valid: 443_153, turnout: 65.2,
      candidates: [
        { no: 1, name: "詹智鈞", party: "時代力量", votes: 19_156, elected: false },
        { no: 2, name: "蘇清泉", party: "中國國民黨", votes: 206_460, elected: false },
        { no: 3, name: "周春米", party: "民主進步黨", votes: 217_537, elected: true },
      ],
    }],
  };
  const councilFile: CouncilFile = { election: "2022", counties: [] };

  it("converges exactly on the real result", () => {
    const [c] = buildReplay(mayorFile, councilFile);
    const end = simState(c.mayor.sim!, 1, 1);
    expect(end.votes).toEqual([19_156, 206_460, 217_537]);
    expect(end.decided).toBe(true);
    expect(end.winners).toEqual([2]);
    const start = simState(c.mayor.sim!, 1, 0);
    expect(start.counted).toBe(0);
    const mid = simState(c.mayor.sim!, 1, c.mayor.sim!.start + c.mayor.sim!.dur / 2);
    expect(mid.decided).toBe(false);
    expect(mid.counted).toBeGreaterThan(0);
    expect(mid.counted).toBeLessThan(443_153);
  });
});

describe("buildLive", () => {
  const snap: LiveResults = {
    schema: 1, election: "2026-local", generatedAt: "2026-11-28T18:00:00+08:00", stage: "count", source: "test",
    mayors: { "10013": tally(10, 711, [[2, 5000], [1, 4000]]) },
    councils: {
      "10013-T3-09": tally(1, 30, [[1, 10]]),
      "10013-T1-02": tally(1, 50, [[1, 10], [2, 20]], 2),
      "10013-T1-01": tally(1, 50, [[1, 10], [2, 20]], 2),
      "10004-T1-01": tally(1, 50, [[1, 10], [2, 20]], 2),
    },
  };
  const mayors: MayorFile = { election: "2022", counties: [] };
  const councils: CouncilFile = {
    election: "2022",
    counties: [{ code: "10004", name: "新竹縣", kind: "縣市議員", seats: 36, districts: [{
      id: "10004-T1-01", type: "區域", no: "01", name: "第01選舉區", seats: 7, electors: 180_000, votesCast: 100_000, valid: 98_000,
      towns: [{ code: "10004010", name: "竹北市" }], candidates: [],
    }] }],
  };
  const counties = buildLive(snap, mayors, councils);

  it("lists all 22 counties with candidates sorted by ballot number", () => {
    expect(counties).toHaveLength(22);
    const pt = counties.find((c) => c.code === "10013")!;
    expect(pt.mayor.candidates.map((x) => x.no)).toEqual([1, 2]);
    expect(counties.find((c) => c.code === "63000")!.mayor.candidates).toEqual([]);
  });

  it("orders districts 區域 → 平原 → 山原 and sums council seats", () => {
    const pt = counties.find((c) => c.code === "10013")!;
    expect(pt.council.districts.map((d) => d.id)).toEqual(["10013-T1-01", "10013-T1-02", "10013-T3-09"]);
    expect(pt.council.districts[2].type).toBe("山地原住民");
    expect(pt.council.seats).toBe(5);
  });

  it("fills races the poller hasn't fetched yet from candidates.json", () => {
    const withList = buildLive(snap, mayors, councils, {
      schema: 1, election: "2026-local", generatedAt: "", source: "",
      mayors: { "63000": [{ no: 2, name: "乙", party: "中國國民黨" }, { no: 1, name: "甲", party: "民主進步黨" }] },
      councils: { "63000-T1-01": { county: "63000", type: "區域", no: "01", seats: 12, candidates: [{ no: 1, name: "丙", party: "無" }] } },
    });
    const tp = withList.find((c) => c.code === "63000")!;
    expect(tp.mayor.candidates.map((x) => x.name)).toEqual(["甲", "乙"]);
    expect(tp.council.districts.map((d) => [d.id, d.seats])).toEqual([["63000-T1-01", 12]]);
  });

  it("treats results from another election as a rehearsal", () => {
    const src = new LiveSource("live/results.json");
    src.snapshot = { ...snap, election: "2022-local" };
    expect(src.rehearsal).toBe(true);
    src.snapshot = snap;
    expect(src.rehearsal).toBe(false);
  });

  it("drops 2022 town lists for districts redrawn in 2026", () => {
    const hc = counties.find((c) => c.code === "10004")!;
    expect(hc.council.districts[0].towns).toEqual([]);
    expect(hc.council.districts[0].electors).toBe(180_000);
  });
});

describe("council and duel helpers", () => {
  it("counts decided seats by party and reports the last-seat margin", () => {
    const d = race(2, [1, 2, 3]);
    d.state = stateFromTally(d, tally(10, 10, [[1, 50, "elected"], [2, 40, "elected"], [3, 30]], 2));
    const agg = councilAggregate({ kind: "縣市議員", seats: 2, districts: [{ ...d, id: "a", county: "x", type: "區域", no: "01", towns: [] }], finalTurnout: null, state: undefined!, completePrev: false });
    expect(agg.complete).toBe(true);
    expect(agg.decided).toEqual({ 無: 2 });
    const du = duelOf(d)!;
    expect([du.a, du.b]).toEqual([1, 2]);
    expect(du.margin).toBeCloseTo(10 / 120);
  });

  it("reads the count site's spellings of independents", () => {
    expect(partyOf("無").key).toBe("ind");
    expect(partyOf("無黨籍及未經政黨推薦").key).toBe("ind");
    expect(partyLabel("無")).toBe("無黨籍");
    expect(partyOf("台灣動物保護黨").key).toBe("other");
    expect(partyLabel("台灣動物保護黨")).toBe("台灣動物保護黨");
  });
});

describe("countdown", () => {
  it("starts the count at 16:00 Taiwan time on 2026-11-28", () => {
    expect(new Date(COUNT_STARTS_AT).toISOString()).toBe("2026-11-28T08:00:00.000Z");
  });

  it("splits the time left into days and HH:MM:SS, rounding up to whole seconds", () => {
    expect(countdownParts(((58 * 24 + 3) * 3600 + 12 * 60 + 45) * 1000)).toEqual({ days: 58, hms: "03:12:45" });
    expect(countdownParts(1)).toEqual({ days: 0, hms: "00:00:01" });
    expect(countdownParts(0)).toEqual({ days: 0, hms: "00:00:00" });
    expect(countdownParts(-5000)).toEqual({ days: 0, hms: "00:00:00" });
  });
});
