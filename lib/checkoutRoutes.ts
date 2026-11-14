import { isCheckoutDart, type CheckoutRule, type Dart } from './x01.ts';

export type Route = { darts: Dart[]; remaining: number; risk: 'low' | 'medium' | 'high' };
export type RouteResult = { kind: 'finish' | 'setup' | 'none'; routes: Route[] };

const darts: Dart[] = [
  ...Array.from({ length: 20 }, (_, index) => [1, 2, 3].map(mult => ({ val: index + 1, mult: mult as 1 | 2 | 3 }))).flat(),
  { val: 25, mult: 1 }, { val: 25, mult: 2 },
];
const scoreOf = (dart: Dart) => dart.val * dart.mult;
const byScore = new Map<number, Dart[]>();
for (const dart of darts) byScore.set(scoreOf(dart), [...byScore.get(scoreOf(dart)) || [], dart]);
const setupTargets = [40, 32, 36, 24, 16, 20];
const favoriteFinishes = [40, 32, 36, 28, 24, 16, 20, 8, 50];

export function dartName(dart: Dart): string {
  return dart.val === 25 ? dart.mult === 2 ? 'BULL' : '25' : `${dart.mult === 3 ? 'T' : dart.mult === 2 ? 'D' : 'S'}${dart.val}`;
}

function riskOf(route: Dart[]): Route['risk'] {
  const difficulty = route.reduce((sum, dart, index) => sum +
    (dart.val === 25 ? 3 : dart.mult === 3 ? 2 : dart.mult === 2 && index < route.length - 1 ? 3 : 0), 0);
  return difficulty >= 4 ? 'high' : difficulty >= 2 ? 'medium' : 'low';
}

function rank(route: Dart[], remaining: number): number {
  const total = route.reduce((sum, dart) => sum + scoreOf(dart), remaining);
  const setup = remaining === 0 ? 0 : 20 + setupTargets.indexOf(remaining) * 2;
  const difficulty = route.reduce((sum, dart, index) => sum +
    (index === route.length - 1 ? 0 : dart.val === 25 ? 8 : dart.mult === 2 ? 15 :
      dart.mult === 3 ? dart.val >= 18 ? 2 : dart.val >= 15 ? 4 : dart.val >= 10 ? 8 : 14 : 0), 0);
  const final = route.at(-1);
  const preferredFinish = remaining === 0 && final?.mult === 2
    ? (favoriteFinishes.includes(scoreOf(final)) ? favoriteFinishes.indexOf(scoreOf(final)) : 12) : 0;
  const opener = total > 100 ? route[0].val === 20 && route[0].mult === 3 ? -6 : route[0].mult === 1 ? 4 : 0 : 0;
  const setupFinal = remaining > 0 && final ? final.mult === 3 ? 6 : final.val === 25 ? 3 : 0 : 0;
  return setup + difficulty + route.length * 2 + preferredFinish + opener + setupFinal;
}

function routesFor(total: number, maxDarts: 1 | 2 | 3, lastDarts: Dart[], remaining: number): Route[] {
  const required = total - remaining;
  const candidates: Route[] = [];
  const add = (path: Dart[]) => {
    if (path.length > maxDarts || path.reduce((sum, dart) => sum + scoreOf(dart), 0) !== required) return;
    if (remaining > 0 && path.some(dart => dart.mult === 2)) return;
    candidates.push({ darts: path, remaining, risk: riskOf(path) });
  };
  for (const last of lastDarts) {
    if (scoreOf(last) === required) add([last]);
    if (maxDarts >= 2) for (const first of byScore.get(required - scoreOf(last)) || []) add([first, last]);
    if (maxDarts === 3) for (const first of darts) {
      for (const second of byScore.get(required - scoreOf(first) - scoreOf(last)) || []) add([first, second, last]);
    }
  }
  const seen = new Set<string>();
  return candidates.sort((a, b) => rank(a.darts, a.remaining) - rank(b.darts, b.remaining)).filter(route => {
    const key = route.darts.map(dartName).join(' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function checkoutRoutes(score: number, maxDarts: 1 | 2 | 3, rule: CheckoutRule = 'double'): RouteResult {
  if (!Number.isInteger(score) || score < 1 || score > 170 || ![1, 2, 3].includes(maxDarts)) return { kind: 'none', routes: [] };
  const finish = routesFor(score, maxDarts, darts.filter(dart => isCheckoutDart(dart, rule)), 0);
  if (finish.length) {
    const choices = [finish[0]];
    const differentLast = finish.find(route => dartName(route.darts.at(-1)!) !== dartName(choices[0].darts.at(-1)!));
    if (differentLast) choices.push(differentLast);
    const alternative = finish.find(route => !choices.includes(route) &&
      rank(route.darts, 0) <= rank(choices[0].darts, 0) + 8);
    if (alternative) choices.push(alternative);
    return { kind: 'finish', routes: choices.slice(0, 3) };
  }
  const setups = setupTargets.flatMap(target => target < score ? routesFor(score, maxDarts, darts, target) : []);
  setups.sort((a, b) => rank(a.darts, a.remaining) - rank(b.darts, b.remaining));
  const chosen: Route[] = [];
  for (const route of setups) {
    if (chosen.some(item => item.remaining === route.remaining)) continue;
    chosen.push(route);
    if (chosen.length === 3) break;
  }
  return { kind: chosen.length ? 'setup' : 'none', routes: chosen };
}
