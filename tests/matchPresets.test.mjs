import test from 'node:test';
import assert from 'node:assert/strict';
import { bullOffWinner, isMatchPreset, readMatchPresets, writeMatchPresets } from '../lib/matchPresets.ts';

const preset = {
  id: 'abc', name: 'Master 701', startingScore: 701, setsToWin: 3, legsToWin: 5,
  checkIn: 'master', checkout: 'master', muteCaller: false,
  players: [
    { name: 'Anna', isBot: false, difficulty: 5, color: 'emerald' },
    { name: 'Bot', isBot: true, difficulty: 8, color: 'purple' },
  ],
};

test('custom rules survive local storage and reject invalid scores', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(isMatchPreset(preset), true);
  writeMatchPresets(storage, [preset]);
  assert.deepEqual(readMatchPresets(storage), [preset]);
  assert.equal(isMatchPreset({ ...preset, startingScore: 1002 }), false);
  assert.equal(isMatchPreset({ ...preset, checkIn: 'impossible' }), false);
});

test('bull-off needs a unique closest dart', () => {
  assert.equal(bullOffWinner([1, 0, 2]), 1);
  assert.equal(bullOffWinner([0, 0, 2]), null);
  assert.equal(bullOffWinner([null, 1]), null);
});
