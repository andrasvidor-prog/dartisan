'use client';

import type { KeyboardEvent } from 'react';
import { sectorHits, sectorType, type AimStat, type HeatmapData, type HeatmapFilter } from '../lib/heatmap';

const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const heatmapBands = [
    { label: '0', color: '#303741' },
    { label: '1–2', color: '#4b5964' },
    { label: '3–9', color: '#728793' },
    { label: '10–19', color: '#a6b5bd' },
    { label: '20+', color: '#e7ecef' },
] as const;

export const heatmapColor = (hits: number) =>
    hits >= 20 ? heatmapBands[4].color : hits >= 10 ? heatmapBands[3].color : hits >= 3 ? heatmapBands[2].color : hits >= 1 ? heatmapBands[1].color : heatmapBands[0].color;

const accuracyBands = [
    { label: '0%', color: '#4b5964' },
    { label: '1–24%', color: '#657985' },
    { label: '25–49%', color: '#879ba6' },
    { label: '50–74%', color: '#b0c1c9' },
    { label: '75–100%', color: '#e7ecef' },
] as const;

const accuracyColor = (rate: number) =>
    rate >= 75 ? accuracyBands[4].color : rate >= 50 ? accuracyBands[3].color : rate >= 25 ? accuracyBands[2].color : rate > 0 ? accuracyBands[1].color : accuracyBands[0].color;

const emptySectorColor = (index: number, ring: 'single' | 'triple' | 'double' | 'bull') => {
    if (ring === 'bull') return '#303741';
    if (ring === 'single') return index % 2 === 0 ? '#20262d' : '#303741';
    return index % 2 === 0 ? '#2b3139' : '#3c444e';
};

const polar = (cx: number, cy: number, radius: number, degrees: number) => {
    const angle = (degrees - 90) * Math.PI / 180;
    const coordinate = (value: number) => Number(value.toFixed(3));
    return { x: coordinate(cx + radius * Math.cos(angle)), y: coordinate(cy + radius * Math.sin(angle)) };
};

const arc = (cx: number, cy: number, inner: number, outer: number, start: number, end: number) => {
    const a = polar(cx, cy, outer, end);
    const b = polar(cx, cy, outer, start);
    const c = polar(cx, cy, inner, end);
    const d = polar(cx, cy, inner, start);
    const large = end - start > 180 ? 1 : 0;
    return `M ${a.x} ${a.y} A ${outer} ${outer} 0 ${large} 0 ${b.x} ${b.y} L ${d.x} ${d.y} A ${inner} ${inner} 0 ${large} 1 ${c.x} ${c.y} Z`;
};

export function HeatmapLegend({ metric = 'hits' }: { metric?: 'hits' | 'accuracy' }) {
    return <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[10px] font-bold text-slate-300" aria-label={metric === 'accuracy' ? 'Célzási arány színenként' : 'Találatok száma színenként'}>
        {(metric === 'accuracy' ? accuracyBands : heatmapBands).map(band => <span key={band.label} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-white/15" style={{ backgroundColor: band.color }} />{band.label}</span>)}
        <span className="text-slate-500">{metric === 'accuracy' ? 'pontosság' : 'találat'}</span>
    </div>;
}

export function HeatmapBoard({ data, filter = 'all', selectedSector, onSelectSector, metric = 'hits', accuracy = {} }: {
    data: HeatmapData;
    filter?: HeatmapFilter;
    selectedSector?: string | null;
    onSelectSector?: (sector: string) => void;
    metric?: 'hits' | 'accuracy';
    accuracy?: Record<string, AimStat>;
}) {
    const center = 160;
    const angle = 18;
    const sectorAttributes = (key: string, emptyColor: string, keyboard = true) => {
        const active = filter === 'all' || sectorType(key) === filter;
        const hits = sectorHits(data, key);
        const attempts = accuracy[key]?.attempts || 0;
        const rate = attempts > 0 ? Math.round((accuracy[key].hits / attempts) * 100) : 0;
        const selected = selectedSector === key && active;
        const interactive = Boolean(active && onSelectSector && (metric === 'accuracy' ? attempts > 0 : hits > 0));
        const accessible = interactive && keyboard;
        return {
            fill: active ? (metric === 'accuracy' ? (attempts > 0 ? accuracyColor(rate) : emptyColor) : (hits > 0 ? heatmapColor(hits) : emptyColor)) : '#161b20',
            opacity: active ? 1 : 0.55,
            stroke: selected ? '#22d3ee' : '#0b0d11',
            strokeWidth: selected ? 2.6 : 1.2,
            className: interactive ? 'cursor-pointer hover:brightness-125 transition-[filter]' : undefined,
            role: accessible ? 'button' : undefined,
            tabIndex: accessible ? 0 : undefined,
            'aria-label': accessible ? (metric === 'accuracy' ? `${key}: ${rate}% pontosság, ${attempts} kísérlet` : `${key}: ${hits} találat`) : undefined,
            'aria-hidden': accessible ? undefined : true,
            onClick: interactive ? () => onSelectSector?.(key) : undefined,
            onKeyDown: accessible ? (event: KeyboardEvent<SVGElement>) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectSector?.(key); }
            } : undefined,
        };
    };
    const segment = (key: string, path: string, emptyColor: string, keyboard = true) => <path key={path} d={path} {...sectorAttributes(key, emptyColor, keyboard)} />;

    return <svg viewBox="0 0 320 320" aria-label={metric === 'accuracy' ? 'Szektoronként mért célzási pontosság' : 'Szektoronként rögzített találatok térképe'} className="block h-auto w-full max-w-[560px] mx-auto drop-shadow-[0_16px_30px_rgba(0,0,0,0.35)]">
        <circle cx={center} cy={center} r="158" fill="#0b0d11" />
        {BOARD_ORDER.map((number, index) => {
            const start = index * angle - angle / 2;
            const end = start + angle;
            const label = polar(center, center, 150, start + angle / 2);
            return <g key={number}>
                {segment(`S${number}`, arc(center, center, 15, 76, start, end), emptySectorColor(index, 'single'), false)}
                {segment(`T${number}`, arc(center, center, 76, 88, start, end), emptySectorColor(index, 'triple'))}
                {segment(`S${number}`, arc(center, center, 88, 125, start, end), emptySectorColor(index, 'single'))}
                {segment(`D${number}`, arc(center, center, 125, 138, start, end), emptySectorColor(index, 'double'))}
                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="900" fill="#e2e8f0" stroke="#0b0d11" strokeWidth="2.5" paintOrder="stroke" pointerEvents="none">{number}</text>
            </g>;
        })}
        <circle cx={center} cy={center} r="15" {...sectorAttributes('25', emptySectorColor(0, 'bull'))} />
        <circle cx={center} cy={center} r="6.5" {...sectorAttributes('50', emptySectorColor(0, 'bull'))} />
        {selectedSector === 'BULL' && <circle cx={center} cy={center} r="18" fill="none" stroke="#22d3ee" strokeWidth="2" pointerEvents="none" />}
    </svg>;
}
