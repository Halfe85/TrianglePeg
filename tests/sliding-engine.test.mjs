import test from 'node:test';
import assert from 'node:assert/strict';
import { SLIDING_LEVELS, solvedTiles, isSolved, neighbors, slideTile, correctTileCount, manhattanDistance, makeSlidingPuzzle } from '../src/app/sliding-engine.ts';

test('15 Puzzle supports 3x3 through 6x6', () => {
  assert.deepEqual(SLIDING_LEVELS.map(l=>l.size),[3,4,5,6]);
  for(const level of SLIDING_LEVELS){
    const tiles=solvedTiles(level.size);
    assert.equal(tiles.length,level.size**2);
    assert.equal(isSolved(tiles),true);
    assert.equal(correctTileCount(tiles),tiles.length-1);
    assert.equal(manhattanDistance(tiles,level.size),0);
  }
});
test('only orthogonal neighbors may slide, without wrapping between rows', () => {
  const size=4, board=solvedTiles(size);
  assert.deepEqual(neighbors(15,size),[11,14]);
  assert.equal(slideTile(board,size,12),null);
  assert.equal(slideTile(board,size,15),null);
  const next=slideTile(board,size,14);
  assert.ok(next);
  assert.equal(next[15],15);
  assert.equal(next[14],0);
  assert.equal(board[15],0,'input is immutable');
  assert.equal(manhattanDistance(next,size),1);
});
test('every shuffled puzzle can be returned to solved by legal moves', () => {
  for(const level of SLIDING_LEVELS){
    for(const seed of [0,1,42,1234567]){
      const puzzle=makeSlidingPuzzle(level.id,seed);
      assert.equal(puzzle.size,level.size);
      assert.equal(isSolved(puzzle.tiles),false);
      let board=puzzle.tiles;
      for(const index of puzzle.solutionMoves){
        const next=slideTile(board,level.size,index);
        assert.notEqual(next,null,`${level.id} invalid rewind index ${index}`);
        board=next;
      }
      assert.equal(isSolved(board),true,`${level.id} seed ${seed}`);
      assert.deepEqual(makeSlidingPuzzle(level.id,seed).tiles,puzzle.tiles);
    }
  }
});
test('invalid tile boards are rejected', () => {
  assert.throws(()=>solvedTiles(0),RangeError);
  assert.equal(slideTile([1,2,3],2,1),null);
});
