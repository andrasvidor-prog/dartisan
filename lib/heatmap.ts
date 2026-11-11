export type HeatmapData = Record<string, { hits: number; throws: number }>;
export type HeatmapFilter = 'all' | 'single' | 'double' | 'treble';
export type HeatmapSource = 'match' | 'training';
export type AimStat = {
    target: string;
    source: HeatmapSource;
    setupId: string;
    attempts: number;
    hits: number;
    landings: Record<string, number>;
    unlocatedMisses: number;
};

export const isSector = (key: string) => /^(?:[SDT](?:[1-9]|1[0-9]|20)|25|50|BULL)$/.test(key);

export const dartSector = (val: number, mult: number): string | null => {
    if (val === 0 && mult === 1) return 'MISS';
    if (val === 25 && (mult === 1 || mult === 2)) return mult === 2 ? '50' : '25';
    if (!Number.isInteger(val) || val < 1 || val > 20 || ![1, 2, 3].includes(mult)) return null;
    return `${mult === 3 ? 'T' : mult === 2 ? 'D' : 'S'}${val}`;
};

export const aimedHit = (target: string, landed: string) =>
    target === 'BULL' ? landed === '25' || landed === '50' : target === landed;

export const mergeHeatmaps = (...maps: HeatmapData[]): HeatmapData => {
    const combined: HeatmapData = {};
    for (const map of maps) {
        for (const [key, value] of Object.entries(normalizeHeatmapData(map))) {
            combined[key] = {
                hits: (combined[key]?.hits || 0) + value.hits,
                throws: (combined[key]?.throws || 0) + value.throws,
            };
        }
    }
    return combined;
};

export const normalizeAimStat = (value: unknown): AimStat | null => {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    if (typeof item.target !== 'string' || !isSector(item.target) ||
        (item.source !== 'match' && item.source !== 'training')) return null;
    const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const landings: Record<string, number> = {};
    if (item.landings && typeof item.landings === 'object') {
        for (const [key, value] of Object.entries(item.landings)) {
            if (isSector(key) || key === 'MISS') landings[key] = count(value);
        }
    }
    const attempts = count(item.attempts);
    return {
        target: item.target,
        source: item.source,
        setupId: typeof item.setupId === 'string' ? item.setupId : 'default',
        attempts,
        hits: Math.min(attempts, count(item.hits)),
        landings,
        unlocatedMisses: count(item.unlocatedMisses),
    };
};

export const mergeAimStats = (stats: AimStat[]) => {
    const combined: Record<string, AimStat> = {};
    for (const item of stats) {
        const current = combined[item.target];
        if (!current) {
            combined[item.target] = { ...item, setupId: 'all', landings: { ...item.landings } };
            continue;
        }
        current.attempts += item.attempts;
        current.hits += item.hits;
        current.unlocatedMisses += item.unlocatedMisses;
        for (const [key, value] of Object.entries(item.landings)) current.landings[key] = (current.landings[key] || 0) + value;
    }
    return combined;
};

export const sectorHits = (data: HeatmapData, key: string) => {
    const hits = data[key]?.hits;
    return typeof hits === 'number' && Number.isFinite(hits) ? Math.max(0, Math.floor(hits)) : 0;
};

export const sectorType = (key: string): Exclude<HeatmapFilter, 'all'> | 'bull' =>
    key === 'BULL' ? 'bull' : key.startsWith('T') ? 'treble' : key.startsWith('D') || key === '50' ? 'double' : 'single';

export const normalizeHeatmapData = (data: HeatmapData): HeatmapData => {
    const normalized: HeatmapData = {};
    for (const [storedKey, value] of Object.entries(data)) {
        const key = storedKey === 'S25' ? '25' : storedKey === 'D25' ? '50' : storedKey;
        if (!isSector(key)) continue;
        const hits = typeof value?.hits === 'number' && Number.isFinite(value.hits) ? Math.max(0, Math.floor(value.hits)) : 0;
        const attempts = typeof value?.throws === 'number' && Number.isFinite(value.throws) ? Math.max(0, Math.floor(value.throws)) : 0;
        normalized[key] = { hits: (normalized[key]?.hits || 0) + hits, throws: (normalized[key]?.throws || 0) + attempts };
    }
    return normalized;
};
