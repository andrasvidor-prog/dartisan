import { evaluateVisit, isValidDart, type Dart } from './x01.ts';

export type TrainingMode = 'double_ladder' | 'random_doubles' | 'treble100' | 'switch30' | 'bull30' | 'countup' | 'shanghai' | 'halveit' | 'baseball' | 'checkout170' | 'pressure60' | 'ladder121';

export type TrainingSession = {
  mode: TrainingMode;
  darts: Dart[];
  targets: number[];
  startedAt: string;
  planId?: string;
  planDay?: number;
};

export type TrainingResult = {
  score: number;
  hits: number;
  target: string;
  progress: number;
  total: number;
  finished: boolean;
  completed: boolean;
  detail: string;
  remainingSeconds: number | null;
};

export const TRAINING_MODES: TrainingMode[] = ['double_ladder', 'random_doubles', 'treble100', 'switch30', 'bull30', 'countup', 'shanghai', 'halveit', 'baseball', 'checkout170', 'ladder121', 'pressure60'];

export function trainingDartLimit(mode: TrainingMode): number {
  if (mode === 'double_ladder' || mode === 'random_doubles') return 60;
  if (mode === 'treble100') return 100;
  if (mode === 'switch30' || mode === 'bull30') return 30;
  if (mode === 'countup') return 24;
  if (mode === 'baseball') return 27;
  if (mode === 'checkout170') return 3;
  if (mode === 'ladder121') return 45;
  if (mode === 'pressure60') return 90;
  return 21;
}

export function trainingTimeLimit(mode: TrainingMode): number | null {
  return mode === 'random_doubles' ? 180 : mode === 'pressure60' ? 60 : null;
}

export function createTrainingSession(mode: TrainingMode, random = Math.random, plan?: { id: string; day: number }): TrainingSession {
  return {
    mode,
    darts: [],
    targets: mode === 'random_doubles' ? Array.from({ length: 20 }, () => Math.floor(random() * 20) + 1) : [],
    startedAt: new Date().toISOString(),
    ...(plan ? { planId: plan.id, planDay: plan.day } : {}),
  };
}

export function isTrainingSession(value: unknown): value is TrainingSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<TrainingSession>;
  return TRAINING_MODES.includes(session.mode as TrainingMode) &&
    Array.isArray(session.darts) && session.darts.length <= trainingDartLimit(session.mode as TrainingMode) && session.darts.every(isValidDart) &&
    Array.isArray(session.targets) && session.targets.every(n => Number.isInteger(n) && n >= 1 && n <= 20) &&
    (session.mode !== 'random_doubles' || session.targets.length === 20) &&
    (session.planId === undefined || (typeof session.planId === 'string' && session.planId.length > 0)) &&
    (session.planDay === undefined || (Number.isInteger(session.planDay) && session.planDay! >= 0 && session.planDay! < 20)) &&
    ((session.planId === undefined) === (session.planDay === undefined)) &&
    typeof session.startedAt === 'string' && !Number.isNaN(Date.parse(session.startedAt));
}

export function evaluateTraining(session: TrainingSession, now = new Date()): TrainingResult {
  const { mode, darts, targets } = session;
  let score = 0;
  let hits = 0;
  let targetIndex = 0;
  let completed = false;
  let detail = '';
  const limit = trainingDartLimit(mode);
  const timeLimit = trainingTimeLimit(mode);
  const remainingSeconds = timeLimit === null ? null : Math.max(0, timeLimit - Math.floor((now.getTime() - Date.parse(session.startedAt)) / 1000));
  let bust = false;
  let failed = false;
  let ladderRemaining = 121;
  let ladderStage = 0;

  if (mode === 'double_ladder' || mode === 'random_doubles') {
    for (const dart of darts) {
      const target = mode === 'double_ladder' ? targetIndex + 1 : targets[targetIndex];
      if (targetIndex < 20 && dart.val === target && dart.mult === 2) {
        targetIndex++;
        hits++;
        score += 2 * target;
      }
    }
    completed = targetIndex === 20;
    detail = `${targetIndex}/20 dupla`;
  } else if (mode === 'treble100') {
    for (const dart of darts) {
      score += dart.val * dart.mult;
      if (dart.val === 20 && dart.mult === 3) hits++;
    }
    completed = darts.length >= 100;
    detail = `${hits} × T20`;
  } else if (mode === 'switch30') {
    for (let i = 0; i < darts.length; i++) {
      const target = [20, 19, 18][i % 3];
      if (darts[i].val === target && darts[i].mult === 3) {
        hits++;
        score += target * 3;
      }
    }
    completed = darts.length >= 30;
    detail = `${hits}/30 célzott tripla`;
  } else if (mode === 'bull30') {
    for (const dart of darts) {
      if (dart.val === 25) {
        hits++;
        score += dart.mult === 2 ? 2 : 1;
      }
    }
    completed = darts.length >= 30;
    detail = `${hits}/30 bull • belső 2 pont`;
  } else if (mode === 'countup') {
    for (const dart of darts) {
      score += dart.val * dart.mult;
      if (dart.val > 0) hits++;
    }
    completed = darts.length >= 24;
    detail = `${Math.ceil(darts.length / 3)}/8 kör`;
  } else if (mode === 'baseball') {
    for (let round = 0; round < 9; round++) {
      const matching = darts.slice(round * 3, round * 3 + 3).filter(d => d.val === round + 1);
      hits += matching.length;
      score += matching.reduce((sum, dart) => sum + dart.mult, 0);
    }
    completed = darts.length >= 27;
    detail = `${Math.ceil(darts.length / 3)}/9 inning • sima 1, dupla 2, tripla 3 futás`;
  } else if (mode === 'checkout170') {
    if (darts.length > 0) {
      const visit = evaluateVisit(170, darts, { checkIn: 'single', checkout: 'double', opened: true });
      score = visit.scored;
      completed = visit.checkout;
      bust = visit.bust;
    }
    hits = darts.filter(d => d.val > 0).length;
    detail = completed ? `${darts.length} nyilas 170-es kiszálló` : bust ? 'Besokallás' : `${170 - score} pont maradt`;
  } else if (mode === 'ladder121') {
    let visitStart = 121;
    let visitDarts: Dart[] = [];
    let stageDarts = 0;
    for (const dart of darts) {
      if (ladderStage === 5 || failed) break;
      visitDarts.push(dart);
      stageDarts++;
      if (dart.val > 0) hits++;
      const visit = evaluateVisit(visitStart, visitDarts, { checkIn: 'single', checkout: 'double', opened: true });
      ladderRemaining = visitStart - visit.scored;
      if (visit.checkout) {
        ladderStage++;
        score = ladderStage;
        stageDarts = 0;
        visitDarts = [];
        visitStart = 121 + ladderStage;
        ladderRemaining = visitStart;
      } else if (visit.bust || visitDarts.length === 3) {
        visitStart = visit.bust ? visitStart : ladderRemaining;
        ladderRemaining = visitStart;
        visitDarts = [];
      }
      if (stageDarts >= 9) failed = true;
    }
    completed = ladderStage === 5;
    detail = completed ? 'Mind az öt kiszálló kész' : failed ? `${121 + ladderStage}: nem sikerült 9 nyílból` : `${ladderRemaining} pont maradt • ${ladderStage}/5 kiszálló`;
  } else if (mode === 'pressure60') {
    for (const dart of darts) {
      score += dart.val * dart.mult;
      if (dart.val > 0) hits++;
    }
    completed = remainingSeconds === 0 || darts.length >= limit;
    detail = `${score} pont 60 másodperc alatt`;
  } else if (mode === 'shanghai') {
    for (let round = 0; round < 7; round++) {
      const roundDarts = darts.slice(round * 3, round * 3 + 3);
      const matching = roundDarts.filter(d => d.val === round + 1);
      score += matching.reduce((sum, dart) => sum + dart.val * dart.mult, 0);
      hits += matching.length;
      if ([1, 2, 3].every(mult => matching.some(d => d.mult === mult))) {
        completed = true;
        detail = `Shanghai a(z) ${round + 1} szektorban`;
        break;
      }
    }
    if (!completed) {
      completed = darts.length >= 21;
      detail = `${Math.ceil(darts.length / 3)}/7 kör`;
    }
  } else {
    const halveTargets = [20, 19, 18, 17, 16, 15, 25];
    for (let round = 0; round < 7; round++) {
      const roundDarts = darts.slice(round * 3, round * 3 + 3);
      const matching = roundDarts.filter(d => d.val === halveTargets[round]);
      hits += matching.length;
      if (roundDarts.length === 3) {
        score = matching.length ? score + matching.reduce((sum, d) => sum + d.val * d.mult, 0) : Math.floor(score / 2);
      } else {
        score += matching.reduce((sum, d) => sum + d.val * d.mult, 0);
      }
    }
    completed = darts.length >= 21;
    detail = `${Math.ceil(darts.length / 3)}/7 kör • kihagyáskor felezés`;
  }

  let target = '';
  if (mode === 'double_ladder' || mode === 'random_doubles') target = targetIndex < 20 ? `D${mode === 'double_ladder' ? targetIndex + 1 : targets[targetIndex]}` : 'Kész';
  else if (mode === 'treble100') target = 'T20';
  else if (mode === 'switch30') target = `T${[20, 19, 18][darts.length % 3]}`;
  else if (mode === 'bull30') target = 'BULL';
  else if (mode === 'countup') target = 'Bármely szektor';
  else if (mode === 'baseball') target = `${Math.min(9, Math.floor(darts.length / 3) + 1)}`;
  else if (mode === 'checkout170') target = `${170 - score}`;
  else if (mode === 'ladder121') target = `${Math.min(125, 121 + ladderStage)}`;
  else if (mode === 'pressure60') target = 'Bármely szektor';
  else if (mode === 'shanghai') target = `${Math.min(7, Math.floor(darts.length / 3) + 1)}`;
  else target = Math.floor(darts.length / 3) >= 6 ? 'BULL' : `${[20, 19, 18, 17, 16, 15][Math.floor(darts.length / 3)]}`;

  if (completed) target = 'Kész';

  return { score, hits, target, progress: darts.length, total: limit,
    finished: completed || failed || bust || darts.length >= limit || remainingSeconds === 0, completed, detail, remainingSeconds };
}
