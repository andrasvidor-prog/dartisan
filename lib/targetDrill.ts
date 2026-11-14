export type DrillTarget = { key: string; val: number; mult: 1 | 2 | 3 };
type ThrownDart = { val: number; mult: number };

export function parseDrillTarget(key: string | null | undefined): DrillTarget | null {
  if (!key) return null;
  if (key === '25') return { key, val: 25, mult: 1 };
  if (key === '50' || key === 'BULL') return { key, val: 25, mult: 2 };
  const match = /^([SDT])([1-9]|1[0-9]|20)$/.exec(key);
  if (!match) return null;
  return { key, val: Number(match[2]), mult: ({ S: 1, D: 2, T: 3 } as const)[match[1] as 'S' | 'D' | 'T'] };
}

export function drillHit(dart: ThrownDart, target: DrillTarget): boolean {
  return dart.val === target.val && (target.key === 'BULL' || dart.mult === target.mult);
}

export function drillResult(darts: ThrownDart[], target: DrillTarget): { throws: number; hits: number; accuracy: number } {
  const throws = Math.min(darts.length, 30);
  const hits = darts.slice(0, 30).filter(dart => drillHit(dart, target)).length;
  return { throws, hits, accuracy: throws ? Math.round(hits / throws * 100) : 0 };
}
