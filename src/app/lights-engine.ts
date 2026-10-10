import type { Difficulty } from './peg-engine';

/** Each press flips the selected light and its orthogonal neighbors. */
export interface LightLevel {
  id: Difficulty;
  label: string;
  size: number;
  scrambles: number;
  subtitle: string;
}
export const LIGHT_LEVELS: readonly LightLevel[] = [
  { id: 'easy', label: 'Easy', size: 3, scrambles: 3, subtitle: '3 × 3 · Learn the pattern' },
  { id: 'medium', label: 'Medium', size: 4, scrambles: 7, subtitle: '4 × 4 · More interactions' },
  { id: 'hard', label: 'Hard', size: 5, scrambles: 12, subtitle: '5 × 5 · Classic challenge' },
  { id: 'extreme', label: 'Extreme', size: 6, scrambles: 18, subtitle: '6 × 6 · A serious challenge' }
];

function validate(size: number, index: number): void {
  if (!Number.isInteger(size) || size < 2 || size > 8 ||
      !Number.isInteger(index) || index < 0 || index >= size * size) {
    throw new RangeError('Invalid Lights Out position');
  }
}
export function pressLight(board: bigint, size: number, index: number): bigint {
  validate(size, index);
  const row = Math.floor(index / size), col = index % size;
  let next = board;
  for (const [r, c] of [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
    if (r >= 0 && r < size && c >= 0 && c < size) next ^= 1n << BigInt(r * size + c);
  }
  return next;
}
export function isLightOn(board: bigint, index: number): boolean {
  return (board & (1n << BigInt(index))) !== 0n;
}
export function litCount(board: bigint): number {
  let count = 0, value = board;
  while (value > 0n) { value &= value - 1n; count++; }
  return count;
}

/** Seeded shuffle, so all puzzles can be reproduced and tested. */
function random(seed: number): () => number {
  let value = (seed >>> 0) || 0x9e3779b9;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x100000000;
  };
}
export interface LightsPuzzle {
  size: number;
  board: bigint;
  /** A solution witness. Pressing these cells again clears the board. */
  scrambledCells: readonly number[];
}
export function makeLightsPuzzle(difficulty: Difficulty, seed: number): LightsPuzzle {
  const level = LIGHT_LEVELS.find(item => item.id === difficulty)!;
  const rng = random(seed);
  const indices = Array.from({ length: level.size * level.size }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  // All initial states are solvable by construction, never unverified random masks.
  const scrambledCells = indices.slice(0, level.scrambles);
  let board = 0n;
  for (const index of scrambledCells) board = pressLight(board, level.size, index);
  // A nonempty scramble can sometimes cancel exactly; use a known valid state.
  if (board === 0n) {
    board = pressLight(0n, level.size, indices[0]);
    return { size: level.size, board, scrambledCells: [indices[0]] };
  }
  return { size: level.size, board, scrambledCells };
}
