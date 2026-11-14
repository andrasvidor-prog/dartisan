export type DnaMatch = {
  won: boolean;
  average: number | null;
  first9Average: number | null;
  checkoutRate: number | null;
  count100: number;
  count140: number;
  count180: number;
};

export type DnaAim = { target: string; attempts: number; hits: number };
export type DnaFocus = 'doubles' | 'opening' | 'scoring';

export type DartsDna = {
  matches: number;
  average: number | null;
  first9Average: number | null;
  checkoutRate: number | null;
  winRate: number | null;
  momentum: number | null;
  consistency: number | null;
  highVisits: number;
  strongestTarget: DnaAim | null;
  weakestTarget: DnaAim | null;
  focus: DnaFocus;
  profile: 'quickstarter' | 'finisher' | 'scorer' | 'builder';
  confidence: 'low' | 'medium' | 'high';
};

const finite = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0;

const average = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

const round = (value: number | null, digits = 1) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

export function buildDartsDna(matches: DnaMatch[], aims: DnaAim[]): DartsDna {
  const recent = matches.slice(0, 20);
  const validAverages = recent.map(match => match.average).filter(finite);
  const first9 = recent.map(match => match.first9Average).filter(finite);
  const checkout = recent.map(match => match.checkoutRate).filter(finite);
  const avg = average(validAverages);
  const first9Avg = average(first9);
  const checkoutRate = average(checkout);
  const firstFive = validAverages.slice(0, 5);
  const previousFive = validAverages.slice(5, 10);
  const momentum = firstFive.length >= 2 && previousFive.length >= 2
    ? average(firstFive)! - average(previousFive)! : null;
  const consistency = validAverages.length >= 3 && avg !== null
    ? Math.sqrt(average(validAverages.map(value => (value - avg) ** 2))!) : null;

  const measured = aims.filter(item => /^([SDT](?:[1-9]|1[0-9]|20)|25|50|BULL)$/.test(item.target) &&
    Number.isFinite(item.attempts) && Number.isFinite(item.hits) && item.attempts >= 8 &&
    item.hits >= 0 && item.hits <= item.attempts);
  const byAccuracy = [...measured].sort((a, b) =>
    b.hits / b.attempts - a.hits / a.attempts || b.attempts - a.attempts);
  const strongestTarget = byAccuracy[0] || null;
  const weakestTarget = byAccuracy.length >= 2 ? byAccuracy.at(-1)! : null;

  const focus: DnaFocus = checkoutRate !== null && checkoutRate < 0.25 && checkout.length >= 2
    ? 'doubles'
    : avg !== null && first9Avg !== null && first9Avg < avg - 5 && first9.length >= 2
      ? 'opening' : 'scoring';
  const profile = avg !== null && first9Avg !== null && first9Avg >= avg + 6 && first9.length >= 3
    ? 'quickstarter'
    : checkoutRate !== null && checkoutRate >= 0.38 && checkout.length >= 3
      ? 'finisher'
      : avg !== null && avg >= 60 && validAverages.length >= 3
        ? 'scorer' : 'builder';

  return {
    matches: recent.length,
    average: round(avg), first9Average: round(first9Avg),
    checkoutRate: round(checkoutRate === null ? null : checkoutRate * 100, 0),
    winRate: recent.length ? round(recent.filter(match => match.won).length / recent.length * 100, 0) : null,
    momentum: round(momentum), consistency: round(consistency),
    highVisits: recent.reduce((sum, match) => sum +
      Math.max(0, match.count100 || 0) + Math.max(0, match.count140 || 0) + Math.max(0, match.count180 || 0), 0),
    strongestTarget, weakestTarget, focus, profile,
    confidence: recent.length >= 10 ? 'high' : recent.length >= 4 ? 'medium' : 'low',
  };
}
