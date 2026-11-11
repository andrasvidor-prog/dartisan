export type MatchAnalyticsRow = {
  date: string;
  mode: string;
  opponent: string;
  won: boolean;
  score: string;
  average: number | null;
  first9Average: number | null;
  checkoutPct: number | null;
  bestLegDarts: number | null;
  count100: number;
  count140: number;
  count180: number;
};

export function recordedMatchScore(score: string | undefined): string {
  const value = score?.trim();
  // Older matches stored the reset leg counters after a set ended.
  return value && !/^0\s*-\s*0$/.test(value) ? value : '—';
}

export function matchTrend(rows: MatchAnalyticsRow[]) {
  const valid = rows.filter(row => row.average !== null && Number.isFinite(row.average)).slice(0, 20).reverse();
  const averages = valid.map(row => row.average as number);
  const first9 = valid.map(row => row.first9Average !== null && Number.isFinite(row.first9Average) ? row.first9Average : null);
  const mean = averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : 0;
  const deviation = averages.length > 1 ? Math.sqrt(averages.reduce((sum, value) => sum + (value - mean) ** 2, 0) / averages.length) : 0;
  const change = averages.length > 1 ? averages[averages.length - 1] - averages[0] : 0;
  return { averages, first9, deviation, change, count: valid.length };
}

function csvCell(value: string | number | boolean | null): string {
  const raw = value === null ? '' : String(value);
  const safe = /^[\s\t\r\n]*[=+@-]/.test(raw) && typeof value === 'string' ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function matchHistoryCsv(rows: MatchAnalyticsRow[]): string {
  const header = ['date', 'mode', 'opponent', 'won', 'score', 'average', 'first9Average', 'checkoutPct', 'bestLegDarts', 'count100', 'count140', 'count180'];
  return '\uFEFF' + [header.join(','), ...rows.map(row => [
    row.date, row.mode, row.opponent, row.won, row.score, row.average, row.first9Average,
    row.checkoutPct, row.bestLegDarts, row.count100, row.count140, row.count180,
  ].map(csvCell).join(','))].join('\r\n');
}
