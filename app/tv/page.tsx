'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { Dart, PlayerData } from '../../components/MatchScreen';

type TvSync = { players: PlayerData[]; activePlayer: number; currentDarts: Dart[] };
const subscribeToMatch = (notify: () => void) => {
    window.addEventListener('storage', notify);
    const interval = window.setInterval(notify, 400);
    return () => { window.removeEventListener('storage', notify); window.clearInterval(interval); };
};

const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const p2c = (cx: number, cy: number, r: number, angle: number) => {
    const a = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};
const arc = (x: number, y: number, r1: number, r2: number, s: number, e: number) => {
    const so = p2c(x,y,r2,e), eo = p2c(x,y,r2,s), si = p2c(x,y,r1,e), ei = p2c(x,y,r1,s);
    const f = e-s <= 180 ? '0' : '1';
    return ['M',so.x,so.y,'A',r2,r2,0,f,0,eo.x,eo.y,'L',ei.x,ei.y,'A',r1,r1,0,f,1,si.x,si.y,'Z'].join(' ');
};

const dartCoord = (val: number, mult: number, idx: number) => {
    const C = 150, s = idx*61 + val*7 + mult*13;
    if (val === 0) { const a=((s*73)%360-90)*Math.PI/180; return {x:C+158*Math.cos(a),y:C+158*Math.sin(a)}; }
    if (val === 25) { const a=((s*43)%360-90)*Math.PI/180,r=mult===2?3+(s%4):9+(s%6); return {x:C+r*Math.cos(a),y:C+r*Math.sin(a)}; }
    const si=DARTBOARD_ORDER.indexOf(val), ji=(s%12)-6;
    const a=(si*18+ji-90)*Math.PI/180;
    const r=mult===3?83+(s%7):mult===2?128+(s%7):s%2===0?30+(s%45):92+(s%30);
    return {x:C+r*Math.cos(a),y:C+r*Math.sin(a)};
};

const HEX: Record<string,string> = { emerald:'#34d399', rose:'#fb7185', cyan:'#22d3ee', amber:'#fbbf24', purple:'#b655ff' };

export default function TVPage() {
    const raw = useSyncExternalStore(subscribeToMatch, () => localStorage.getItem('dartisan_tv_sync'), () => null);
    const syncData = useMemo<TvSync | null>(() => {
        try {
            const value = raw ? JSON.parse(raw) : null;
            return value && Array.isArray(value.players) && Array.isArray(value.currentDarts) && Number.isInteger(value.activePlayer)
                ? value as TvSync : null;
        } catch { return null; }
    }, [raw]);

    if (!syncData?.players?.length) return (
        <div className="fixed inset-0 bg-[#050508] flex flex-col items-center justify-center gap-4">
            <div className="text-6xl">📺</div>
            <p className="text-2xl font-black text-white uppercase tracking-widest">Dartisan TV</p>
            <p className="text-sm text-slate-500 font-bold text-center max-w-xs leading-relaxed">
                Nyiss meg egy meccset a Dartisan appban,<br />majd kattints a <span className="text-white font-black">TV</span> gombra.
            </p>
            <div className="flex gap-1 mt-4">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-slate-700 animate-pulse" style={{animationDelay:`${i*200}ms`}}/>)}</div>
        </div>
    );

    const { players, activePlayer, currentDarts } = syncData;
    const ap    = players[activePlayer] ?? players[0];
    const apHex = HEX[ap?.color] ?? '#34d399';

    return (
        <div className="fixed inset-0 bg-[#050508] flex flex-col overflow-hidden select-none">

            {/* ── SCORE HEADER ──────────────────────────────────────────── */}
            <div className="flex border-b border-[#0e1017] shrink-0">
                {players.map((pl) => {
                    const isAct = pl.id === activePlayer;
                    const hex   = HEX[pl.color] ?? '#34d399';
                    return (
                        <div key={pl.id} className={`flex-1 flex flex-col items-center py-4 sm:py-6 gap-1 transition-all duration-300 ${isAct ? 'bg-[#0c0e14]' : 'opacity-25'}`}>
                            <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.25em]" style={{color:hex}}>{pl.name}</span>
                            <span className="font-mono font-black text-white leading-none" style={{fontSize:'clamp(3.5rem,14vw,9rem)'}}>{pl.score}</span>
                            <span className="text-[10px] text-slate-600 font-bold">S:{pl.setsWon} L:{pl.legsWon}</span>
                            {isAct && (
                                <div className="flex gap-1.5 mt-1">
                                    {[0,1,2].map(di=>{
                                        const d=currentDarts[di];
                                        return <span key={di} className={`w-14 h-7 rounded-lg border font-mono text-[11px] font-black flex items-center justify-center transition-all ${d?'bg-slate-700 text-white border-slate-600':'bg-[#0b0d11] border-slate-900 text-slate-800'}`}>
                                            {d?`${d.mult>1?(d.mult===3?'T':'D'):''}${d.val===0?'MISS':d.val===25?'BULL':d.val}`:'—'}
                                        </span>;
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── FULLSCREEN DARTBOARD ──────────────────────────────────── */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
                <svg viewBox="0 0 300 300" style={{height:'min(75vmin,75vh)',width:'min(75vmin,75vh)'}}>
                    <circle cx="150" cy="150" r="149" fill="#040406"/>
                    <circle cx="150" cy="150" r="148" fill="#0b0d11"/>
                    {DARTBOARD_ORDER.map((num,i)=>{
                        const sa=i*18-9, ea=sa+18, isEven=i%2===0;
                        const single=isEven?'#1a1a1a':'#d4d4d4';
                        const tp=p2c(150,150,142,sa+9);
                        return (
                            <g key={num}>
                                <path d={arc(150,150,15,80,sa,ea)}   fill={single}                        stroke="#040406" strokeWidth="0.6"/>
                                <path d={arc(150,150,80,90,sa,ea)}   fill={isEven?'#c8102e':'#00953f'}    stroke="#040406" strokeWidth="0.6"/>
                                <path d={arc(150,150,90,125,sa,ea)}  fill={single}                        stroke="#040406" strokeWidth="0.6"/>
                                <path d={arc(150,150,125,135,sa,ea)} fill={isEven?'#c8102e':'#00953f'}    stroke="#040406" strokeWidth="0.6"/>
                                <text x={tp.x} y={tp.y} fill="#374151" fontSize="10" fontWeight="900"
                                    textAnchor="middle" alignmentBaseline="middle"
                                    transform={`rotate(${sa+9+90} ${tp.x} ${tp.y})`}>{num}</text>
                            </g>
                        );
                    })}
                    <circle cx="150" cy="150" r="15"   fill="#00953f" stroke="#040406" strokeWidth="0.6"/>
                    <circle cx="150" cy="150" r="6.35" fill="#c8102e" stroke="#040406" strokeWidth="0.6"/>

                    {/* ── DART MARKERS ────────────────────────────────── */}
                    {currentDarts.map((d, di: number)=>{
                        const pos=dartCoord(d.val,d.mult,di);
                        return (
                            <g key={`${di}-${d.val}-${d.mult}`}>
                                {/* Glow ring */}
                                <circle cx={pos.x} cy={pos.y} r="13" fill={apHex} opacity="0.15"/>
                                <circle cx={pos.x} cy={pos.y} r="9"  fill={apHex} opacity="0.2"/>
                                {/* Drop shadow */}
                                <circle cx={pos.x+1.5} cy={pos.y+1.5} r="7" fill="#000" opacity="0.6"/>
                                {/* Main body */}
                                <circle cx={pos.x} cy={pos.y} r="7" fill={apHex} stroke="#fff" strokeWidth="1.5" opacity="0.97"/>
                                {/* Dart number */}
                                <text x={pos.x} y={pos.y+0.5} fill="#000" fontSize="8.5" fontWeight="900"
                                    textAnchor="middle" alignmentBaseline="middle" style={{userSelect:'none'}}>{di+1}</text>
                            </g>
                        );
                    })}

                    {/* Aiming crosshair when no darts */}
                    {currentDarts.length===0 && (
                        <g opacity="0.06">
                            <line x1="130" y1="150" x2="170" y2="150" stroke="#94a3b8" strokeWidth="1"/>
                            <line x1="150" y1="130" x2="150" y2="170" stroke="#94a3b8" strokeWidth="1"/>
                            <circle cx="150" cy="150" r="20" fill="none" stroke="#94a3b8" strokeWidth="1"/>
                        </g>
                    )}
                </svg>
            </div>

            {/* ── FOOTER ────────────────────────────────────────────────── */}
            <div className="shrink-0 flex items-center justify-between px-6 py-2 border-t border-[#0e1017]">
                <span className="text-[9px] font-black text-slate-800 uppercase tracking-[0.3em]">DARTISAN TV</span>
                <span className="text-[9px] font-bold text-slate-800">
                    {currentDarts.length===0 ? 'Várakozás dobásra...' : `${currentDarts.length} / 3 nyíl bedobva`}
                </span>
            </div>
        </div>
    );
}
