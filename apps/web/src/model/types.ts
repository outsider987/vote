import type { CountyKind, DistrictType, Turnout } from "@vote/shared";

export interface Candidate {
  no: number;
  name: string;
  party: string;
  womenQuota?: boolean;
  photo?: string;
  platformUrl?: string;
  platformImage?: string;
  birth?: string;
  birthplace?: string;
  gender?: "M" | "F" | null;
  incumbent?: boolean;
}

/** A race at one moment. Replay and live sources both produce this; the UI reads nothing else. */
export interface RaceState {
  /** Share of the count done, 0–1 (live: polling stations reported ÷ expected). */
  p: number;
  /** Votes per candidate, aligned with `race.candidates`. */
  votes: number[];
  counted: number;
  decided: boolean;
  /** The `seats` candidates currently in a winning position; the elected ones once decided. */
  top: number[];
  /** Elected candidates once decided, otherwise empty. */
  winners: number[];
  /** Live only: a tie awaiting the lot draw (？ on the count site). */
  tie?: boolean;
}

/** Replay-only schedule and wobble for one simulated count. */
export interface Sim {
  start: number;
  dur: number;
  amp: number;
  waves: [number, number, number, number][];
  finalVotes: number[];
  valid: number;
  winners: number[];
  /** The state before this count starts, shared so idle frames don't allocate. */
  zero: RaceState;
}

export type RaceKind = "mayor" | "district" | "town";

/** One ballot count: a mayor race, a councilor district (multi-seat) or a town's share of a mayor race. */
export interface Race {
  kind: RaceKind;
  /** County code, district id or town code — the key used in results.json. */
  key: string;
  name: string;
  candidates: Candidate[];
  seats: number;
  /** Stack height denominator. Live mode uses the 2022 electorate as an estimate. */
  electors: number;
  /** Ballots cast per valid vote, so counted votes convert to ballots for the stack height. */
  castPerValid: number;
  /** Official turnout in percent once known; null when the source doesn't publish it. */
  turnout: number | null;
  /** Votes per tally stroke. Replay fixes it up front; live only ever raises it. */
  unit: number;
  /** Replay only: final votes, so the tally can be sized once and never overshoot. */
  finalVotes: number[] | null;
  state: RaceState;
  decidedPrev: boolean;
  sim: Sim | null;
  /** Live: the snapshot version `state` was mapped from. */
  version: number;
  /** Live: the latest turnout-page numbers (選舉人數, 投票數, …) for this race, when the poller has them. */
  ballots?: Turnout;
}

export interface District extends Race {
  id: string;
  county: string;
  type: DistrictType;
  no: string;
  towns: { code: string; name: string }[];
  /** 婦女應當選名額, when the source states it. */
  womenSeats?: number;
}

export interface CouncilState {
  p: number;
  turnoutCounted: number;
  decidedSeats: number;
  decided: Record<string, number>;
  leaderParty: string | null;
  complete: boolean;
}

export interface Council {
  /** 直轄市議員 / 縣市議員 */
  kind: string;
  seats: number;
  districts: District[];
  finalTurnout: number | null;
  state: CouncilState;
}

export interface County {
  code: string;
  name: string;
  short: string;
  kind: CountyKind;
  /** 市長選舉 / 縣長選舉 */
  raceLabel: string;
  mayor: Race;
  council: Council;
}

/** Town-level mayor results from data/mayor-2022-towns.json (votes keyed by ballot number). */
export interface TownRecord {
  code: string;
  name: string;
  electors: number;
  votesCast: number;
  valid: number;
  votes: Record<string, number>;
}

export const emptyState = (n: number): RaceState =>
  ({ p: 0, votes: new Array<number>(n).fill(0), counted: 0, decided: false, top: [], winners: [] });

export const emptyCouncilState = (): CouncilState =>
  ({ p: 0, turnoutCounted: 0, decidedSeats: 0, decided: {}, leaderParty: null, complete: false });
