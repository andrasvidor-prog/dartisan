import { checkoutRoutes, type Route } from './checkoutRoutes.ts';
import { readMatchVisits, visitRemaining, type MatchVisit } from './matchReplay.ts';
import type { CheckoutRule } from './x01.ts';
import type { DatedDnaMatch } from './weeklyGoal.ts';

export type WhatIf = {
  visit: MatchVisit;
  actualRemaining: number;
  route: Route;
};

// A hypothetical route assumes that every suggested target is hit. It never
// changes the saved match or estimates a win probability from missing aim data.
export function whatIfRoute(visits: MatchVisit[], position: number, checkout: CheckoutRule): WhatIf | null {
  const selected = visits.slice(0, position > 0 ? position : visits.length);
  for (let index = selected.length - 1; index >= 0; index--) {
    const visit = selected[index];
    if (visit.playerId !== 0 || visit.checkout || visit.scoreBefore > 170) continue;
    const options = checkoutRoutes(visit.scoreBefore, visit.darts as 1 | 2 | 3, checkout);
    if (options.routes.length && options.routes[0].remaining < visitRemaining(visit)) return {
      visit,
      actualRemaining: visitRemaining(visit),
      route: options.routes[0],
    };
  }
  return null;
}

export type LegAdvice = { kind: 'busts' | 'scoring' | 'protect' | 'keep';
  ownAverage: number; opponentAverage: number | null; busts: number };

export function legBreakAdvice(visits: MatchVisit[], leg: number): LegAdvice | null {
  const own = visits.filter(visit => visit.leg === leg && visit.playerId === 0);
  if (!own.length) return null;
  const other = visits.filter(visit => visit.leg === leg && visit.playerId === 1);
  const average = (rows: MatchVisit[]) => {
    const darts = rows.reduce((sum, visit) => sum + visit.darts, 0);
    return darts ? Math.round(rows.reduce((sum, visit) => sum + visit.points, 0) / darts * 30) / 10 : null;
  };
  const ownAverage = average(own)!;
  const opponentAverage = average(other);
  const busts = own.filter(visit => visit.bust && visit.scoreBefore <= 100).length;
  const kind = busts ? 'busts' : opponentAverage !== null && ownAverage < opponentAverage - 5
    ? 'scoring' : opponentAverage !== null && ownAverage >= opponentAverage + 5 ? 'protect' : 'keep';
  return { kind, ownAverage, opponentAverage, busts };
}

export type ScoutMatch = {
  opponent: string;
  won: boolean;
  visits: MatchVisit[];
};

export function readScoutMatch(data: Record<string, unknown>): ScoutMatch | null {
  if (data.mode !== 'x01') return null;
  const players = data.players;
  const opponent = Array.isArray(players) && players.length === 2 && typeof players[1] === 'string'
    ? players[1] : typeof data.opponent === 'string' ? data.opponent : '';
  if (!opponent.trim() || opponent.trim().toLowerCase() === 'unknown') return null;
  return { opponent, won: data.won === true, visits: readMatchVisits(data.visits) };
}

export type OpponentScout = {
  name: string;
  matches: number;
  wins: number;
  recordedVisits: number;
  average: number | null;
  highVisits: number;
  busts: number;
  checkouts: number;
};

export function scoutOpponents(matches: ScoutMatch[]): OpponentScout[] {
  const groups = new Map<string, { name: string; matches: ScoutMatch[] }>();
  for (const match of matches) {
    const name = match.opponent.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name || name.toLowerCase() === 'unknown') continue;
    const key = name.toLocaleLowerCase();
    const group = groups.get(key) || { name, matches: [] };
    group.matches.push(match);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ name, matches: group }) => {
    const visits = group.flatMap(match => match.visits.filter(visit => visit.playerId === 1));
    const darts = visits.reduce((sum, visit) => sum + visit.darts, 0);
    return {
      name, matches: group.length, wins: group.filter(match => match.won).length,
      recordedVisits: visits.length,
      average: darts ? Math.round(visits.reduce((sum, visit) => sum + visit.points, 0) / darts * 30) / 10 : null,
      highVisits: visits.filter(visit => visit.points >= 100).length,
      busts: visits.filter(visit => visit.bust).length,
      checkouts: visits.filter(visit => visit.checkout).length,
    };
  }).sort((a, b) => b.matches - a.matches || b.recordedVisits - a.recordedVisits || a.name.localeCompare(b.name)).slice(0, 3);
}

export type WinSignal = { kind: 'average' | 'first9' | 'checkout' | 'high';
  wins: number; losses: number; winnerValue: number; loserValue: number; gap: number };
export type WinRecipe = { wins: number; losses: number; signals: WinSignal[] };

export function winRecipe(matches: DatedDnaMatch[]): WinRecipe {
  const x01 = matches.filter(match => match.mode === 'x01').slice(0, 30);
  const wins = x01.filter(match => match.won);
  const losses = x01.filter(match => !match.won);
  const metrics: { kind: WinSignal['kind']; value: (match: DatedDnaMatch) => number | null; scale: number }[] = [
    { kind: 'average', value: match => match.average, scale: 10 },
    { kind: 'first9', value: match => match.first9Average, scale: 10 },
    { kind: 'checkout', value: match => match.checkoutRate === null ? null : match.checkoutRate * 100, scale: 10 },
    { kind: 'high', value: match => match.count100 + match.count140 + match.count180, scale: 1 },
  ];
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const signals = metrics.flatMap(({ kind, value, scale }): WinSignal[] => {
    const winValues = wins.map(value).filter((number): number is number => number !== null && Number.isFinite(number));
    const lossValues = losses.map(value).filter((number): number is number => number !== null && Number.isFinite(number));
    if (!winValues.length || !lossValues.length) return [];
    const winnerValue = mean(winValues);
    const loserValue = mean(lossValues);
    const gap = winnerValue - loserValue;
    return gap > 0 ? [{ kind, wins: winValues.length, losses: lossValues.length,
      winnerValue: Math.round(winnerValue * 10) / 10, loserValue: Math.round(loserValue * 10) / 10,
      gap: Math.round(gap / scale * 100) / 100 }] : [];
  }).sort((a, b) => b.gap - a.gap).slice(0, 2);
  return { wins: wins.length, losses: losses.length, signals };
}
