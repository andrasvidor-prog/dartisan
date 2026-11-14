import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedVisits, readMatchVisits, recordVisit, replayFrame, turningPoints } from '../lib/matchReplay.ts';

const visit = (scoreBefore, points, leg = 1, overrides = {}) => ({
  leg, scoreBefore, points, enteredPoints: points, darts: 3,
  bust: false, checkout: false, hits: [], ...overrides,
});

test('visits keep a shared match order across both players and legs', () => {
  const players = [{ visitLog: [] }, { visitLog: [] }];
  recordVisit(players, 0, visit(501, 100));
  recordVisit(players, 1, visit(501, 60));
  recordVisit(players, 0, visit(401, 140));
  recordVisit(players, 1, visit(501, 45, 2));
  assert.deepEqual(orderedVisits(players).map(row => [row.order, row.playerId, row.leg]),
    [[1, 0, 1], [2, 1, 1], [3, 0, 1], [4, 1, 2]]);
  assert.deepEqual(replayFrame(orderedVisits(players), 3, 501).scores, [261, 441]);
  assert.deepEqual(replayFrame(orderedVisits(players), 4, 501).scores, [501, 456]);
});

test('undoing a visit and recording another reuses the correct position', () => {
  const players = [{ visitLog: [] }, { visitLog: [] }];
  recordVisit(players, 0, visit(501, 100));
  players[0].visitLog.pop();
  recordVisit(players, 0, visit(501, 85));
  assert.equal(orderedVisits(players)[0].order, 1);
  assert.equal(orderedVisits(players)[0].points, 85);
});

test('replay honors busts, checkouts and finds distinct turning points', () => {
  const players = [{ visitLog: [] }, { visitLog: [] }];
  recordVisit(players, 0, visit(501, 140));
  recordVisit(players, 1, visit(501, 60));
  recordVisit(players, 0, visit(81, 0, 1, { bust: true, enteredPoints: 82 }));
  recordVisit(players, 0, visit(81, 81, 1, { checkout: true, darts: 2 }));
  const rows = orderedVisits(players);
  assert.deepEqual(replayFrame(rows, 3, 501).scores, [81, 441]);
  assert.deepEqual(replayFrame(rows, 4, 501).scores, [0, 441]);
  assert.deepEqual(turningPoints(rows).map(item => item.kind), ['checkout', 'high', 'bust']);
});

test('stored replay rejects malformed and impossible rows', () => {
  const good = { ...visit(501, 100), order: 1, playerId: 0 };
  assert.deepEqual(readMatchVisits([good, { ...good, order: 2, points: 600 },
    { ...good, order: 3, checkout: true }, { ...good, order: 4, darts: 0 }]), [good]);
});
