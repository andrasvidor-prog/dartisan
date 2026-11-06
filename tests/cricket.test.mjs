import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCricketDart, cricketWinner, CRICKET_TARGETS } from '../lib/cricket.ts';

const player = (id, score = 0, closed = []) => ({
  id, name: `Player ${id + 1}`, color: 'emerald', score,
  marks: Object.fromEntries(CRICKET_TARGETS.map(target => [target, closed.includes(target) ? 3 : 0])),
});

test('standard Cricket awards overflow to the shooter only', () => {
  const players = [player(0, 0, [20]), player(1)];
  const updated = applyCricketDart(players, 0, 20, 3, 'standard');
  assert.deepEqual(updated.map(item => item.score), [60, 0]);
  assert.deepEqual(players.map(item => item.score), [0, 0]);
});

test('cut-throat Cricket awards overflow to each open opponent', () => {
  const players = [player(0, 0, [20]), player(1), player(2, 0, [20])];
  const updated = applyCricketDart(players, 0, 20, 2, 'cutthroat');
  assert.deepEqual(updated.map(item => item.score), [0, 40, 0]);
  const closing = applyCricketDart([player(0, 0, []), player(1)], 0, 20, 3, 'cutthroat');
  assert.equal(closing[1].score, 0);
});

test('winner needs all targets closed and correct score direction', () => {
  const all = [...CRICKET_TARGETS];
  assert.equal(cricketWinner([player(0, 40, all), player(1, 60, all)], 'standard')?.id, 1);
  assert.equal(cricketWinner([player(0, 40, all), player(1, 60, all)], 'cutthroat')?.id, 0);
  assert.equal(cricketWinner([player(0, 40, [20]), player(1, 60, all)], 'cutthroat'), null);
});
