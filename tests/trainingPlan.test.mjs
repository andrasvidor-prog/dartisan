import test from 'node:test';
import assert from 'node:assert/strict';
import { completedPlanDays, createTrainingPlan, isTrainingPlan, suggestedPlanFocus } from '../lib/trainingPlan.ts';

test('a four-week plan has twenty frozen drills and can be restored', () => {
  const plan = createTrainingPlan([], new Date('2026-11-06T12:00:00Z'), 'plan-1');
  assert.equal(plan.focus, 'balanced');
  assert.equal(plan.days.length, 20);
  assert.equal(isTrainingPlan(JSON.parse(JSON.stringify(plan))), true);
  assert.equal(isTrainingPlan({ ...plan, days: [] }), false);
});

test('the plan focuses on the weakest measured skill', () => {
  const records = [
    { mode: 'double_ladder', hits: 2, darts: 20 },
    { mode: 'treble100', hits: 12, darts: 20 },
    { mode: 'bull30', hits: 10, darts: 20 },
  ];
  assert.equal(suggestedPlanFocus(records), 'doubles');
  const plan = createTrainingPlan(records, new Date('2026-11-06T12:00:00Z'), 'plan-2');
  assert.equal(plan.days[0], 'double_ladder');
  assert.equal(plan.days[5], 'random_doubles');
});

test('only a record from the current plan and assigned drill counts', () => {
  const plan = createTrainingPlan([], new Date('2026-11-06T12:00:00Z'), 'plan-3');
  const records = [
    { mode: plan.days[0], hits: 3, darts: 20, planId: 'plan-3', planDay: 0 },
    { mode: plan.days[1], hits: 3, darts: 20, planId: 'old', planDay: 1 },
    { mode: 'treble100', hits: 3, darts: 20, planId: 'plan-3', planDay: 2 },
  ];
  assert.deepEqual([...completedPlanDays(plan, records)], [0]);
});
