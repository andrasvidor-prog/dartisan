import test from 'node:test';
import assert from 'node:assert/strict';
import { profileMatchTotals } from '../lib/profileMatchTotals.ts';

test('saved wins repair a stale zero-win profile without lowering larger lifetime counts', () => {
  assert.deepEqual(profileMatchTotals({ matchesPlayed: 9, matchesWon: 0 }, { matches: 9, wins: 7 }),
    { matches: 9, wins: 7, winRate: 78 });
  assert.deepEqual(profileMatchTotals({ matchesPlayed: 100, matchesWon: 55 }, { matches: 9, wins: 7 }),
    { matches: 100, wins: 55, winRate: 55 });
  assert.deepEqual(profileMatchTotals({ matchesPlayed: 3, matchesWon: 0 }, { matches: 9, wins: 7 }),
    { matches: 9, wins: 7, winRate: 78 });
});

test('invalid and inconsistent counters cannot produce more wins than matches', () => {
  assert.deepEqual(profileMatchTotals({ matchesPlayed: -1, matchesWon: NaN }, { matches: 2, wins: 7 }),
    { matches: 2, wins: 2, winRate: 100 });
  assert.deepEqual(profileMatchTotals({ matchesPlayed: 0, matchesWon: 0 }, null),
    { matches: 0, wins: 0, winRate: 0 });
});
