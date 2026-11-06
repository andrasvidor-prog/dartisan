import { isValidDart, type Dart } from './x01.ts';

export type TrainingMode = 'double_ladder' | 'random_doubles' | 'treble100' | 'switch30' | 'bull30' | 'countup' | 'shanghai' | 'halveit';

export type TrainingSession = {
  mode: TrainingMode;
  darts: Dart[];
  targets: number[];
  startedAt: string;
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
};

export const TRAINING_MODES: TrainingMode[] = ['double_ladder', 'random_doubles', 'treble100', 'switch30', 'bull30', 'countup', 'shanghai', 'halveit'];

export function createTrainingSession(mode: TrainingMode, random = Math.random): TrainingSession {
  return {
    mode,
    darts: [],
    targets: mode === 'random_doubles' ? Array.from({ length: 20 }, () => Math.floor(random() * 20) + 1) : [],
    startedAt: new Date().toISOString(),
  };
}

export function isTrainingSession(value: unknown): value is TrainingSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<TrainingSession>;
  return TRAINING_MODES.includes(session.mode as TrainingMode) &&
    Array.isArray(session.darts) && session.darts.length <= 100 && session.darts.every(isValidDart) &&
    Array.isArray(session.targets) && session.targets.every(n => Number.isInteger(n) && n >= 1 && n <= 20) &&
    (session.mode !== 'random_doubles' || session.targets.length === 20) &&
    typeof session.startedAt === 'string' && !Number.isNaN(Date.parse(session.startedAt));
}

export function evaluateTraining(session: TrainingSession): TrainingResult {
  const { mode, darts, targets } = session;
  let score = 0;
  let hits = 0;
  let targetIndex = 0;
  let completed = false;
  let detail = '';
  const limit = mode === 'double_ladder' || mode === 'random_doubles' ? 60 :
    mode === 'treble100' ? 100 : mode === 'switch30' || mode === 'bull30' ? 30 :
    mode === 'countup' ? 24 : 21;

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
  else if (mode === 'shanghai') target = `${Math.min(7, Math.floor(darts.length / 3) + 1)}`;
  else target = Math.floor(darts.length / 3) >= 6 ? 'BULL' : `${[20, 19, 18, 17, 16, 15][Math.floor(darts.length / 3)]}`;

  if (completed) target = 'Kész';

  return { score, hits, target, progress: darts.length, total: limit,
    finished: completed || darts.length >= limit, completed, detail };
}
