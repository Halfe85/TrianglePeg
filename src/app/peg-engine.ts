/**
 * Pure 5-row triangle peg solitaire rules. Each occupied hole uses a bit in a
 * 15-bit board mask; the six directions are the triangle's lattice axes.
 */
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
export const HOLES: readonly Hole[] = Array.from({length:5}, (_, row) =>
  Array.from({length:row+1}, (_, column):Hole => ({
    id:row*(row+1)/2+column,
    row,column,
    x:50+(column-row/2)*18.7,
    y:18+row*16.6
  }))
).flat();
export const FULL_BOARD = (1 << HOLES.length) - 1;
const COORDS = new Map(HOLES.map(h => [`${h.row},${h.column}`, h.id]));
const DIRECTIONS:ReadonlyArray<readonly [number,number]> = [
  [0,-1],[0,1],[-1,0],[-1,-1],[1,0],[1,1]
];
export const JUMPS:readonly Move[] = HOLES.flatMap(h =>
  DIRECTIONS.flatMap(([dr,dc]) => {
    const over = COORDS.get(`${h.row+dr},${h.column+dc}`);
    const to = COORDS.get(`${h.row+2*dr},${h.column+2*dc}`);
    return over === undefined || to === undefined ? [] : [{from:h.id,over,to}];
  })
);
export function hasPeg(board:number,id:number):boolean {
  return (board & (1 << id)) !== 0;
}
export function initialBoard(empty=0):number {
  if (!Number.isInteger(empty) || empty<0 || empty>=HOLES.length)
    throw new RangeError('Invalid starting hole');
  return FULL_BOARD & ~(1 << empty);
}
export function pegCount(board:number):number {
  let n=board & FULL_BOARD, count=0;
  while(n){ n &= n-1; count++; }
  return count;
}
export function legalMoves(board:number):Move[] {
  return JUMPS.filter(m => hasPeg(board,m.from) && hasPeg(board,m.over) && !hasPeg(board,m.to));
}
export function applyMove(board:number,m:Move):number {
  if (!hasPeg(board,m.from) || !hasPeg(board,m.over) || hasPeg(board,m.to) ||
      !JUMPS.some(j=>j.from===m.from && j.over===m.over && j.to===m.to))
    throw new Error('Illegal jump');
  return board ^ (1 << m.from) ^ (1 << m.over) ^ (1 << m.to);
}
/** Memoized exhaustive search for a route with exactly one peg remaining. */
export function solve(board:number,memo=new Map<number,Move[]|null>()):Move[]|null {
  if (pegCount(board)===1) return [];
  if (memo.has(board)) return memo.get(board) ?? null;
  for(const jump of legalMoves(board)){
    const rest=solve(applyMove(board,jump),memo);
    if(rest!==null){
      const path=[jump,...rest];
      memo.set(board,path);
      return path;
    }
  }
  memo.set(board,null);
  return null;
}
