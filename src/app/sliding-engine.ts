import type { Difficulty } from './peg-engine';

export interface SlidingLevel {
  id: Difficulty;
  label: string;
  size: number;
  scrambles: number;
  subtitle: string;
}
export const SLIDING_LEVELS: readonly SlidingLevel[] = [
  { id: 'easy', label: 'Easy', size: 3, scrambles: 12, subtitle: '3 × 3 · Eight tiles' },
  { id: 'medium', label: 'Medium', size: 4, scrambles: 42, subtitle: '4 × 4 · Classic fifteen' },
  { id: 'hard', label: 'Hard', size: 5, scrambles: 100, subtitle: '5 × 5 · Twenty-four tiles' },
  { id: 'extreme', label: 'Extreme', size: 6, scrambles: 220, subtitle: '6 × 6 · Thirty-five tiles' }
];
export function solvedTiles(size: number): number[] {
  if (!Number.isInteger(size) || size < 2 || size > 8) throw new RangeError('Invalid board size');
  return [...Array.from({ length: size * size - 1 }, (_, i) => i + 1), 0];
}
export function isSolved(tiles: readonly number[]): boolean {
  return tiles.every((number, index) => index === tiles.length - 1 ? number === 0 : number === index + 1);
}
export function neighbors(index: number, size: number): number[] {
  if (!Number.isInteger(size) || size < 2 || !Number.isInteger(index) ||
      index < 0 || index >= size * size) throw new RangeError('Invalid tile location');
  const row = Math.floor(index / size), col = index % size;
  return [
    ...(row > 0 ? [index - size] : []),
    ...(row < size - 1 ? [index + size] : []),
    ...(col > 0 ? [index - 1] : []),
    ...(col < size - 1 ? [index + 1] : [])
  ];
}
/** Returns a new board, or null if the selected tile cannot slide into the gap. */
export function slideTile(tiles: readonly number[], size: number, index: number): number[] | null {
  const blank = tiles.indexOf(0);
  if (tiles.length !== size * size || blank < 0 || !neighbors(blank, size).includes(index)) return null;
  const next = [...tiles];
  [next[index], next[blank]] = [next[blank], next[index]];
  return next;
}
export function correctTileCount(tiles: readonly number[]): number {
  return tiles.slice(0, -1).filter((tile, index) => tile === index + 1).length;
}
export function manhattanDistance(tiles: readonly number[], size: number): number {
  return tiles.reduce((total, tile, pos) => {
    if (!tile) return total;
    const goal = tile - 1;
    return total + Math.abs(Math.floor(pos / size) - Math.floor(goal / size)) +
      Math.abs(pos % size - goal % size);
  }, 0);
}
function random(seed: number): () => number {
  let value = (seed >>> 0) || 0x9e3779b9;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x100000000;
  };
}
export interface SlidingPuzzle {
  size: number;
  tiles: readonly number[];
  /** A sequence of legal tile indices that returns to the solved layout. */
  solutionMoves: readonly number[];
}
export function makeSlidingPuzzle(difficulty: Difficulty, seed: number): SlidingPuzzle {
  const level = SLIDING_LEVELS.find(item => item.id === difficulty)!;
  const rng = random(seed);
  const tiles = solvedTiles(level.size);
  let blank = tiles.length - 1;
  let previous = -1;
  const blanks: number[] = [];
  for (let i = 0; i < level.scrambles; i++) {
    const choices = neighbors(blank, level.size).filter(index => index !== previous);
    const from = choices[Math.floor(rng() * choices.length)];
    blanks.push(blank);
    [tiles[from], tiles[blank]] = [tiles[blank], tiles[from]];
    previous = blank;
    blank = from;
  }
  // Constructed via legal slides: solvable on any size, including even grids.
  if (isSolved(tiles)) {
    const from = neighbors(blank, level.size)[0];
    blanks.push(blank);
    [tiles[from], tiles[blank]] = [tiles[blank], tiles[from]];
  }
  return { size: level.size, tiles, solutionMoves: blanks.reverse() };
}
