import test from 'node:test';
import assert from 'node:assert/strict';
import { canCheckoutInDarts, canScoreInDarts, evaluateVisit } from '../lib/x01.ts';

const rules = { checkIn: 'single', checkout: 'double', opened: true };
const dart = (val, mult = 1) => ({ val, mult });

test('double-out accepts a real finish and rejects a single finish', () => {
  assert.deepEqual(evaluateVisit(40, [dart(20, 2)], rules), {
    remaining: 0, scored: 40, opened: true, bust: false, checkout: true, dartsUsed: 1,
  });
  assert.equal(evaluateVisit(40, [dart(20), dart(20)], rules).bust, true);
  assert.equal(evaluateVisit(40, [dart(19, 2)], rules).remaining, 2);
});

test('bust restores the visit score and counts only the darts thrown', () => {
  const result = evaluateVisit(32, [dart(20), dart(11), dart(3)], rules);
  assert.equal(result.remaining, 32);
  assert.equal(result.scored, 0);
  assert.equal(result.dartsUsed, 2);
});

test('double-in ignores opening singles, then scores from the first double', () => {
  const result = evaluateVisit(301, [dart(20), dart(20, 2), dart(20, 3)], {
    checkIn: 'double', checkout: 'double', opened: false,
  });
  assert.equal(result.remaining, 201);
  assert.equal(result.scored, 100);
  assert.equal(result.opened, true);
  assert.equal(evaluateVisit(301, [dart(20)], { checkIn: 'double', checkout: 'double', opened: false }).scored, 0);
});

test('bull, master entry and master exit are evaluated correctly', () => {
  assert.equal(evaluateVisit(50, [dart(25, 2)], rules).checkout, true);
  assert.equal(evaluateVisit(60, [dart(20, 3)], { checkIn: 'master', checkout: 'master', opened: false }).checkout, true);
  assert.equal(evaluateVisit(60, [dart(20, 3)], rules).bust, true);
});

test('fast scoring rejects impossible visits and exact-dart finishes', () => {
  assert.equal(canScoreInDarts(180, 3), true);
  assert.equal(canScoreInDarts(179, 3), false);
  assert.equal(canScoreInDarts(163, 3), false);
  assert.equal(canCheckoutInDarts(170, 3, 'double'), true);
  assert.equal(canCheckoutInDarts(169, 3, 'double'), false);
  assert.equal(canCheckoutInDarts(50, 1, 'double'), true);
  assert.equal(canCheckoutInDarts(50, 1, 'single'), true);
  assert.equal(canCheckoutInDarts(51, 1, 'double'), false);
  assert.equal(canCheckoutInDarts(40, 1, 'double'), true);
});

test('invalid dart combinations cannot enter the scoring engine', () => {
  assert.throws(() => evaluateVisit(501, [dart(25, 3)], rules));
  assert.throws(() => evaluateVisit(501, [dart(21)], rules));
  assert.throws(() => evaluateVisit(501, [dart(20), dart(20), dart(20), dart(20)], rules));
});
