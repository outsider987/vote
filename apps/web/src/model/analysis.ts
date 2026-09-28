import { rankOrder } from "../util";
import type { Council, CouncilState, Race, RaceState } from "./types";

/** A county council's combined count: progress, decided seats per party and the current seat leader. */
export function councilAggregate(cn: Council): CouncilState {
  let psum = 0, wsum = 0, cast = 0, electors = 0, decidedSeats = 0;
  const decided: Record<string, number> = {}, combined: Record<string, number> = {};
  for (const d of cn.districts) {
    const s = d.state;
    psum += s.p * d.electors; wsum += d.electors;
    cast += s.counted * d.castPerValid; electors += d.electors;
    if (s.decided) decidedSeats += d.seats;
    for (const j of s.top) {
      const party = d.candidates[j].party;
      combined[party] = (combined[party] || 0) + 1;
      if (s.decided) decided[party] = (decided[party] || 0) + 1;
    }
  }
  let leaderParty: string | null = null, best = 0;
  for (const [party, n] of Object.entries(combined)) if (n > best) { best = n; leaderParty = party; }
  return {
    p: wsum ? psum / wsum : 0,
    turnoutCounted: electors ? cast / electors : 0,
    decidedSeats,
    decided,
    leaderParty,
    complete: cn.seats > 0 && decidedSeats === cn.seats,
  };
}

/** The contest for the last seat: rank `seats` against rank `seats + 1` (leader vs runner-up for a mayor). */
export function duelOf(race: Race, s: RaceState = race.state) {
  if (!s.counted || race.candidates.length <= race.seats) return null;
  const order = rankOrder(s.votes);
  const a = order[race.seats - 1], b = order[race.seats];
  return { a, b, gap: s.votes[a] - s.votes[b], margin: (s.votes[a] - s.votes[b]) / s.counted };
}

/** Stack height: ballots counted ÷ electors (the turnout once the count is complete). */
export const turnoutCounted = (race: Race) => (race.electors ? (race.state.counted * race.castPerValid) / race.electors : 0);

/** A council's turnout once every district is complete: the published figure, else the sum of district turnout pages. */
export function councilTurnout(cn: Council) {
  if (cn.finalTurnout !== null) return cn.finalTurnout;
  if (!cn.districts.length || cn.districts.some((d) => !d.state.decided || !d.ballots)) return null;
  const cast = cn.districts.reduce((a, d) => a + d.ballots!.cast, 0);
  const electors = cn.districts.reduce((a, d) => a + d.ballots!.electors, 0);
  return electors ? (cast / electors) * 100 : null;
}
