import test from 'node:test';
import assert from 'node:assert/strict';
import { questsFor, readQuestProgress, recordQuestMatch } from '../lib/quests.ts';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test('a completed match updates daily and weekly quests only once', () => {
  const storage = memoryStorage();
  const date = new Date(2026, 10, 4, 20);
  const match = { matchId: '11111111-1111-4111-8111-111111111111', won: true,
    againstBot: true, count140: 2, count180: 1, bestLegDarts: 12 };
  recordQuestMatch(storage, match, date);
  recordQuestMatch(storage, match, date);
  const quests = questsFor(readQuestProgress(storage, date), 'hu');
  assert.deepEqual(quests.daily.map(q => q.current), [3, 1, 1]);
  assert.deepEqual(quests.weekly.map(q => q.current), [1, 1]);
  assert.equal(quests.daily[0].completed, true);
});

test('daily counters reset at midnight while weekly counters last until Monday', () => {
  const storage = memoryStorage();
  const wednesday = new Date(2026, 10, 4, 20);
  recordQuestMatch(storage, { matchId: '22222222-2222-4222-8222-222222222222', won: true,
    againstBot: false, count140: 0, count180: 0, bestLegDarts: null }, wednesday);
  const thursday = questsFor(readQuestProgress(storage, new Date(2026, 10, 5, 10)), 'en');
  assert.equal(thursday.daily[2].current, 0);
  assert.equal(thursday.weekly[0].current, 1);
  const monday = questsFor(readQuestProgress(storage, new Date(2026, 10, 9, 10)), 'en');
  assert.equal(monday.weekly[0].current, 0);
});
