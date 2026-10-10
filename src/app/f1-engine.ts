/** Pure scoring and timing rules for F1 start-light reflex challenges. */
export type F1Mode = 'reaction' | 'perfect10';
export type F1Stage = 'idle' | 'countdown' | 'go' | 'running' | 'result' | 'false-start';

export const F1_LIGHTS = 5;
export const F1_LIGHT_INTERVAL_MS = 1000;
export const F1_HOLD_MIN_MS = 200;
export const F1_HOLD_MAX_MS = 3000;
export const F1_TEN_SECONDS_MS = 10_000;
export const F1_HIDE_CLOCK_AFTER_MS = 3000;

export function reactionHoldDelay(randomFraction: number): number {
  if (!Number.isFinite(randomFraction) || randomFraction < 0 || randomFraction >= 1) {
    throw new RangeError('Random fraction must be within [0, 1)');
  }
  return Math.floor(F1_HOLD_MIN_MS + randomFraction * (F1_HOLD_MAX_MS - F1_HOLD_MIN_MS));
}

export function lightsShowing(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs)) throw new RangeError('Invalid elapsed time');
  return Math.max(0, Math.min(F1_LIGHTS, Math.floor(elapsedMs / F1_LIGHT_INTERVAL_MS)));
}

export type ReactionResult =
  | { kind: 'false-start'; reactionMs: null }
  | { kind: 'reaction'; reactionMs: number };

/** `lightsOffAt` is recorded when the callback actually extinguishes the lights. */
export function scoreReaction(tappedAt: number, lightsOffAt: number): ReactionResult {
  if (!Number.isFinite(tappedAt) || !Number.isFinite(lightsOffAt)) {
    throw new RangeError('Invalid timestamp');
  }
  if (tappedAt < lightsOffAt) return { kind: 'false-start', reactionMs: null };
  return { kind: 'reaction', reactionMs: tappedAt - lightsOffAt };
}

export interface Perfect10Result {
  elapsedMs: number;
  differenceMs: number;
  absoluteErrorMs: number;
}
export function scorePerfect10(startedAt: number, tappedAt: number): Perfect10Result {
  if (!Number.isFinite(startedAt) || !Number.isFinite(tappedAt) || tappedAt < startedAt) {
    throw new RangeError('Invalid start/stop timestamps');
  }
  const elapsedMs = tappedAt - startedAt;
  const differenceMs = elapsedMs - F1_TEN_SECONDS_MS;
  return { elapsedMs, differenceMs, absoluteErrorMs: Math.abs(differenceMs) };
}

/** Seconds displayed to 3 decimal places. Milliseconds are measured before rounding. */
export function formatF1Time(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) throw new RangeError('Invalid duration');
  return `${(milliseconds / 1000).toFixed(3)}s`;
}
export function formatF1Difference(milliseconds: number): string {
  return `${milliseconds > 0 ? '+' : ''}${formatF1Time(milliseconds)}`;
}
