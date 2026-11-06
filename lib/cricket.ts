export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;
export type CricketVariant = 'standard' | 'cutthroat';

export type CricketPlayer = {
  id: number;
  name: string;
  color: string;
  marks: Record<number, number>;
  score: number;
};

export function applyCricketDart<T extends CricketPlayer>(players: T[], activeIndex: number, target: number, mult: number, variant: CricketVariant): T[] {
  if (target === 0) return players;
  if (!CRICKET_TARGETS.includes(target as typeof CRICKET_TARGETS[number]) || !Number.isInteger(mult) || mult < 1 || mult > (target === 25 ? 2 : 3)) {
    throw new Error('Invalid Cricket dart');
  }
  if (!players[activeIndex]) throw new Error('Invalid Cricket player');
  const next = players.map(player => ({ ...player, marks: { ...player.marks } }));
  const active = next[activeIndex];
  const previous = active.marks[target] ?? 0;
  const overflow = Math.max(0, previous + mult - 3);
  active.marks[target] = Math.min(3, previous + mult);
  if (overflow > 0) {
    if (variant === 'cutthroat') {
      next.forEach((opponent, index) => {
        if (index !== activeIndex && (opponent.marks[target] ?? 0) < 3) opponent.score += overflow * target;
      });
    } else if (next.some((opponent, index) => index !== activeIndex && (opponent.marks[target] ?? 0) < 3)) {
      active.score += overflow * target;
    }
  }
  return next as T[];
}

export function cricketWinner<T extends CricketPlayer>(players: T[], variant: CricketVariant): T | null {
  const closed = players.filter(player => CRICKET_TARGETS.every(target => (player.marks[target] ?? 0) >= 3));
  if (closed.length === 0) return null;
  const better = (a: number, b: number) => variant === 'cutthroat' ? a <= b : a >= b;
  return closed.find(player => players.every(other => other.id === player.id || better(player.score, other.score))) ?? null;
}
