import type { CountyKind } from "@vote/shared";
import { niceUnit } from "../util";
import type { Race } from "./types";

/** Where race states come from: the 2022 replay clock, or the poller's live results.json. */
export interface Source {
  readonly kind: "replay" | "live";
  readonly playing: boolean;
  readonly speed: number;
  /** Whether any race has started counting. */
  readonly started: boolean;
  /** Advance one frame. */
  tick(dt: number): void;
  /** Bring `race.state` up to date. Cheap enough to call for every race on every frame. */
  refresh(race: Race): void;
  /** Whether state changes since the last commit are real-time progress worth announcing. */
  isForward(): boolean;
  commit(): void;
}

export const councilKind = (kind: CountyKind) => (kind === "municipality" ? "直轄市議員" : "縣市議員");

/**
 * A tally unit before any votes are in: about 50 strokes for a mayor winner (40 for a councilor)
 * at typical turnout and vote share, so the 正 marks fit the board.
 */
export function estimateUnit(electors: number, seats: number) {
  const topShare = seats > 1 ? 1.4 / (seats + 1) : 0.52;
  return niceUnit((electors * 0.62 * topShare) / (seats > 1 ? 40 : 50));
}
