export type VisitHit = { val: number; mult: number };
export type MatchVisit = {
  order: number;
  playerId: number;
  leg: number;
  scoreBefore: number;
  points: number;
  enteredPoints: number;
  darts: number;
  bust: boolean;
  checkout: boolean;
  hits: VisitHit[];
};

type VisitInput = Omit<MatchVisit, 'order' | 'playerId'>;
type VisitPlayer = { visitLog?: MatchVisit[] };

export function recordVisit<T extends VisitPlayer>(players: T[], playerIndex: number, input: VisitInput): void {
  const nextOrder = players.reduce((latest, player) => Math.max(latest, player.visitLog?.at(-1)?.order || 0), 0) + 1;
  players[playerIndex].visitLog ??= [];
  players[playerIndex].visitLog!.push({ ...input, order: nextOrder, playerId: playerIndex,
    hits: input.hits.map(hit => ({ val: hit.val, mult: hit.mult })) });
}

export function orderedVisits(players: VisitPlayer[]): MatchVisit[] {
  return players.flatMap(player => player.visitLog || []).sort((a, b) => a.order - b.order);
}

export function readMatchVisits(value: unknown): MatchVisit[] {
  if (!Array.isArray(value)) return [];
  const visits: MatchVisit[] = [];
  for (const item of value.slice(-500)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const integer = (key: string, min: number, max: number) =>
      Number.isInteger(row[key]) && Number(row[key]) >= min && Number(row[key]) <= max;
    if (!integer('order', 1, 10000) || !integer('playerId', 0, 7) || !integer('leg', 1, 100) ||
      !integer('scoreBefore', 1, 1001) || !integer('points', 0, 180) ||
      !integer('enteredPoints', 0, 180) || !integer('darts', 1, 3) ||
      typeof row.bust !== 'boolean' || typeof row.checkout !== 'boolean') continue;
    if (row.bust && row.checkout || !row.bust && Number(row.points) > Number(row.scoreBefore) ||
      row.checkout && row.points !== row.scoreBefore) continue;
    const hits = Array.isArray(row.hits) ? row.hits.slice(0, 3).flatMap(hit => {
      if (!hit || typeof hit !== 'object') return [];
      const dart = hit as Record<string, unknown>;
      return Number.isInteger(dart.val) && Number(dart.val) >= 0 && Number(dart.val) <= 25 &&
        Number.isInteger(dart.mult) && Number(dart.mult) >= 1 && Number(dart.mult) <= 3
        ? [{ val: Number(dart.val), mult: Number(dart.mult) }] : [];
    }) : [];
    visits.push({ order: Number(row.order), playerId: Number(row.playerId), leg: Number(row.leg),
      scoreBefore: Number(row.scoreBefore), points: Number(row.points),
      enteredPoints: Number(row.enteredPoints), darts: Number(row.darts),
      bust: row.bust, checkout: row.checkout, hits });
  }
  return visits.sort((a, b) => a.order - b.order);
}

export function visitRemaining(visit: MatchVisit): number {
  return visit.checkout ? 0 : visit.bust ? visit.scoreBefore : visit.scoreBefore - visit.points;
}

export function replayFrame(visits: MatchVisit[], index: number, startingScore: number): {
  scores: [number, number]; leg: number; current: MatchVisit | null; previous: MatchVisit[];
} {
  const scores: [number, number] = [startingScore, startingScore];
  const selected = visits.slice(0, Math.max(0, Math.min(visits.length, index)));
  let leg = 1;
  for (const visit of selected) {
    if (visit.leg !== leg) { leg = visit.leg; scores[0] = startingScore; scores[1] = startingScore; }
    if (visit.playerId < 2) scores[visit.playerId] = visitRemaining(visit);
  }
  return { scores, leg, current: selected.at(-1) || null, previous: selected.slice(-5) };
}

export type TurningPoint = { visit: MatchVisit; kind: 'checkout' | 'high' | 'bust' };
export function turningPoints(visits: MatchVisit[], playerId = 0): TurningPoint[] {
  const own = visits.filter(visit => visit.playerId === playerId);
  const checkout = own.filter(visit => visit.checkout).sort((a, b) => b.points - a.points)[0];
  const high = own.filter(visit => !visit.checkout && !visit.bust).sort((a, b) => b.points - a.points)[0];
  const bust = own.filter(visit => visit.bust && visit.scoreBefore <= 100).sort((a, b) => a.scoreBefore - b.scoreBefore)[0];
  return [checkout && { visit: checkout, kind: 'checkout' as const },
    high && { visit: high, kind: 'high' as const },
    bust && { visit: bust, kind: 'bust' as const }].filter((item): item is TurningPoint => !!item);
}
