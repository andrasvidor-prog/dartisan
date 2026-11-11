export type HeatmapData = Record<string, { hits: number; throws: number }>;
export type HeatmapFilter = 'all' | 'single' | 'double' | 'treble';

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
        if (!/^(?:[SDT](?:[1-9]|1[0-9]|20)|25|50|BULL)$/.test(key)) continue;
        const hits = typeof value?.hits === 'number' && Number.isFinite(value.hits) ? Math.max(0, Math.floor(value.hits)) : 0;
        const attempts = typeof value?.throws === 'number' && Number.isFinite(value.throws) ? Math.max(0, Math.floor(value.throws)) : 0;
        normalized[key] = { hits: (normalized[key]?.hits || 0) + hits, throws: (normalized[key]?.throws || 0) + attempts };
    }
    return normalized;
};
