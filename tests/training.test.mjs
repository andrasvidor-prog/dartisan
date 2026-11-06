import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrainingSession, evaluateTraining, isTrainingSession } from '../lib/training.ts';

const hit = (val, mult = 1) => ({ val, mult });
const sessionWith = (mode, darts) => ({ ...createTrainingSession(mode, () => 0), darts });

test('double ladder advances only on the required double and completes at D20', () => {
  const first = evaluateTraining(sessionWith('double_ladder', [hit(1), hit(1, 2), hit(1, 2)]));
  assert.equal(first.target, 'D2');
  assert.equal(first.hits, 1);
  const complete = evaluateTraining(sessionWith('double_ladder', Array.from({ length: 20 }, (_, i) => hit(i + 1, 2))));
  assert.equal(complete.finished, true);
  assert.equal(complete.hits, 20);
});

test('random doubles use the saved sequence', () => {
  const session = createTrainingSession('random_doubles', () => 0.75);
  assert.equal(session.targets[0], 16);
  assert.equal(evaluateTraining({ ...session, darts: [hit(16, 2)] }).target, 'D16');
});

test('treble and bull drills count only intended hits', () => {
  const treble = evaluateTraining(sessionWith('treble100', [hit(20, 3), hit(20), hit(19, 3)]));
  assert.deepEqual([treble.hits, treble.score], [1, 137]);
  const bull = evaluateTraining(sessionWith('bull30', [hit(25), hit(25, 2), hit(20)]));
  assert.deepEqual([bull.hits, bull.score], [2, 3]);
});

test('Count-Up and Shanghai score full darts and target sectors', () => {
  const countup = evaluateTraining(sessionWith('countup', Array.from({ length: 24 }, () => hit(20, 3))));
  assert.equal(countup.score, 1440);
  assert.equal(countup.finished, true);
  const shanghai = evaluateTraining(sessionWith('shanghai', [hit(1), hit(1, 2), hit(1, 3)]));
  assert.equal(shanghai.score, 6);
  assert.equal(shanghai.finished, true);
  assert.match(shanghai.detail, /Shanghai/);
});

test('Halve-It halves after a missed three-dart round', () => {
  const darts = [hit(20), hit(20, 3), hit(0), hit(0), hit(0), hit(0)];
  const result = evaluateTraining(sessionWith('halveit', darts));
  assert.equal(result.score, 40);
  assert.equal(result.target, '18');
});

test('invalid saved sessions are rejected', () => {
  assert.equal(isTrainingSession({ ...createTrainingSession('countup'), darts: [hit(25, 3)] }), false);
  assert.equal(isTrainingSession({ ...createTrainingSession('random_doubles'), targets: [1] }), false);
});
