import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutRoutes, dartName } from '../lib/checkoutRoutes.ts';
import { evaluateVisit } from '../lib/x01.ts';
import { drillHit, drillResult, parseDrillTarget } from '../lib/targetDrill.ts';
import { buildDartsDna, aggregateDnaAims } from '../lib/dartsDna.ts';
import { localWeekStart, weeklyGoal } from '../lib/weeklyGoal.ts';
import { targetDrillHeatmapEvent, reverseHeatmapEvent } from '../lib/heatmapSync.ts';

test('checkout alternatives finish legally under the selected rule', () => {
  for (const rule of ['double', 'master', 'single']) {
    for (const score of [2, 40, 60, 121, 170]) {
      const result = checkoutRoutes(score, 3, rule);
      if (result.kind !== 'finish') continue;
      for (const route of result.routes) {
        assert.equal(evaluateVisit(score, route.darts, { checkIn: 'single', checkout: rule, opened: true }).checkout, true);
        assert.ok(route.darts.length <= 3);
      }
    }
  }
  assert.deepEqual(checkoutRoutes(170, 3, 'double').routes[0].darts.map(dartName), ['T20', 'T20', 'BULL']);
  assert.deepEqual(checkoutRoutes(40, 1, 'double').routes[0].darts.map(dartName), ['D20']);
});

test('unfinishable scores offer safe setup rather than an impossible checkout', () => {
  const result = checkoutRoutes(169, 3, 'double');
  assert.equal(result.kind, 'setup');
  assert.equal(result.routes[0].remaining, 40);
  assert.equal(result.routes[0].darts.some(dart => dart.mult === 2), false);
  assert.equal(result.routes[0].darts.reduce((sum, dart) => sum + dart.val * dart.mult, 0), 129);
  assert.equal(checkoutRoutes(1, 1, 'double').kind, 'none');
  assert.equal(checkoutRoutes(171, 3, 'double').kind, 'none');
});

test('every displayed route across the score range respects X01 scoring', () => {
  for (const rule of ['single', 'double', 'master']) {
    for (const dartsLeft of [1, 2, 3]) {
      for (let score = 1; score <= 170; score += 1) {
        const result = checkoutRoutes(score, dartsLeft, rule);
        for (const route of result.routes) {
          assert.ok(route.darts.length <= dartsLeft);
          const played = evaluateVisit(score, route.darts, { checkIn: 'single', checkout: rule, opened: true });
          assert.equal(played.bust, false, `${score} / ${dartsLeft} / ${rule}: ${route.darts.map(dartName)}`);
          assert.equal(played.checkout, result.kind === 'finish');
          assert.equal(played.remaining, route.remaining);
        }
      }
    }
  }
});

test('target drill distinguishes singles, doubles, trebles and bull rings', () => {
  assert.deepEqual(parseDrillTarget('D20'), { key: 'D20', val: 20, mult: 2 });
  assert.equal(parseDrillTarget('D21'), null);
  assert.equal(drillHit({ val: 20, mult: 1 }, parseDrillTarget('D20')), false);
  assert.equal(drillHit({ val: 20, mult: 2 }, parseDrillTarget('D20')), true);
  assert.equal(drillHit({ val: 25, mult: 1 }, parseDrillTarget('BULL')), true);
  assert.equal(drillHit({ val: 25, mult: 1 }, parseDrillTarget('50')), false);
  assert.deepEqual(drillResult([{ val: 20, mult: 2 }, { val: 20, mult: 1 }, { val: 20, mult: 2 }], parseDrillTarget('D20')),
    { throws: 3, hits: 2, accuracy: 67 });
});

test('target drill records one aimed attempt per dart and reverses an undo', () => {
  const hit = targetDrillHeatmapEvent('guest', 'default', 20, 3, 'T20');
  const miss = targetDrillHeatmapEvent('guest', 'default', 20, 1, 'T20');
  assert.equal(hit.source, 'training');
  assert.deepEqual([hit.attempts, hit.hits, miss.attempts, miss.hits], [1, 1, 1, 0]);
  assert.equal(reverseHeatmapEvent(hit).direction, -1);
  assert.equal(targetDrillHeatmapEvent('guest', 'default', 0, 1, 'T20').unlocatedMisses, 1);
  assert.equal(targetDrillHeatmapEvent('guest', 'default', 25, 1, 'BULL').hits, 1);
});

test('aim accuracy combines measurements across setups before identifying a weak target', () => {
  assert.deepEqual(aggregateDnaAims([{ target: 'D20', attempts: 5, hits: 1 }, { target: 'D20', attempts: 5, hits: 2 }]),
    [{ target: 'D20', attempts: 10, hits: 3 }]);
  const dna = buildDartsDna([], [
    { target: 'D16', attempts: 10, hits: 7 },
    { target: 'D20', attempts: 5, hits: 1 }, { target: 'D20', attempts: 5, hits: 2 },
  ]);
  assert.equal(dna.weakestTarget?.target, 'D20');
  assert.equal(dna.weakestTarget?.attempts, 10);
});

test('weekly goal counts completed X01 matches in the current local week', () => {
  const now = new Date(2026, 10, 14, 12);
  assert.equal(localWeekStart(now), '2026-11-09');
  const baseline = Array.from({ length: 4 }, () => ({ won: true, average: 50, first9Average: 50,
    checkoutRate: 0.2, count100: 0, count140: 0, count180: 0 }));
  const prior = baseline.map((match, index) => ({ ...match, mode: 'x01', date: new Date(2026, 10, index + 1, 10).toISOString() }));
  const recent = [
    { ...baseline[0], mode: 'x01', date: new Date(2026, 10, 10, 10).toISOString(), average: 55 },
    { ...baseline[0], mode: 'x01', date: new Date(2026, 10, 12, 10).toISOString(), average: 56 },
    { ...baseline[0], mode: 'practice', date: new Date(2026, 10, 13, 10).toISOString(), average: 80 },
    { ...baseline[0], mode: 'x01', date: new Date(2026, 10, 8, 10).toISOString(), average: 90 },
  ];
  const goal = weeklyGoal([...recent, ...prior], now);
  assert.equal(goal.kind, 'checkout');
  assert.equal(goal.progress, 0);
  const scoringPrior = prior.map(match => ({ ...match, checkoutRate: 0.5 }));
  assert.equal(weeklyGoal([...recent.slice(0, 3), ...scoringPrior], now).progress, 2);
  assert.equal(weeklyGoal([...recent, { ...recent[0], average: 100 }, ...prior], now).threshold, goal.threshold);
});
