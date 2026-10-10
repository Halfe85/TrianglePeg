import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLES, FULL_BOARD, JUMPS, initialBoard, hasPeg, pegCount,
  legalMoves, applyMove, solve } from '../src/app/peg-engine.ts';

test('board geometry: 15 holes, 36 directed jumps',()=>{
  assert.equal(HOLES.length,15);
  assert.equal(JUMPS.length,36);
  assert.equal(new Set(HOLES.map(h=>h.id)).size,15);
});
test('every opening leaves 14 pegs',()=>{
  for(let i=0;i<15;i++){
    const board=initialBoard(i);
    assert.equal(pegCount(board),14);
    assert.equal(hasPeg(board,i),false);
  }
  assert.equal(pegCount(FULL_BOARD),15);
  assert.throws(()=>initialBoard(15),RangeError);
});
test('two legal opening jumps into an empty top hole',()=>{
  const moves=legalMoves(initialBoard(0));
  assert.deepEqual(moves.map(m=>[m.from,m.over,m.to]),[[3,1,0],[5,2,0]]);
});
test('legal jump takes away exactly one peg',()=>{
  const board=initialBoard(0),move=legalMoves(board)[0];
  const next=applyMove(board,move);
  assert.equal(pegCount(next),13);
  assert.equal(hasPeg(next,move.from),false);
  assert.equal(hasPeg(next,move.over),false);
  assert.equal(hasPeg(next,move.to),true);
  assert.throws(()=>applyMove(next,move),/Illegal jump/);
});
test('solver gives a legal 13-jump winning path',()=>{
  const path=solve(initialBoard(0));
  assert.ok(path);
  assert.equal(path.length,13);
  let board=initialBoard(0);
  for(const move of path){
    assert.ok(legalMoves(board).some(m=>m.from===move.from&&m.over===move.over&&m.to===move.to));
    board=applyMove(board,move);
  }
  assert.equal(pegCount(board),1);
  assert.equal(solve(board)?.length,0);
});
test('full triangle is stuck',()=>{
  assert.deepEqual(legalMoves(FULL_BOARD),[]);
  assert.equal(solve(FULL_BOARD),null);
});
