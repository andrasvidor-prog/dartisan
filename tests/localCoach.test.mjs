import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDartsDna } from '../lib/dartsDna.ts';
import { createLocalNarrative } from '../lib/localCoach.ts';

test('local coach reports missing match history without making up results', () => {
  const dna = buildDartsDna([], []);
  for (const mode of ['tactics', 'broadcast', 'rival']) {
    assert.match(createLocalNarrative(mode, 'hu', dna), /nincs mentett meccsed/);
  }
});

test('local coach uses recorded figures and offers an achievable challenge in both languages', () => {
  const dna = buildDartsDna(Array.from({ length: 4 }, () => ({
    won: true, average: 52, first9Average: 47, checkoutRate: 0.2,
    count100: 1, count140: 0, count180: 0,
  })), []);
  assert.match(createLocalNarrative('tactics', 'hu', dna), /52/);
  assert.match(createLocalNarrative('tactics', 'hu', dna), /dupla kiszállók/);
  assert.match(createLocalNarrative('broadcast', 'en', dna), /4 matches/);
  assert.match(createLocalNarrative('rival', 'hu', dna), /55 pontot/);
});

test('local coach recommends a full-match drill when scoring is already strong', () => {
  const dna = buildDartsDna(Array.from({ length: 9 }, () => ({
    won: true, average: 96, first9Average: 112, checkoutRate: 1,
    count100: 3, count140: 1, count180: 0,
  })), []);
  assert.match(createLocalNarrative('tactics', 'hu', dna), /meccsstabilitás/);
  assert.match(createLocalNarrative('tactics', 'hu', dna), /három 501-es leget/);
});
