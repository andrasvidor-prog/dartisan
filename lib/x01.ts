export type Dart = { val: number; mult: 1 | 2 | 3 };
export type EntryRule = 'single' | 'double' | 'master';
export type CheckoutRule = 'single' | 'double' | 'master';

export type VisitResult = {
  remaining: number;
  scored: number;
  opened: boolean;
  bust: boolean;
  checkout: boolean;
  dartsUsed: number;
};

export function isValidDart(dart: Dart): boolean {
  if (!Number.isInteger(dart.val) || !Number.isInteger(dart.mult)) return false;
  if (dart.val === 0) return dart.mult === 1;
  if (dart.val === 25) return dart.mult === 1 || dart.mult === 2;
  return dart.val >= 1 && dart.val <= 20 && dart.mult >= 1 && dart.mult <= 3;
}

export function isOpeningDart(dart: Dart, rule: EntryRule): boolean {
  return rule === 'single' || (dart.val > 0 && (dart.mult === 2 || (rule === 'master' && dart.mult === 3)));
}

export function isCheckoutDart(dart: Dart, rule: CheckoutRule): boolean {
  return dart.val > 0 && (rule === 'single' || dart.mult === 2 || (rule === 'master' && dart.mult === 3));
}

export function evaluateVisit(
  startingScore: number,
  darts: Dart[],
  rules: { checkIn: EntryRule; checkout: CheckoutRule; opened: boolean },
): VisitResult {
  if (!Number.isInteger(startingScore) || startingScore < 1 || darts.length < 1 || darts.length > 3 || !darts.every(isValidDart)) {
    throw new Error('Invalid X01 visit');
  }
  let remaining = startingScore;
  let opened = rules.opened || rules.checkIn === 'single';
  for (let i = 0; i < darts.length; i++) {
    const dart = darts[i];
    if (!opened && isOpeningDart(dart, rules.checkIn)) opened = true;
    if (opened) remaining -= dart.val * dart.mult;
    const checkout = remaining === 0 && isCheckoutDart(dart, rules.checkout);
    const bust = remaining < 0 || (remaining === 0 && !checkout) ||
      (remaining === 1 && rules.checkout !== 'single');
    if (bust) return { remaining: startingScore, scored: 0, opened, bust: true, checkout: false, dartsUsed: i + 1 };
    if (checkout) return { remaining: 0, scored: startingScore, opened, bust: false, checkout: true, dartsUsed: i + 1 };
  }
  return { remaining, scored: startingScore - remaining, opened, bust: false, checkout: false, dartsUsed: darts.length };
}

export function previewRemainingScore(
  startingScore: number,
  darts: Dart[],
  rules: { checkIn: EntryRule; checkout: CheckoutRule; opened: boolean },
): number {
  return darts.length === 0 ? startingScore : evaluateVisit(startingScore, darts, rules).remaining;
}

const ALL_DARTS: Dart[] = [
  { val: 0, mult: 1 },
  ...Array.from({ length: 20 }, (_, i) => [1, 2, 3].map(mult => ({ val: i + 1, mult: mult as 1 | 2 | 3 }))).flat(),
  { val: 25, mult: 1 }, { val: 25, mult: 2 },
];

export function canScoreInDarts(points: number, darts: 1 | 2 | 3): boolean {
  if (!Number.isInteger(points) || points < 0 || points > darts * 60) return false;
  const scores = [...new Set(ALL_DARTS.map(dart => dart.val * dart.mult))];
  if (darts === 1) return scores.includes(points);
  if (darts === 2) return scores.some(first => scores.includes(points - first));
  return scores.some(first => scores.some(second => scores.includes(points - first - second)));
}

export function canCheckoutInDarts(points: number, darts: 1 | 2 | 3, rule: CheckoutRule): boolean {
  if (!Number.isInteger(points) || points < 1 || points > darts * 60) return false;
  return ALL_DARTS.some(last => {
    if (!isCheckoutDart(last, rule)) return false;
    const preceding = points - last.val * last.mult;
    return darts === 1 ? preceding === 0 : canScoreInDarts(preceding, (darts - 1) as 1 | 2);
  });
}
