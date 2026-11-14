import { buildDartsDna, type DnaMatch } from './dartsDna.ts';

export type DatedDnaMatch = DnaMatch & { date: string | null; mode?: string };
export type WeeklyGoal = { kind: 'matches' | 'average' | 'first9' | 'checkout'; threshold: number; progress: number; target: number; weekStart: string };

export function localWeekStart(now: Date): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

export function weeklyGoal(matches: DatedDnaMatch[], now = new Date()): WeeklyGoal {
  const weekStart = localWeekStart(now);
  const start = new Date(`${weekStart}T00:00:00`).getTime();
  const nextMonday = new Date(`${weekStart}T00:00:00`);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const end = nextMonday.getTime();
  const past = matches.filter(match => match.date && new Date(match.date).getTime() < start).slice(0, 20);
  const dna = buildDartsDna(past, []);
  const thisWeek = matches.filter(match => {
    if (match.mode && match.mode !== 'x01') return false;
    const date = match.date ? new Date(match.date).getTime() : NaN;
    return Number.isFinite(date) && date >= start && date < end && date <= now.getTime();
  });
  if (dna.matches < 3 || dna.average === null) return { kind: 'matches', threshold: 0, progress: Math.min(2, thisWeek.length), target: 2, weekStart };
  const kind = dna.focus === 'doubles' && dna.checkoutRate !== null ? 'checkout'
    : dna.focus === 'opening' && dna.first9Average !== null ? 'first9' : 'average';
  const threshold = kind === 'checkout' ? Math.min(70, Math.max(10, Math.round(dna.checkoutRate! + 5)))
    : kind === 'first9' ? Math.round(dna.first9Average! + 3) : Math.round(dna.average + 3);
  const qualifies = (match: DatedDnaMatch) => kind === 'checkout'
    ? match.checkoutRate !== null && match.checkoutRate * 100 >= threshold
    : kind === 'first9' ? match.first9Average !== null && match.first9Average >= threshold
      : match.average !== null && match.average >= threshold;
  return { kind, threshold, progress: Math.min(3, thisWeek.filter(qualifies).length), target: 3, weekStart };
}
