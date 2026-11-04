export function nextCareerStage(savedStage: number, playedStage: number, winnerId: number): number {
  const current = Number.isInteger(savedStage) ? Math.min(15, Math.max(0, savedStage)) : 0;
  if (winnerId !== 0 || !Number.isInteger(playedStage) || playedStage < 0 || playedStage >= 15) return current;
  return Math.min(15, Math.max(current, playedStage + 1));
}
