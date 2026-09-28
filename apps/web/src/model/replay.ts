import { COUNTIES } from "@vote/shared";
import { DURATION } from "../config";
import { clamp01, decodeName, mulberry32, niceUnit, type Rng } from "../util";
import { councilKind, estimateUnit, type Source } from "./source";
import { emptyCouncilState, emptyState } from "./types";
import type { County, District, Race, RaceState, Sim, TownRecord } from "./types";
import type { CouncilFile, MayorFile } from "./data";

/* 2022 replay: every count follows a schedule and converges exactly on the real result. */

function makeSim(votes: number[], valid: number, seats: number, o: { start: number; dur: number; winners: number[]; rng: Rng }): Sim {
  const sorted = [...votes].sort((a, b) => b - a);
  const cut = sorted[seats - 1] ?? 0;
  const next = sorted[seats] ?? 0;
  return {
    start: o.start,
    dur: o.dur,
    // tight races wobble more, so the lead can change hands before the count settles
    amp: (cut - next) / valid < 0.05 / seats ? 0.11 : 0.07,
    waves: votes.map(() => [7 + o.rng() * 12, o.rng() * 6.283, 15 + o.rng() * 14, o.rng() * 6.283]),
    finalVotes: votes,
    valid,
    winners: o.winners,
    zero: emptyState(votes.length),
  };
}

export function simState(sim: Sim, seats: number, T: number): RaceState {
  const x = clamp01((T - sim.start) / sim.dur);
  const p = x >= 1 ? 1 : 1 - Math.pow(1 - x, 2.3);
  if (p >= 1) return { p: 1, votes: sim.finalVotes, counted: sim.valid, decided: true, top: sim.winners, winners: sim.winners };
  if (p <= 0) return sim.zero;
  const amp = sim.amp * Math.pow(1 - p, 1.3);
  let sum = 0;
  const shares = sim.finalVotes.map((v, j) => {
    const f = v / sim.valid;
    const [w1, p1, w2, p2] = sim.waves[j];
    const s = Math.max(0.0003, f + amp * (Math.sin(w1 * T + p1) * 0.6 + Math.sin(w2 * T + p2) * 0.4) * Math.sqrt(f));
    sum += s;
    return s;
  });
  const total = sim.valid * p;
  const votes = shares.map((s) => Math.round((total * s) / sum));
  const top = votes.map((_, j) => j).sort((a, b) => votes[b] - votes[a]).slice(0, seats);
  return { p, votes, counted: votes.reduce((a, b) => a + b, 0), decided: false, top, winners: [] };
}

const unitFor = (votes: number[], seats: number) => niceUnit(Math.max(0, ...votes) / (seats > 1 ? 40 : 50));

export function buildReplay(mayorFile: MayorFile, councilFile: CouncilFile): County[] {
  const rng = mulberry32(20221126);
  const logE = mayorFile.counties.map((c) => Math.log(c.electors));
  const logMin = Math.min(...logE), logMax = Math.max(...logE);

  const counties: County[] = mayorFile.counties.map((c) => {
    const size = (Math.log(c.electors) - logMin) / (logMax - logMin || 1);
    const start = 0.012 + rng() * 0.06;
    const dur = Math.min(0.955 - start, 0.2 + 0.64 * Math.pow(size, 1.15) + rng() * 0.08);
    const winner = c.candidates.findIndex((x) => x.elected);
    const votes = c.candidates.map((x) => x.votes);
    const mayor: Race = {
      kind: "mayor",
      key: c.code,
      name: c.name,
      candidates: c.candidates.map((x) => ({ no: x.no, name: decodeName(x.name), party: x.party })),
      seats: 1,
      electors: c.electors,
      castPerValid: c.votesCast / c.valid,
      turnout: c.turnout,
      unit: unitFor(votes, 1),
      finalVotes: votes,
      state: emptyState(votes.length),
      decidedPrev: false,
      sim: makeSim(votes, c.valid, 1, { start, dur, winners: [winner], rng }),
      version: 0,
    };
    const info = COUNTIES.find((k) => k.code === c.code)!;
    return {
      code: c.code,
      name: c.name,
      short: info.short,
      kind: c.type,
      raceLabel: c.type === "county" ? "縣長選舉" : "市長選舉",
      mayor,
      council: { kind: councilKind(c.type), seats: 0, districts: [], finalTurnout: null, state: emptyCouncilState(), completePrev: false },
    };
  });
  const byCode = new Map(counties.map((c) => [c.code, c]));

  // Councilor ballots are counted after the mayor ballots at each polling station, so they start later.
  const crng = mulberry32(20221127);
  const dLog = councilFile.counties.flatMap((cc) => cc.districts.map((d) => Math.log(d.electors)));
  const dLogMin = Math.min(...dLog), dLogMax = Math.max(...dLog);
  for (const cc of councilFile.counties) {
    const c = byCode.get(cc.code);
    if (!c) continue;
    const cStart = c.mayor.sim!.start;
    const districts = cc.districts.map((d): District => {
      const size = (Math.log(d.electors) - dLogMin) / (dLogMax - dLogMin || 1);
      const start = Math.min(0.45, cStart + 0.05 + crng() * 0.06);
      const dur = Math.min(0.985 - start, 0.26 + 0.6 * Math.pow(size, 1.1) + crng() * 0.08);
      const winners = d.candidates.map((x, j) => (x.elected ? j : -1)).filter((j) => j >= 0);
      const votes = d.candidates.map((x) => x.votes);
      return {
        kind: "district",
        key: d.id,
        id: d.id,
        county: cc.code,
        type: d.type,
        no: d.no,
        name: d.name,
        towns: d.towns,
        candidates: d.candidates.map((x) => ({ no: x.no, name: decodeName(x.name), party: x.party, womenQuota: x.womenQuota || undefined })),
        seats: d.seats,
        electors: d.electors,
        castPerValid: d.votesCast / d.valid,
        turnout: (d.votesCast / d.electors) * 100,
        unit: unitFor(votes, d.seats),
        finalVotes: votes,
        state: emptyState(votes.length),
        decidedPrev: false,
        sim: makeSim(votes, d.valid, d.seats, { start, dur, winners, rng: crng }),
        version: 0,
      };
    });
    const cast = cc.districts.reduce((a, d) => a + d.votesCast, 0);
    const electors = cc.districts.reduce((a, d) => a + d.electors, 0);
    Object.assign(c.council, { kind: cc.kind, seats: cc.seats, districts, finalTurnout: (cast / electors) * 100 });
  }
  return counties;
}

/** A county's mayor race split by town: the county's candidates with each town's votes. */
export function townRaces(c: County, towns: TownRecord[], simulate: boolean): Race[] {
  const rr = mulberry32(Number(c.code) * 13 + 5);
  const sim = c.mayor.sim;
  return towns.map((t) => {
    const votes = c.mayor.candidates.map((x) => t.votes[x.no] || 0);
    let townSim: Sim | null = null;
    if (simulate && sim) {
      // the town finishes no later than its county
      const winner = votes.reduce((best, v, j) => (v > votes[best] ? j : best), 0);
      const start = sim.start + rr() * 0.03;
      const dur = Math.max(0.05, (sim.start + sim.dur - start) * (0.82 + rr() * 0.18));
      townSim = makeSim(votes, t.valid, 1, { start, dur, winners: [winner], rng: rr });
    }
    return {
      kind: "town",
      key: t.code,
      name: t.name,
      candidates: c.mayor.candidates,
      seats: 1,
      electors: t.electors,
      castPerValid: t.votesCast / t.valid,
      turnout: simulate ? (t.votesCast / t.electors) * 100 : null,
      unit: simulate ? unitFor(votes, 1) : estimateUnit(t.electors, 1),
      finalVotes: simulate ? votes : null,
      state: emptyState(votes.length),
      decidedPrev: false,
      sim: townSim,
      version: -1,
    };
  });
}

export class ReplaySource implements Source {
  readonly kind = "replay";
  T = 0;
  lastT = 0;
  playing = true;
  speed = 1;

  tick(dt: number) {
    if (!this.playing) return;
    this.T = Math.min(1, this.T + (dt * this.speed) / DURATION);
    if (this.T >= 1) this.playing = false;
  }

  refresh(race: Race) {
    if (race.sim) race.state = simState(race.sim, race.seats, this.T);
  }

  /** Decisions announce themselves only while the replay plays forward at normal pace, not after a seek. */
  isForward() {
    return this.playing && this.T > this.lastT && this.T - this.lastT < 0.02;
  }

  commit() {
    this.lastT = this.T;
  }

  seek(T: number) {
    this.T = clamp01(T);
  }

  get started() {
    return this.T > 0.02;
  }
}
