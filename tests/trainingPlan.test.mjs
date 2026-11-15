import test from 'node:test';
import assert from 'node:assert/strict';
import { completedPlanDays, createTrainingPlan, isTrainingPlan, replanTrainingPlan, suggestedPlanFocus } from '../lib/trainingPlan.ts';

test('a four-week plan has twenty frozen drills and can be restored', () => {
  const plan = createTrainingPlan([], new Date('2026-11-06T12:00:00Z'), 'plan-1');
  assert.equal(plan.focus, 'balanced');
  assert.equal(plan.days.length, 20);
  assert.equal(isTrainingPlan(JSON.parse(JSON.stringify(plan))), true);
  assert.equal(isTrainingPlan({ ...plan, days: [] }), false);
  assert.equal(plan.days.includes('adaptive30'), true);
  assert.equal(isTrainingPlan({ ...plan, days: plan.days.map(mode => mode === 'adaptive30' ? 'switch30' : mode) }), true);
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

test('match profile supplies an initial focus when aimed drill data is missing', () => {
  const plan = createTrainingPlan([], new Date('2026-11-06T12:00:00Z'), 'plan-4', 'scoring');
  assert.equal(plan.focus, 'scoring');
  assert.equal(plan.days[0], 'treble100');
  assert.equal(suggestedPlanFocus([], 'doubles'), 'doubles');
});

test('replanning changes only future weeks and keeps completed work valid', () => {
  const plan = createTrainingPlan([], new Date('2026-11-06T12:00:00Z'), 'plan-5');
  const records = [
    { mode: 'double_ladder', hits: 1, darts: 20, planId: plan.id, planDay: 1 },
    { mode: 'bull30', hits: 15, darts: 20, planId: plan.id, planDay: 2 },
    { mode: 'switch30', hits: 12, darts: 20, planId: plan.id, planDay: 3 },
  ];
  assert.equal(replanTrainingPlan(plan, records.slice(0, 2)), plan);
  const revised = replanTrainingPlan(plan, records);
  assert.equal(revised.id, plan.id);
  assert.equal(revised.focus, 'doubles');
  assert.deepEqual(revised.days.slice(0, 5), plan.days.slice(0, 5));
  assert.notDeepEqual(revised.days.slice(5), plan.days.slice(5));
  assert.deepEqual([...completedPlanDays(revised, records)], [1, 2, 3]);
  assert.equal(isTrainingPlan(revised), true);
});
