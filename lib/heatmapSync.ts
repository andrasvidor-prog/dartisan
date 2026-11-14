import { doc, increment, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { aimedHit, dartSector, isSector, type HeatmapData, type HeatmapSource } from './heatmap.ts';

export type HeatmapEvent = {
    id: string;
    uid: string;
    setupId: string;
    source: HeatmapSource;
    target: string | null;
    landed: string | null;
    landingHits: number;
    attempts: number;
    hits: number;
    unlocatedMisses: number;
    direction: 1 | -1;
};

type QueueStorage = Pick<Storage, 'getItem' | 'setItem'>;
const queueKey = (uid: string) => `dartisan_heatmap_queue_v1_${uid}`;
const inFlight = new Map<string, Promise<{ pending: number; error: string | null }>>();

const safeSetupId = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'default';

export function matchHeatmapEvent(uid: string, setupId: string, val: number, mult: number, target: string | null): HeatmapEvent | null {
    const landed = dartSector(val, mult);
    if (!landed || (landed === 'MISS' && !target)) return null;
    const validTarget = target && isSector(target) ? target : null;
    return {
        id: crypto.randomUUID(), uid, setupId: safeSetupId(setupId), source: 'match',
        target: validTarget, landed, landingHits: landed === 'MISS' ? 0 : 1,
        attempts: validTarget ? 1 : 0,
        hits: validTarget && aimedHit(validTarget, landed) ? 1 : 0,
        unlocatedMisses: 0, direction: 1,
    };
}

export function targetDrillHeatmapEvent(uid: string, setupId: string, val: number, mult: number, target: string): HeatmapEvent | null {
    const landed = dartSector(val, mult);
    if (!landed || !isSector(target)) return null;
    return {
        id: crypto.randomUUID(), uid, setupId: safeSetupId(setupId), source: 'training',
        target, landed, landingHits: landed === 'MISS' ? 0 : 1,
        attempts: 1, hits: aimedHit(target, landed) ? 1 : 0,
        unlocatedMisses: landed === 'MISS' ? 1 : 0, direction: 1,
    };
}

export function hunterHeatmapEvent(uid: string, setupId: string, target: string, hits: number): HeatmapEvent {
    const recordedHits = Number.isInteger(hits) ? Math.max(0, Math.min(3, hits)) : 0;
    return {
        id: crypto.randomUUID(), uid, setupId: safeSetupId(setupId), source: 'training',
        target, landed: recordedHits > 0 ? target : null, landingHits: recordedHits,
        attempts: 3, hits: recordedHits, unlocatedMisses: 3 - recordedHits, direction: 1,
    };
}

export const reverseHeatmapEvent = (event: HeatmapEvent): HeatmapEvent => ({ ...event, id: crypto.randomUUID(), direction: -1 });

export function applyHeatmapEvent(data: HeatmapData, event: HeatmapEvent): HeatmapData {
    if (!event.landed || event.landed === 'MISS' || event.landingHits === 0) return data;
    const previous = data[event.landed] || { hits: 0, throws: 0 };
    const next = Math.max(0, previous.hits + event.direction * event.landingHits);
    return { ...data, [event.landed]: { hits: next, throws: next } };
}

export function readHeatmapQueue(storage: QueueStorage, uid: string): HeatmapEvent[] {
    try {
        const parsed = JSON.parse(storage.getItem(queueKey(uid)) || '[]');
        return Array.isArray(parsed) ? parsed.filter((event): event is HeatmapEvent =>
            event && typeof event.id === 'string' && event.uid === uid &&
            (event.source === 'match' || event.source === 'training') &&
            (event.direction === 1 || event.direction === -1) &&
            typeof event.setupId === 'string' && event.setupId.length > 0 &&
            (event.target === null || typeof event.target === 'string' && isSector(event.target)) &&
            (event.landed === null || event.landed === 'MISS' || typeof event.landed === 'string' && isSector(event.landed)) &&
            Number.isInteger(event.landingHits) && event.landingHits >= 0 && event.landingHits <= 3 &&
            Number.isInteger(event.attempts) && event.attempts >= 0 && event.attempts <= 3 &&
            Number.isInteger(event.hits) && event.hits >= 0 && event.hits <= event.attempts &&
            Number.isInteger(event.unlocatedMisses) && event.unlocatedMisses >= 0 && event.unlocatedMisses <= 3
        ) : [];
    } catch { return []; }
}

export function enqueueHeatmapEvent(storage: QueueStorage, event: HeatmapEvent): number {
    const next = [...readHeatmapQueue(storage, event.uid), event];
    storage.setItem(queueKey(event.uid), JSON.stringify(next));
    return next.length;
}

export async function persistHeatmapEvent(database: Firestore, event: HeatmapEvent): Promise<void> {
    const base = ['users', event.uid, 'stats'] as const;
    const marker = doc(database, 'users', event.uid, 'heatmapEvents', event.id);
    const landings = doc(database, ...base, 'landings', 'setups', `${event.setupId}_${event.source}`);
    const aims = event.target ? doc(database, ...base, 'aims', 'targets', `${event.setupId}_${event.source}_${event.target}`) : null;
    await runTransaction(database, async transaction => {
        if ((await transaction.get(marker)).exists()) return;
        transaction.set(marker, {
            setupId: event.setupId, source: event.source, target: event.target, landed: event.landed,
            landingHits: event.landingHits, attempts: event.attempts, hits: event.hits,
            unlocatedMisses: event.unlocatedMisses, direction: event.direction, createdAt: serverTimestamp(),
        });
        if (event.landed && event.landed !== 'MISS' && event.landingHits > 0) {
            const change = event.direction * event.landingHits;
            transaction.set(landings, {
                setupId: event.setupId, source: event.source,
                sectors: { [event.landed]: { hits: increment(change), throws: increment(change) } },
            }, { merge: true });
        }
        if (aims && event.target) {
            const landingCount = event.source === 'training' ? event.hits : event.attempts;
            transaction.set(aims, {
                setupId: event.setupId, source: event.source, target: event.target,
                attempts: increment(event.direction * event.attempts),
                hits: increment(event.direction * event.hits),
                unlocatedMisses: increment(event.direction * event.unlocatedMisses),
                ...(event.landed && landingCount > 0 ? { landings: { [event.landed]: increment(event.direction * landingCount) } } : {}),
            }, { merge: true });
        }
    });
}

export function flushHeatmapQueue(database: Firestore, storage: QueueStorage, uid: string): Promise<{ pending: number; error: string | null }> {
    const active = inFlight.get(uid);
    if (active) return active;
    const work = (async () => {
        while (true) {
            const event = readHeatmapQueue(storage, uid)[0];
            if (!event) return { pending: 0, error: null };
            try {
                await persistHeatmapEvent(database, event);
            } catch (error) {
                const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';
                return { pending: readHeatmapQueue(storage, uid).length, error: code };
            }
            storage.setItem(queueKey(uid), JSON.stringify(readHeatmapQueue(storage, uid).filter(queued => queued.id !== event.id)));
        }
    })();
    inFlight.set(uid, work);
    void work.finally(() => inFlight.delete(uid));
    return work;
}
