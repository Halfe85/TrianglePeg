import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDS, LEVELS, createTriangle, canStartAt, initialBoard, pegCount,
  legalMoves, applyMove, searchSolution, hasPeg
} from '../src/app/peg-engine.ts';

test('four levels have 5, 6, 7 and 8 triangle rows', () => {
  assert.deepEqual(LEVELS.map(level => level.id), ['easy', 'medium', 'hard', 'extreme']);
  assert.deepEqual(LEVELS.map(level => BOARDS[level.id].holes.length), [15, 21, 28, 36]);
  assert.equal(BOARDS.extreme.fullBoard.toString(2).length, 36);
  assert.throws(() => createTriangle(9), RangeError);
});

test('each level uses unique hole coordinates and valid jump triples', () => {
  for (const level of LEVELS) {
    const puzzle = BOARDS[level.id];
    const ids = new Set(puzzle.holes.map(h => h.id));
    assert.equal(ids.size, puzzle.holes.length);
    const coords = new Set(puzzle.holes.map(h => `${h.row},${h.column}`));
    assert.equal(coords.size, puzzle.holes.length);
    for (const move of puzzle.jumps) {
      const from = puzzle.holes[move.from];
      const over = puzzle.holes[move.over];
      const to = puzzle.holes[move.to];
      assert.equal(over.row - from.row, to.row - over.row);
      assert.equal(over.column - from.column, to.column - over.column);
    }
  }
});

test('Hard rejects impossible openings, including corners and center', () => {
  const hard = BOARDS.hard;
  const blocked = [0, 21, 27, 12]; // top, left corner, right corner, central hole
  for (const id of blocked) {
    assert.equal(canStartAt(hard, id), false);
    assert.throws(() => initialBoard(id, hard), RangeError);
  }
  assert.equal(canStartAt(hard, 1), true);
  assert.equal(canStartAt(hard, 2), true);
});

test('every recommended start has a complete valid winning route', () => {
  for (const level of LEVELS) {
    const puzzle = BOARDS[level.id];
    let board = initialBoard(puzzle.recommendedOpening, puzzle);
    assert.equal(pegCount(board), puzzle.holes.length - 1);
    assert.equal(hasPeg(board, puzzle.recommendedOpening), false);
    const found = searchSolution(board, puzzle, 100_000);
    assert.ok(found.path, `Winning path missing on ${level.id}`);
    assert.equal(found.path.length, puzzle.holes.length - 2);
    for (const move of found.path) {
      assert.ok(legalMoves(board, puzzle).some(other =>
        other.from === move.from && other.over === move.over && other.to === move.to));
      board = applyMove(board, move, puzzle);
    }
    assert.equal(pegCount(board), 1);
  }
});

test('bounded searches report an incomplete result rather than an impossible puzzle', () => {
  const board = initialBoard(BOARDS.extreme.recommendedOpening, BOARDS.extreme);
  const result = searchSolution(board, BOARDS.extreme, 1);
  assert.equal(result.path, null);
  assert.equal(result.complete, false);
});

test('each difficulty has an independent hint allowance', () => {
  assert.deepEqual(LEVELS.map(l => l.hints), [null, 3, 1, 0]);
});
