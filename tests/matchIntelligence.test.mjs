import test from 'node:test';
import assert from 'node:assert/strict';
import { legBreakAdvice, readScoutMatch, scoutOpponents, whatIfRoute, winRecipe } from '../lib/matchIntelligence.ts';
import { evaluateVisit } from '../lib/x01.ts';

const visit = (order, playerId, scoreBefore, points, overrides = {}) => ({
  order, playerId, leg: 1, scoreBefore, points, enteredPoints: points,
  darts: 3, bust: false, checkout: false, hits: [], ...overrides,
});

test('what-if route is a legal, better hypothetical from the recorded score and dart count', () => {
  const rows = [visit(1, 0, 81, 0, { bust: true, enteredPoints: 82 }), visit(2, 1, 40, 40, { checkout: true })];
  const result = whatIfRoute(rows, 0, 'double');
  assert.equal(result?.visit.order, 1);
  assert.equal(result?.actualRemaining, 81);
  assert.equal(result?.route.remaining, 0);
  const evaluated = evaluateVisit(81, result.route.darts, { checkIn: 'single', checkout: 'double', opened: true });
  assert.equal(evaluated.checkout, true);
  assert.equal(evaluated.remaining, 0);
  assert.equal(whatIfRoute(rows, 1, 'double')?.visit.order, 1);
  assert.equal(whatIfRoute([visit(1, 0, 80, 80, { checkout: true })], 0, 'double'), null);
});

test('leg coach uses only the completed leg and gives busts priority', () => {
  const rows = [visit(1, 0, 81, 0, { bust: true }), visit(2, 1, 501, 140),
    visit(3, 0, 81, 81, { checkout: true }), visit(4, 0, 501, 180, { leg: 2 })];
  assert.deepEqual(legBreakAdvice(rows, 1), { kind: 'busts', ownAverage: 40.5, opponentAverage: 140, busts: 1 });
  assert.equal(legBreakAdvice(rows, 3), null);
});

test('scout groups repeat opponents, excludes unknown names and only counts opponent visits', () => {
  const matches = [
    { opponent: ' Alex ', won: true, visits: [visit(1, 0, 501, 100), visit(2, 1, 501, 120)] },
    { opponent: 'alex', won: false, visits: [visit(1, 0, 501, 140), visit(2, 1, 501, 0, { bust: true })] },
    { opponent: 'Unknown', won: false, visits: [] },
  ];
  const scout = scoutOpponents(matches)[0];
  assert.equal(scout.name, 'Alex');
  assert.equal(scout.matches, 2);
  assert.equal(scout.wins, 1);
  assert.equal(scout.recordedVisits, 2);
  assert.equal(scout.average, 60);
  assert.equal(scout.highVisits, 1);
  assert.equal(scout.busts, 1);
});

test('old match records still supply an opponent record without a visit log', () => {
  const old = readScoutMatch({ mode: 'x01', opponent: 'Régi rivális', won: true });
  assert.deepEqual(old, { opponent: 'Régi rivális', won: true, visits: [] });
  assert.deepEqual(scoutOpponents([old])[0], {
    name: 'Régi rivális', matches: 1, wins: 1, recordedVisits: 0,
    average: null, highVisits: 0, busts: 0, checkouts: 0,
  });
  assert.equal(readScoutMatch({ mode: 'practice', opponent: 'Régi rivális' }), null);
  assert.equal(readScoutMatch({ mode: 'x01', opponent: 'Unknown' }), null);
});

test('winning recipe compares only X01 outcomes and leaves absent metrics out', () => {
  const match = (won, average, first9, mode = 'x01') => ({
    date: '2026-11-01', mode, won, average, first9Average: first9,
    checkoutRate: null, count100: won ? 3 : 1, count140: 0, count180: 0,
  });
  const recipe = winRecipe([match(true, 60, 70), match(true, 65, 75), match(false, 40, 50), match(false, 45, 55), match(true, 200, 200, 'practice')]);
  assert.equal(recipe.wins, 2);
  assert.equal(recipe.losses, 2);
  assert.equal(recipe.signals.find(signal => signal.kind === 'average')?.winnerValue, 62.5);
  assert.equal(recipe.signals.some(signal => signal.kind === 'checkout'), false);
  assert.deepEqual(winRecipe([match(true, 50, 50)]), { wins: 1, losses: 0, signals: [] });
});
