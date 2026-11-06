'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { XMarkIcon, TrophyIcon, ArrowPathIcon, BackspaceIcon } from '@heroicons/react/24/outline';
import { TutorialOverlay, shouldShowTutorial } from './TutorialOverlay';
import { applyCricketDart, cricketWinner, CRICKET_TARGETS, type CricketVariant } from '../lib/cricket';

type Mark = 0 | 1 | 2 | 3; // 0=nyitott, 1=1 jel, 2=2 jel, 3=zárva

interface PlayerState {
    id: number;
    name: string;
    color: string;
    marks: Record<number, Mark>;  // target → marks count
    score: number;
}

interface CricketScreenProps {
    config: { players: { name: string; color: string }[]; cricketVariant?: CricketVariant };
    lang: 'hu' | 'en';
    onBack: () => void;
}

const COLOR_MAP: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50',
    rose:    'text-rose-400    bg-rose-500/20    border-rose-500/50',
    cyan:    'text-cyan-400    bg-cyan-500/20    border-cyan-500/50',
    amber:   'text-amber-400   bg-amber-500/20   border-amber-500/50',
    purple:  'text-[#b655ff]   bg-[#b655ff]/20   border-[#b655ff]/50',
};

export function CricketScreen({ config, lang, onBack }: CricketScreenProps) {
    const variant: CricketVariant = config.cricketVariant === 'cutthroat' ? 'cutthroat' : 'standard';
    const initPlayers = (): PlayerState[] =>
        config.players.map((p, i) => ({
            id: i,
            name: p.name,
            color: p.color,
            marks: Object.fromEntries(CRICKET_TARGETS.map(t => [t, 0 as Mark])),
            score: 0,
        }));

    const [players, setPlayers] = useState<PlayerState[]>(initPlayers);
    const [activePlayer, setActivePlayer] = useState(0);
    const [pendingDarts, setPendingDarts]   = useState<{ target: number; mult: number }[]>([]);
    const [turnHistory, setTurnHistory]     = useState<{ players: PlayerState[]; activePlayer: number }[]>([]);
    const [winner, setWinner]               = useState<PlayerState | null>(null);
    const [activeMult, setActiveMult]       = useState<1 | 2 | 3>(1);
    const [showTutorial, setShowTutorial]   = useState(() => shouldShowTutorial('cricket'));
    const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const winnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimers = () => {
        if (turnTimer.current) clearTimeout(turnTimer.current);
        if (winnerTimer.current) clearTimeout(winnerTimer.current);
        turnTimer.current = null;
        winnerTimer.current = null;
    };

    useEffect(() => () => {
        if (turnTimer.current) clearTimeout(turnTimer.current);
        if (winnerTimer.current) clearTimeout(winnerTimer.current);
    }, []);

    // Closed by all players?
    const isClosedByAll = useCallback((target: number, ps: PlayerState[]) =>
        ps.every(p => p.marks[target] >= 3), []);

    const recordHit = (target: number, mult: number) => {
        if (winner) return;
        if (pendingDarts.length >= 3) return;
        const newDarts = [...pendingDarts, { target, mult }];
        setPendingDarts(newDarts);

        if (newDarts.length === 3) {
            applyDarts(newDarts);
        }
    };

    const applyDarts = (darts: { target: number; mult: number }[]) => {
        setTurnHistory(previous => [...previous, { players, activePlayer }]);
        let nextPlayers = players;
        for (const { target, mult } of darts) nextPlayers = applyCricketDart(nextPlayers, activePlayer, target, mult, variant);
        setPlayers(nextPlayers);
        const nextWinner = cricketWinner(nextPlayers, variant);
        if (nextWinner) winnerTimer.current = setTimeout(() => setWinner(nextWinner), 300);

        turnTimer.current = setTimeout(() => {
            setPendingDarts([]);
            setActiveMult(1);
            setActivePlayer(prev => (prev + 1) % config.players.length);
        }, 600);
    };

    const handleUndo = () => {
        if (pendingDarts.length > 0 && pendingDarts.length < 3) {
            setPendingDarts(previous => previous.slice(0, -1));
            return;
        }
        const lastTurn = turnHistory[turnHistory.length - 1];
        if (!lastTurn) return;
        clearTimers();
        setPlayers(lastTurn.players);
        setActivePlayer(lastTurn.activePlayer);
        setTurnHistory(previous => previous.slice(0, -1));
        setPendingDarts([]);
        setWinner(null);
        setActiveMult(1);
    };

    const handleReset = () => {
        clearTimers();
        setPlayers(initPlayers());
        setActivePlayer(0);
        setPendingDarts([]);
        setTurnHistory([]);
        setWinner(null);
        setActiveMult(1);
    };

    const ap = players[activePlayer];
    const colorClass = COLOR_MAP[ap.color] || COLOR_MAP.emerald;

    return (
        <div className="fixed inset-0 bg-[#0b0d11] text-slate-200 flex flex-col overflow-hidden">
            {showTutorial && (
                <TutorialOverlay tutorialKey="cricket" onClose={() => setShowTutorial(false)} />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-4 pt-[calc(1rem+var(--app-safe-top))] bg-[#12141a] border-b border-slate-800 shrink-0">
                <button onClick={onBack} aria-label={lang === 'hu' ? 'Vissza' : 'Back'} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                    <XMarkIcon className="h-6 w-6" />
                </button>
                <h1 className="text-xl font-black text-white uppercase italic tracking-wider">{variant === 'cutthroat' ? 'Cut-throat Cricket' : 'Cricket'}</h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowTutorial(true)} aria-label={lang === 'hu' ? 'Szabályok' : 'Rules'} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-amber-400 transition-colors text-[11px] font-black">?</button>
                    <button onClick={handleReset} aria-label={lang === 'hu' ? 'Újrakezdés' : 'Restart'} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                        <ArrowPathIcon className="h-6 w-6" />
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col lg:flex-row">
            <div className="flex-1 min-h-0 flex flex-col lg:border-r lg:border-slate-800">
            {/* Score header */}
            <div className="grid gap-2 px-4 pt-3 pb-2 shrink-0"
                style={{ gridTemplateColumns: `repeat(${players.length}, 1fr)` }}>
                {players.map(p => {
                    const cc = COLOR_MAP[p.color] || COLOR_MAP.emerald;
                    const isActive = p.id === activePlayer;
                    return (
                        <div key={p.id} className={`flex flex-col items-center p-2 rounded-2xl border-2 transition-all ${isActive ? cc : 'border-slate-800 bg-slate-900/40 text-slate-300'}`}>
                            <span className="text-[9px] font-black uppercase tracking-widest truncate w-full text-center">
                                {p.name}
                            </span>
                            <span className="text-3xl font-black font-mono">{p.score}</span>
                        </div>
                    );
                })}
            </div>

            {/* Cricket grid */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {players.length === 2 && <th className="text-[10px] text-slate-500 font-black uppercase pb-2 w-1/3 text-right pr-4">
                                {players[0].name}
                            </th>}
                            <th className="text-[10px] text-slate-500 font-black uppercase pb-2 text-center">{lang === 'hu' ? 'Célpont' : 'Target'}</th>
                            {players.length === 2 && <th className="text-[10px] text-slate-500 font-black uppercase pb-2 w-1/3 text-left pl-4">
                                {players[1].name}
                            </th>}
                        </tr>
                    </thead>
                    <tbody>
                        {CRICKET_TARGETS.map(target => {
                            const closedByAll = isClosedByAll(target, players);
                            return (
                                <tr key={target} className={`border-b border-slate-800/50 ${closedByAll ? 'opacity-40' : ''}`}>
                                    {players.length === 2 && (
                                        <td className="py-2 text-right pr-4">
                                            <div className="flex items-center justify-end gap-1">
                                                {renderMarks(players[0].marks[target] as Mark)}
                                            </div>
                                        </td>
                                    )}
                                    <td className="py-2 text-center">
                                        <span className={`text-xl font-black font-mono ${closedByAll ? 'line-through text-slate-600' : 'text-white'}`}>
                                            {target === 25 ? 'BULL' : target}
                                        </span>
                                    </td>
                                    {players.length === 2 && (
                                        <td className="py-2 pl-4">
                                            <div className="flex items-center justify-start gap-1">
                                                {renderMarks(players[1].marks[target] as Mark)}
                                            </div>
                                        </td>
                                    )}
                                    {players.length > 2 && players.map(p => (
                                        <td key={p.id} className="py-2 text-center px-2">
                                            <div className="flex justify-center">
                                                {renderMarks(p.marks[target] as Mark)}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            </div>

            {/* Input panel – responsive for phone & tablet */}
            <div className="shrink-0 px-3 sm:px-6 py-3 sm:py-4 bg-[#12141a] border-t lg:border-t-0 border-slate-800 w-full max-w-2xl lg:max-w-none lg:w-[42%] lg:overflow-y-auto mx-auto">
                {/* Pending darts display */}
                <div className="flex gap-2 mb-3">
                    {[0, 1, 2].map(i => (
                        <div key={i} className={`flex-1 h-10 sm:h-12 rounded-xl border flex items-center justify-center font-mono font-black text-sm sm:text-base ${pendingDarts[i] ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-950 border-slate-800 text-slate-700'}`}>
                            {pendingDarts[i] ? `${pendingDarts[i].mult > 1 ? (pendingDarts[i].mult === 3 ? 'T' : 'D') : ''}${pendingDarts[i].target === 25 ? 'B' : pendingDarts[i].target}` : '—'}
                        </div>
                    ))}
                    <button onClick={handleUndo} aria-label={lang === 'hu' ? 'Visszavonás' : 'Undo'} disabled={pendingDarts.length === 0 && turnHistory.length === 0}
                        className="w-12 sm:w-14 h-10 sm:h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 disabled:opacity-30 border border-slate-700 active:scale-90 transition-transform">
                        <BackspaceIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                </div>

                {/* Multiplier */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {([1, 2, 3] as const).map(m => (
                        <button key={m} onClick={() => setActiveMult(m)} aria-pressed={activeMult === m}
                            className={`h-11 sm:h-13 rounded-xl font-black text-xs sm:text-sm uppercase border transition-all active:scale-95 ${activeMult === m
                                ? m === 1 ? 'bg-white text-black border-white'
                                  : m === 2 ? 'bg-emerald-500 text-black border-emerald-400'
                                  : 'bg-rose-600 text-white border-rose-500'
                                : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                            {m === 1 ? (lang === 'hu' ? 'Sima' : 'Single') : m === 2 ? (lang === 'hu' ? 'Dupla' : 'Double') : (lang === 'hu' ? 'Tripla' : 'Triple')}
                        </button>
                    ))}
                </div>

                {/* Target buttons */}
                <div className="grid grid-cols-4 gap-2">
                    {CRICKET_TARGETS.map(t => {
                        const disabled = activeMult === 3 && t === 25;
                        return (
                            <button key={t}
                                onClick={() => !disabled && recordHit(t, activeMult)}
                                disabled={disabled || pendingDarts.length >= 3}
                                className={`h-12 sm:h-14 rounded-xl font-black text-lg sm:text-xl border transition-all active:scale-95 disabled:opacity-30 ${colorClass}`}>
                                {t === 25 ? 'BULL' : t}
                            </button>
                        );
                    })}
                    <button onClick={() => recordHit(0, 1)}
                        disabled={pendingDarts.length >= 3}
                        className="h-12 sm:h-14 rounded-xl font-black text-sm col-span-4 bg-slate-900 border border-slate-700 text-slate-500 active:scale-95 disabled:opacity-30 transition-all">
                        {lang === 'hu' ? 'Mellé' : 'Miss'}
                    </button>
                </div>
            </div>
            </div>

            {/* Winner overlay */}
            {winner && (
                <div className="fixed inset-0 z-50 bg-[#0b0d11]/95 flex flex-col items-center justify-center p-8 text-center">
                    <TrophyIcon className="h-24 w-24 text-amber-400 mb-4 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
                    <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">{lang === 'hu' ? 'Győztes!' : 'Winner!'}</h2>
                    <p className={`text-2xl font-black uppercase mb-2 ${(COLOR_MAP[winner.color] || '').split(' ')[0]}`}>
                        {winner.name}
                    </p>
                    <p className="text-slate-400 font-bold mb-10">{lang === 'hu' ? 'Pontszám' : 'Score'}: {winner.score}</p>
                    <div className="flex gap-4 w-full max-w-xs">
                        <button onClick={onBack} className="flex-1 h-14 bg-slate-800 text-white rounded-2xl font-black uppercase text-sm">
                            {lang === 'hu' ? 'Vissza' : 'Back'}
                        </button>
                        <button onClick={handleReset} className="flex-1 h-14 bg-emerald-500 text-slate-950 rounded-2xl font-black uppercase text-sm">
                            {lang === 'hu' ? 'Újra' : 'Play again'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Mark display helper ──────────────────────────────────────────────────────
function renderMarks(marks: Mark) {
    if (marks === 0) return <span className="text-slate-700 text-xs font-black w-12 text-center">—</span>;
    if (marks === 3) return (
        <span className="text-emerald-400 font-black text-lg leading-none">✓</span>
    );
    return (
        <div className="flex items-center gap-0.5">
            {marks >= 1 && <div className="w-px h-5 bg-slate-300 rotate-12" />}
            {marks >= 2 && <div className="w-px h-5 bg-slate-300 -rotate-12" />}
        </div>
    );
}
