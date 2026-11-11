import test from 'node:test';
import assert from 'node:assert/strict';
import { matchHistoryCsv, matchTrend, recordedMatchScore } from '../lib/matchAnalytics.ts';

const row = (average, first9Average, opponent = 'Rival') => ({
  date: '2026-11-06T12:00:00.000Z', mode: 'local', opponent, won: true, score: '3 - 1',
  average, first9Average, checkoutPct: 25, bestLegDarts: 18, count100: 2, count140: 1, count180: 0,
});

test('match trend follows chronological order and measures variation', () => {
  const trend = matchTrend([row(60, 70), row(50, 55), row(40, 45)]);
  assert.deepEqual(trend.averages, [40, 50, 60]);
  assert.deepEqual(trend.first9, [45, 55, 70]);
  assert.equal(trend.change, 20);
  assert.ok(Math.abs(trend.deviation - 8.165) < 0.01);
});

test('CSV includes match metrics and neutralizes spreadsheet formulas in names', () => {
  const csv = matchHistoryCsv([row(60, 70, '=HYPERLINK("bad")')]);
  assert.ok(csv.startsWith('\uFEFFdate,mode'));
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"60","70","25"/);
});

test('legacy reset leg scores are not shown as a drawn darts match', () => {
  assert.equal(recordedMatchScore('0 - 0'), '—');
  assert.equal(recordedMatchScore('0-0'), '—');
  assert.equal(recordedMatchScore('1 - 0'), '1 - 0');
});
