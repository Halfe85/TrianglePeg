import test from 'node:test';
import assert from 'node:assert/strict';
import { LIGHT_LEVELS, pressLight, litCount, makeLightsPuzzle, isLightOn } from '../src/app/lights-engine.ts';

test('Lights Out size and difficulty progression', () => {
  assert.deepEqual(LIGHT_LEVELS.map(l => l.size), [3,4,5,6]);
  assert.deepEqual(LIGHT_LEVELS.map(l => l.scrambles), [3,7,12,18]);
});
test('one press flips itself and only orthogonally adjacent lights', () => {
  const board = pressLight(0n, 3, 4);
  assert.equal(litCount(board), 5);
  for (const i of [1,3,4,5,7]) assert.equal(isLightOn(board, i), true);
  for (const i of [0,2,6,8]) assert.equal(isLightOn(board, i), false);
  assert.equal(pressLight(board, 3, 4), 0n);
  assert.equal(litCount(pressLight(0n, 4, 0)), 3);
});
test('all generated puzzles are solvable by reversing their press sequence', () => {
  for (const level of LIGHT_LEVELS) {
    for (const seed of [0, 1, 42, 1234567]) {
      const puzzle = makeLightsPuzzle(level.id, seed);
      assert.equal(puzzle.size, level.size);
      assert.ok(litCount(puzzle.board) > 0);
      let state = puzzle.board;
      for (const id of [...puzzle.scrambledCells].reverse()) state = pressLight(state, level.size, id);
      assert.equal(state, 0n, `${level.id} seed ${seed}`);
      assert.equal(makeLightsPuzzle(level.id,seed).board, puzzle.board);
    }
  }
});
test('invalid Lights Out positions are rejected', () => {
  assert.throws(()=>pressLight(0n,3,9),RangeError);
  assert.throws(()=>pressLight(0n,0,0),RangeError);
});
