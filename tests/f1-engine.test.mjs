import test from 'node:test';
import assert from 'node:assert/strict';
import {
  F1_LIGHTS, F1_LIGHT_INTERVAL_MS, F1_HOLD_MIN_MS, F1_HOLD_MAX_MS,
  F1_TEN_SECONDS_MS, F1_HIDE_CLOCK_AFTER_MS,
  reactionHoldDelay, lightsShowing, scoreReaction, scorePerfect10,
  formatF1Time, formatF1Difference
} from '../src/app/f1-engine.ts';

test('five lights appear one at a time', () => {
  assert.equal(F1_LIGHTS, 5);
  assert.equal(F1_LIGHT_INTERVAL_MS, 1000);
  assert.equal(lightsShowing(0), 0);
  assert.equal(lightsShowing(999), 0);
  assert.equal(lightsShowing(1000), 1);
  assert.equal(lightsShowing(4999), 4);
  assert.equal(lightsShowing(5000), 5);
  assert.equal(lightsShowing(20000), 5);
});

test('random hold is bounded and variable', () => {
  assert.equal(reactionHoldDelay(0), F1_HOLD_MIN_MS);
  assert.ok(reactionHoldDelay(0.99999999) < F1_HOLD_MAX_MS);
  assert.ok(reactionHoldDelay(0.5) > F1_HOLD_MIN_MS);
  assert.throws(() => reactionHoldDelay(1), RangeError);
  assert.throws(() => reactionHoldDelay(-0.1), RangeError);
});

test('premature reaction is a false start with no recorded reaction', () => {
  assert.deepEqual(scoreReaction(4999, 5000), { kind:'false-start', reactionMs: null });
  assert.deepEqual(scoreReaction(5000, 5000), { kind:'reaction', reactionMs: 0 });
  assert.deepEqual(scoreReaction(5278.125, 5000), { kind:'reaction', reactionMs:278.125 });
});

test('ten seconds scores absolute accuracy on either side of the target', () => {
  assert.equal(F1_TEN_SECONDS_MS, 10000);
  assert.equal(F1_HIDE_CLOCK_AFTER_MS, 3000);
  assert.deepEqual(scorePerfect10(1000, 11000), {
    elapsedMs:10000, differenceMs:0, absoluteErrorMs:0
  });
  const early=scorePerfect10(1000, 10950);
  const late=scorePerfect10(1000, 11050);
  assert.equal(early.differenceMs,-50);
  assert.equal(late.differenceMs,50);
  assert.equal(early.absoluteErrorMs,50);
  assert.equal(late.absoluteErrorMs,50);
  assert.throws(() => scorePerfect10(3000, 1000),RangeError);
});

test('formatting and sign correctly reflect timing', () => {
  assert.equal(formatF1Time(275.55),'0.276s');
  assert.equal(formatF1Difference(-20),'-0.020s');
  assert.equal(formatF1Difference(20),'+0.020s');
  assert.equal(formatF1Difference(0),'0.000s');
  assert.throws(() => formatF1Time(Infinity),RangeError);
});
