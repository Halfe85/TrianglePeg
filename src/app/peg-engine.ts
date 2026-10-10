/**
 * Triangle Peg rule engine.
 * BigInt masks support the 15, 21, 28 and 36-hole boards without 32-bit overflow.
 */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export type BoardState = bigint;

export interface Hole {
  readonly id: number;
  readonly row: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
}
export interface Move {
  readonly from: number;
  readonly over: number;
  readonly to: number;
}
export interface TriangleBoard {
  readonly rows: number;
  readonly holes: readonly Hole[];
  readonly jumps: readonly Move[];
  readonly fullBoard: BoardState;
  readonly recommendedOpening: number;
}
export interface Level {
  readonly id: Difficulty;
  readonly label: string;
  readonly rows: number;
  readonly hints: number | null;
  readonly subtitle: string;
}
export interface SearchResult {
  readonly path: Move[] | null;
  /** False means the search budget ran out; null does not prove impossibility. */
  readonly complete: boolean;
}

export const LEVELS: readonly Level[] = [
  { id: 'easy', label: 'Easy', rows: 5, hints: null, subtitle: 'The classic triangle' },
  { id: 'medium', label: 'Medium', rows: 6, hints: 3, subtitle: 'Six rows to clear' },
  { id: 'hard', label: 'Hard', rows: 7, hints: 1, subtitle: 'Choose your opening carefully' },
  { id: 'extreme', label: 'Extreme', rows: 8, hints: 0, subtitle: 'No hints. Thirty-four jumps.' }
];

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [0, 1], [-1, 0], [-1, -1], [1, 0], [1, 1]
];

/** Hole positions and directed moves are generated from lattice geometry. */
export function createTriangle(rows: number): TriangleBoard {
  if (!Number.isInteger(rows) || rows < 5 || rows > 8) {
    throw new RangeError('Triangle rows must be between 5 and 8.');
  }
  const holes: Hole[] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: row + 1 }, (_, column): Hole => ({
      id: (row * (row + 1)) / 2 + column,
      row,
      column,
      x: 50 + (column - row / 2) * 74 / (rows - 1),
      y: 13 + row * 72 / (rows - 1)
    }))
  ).flat();
  const byCoordinate = new Map(holes.map(h => [`${h.row},${h.column}`, h.id]));
  const jumps = holes.flatMap(hole =>
    DIRECTIONS.flatMap(([dr, dc]) => {
      const over = byCoordinate.get(`${hole.row + dr},${hole.column + dc}`);
      const to = byCoordinate.get(`${hole.row + 2 * dr},${hole.column + 2 * dc}`);
      return over === undefined || to === undefined ? [] : [{ from: hole.id, over, to }];
    })
  );
  const fullBoard = (1n << BigInt(holes.length)) - 1n;
  // Triangle(7) is not null-class: a corner vacancy cannot be solved.
  // A vacancy at (row 1, column 0) is a verified feasible opening.
  return { rows, holes, jumps, fullBoard, recommendedOpening: rows === 7 ? 1 : 0 };
}

export const BOARDS: Readonly<Record<Difficulty, TriangleBoard>> = {
  easy: createTriangle(5),
  medium: createTriangle(6),
  hard: createTriangle(7),
  extreme: createTriangle(8)
};

/** Keep the original public exports working for 15-hole consumers. */
export const HOLES = BOARDS.easy.holes;
export const JUMPS = BOARDS.easy.jumps;
export const FULL_BOARD = BOARDS.easy.fullBoard;

/**
 * On the 28-hole board, holes in the corner's position class cannot be
 * vacancies in a single-vacancy / single-survivor puzzle.
 */
export function canStartAt(puzzle: TriangleBoard, id: number): boolean {
  if (!Number.isInteger(id) || id < 0 || id >= puzzle.holes.length) return false;
  const hole = puzzle.holes[id];
  return puzzle.rows !== 7 || (hole.row + hole.column) % 3 !== 0;
}

export function hasPeg(board: BoardState, id: number): boolean {
  return (board & (1n << BigInt(id))) !== 0n;
}
export function initialBoard(empty = 0, puzzle: TriangleBoard = BOARDS.easy): BoardState {
  if (!canStartAt(puzzle, empty)) throw new RangeError('Unsolvable or invalid starting hole');
  return puzzle.fullBoard & ~(1n << BigInt(empty));
}
export function pegCount(board: BoardState): number {
  let n = board;
  let count = 0;
  while (n > 0n) { n &= n - 1n; count++; }
  return count;
}
export function legalMoves(board: BoardState, puzzle: TriangleBoard = BOARDS.easy): Move[] {
  return puzzle.jumps.filter(move =>
    hasPeg(board, move.from) && hasPeg(board, move.over) && !hasPeg(board, move.to)
  );
}
export function applyMove(board: BoardState, move: Move, puzzle: TriangleBoard = BOARDS.easy): BoardState {
  if (!hasPeg(board, move.from) || !hasPeg(board, move.over) || hasPeg(board, move.to) ||
      !puzzle.jumps.some(j =>
        j.from === move.from && j.over === move.over && j.to === move.to)) {
    throw new Error('Illegal jump');
  }
  return board ^ (1n << BigInt(move.from)) ^ (1n << BigInt(move.over)) ^ (1n << BigInt(move.to));
}

/**
 * Memoized depth-first search with a finite state budget.
 * Budget avoids freezing the browser when a large board is already lost.
 */
export function searchSolution(
  board: BoardState,
  puzzle: TriangleBoard = BOARDS.easy,
  maxStates = 80_000
): SearchResult {
  const knownDead = new Set<BoardState>();
  let explored = 0;
  let truncated = false;
  const moves = puzzle.jumps.map(move => ({
    move,
    from: 1n << BigInt(move.from),
    over: 1n << BigInt(move.over),
    to: 1n << BigInt(move.to)
  }));

  function visit(state: BoardState): Move[] | null {
    if (pegCount(state) === 1) return [];
    if (knownDead.has(state)) return null;
    if (explored >= maxStates) {
      truncated = true;
      return null;
    }
    explored++;
    for (const { move, from, over, to } of moves) {
      if ((state & from) === 0n || (state & over) === 0n || (state & to) !== 0n) continue;
      const tail = visit(state ^ from ^ over ^ to);
      if (tail !== null) return [move, ...tail];
      if (truncated) return null;
    }
    knownDead.add(state);
    return null;
  }

  const path = visit(board);
  return { path, complete: !truncated };
}

/** Convenience wrapper: returns a winning route if found. */
export function solve(board: BoardState, puzzle: TriangleBoard = BOARDS.easy): Move[] | null {
  return searchSolution(board, puzzle).path;
}
