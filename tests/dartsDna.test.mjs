import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDartsDna } from '../lib/dartsDna.ts';

test('early samples stay low confidence and never invent target accuracy', () => {
  const dna = buildDartsDna([
    { won: true, average: 54, first9Average: 63, checkoutRate: 0.5, count100: 2, count140: 1, count180: 0 },
  ], [{ target: 'D16', attempts: 3, hits: 3 }]);
  assert.equal(dna.confidence, 'low');
  assert.equal(dna.profile, 'builder');
  assert.equal(dna.strongestTarget, null);
  assert.equal(dna.weakestTarget, null);
  assert.equal(dna.momentum, null);
});

test('recent improvement and weak doubles are calculated from recorded evidence', () => {
  const recent = [62, 64, 61, 63, 65, 42, 44, 45, 43, 46];
  const dna = buildDartsDna(recent.map(average => ({
    won: average >= 60, average, first9Average: average - 2, checkoutRate: 0.2,
    count100: 1, count140: 0, count180: 0,
  })), [
    { target: 'D16', attempts: 20, hits: 12 },
    { target: 'D20', attempts: 20, hits: 3 },
  ]);
  assert.equal(dna.confidence, 'high');
  assert.equal(dna.focus, 'doubles');
  assert.equal(dna.momentum, 19);
  assert.equal(dna.strongestTarget?.target, 'D16');
  assert.equal(dna.weakestTarget?.target, 'D20');
});
