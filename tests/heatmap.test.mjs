import test from 'node:test';
import assert from 'node:assert/strict';
import { aimedHit, dartSector, mergeAimStats, mergeHeatmaps, normalizeAimStat, normalizeHeatmapData, sectorHits, sectorType } from '../lib/heatmap.ts';

test('legacy bull keys remain visible without merging unspecified Bull training hits into a ring', () => {
    const data = normalizeHeatmapData({
        S25: { hits: 2, throws: 2 },
        '25': { hits: 4, throws: 4 },
        D25: { hits: 3, throws: 3 },
        '50': { hits: 1, throws: 1 },
        BULL: { hits: 5, throws: 9 },
    });
    assert.equal(sectorHits(data, '25'), 6);
    assert.equal(sectorHits(data, '50'), 4);
    assert.equal(sectorHits(data, 'BULL'), 5);
    assert.equal(sectorType('BULL'), 'bull');
});

test('invalid stored sectors and non-finite counts do not appear in the map', () => {
    const data = normalizeHeatmapData({
        T20: { hits: 12, throws: 12 },
        S21: { hits: 99, throws: 99 },
        D16: { hits: Number.NaN, throws: 3 },
        S1: { hits: -5, throws: -5 },
    });
    assert.deepEqual(Object.keys(data).sort(), ['D16', 'S1', 'T20']);
    assert.equal(sectorHits(data, 'D16'), 0);
    assert.equal(sectorHits(data, 'S1'), 0);
    assert.equal(sectorHits(data, 'T20'), 12);
});

test('aimed hits are exact and legacy setup totals merge without fabricating accuracy', () => {
    assert.equal(dartSector(25, 2), '50');
    assert.equal(dartSector(0, 1), 'MISS');
    assert.equal(aimedHit('T20', 'S20'), false);
    assert.equal(aimedHit('BULL', '50'), true);
    assert.equal(sectorHits(mergeHeatmaps({ T20: { hits: 2, throws: 2 } }, { T20: { hits: 3, throws: 3 } }), 'T20'), 5);
    const combined = mergeAimStats([
        normalizeAimStat({ target: 'T20', source: 'match', setupId: 'a', attempts: 3, hits: 1, landings: { T20: 1, S20: 2 } }),
        normalizeAimStat({ target: 'T20', source: 'training', setupId: 'b', attempts: 3, hits: 2, landings: { T20: 2 }, unlocatedMisses: 1 }),
    ].filter(Boolean));
    assert.equal(combined.T20.attempts, 6);
    assert.equal(combined.T20.hits, 3);
    assert.equal(combined.T20.landings.S20, 2);
    assert.equal(combined.T20.unlocatedMisses, 1);
});
