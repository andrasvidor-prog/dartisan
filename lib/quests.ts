export type Quest = {
  id: number;
  title: string;
  current: number;
  target: number;
  completed: boolean;
};

export type QuestProgress = {
  day: string;
  week: string;
  daily: Record<string, number>;
  weekly: Record<string, number>;
  seen: string[];
};

export type MatchQuestResult = {
  matchId: string;
  won: boolean;
  againstBot: boolean;
  count140: number;
  count180: number;
  bestLegDarts: number | null;
};

const STORAGE_KEY = 'dartisan_quests_progress';

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localWeek(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return localDay(monday);
}

function asCount(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function readQuestProgress(storage: Pick<Storage, 'getItem' | 'setItem'>, date = new Date()): QuestProgress {
  let saved: Partial<QuestProgress> = {};
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  } catch { /* damaged local data starts fresh */ }
  const day = localDay(date);
  const week = localWeek(date);
  const progress: QuestProgress = {
    day,
    week,
    daily: saved.day === day && saved.daily && typeof saved.daily === 'object' ? saved.daily : {},
    weekly: saved.week === week && saved.weekly && typeof saved.weekly === 'object' ? saved.weekly : {},
    seen: saved.week === week && Array.isArray(saved.seen) ? saved.seen.filter(id => typeof id === 'string').slice(-200) : [],
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  return progress;
}

export function recordQuestMatch(storage: Pick<Storage, 'getItem' | 'setItem'>, match: MatchQuestResult, date = new Date()) {
  const progress = readQuestProgress(storage, date);
  if (!/^[a-f0-9-]{36}$/i.test(match.matchId) || progress.seen.includes(match.matchId)) return progress;
  const highVisits = Math.max(0, asCount(match.count140) + asCount(match.count180));
  progress.daily['1'] = asCount(progress.daily['1']) + highVisits;
  progress.daily['2'] = asCount(progress.daily['2']) + (match.bestLegDarts && match.bestLegDarts <= 15 ? 1 : 0);
  progress.daily['3'] = asCount(progress.daily['3']) + 1;
  progress.weekly['101'] = asCount(progress.weekly['101']) + (match.won ? 1 : 0);
  progress.weekly['102'] = asCount(progress.weekly['102']) + (match.againstBot ? 1 : 0);
  progress.seen = [...progress.seen, match.matchId].slice(-200);
  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  return progress;
}

export function questsFor(progress: QuestProgress, lang: 'hu' | 'en'): { daily: Quest[]; weekly: Quest[] } {
  const quest = (id: number, title: string, target: number, values: Record<string, number>): Quest => {
    const current = Math.min(target, asCount(values[String(id)]));
    return { id, title, target, current, completed: current >= target };
  };
  return {
    daily: [
      quest(1, lang === 'hu' ? '3 darab 140+ kör' : 'Three 140+ visits', 3, progress.daily),
      quest(2, lang === 'hu' ? 'Kiszálló 15 nyíl alatt' : 'Checkout in under 15 darts', 1, progress.daily),
      quest(3, lang === 'hu' ? 'Játssz le 5 meccset' : 'Play five matches', 5, progress.daily),
    ],
    weekly: [
      quest(101, lang === 'hu' ? 'Nyerj meg 20 meccset' : 'Win 20 matches', 20, progress.weekly),
      quest(102, lang === 'hu' ? 'Játssz 10 meccset bot ellen' : 'Play 10 matches against a bot', 10, progress.weekly),
    ],
  };
}
