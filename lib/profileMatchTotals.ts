export type MatchTotals = { matches: number; wins: number; winRate: number };

const safeCount = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

// Older accounts can have saved match results while their legacy profile
// counters were never updated. Saved history supplies a lower bound without
// overwriting a larger lifetime counter or changing XP and leaderboards.
export function profileMatchTotals(profile: { matchesPlayed: number; matchesWon: number }, history: { matches: number; wins: number } | null): MatchTotals {
  const matches = Math.max(safeCount(profile.matchesPlayed), safeCount(history?.matches ?? 0));
  const wins = Math.min(matches, Math.max(safeCount(profile.matchesWon), safeCount(history?.wins ?? 0)));
  return { matches, wins, winRate: matches ? Math.round(wins / matches * 100) : 0 };
}
