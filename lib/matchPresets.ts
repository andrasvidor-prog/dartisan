import type { PlayerConfig } from '../components/SetupScreen';
import type { EntryRule, CheckoutRule } from './x01.ts';

export type MatchPreset = {
  id: string;
  name: string;
  startingScore: number;
  setsToWin: number;
  legsToWin: number;
  checkIn: EntryRule;
  checkout: CheckoutRule;
  muteCaller: boolean;
  players: PlayerConfig[];
};

const STORAGE_KEY = 'dartisan_match_presets';
const COLORS = new Set(['emerald', 'rose', 'cyan', 'amber', 'purple']);
const RULES = new Set(['single', 'double', 'master']);

export function isMatchPreset(value: unknown): value is MatchPreset {
  if (!value || typeof value !== 'object') return false;
  const preset = value as Partial<MatchPreset>;
  return typeof preset.id === 'string' && preset.id.length > 0 && preset.id.length <= 80 &&
    typeof preset.name === 'string' && preset.name.trim().length > 0 && preset.name.length <= 30 &&
    Number.isInteger(preset.startingScore) && preset.startingScore! >= 2 && preset.startingScore! <= 1001 &&
    Number.isInteger(preset.setsToWin) && preset.setsToWin! >= 1 && preset.setsToWin! <= 9 &&
    Number.isInteger(preset.legsToWin) && preset.legsToWin! >= 1 && preset.legsToWin! <= 9 &&
    RULES.has(preset.checkIn as string) && RULES.has(preset.checkout as string) &&
    typeof preset.muteCaller === 'boolean' && Array.isArray(preset.players) &&
    preset.players.length >= 1 && preset.players.length <= 4 && preset.players.every(player =>
      player && typeof player.name === 'string' && player.name.trim().length > 0 && player.name.length <= 40 &&
      typeof player.isBot === 'boolean' && Number.isInteger(player.difficulty) && player.difficulty >= 1 && player.difficulty <= 10 &&
      COLORS.has(player.color) &&
      (player.customStartingScore === undefined || (Number.isInteger(player.customStartingScore) && player.customStartingScore >= 2 && player.customStartingScore <= 1001)) &&
      (player.teamId === undefined || (Number.isInteger(player.teamId) && player.teamId >= 0 && player.teamId <= 2))
    );
}

export function readMatchPresets(storage: Pick<Storage, 'getItem'>): MatchPreset[] {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(isMatchPreset).slice(0, 10) : [];
  } catch { return []; }
}

export function writeMatchPresets(storage: Pick<Storage, 'setItem'>, presets: MatchPreset[]) {
  if (presets.length > 10 || !presets.every(isMatchPreset)) throw new Error('Invalid match presets');
  storage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export type BullOffHit = 0 | 1 | 2 | 3 | null;

export function bullOffWinner(hits: BullOffHit[]): number | null {
  if (hits.length < 2 || hits.some(hit => hit === null)) return null;
  const best = Math.min(...hits as number[]);
  const winners = hits.reduce<number[]>((indices, hit, index) => hit === best ? [...indices, index] : indices, []);
  return winners.length === 1 ? winners[0] : null;
}
