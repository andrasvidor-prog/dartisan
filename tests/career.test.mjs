import test from 'node:test';
import assert from 'node:assert/strict';
import { nextCareerStage } from '../lib/career.ts';

test('winning advances once, losing or replaying an old stage does not skip', () => {
  assert.equal(nextCareerStage(0, 0, 0), 1);
  assert.equal(nextCareerStage(1, 0, 0), 1);
  assert.equal(nextCareerStage(1, 1, 1), 1);
  assert.equal(nextCareerStage(1, 1, 0), 2);
  assert.equal(nextCareerStage(14, 14, 0), 15);
});
