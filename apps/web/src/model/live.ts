import { COUNTIES } from "@vote/shared";
import type { CandidateList, CandidateProfile, DistrictType, LiveResults, RaceTally } from "@vote/shared";
import { ELECTION } from "../config";
import { decodeName, niceUnit } from "../util";
import { councilKind, estimateUnit, type Source } from "./source";
import { emptyCouncilState, emptyState } from "./types";
import type { Candidate, County, District, Race, RaceState } from "./types";
import type { CouncilFile, MayorFile } from "./data";

/* Live mode: race states come from the poller's results.json (see apps/poller). */

const TYPE: Record<string, DistrictType> = { T1: "區域", T2: "平地原住民", T3: "山地原住民" };

// 2026 redistricting: 竹北市 splits into two districts and 新竹市's districts divide towns by village,
// so the 2022 town lists don't apply there. Elsewhere only indigenous districts are added.
const REDRAWN_2026 = new Set(["10004", "10018"]);

/** Map one count-site tally onto a race whose candidates are fixed; candidates are matched by ballot number. */
export function stateFromTally(race: Race, tally: RaceTally | undefined): RaceState {
  if (!tally) return emptyState(race.candidates.length);
  const byNo = new Map(tally.candidates.map((c) => [c.no, c]));
  const votes = race.candidates.map((c) => byNo.get(c.no)?.votes ?? 0);
  const marks = race.candidates.map((c) => byNo.get(c.no)?.mark ?? null);
  const counted = votes.reduce((a, b) => a + b, 0);
  const { reported, total } = tally.stations;
  const complete = total > 0 && reported >= total;
  const elected = marks.flatMap((m, j) => (m === "elected" ? [j] : []));
  const tie = marks.includes("tie");
  const decided = elected.length >= race.seats || (complete && !tie);
  const ranked = votes.map((_, j) => j).sort((a, b) => votes[b] - votes[a] || race.candidates[a].no - race.candidates[b].no);
  // The ◎ marks are authoritative: a women's-quota seat can go to a candidate outside the top N by votes.
  const winners = !decided ? [] : elected.length ? elected : ranked.filter((j) => marks[j] !== "belowMin").slice(0, race.seats);
  return {
    p: total > 0 ? Math.min(1, reported / total) : 0,
    votes,
    counted,
    decided,
    top: decided ? winners : counted ? ranked.slice(0, race.seats) : [],
    winners,
    ...(tie ? { tie } : {}),
  };
}

/** Raise the tally unit as the projected winner total grows; never lower it mid-count. */
export function liveUnit(race: Race) {
  const s = race.state;
  if (!s.counted) return race.unit;
  const top = Math.max(...s.votes);
  const projected = s.p >= 0.1 ? top / s.p : top;
  return Math.max(race.unit, niceUnit(projected / (race.seats > 1 ? 40 : 50)));
}

// Names and parties end up in markup; the count site never uses these characters in them.
const clean = (s: string) => s.replace(/[<>&"']/g, "");

const rosterOf = (t: RaceTally | undefined): Candidate[] =>
  (t ? [...t.candidates].sort((a, b) => a.no - b.no) : []).map((x) => ({
    no: x.no,
    name: clean(decodeName(x.name)),
    party: clean(x.party),
    ...(x.womenQuota ? { womenQuota: true } : {}),
  }));

const rosterOfProfiles = (list: CandidateProfile[] | undefined): Candidate[] =>
  [...(list ?? [])].sort((a, b) => a.no - b.no).map((x) => ({ no: x.no, name: clean(decodeName(x.name)), party: clean(x.party) }));

const districtOrder = (a: string, b: string) => {
  const [, ta, na] = a.split("-"), [, tb, nb] = b.split("-");
  return ta.localeCompare(tb) || Number(na) - Number(nb);
};

/**
 * Counties, councils and candidates as the live results list them. The 2022 files only supply estimates
 * for the stack heights (electorate, ballots per valid vote) and district town lists where unchanged.
 */
export function buildLive(snap: LiveResults, mayorFile: MayorFile, councilFile: CouncilFile, list?: CandidateList | null): County[] {
  const m22 = new Map(mayorFile.counties.map((c) => [c.code, c]));
  const d22 = new Map(councilFile.counties.flatMap((cc) => cc.districts.map((d) => [d.id, d] as const)));
  const redrawn = snap.election === ELECTION ? REDRAWN_2026 : new Set<string>();

  return COUNTIES.map((info): County => {
    const old = m22.get(info.code);
    const tally = snap.mayors[info.code];
    // results.json is authoritative; the imported candidate list covers races the poller hasn't fetched yet
    const candidates = tally?.candidates.length ? rosterOf(tally) : rosterOfProfiles(list?.mayors[info.code]);
    const electors = old?.electors ?? 100_000;
    const mayor: Race = {
      kind: "mayor",
      key: info.code,
      name: info.name,
      candidates,
      seats: tally?.seats || 1,
      electors,
      castPerValid: old ? old.votesCast / old.valid : 1.015,
      turnout: null,
      unit: estimateUnit(electors, 1),
      finalVotes: null,
      state: emptyState(candidates.length),
      decidedPrev: false,
      sim: null,
      version: -1,
    };

    const ids = [...new Set([...Object.keys(snap.councils), ...Object.keys(list?.councils ?? {})])]
      .filter((id) => id.startsWith(`${info.code}-`) && /^\d{5}-T[123]-\d{2}$/.test(id)).sort(districtOrder);
    const seatsOf = (id: string) => snap.councils[id]?.seats || list?.councils[id]?.seats || 1;
    const seatsTotal = ids.reduce((a, id) => a + seatsOf(id), 0);
    const districts = ids.map((id): District => {
      const t = snap.councils[id] as RaceTally | undefined;
      const [, legis, no] = id.split("-");
      const prev = d22.get(id);
      const seats = seatsOf(id);
      // an unknown district gets the county electorate in proportion to its seats
      const dElectors = prev?.electors ?? Math.round((electors * seats) / Math.max(1, seatsTotal));
      const dc = t?.candidates.length ? rosterOf(t) : rosterOfProfiles(list?.councils[id]?.candidates);
      return {
        kind: "district",
        key: id,
        id,
        county: info.code,
        type: TYPE[legis] ?? "區域",
        no,
        name: `第${no}選舉區`,
        towns: prev && !redrawn.has(info.code) ? prev.towns : [],
        candidates: dc,
        seats,
        electors: dElectors,
        castPerValid: prev ? prev.votesCast / prev.valid : 1.015,
        turnout: null,
        unit: estimateUnit(dElectors, seats),
        finalVotes: null,
        state: emptyState(dc.length),
        decidedPrev: false,
        sim: null,
        version: -1,
      };
    });

    return {
      code: info.code,
      name: info.name,
      short: info.short,
      kind: info.kind,
      raceLabel: info.kind === "county" ? "縣長選舉" : "市長選舉",
      mayor,
      council: {
        kind: councilKind(info.kind),
        seats: districts.reduce((a, d) => a + d.seats, 0),
        districts,
        finalTurnout: null,
        state: emptyCouncilState(),
        completePrev: false,
      },
    };
  });
}

export type LiveStatus = "ok" | "error";

export class LiveSource implements Source {
  readonly kind = "live";
  readonly playing = true;
  readonly speed = 1;
  snapshot: LiveResults | null = null;
  /** Bumped whenever a new snapshot arrives. */
  version = 0;
  status: LiveStatus = "ok";
  lastOk = 0;
  private primed = false;
  private timer = 0;

  constructor(readonly url: string, readonly intervalMs = 30_000) {}

  /** Fetch results.json; resolves true when it holds a new snapshot. */
  async fetch(): Promise<boolean> {
    try {
      // "no-cache" revalidates with the CDN (ETag → 304) instead of bypassing it with a query string.
      const r = await fetch(this.url, { cache: "no-cache", signal: AbortSignal.timeout(10_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const snap = (await r.json()) as LiveResults;
      if (snap.schema !== 1 || !snap.mayors || !snap.councils) throw new Error("unexpected results.json");
      this.status = "ok";
      this.lastOk = Date.now();
      if (this.snapshot && this.snapshot.generatedAt === snap.generatedAt) return false;
      this.snapshot = snap;
      this.version++;
      return true;
    } catch (err) {
      this.status = "error";
      console.warn("live results:", err);
      return false;
    }
  }

  /** Poll on an interval with jitter, and again as soon as a hidden tab comes back. */
  start(onUpdate: () => void) {
    const loop = async () => {
      clearTimeout(this.timer);
      if (await this.fetch()) onUpdate();
      this.timer = window.setTimeout(loop, this.intervalMs * (0.9 + Math.random() * 0.2));
    };
    this.timer = window.setTimeout(loop, this.intervalMs);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - this.lastOk > this.intervalMs * 0.7) loop();
    });
  }

  /** Before the count: every race at zero, so the site can stand ready with the rosters it has. */
  useEmpty() {
    this.snapshot = { schema: 1, election: ELECTION, generatedAt: new Date().toISOString(), stage: "prior", source: "", mayors: {}, councils: {} };
    this.version++;
  }

  /** The poller's candidates.json beside results.json, if published; used only to fill rosters. */
  async fetchCandidates(): Promise<CandidateList | null> {
    try {
      const r = await fetch(new URL("candidates.json", new URL(this.url, location.href)), { cache: "no-cache", signal: AbortSignal.timeout(10_000) });
      if (!r.ok) return null;
      const list = (await r.json()) as CandidateList;
      return list.schema === 1 && list.mayors && list.councils ? list : null;
    } catch {
      return null;
    }
  }

  get started() {
    return !!this.snapshot && this.snapshot.stage !== "prior";
  }

  /** Results from another election (e.g. the 2022 mock count) are a rehearsal, never presented as live. */
  get rehearsal() {
    return !!this.snapshot && this.snapshot.election !== ELECTION;
  }

  tick() {}

  refresh(race: Race) {
    const snap = this.snapshot;
    if (!snap || race.version === this.version) return;
    race.version = this.version;
    const tally = race.kind === "mayor" ? snap.mayors[race.key]
      : race.kind === "district" ? snap.councils[race.key]
      : snap.mayorTowns?.[race.key];
    // town tallies refresh less often; keep the last known state until they arrive
    if (!tally && race.kind === "town") return;
    // a race missing at boot (its page failed on the poller's first cycle) takes its roster from the first tally
    // (in place: a county's town races share its candidate array)
    if (!race.candidates.length && tally?.candidates.length) race.candidates.push(...rosterOf(tally));
    race.state = stateFromTally(race, tally);
    race.unit = liveUnit(race);
    if (tally?.womenSeats && race.kind === "district") (race as District).womenSeats = tally.womenSeats;
    const t = tally?.turnout;
    if (t && t.electors > 0) {
      race.ballots = t;
      // Mid-count the turnout page may cover only the stations reported so far, so the real electorate
      // replaces the 2022 estimate only once the count is complete.
      if (race.state.decided) {
        race.electors = t.electors;
        if (t.valid > 0) race.castPerValid = t.cast / t.valid;
        race.turnout = (t.cast / t.electors) * 100;
      }
    }
  }

  /** The first snapshot only sets the scene; later changes are announced. */
  isForward() {
    return this.primed;
  }

  commit() {
    if (this.snapshot) this.primed = true;
  }
}
