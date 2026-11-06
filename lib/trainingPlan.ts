import type { TrainingMode } from './training.ts';

export type PlanFocus = 'balanced' | 'doubles' | 'scoring' | 'bull';
export type PlanRecord = { mode: TrainingMode; hits: number; darts: number; planId?: string; planDay?: number };
export type TrainingPlan = { id: string; createdAt: string; focus: PlanFocus; days: TrainingMode[] };

const BASE_WEEKS: TrainingMode[][] = [
  ['countup', 'double_ladder', 'bull30', 'switch30', 'checkout170'],
  ['pressure60', 'random_doubles', 'shanghai', 'treble100', 'ladder121'],
  ['baseball', 'halveit', 'bull30', 'switch30', 'checkout170'],
  ['countup', 'random_doubles', 'treble100', 'pressure60', 'ladder121'],
];

export function suggestedPlanFocus(records: PlanRecord[]): PlanFocus {
  const groups: { focus: PlanFocus; modes: TrainingMode[] }[] = [
    { focus: 'doubles', modes: ['double_ladder', 'random_doubles'] },
    { focus: 'scoring', modes: ['treble100', 'switch30'] },
    { focus: 'bull', modes: ['bull30'] },
  ];
  const observed = groups.map(group => {
    const recent = records.filter(record => group.modes.includes(record.mode) && record.darts > 0).slice(0, 5);
    const darts = recent.reduce((sum, record) => sum + record.darts, 0);
    return { focus: group.focus, rate: darts ? recent.reduce((sum, record) => sum + record.hits, 0) / darts : null };
  }).filter((item): item is { focus: PlanFocus; rate: number } => item.rate !== null);
  if (!observed.length) return 'balanced';
  observed.sort((a, b) => a.rate - b.rate);
  return observed[0].focus;
}

export function createTrainingPlan(records: PlanRecord[], now = new Date(), id = crypto.randomUUID()): TrainingPlan {
  const focus = suggestedPlanFocus(records);
  const days = BASE_WEEKS.map((week, index) => {
    const assigned = [...week];
    if (focus === 'doubles') {
      assigned[0] = index % 2 ? 'random_doubles' : 'double_ladder';
      assigned[3] = index % 2 ? 'double_ladder' : 'random_doubles';
    } else if (focus === 'scoring') {
      assigned[0] = index % 2 ? 'switch30' : 'treble100';
      assigned[3] = index % 2 ? 'pressure60' : 'countup';
    } else if (focus === 'bull') {
      assigned[0] = 'bull30';
      assigned[3] = index % 2 ? 'checkout170' : 'bull30';
    }
    return assigned;
  }).flat();
  return { id, createdAt: now.toISOString(), focus, days };
}

export function isTrainingPlan(value: unknown): value is TrainingPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Partial<TrainingPlan>;
  const modes = BASE_WEEKS.flat();
  return typeof plan.id === 'string' && plan.id.length > 0 &&
    typeof plan.createdAt === 'string' && !Number.isNaN(Date.parse(plan.createdAt)) &&
    ['balanced', 'doubles', 'scoring', 'bull'].includes(plan.focus ?? '') &&
    Array.isArray(plan.days) && plan.days.length === 20 && plan.days.every(mode => modes.includes(mode));
}

export function completedPlanDays(plan: TrainingPlan, records: PlanRecord[]): Set<number> {
  return new Set(records.filter(record => record.planId === plan.id && Number.isInteger(record.planDay) &&
    record.planDay! >= 0 && record.planDay! < 20 && record.mode === plan.days[record.planDay!]).map(record => record.planDay!));
}
