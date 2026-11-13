'use client';

import { useState, useEffect, useRef } from 'react';
import { TrophyIcon, ArrowLeftIcon, BoltIcon, CheckCircleIcon, XMarkIcon, PlayIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import type { TournamentConfig, TournamentPlayer } from './TournamentScreen';
import type { MatchConfig } from './SetupScreen';
import type { Language } from '@/app/page';

interface Match {
    id: string;
    round: number;
    matchIndex: number;
    player1: TournamentPlayer | null;
    player2: TournamentPlayer | null;
    score1: number;
    score2: number;
    winnerId: string | null;
    isBye: boolean;
    isFinished: boolean;
    groupId?: string; 
}

interface TournamentBracketProps {
    lang: Language;
    config: TournamentConfig;
    liveMatchResult?: { winnerId: string; score1: number; score2: number; tournamentMatchId?: string; isGroupMatch?: boolean } | null;
    onBack: () => void;
    onPlayMatch?: (matchConfig: MatchConfig) => void;
}

export function TournamentBracket({ config, liveMatchResult, onBack, onPlayMatch, lang }: TournamentBracketProps) {
    const tr = (hu: string, en: string) => lang === 'hu' ? hu : en;
    // OKOS ÁLLAPOT BETÖLTÉS: Már a legelején betöltjük a memóriából, így nem írja felül a friss élő meccsek eredményét!
    const [phase, setPhase] = useState<'groups' | 'knockout'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`dartisan_tourney_${config.id}`);
            if (saved) return JSON.parse(saved).phase || 'knockout';
        }
        return config.format === 'groups_to_knockout' ? 'groups' : 'knockout';
    });

    const [matches, setMatches] = useState<Match[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`dartisan_tourney_${config.id}`);
            if (saved) return JSON.parse(saved).matches || [];
        }
        return [];
    });

    const [groupMatches, setGroupMatches] = useState<Match[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`dartisan_tourney_${config.id}`);
            if (saved) return JSON.parse(saved).groupMatches || [];
        }
        return [];
    });

    const [numRounds, setNumRounds] = useState<number>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`dartisan_tourney_${config.id}`);
            if (saved) return JSON.parse(saved).numRounds || 1;
        }
        return 1;
    });

    const [isGenerated, setIsGenerated] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`dartisan_tourney_${config.id}`);
            return !!saved;
        }
        return false;
    });

    const [quickEntryMatch, setQuickEntryMatch] = useState<Match | null>(null);
    const [qScore1, setQScore1] = useState(0);
    const [qScore2, setQScore2] = useState(0);
    const quickEntryDialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!quickEntryMatch) return;
        const dialog = quickEntryDialogRef.current;
        if (!dialog) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const siblings = Array.from(dialog.parentElement?.children || []).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialog)
            .map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
        siblings.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
        const focusable = () => Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
        focusable()[0]?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); setQuickEntryMatch(null); return; }
            if (event.key !== 'Tab') return;
            const controls = focusable();
            const first = controls[0];
            const last = controls.at(-1);
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        dialog.addEventListener('keydown', onKeyDown);
        return () => {
            dialog.removeEventListener('keydown', onKeyDown);
            siblings.forEach(({ element, inert, ariaHidden }) => {
                element.inert = inert;
                if (ariaHidden === null) element.removeAttribute('aria-hidden');
                else element.setAttribute('aria-hidden', ariaHidden);
            });
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [quickEntryMatch]);

    const triggerHaptic = () => { if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(20); };

    // --- LOGIKAI FÜGGVÉNYEK ---
    const generateGroupStage = () => {
        const numGroups = config.players.length >= 6 ? 2 : 1;
        const groups: TournamentPlayer[][] = Array.from({length: numGroups}, () => []);
        config.players.forEach((p, i) => { groups[i % numGroups].push(p); });

        const newGroupMatches: Match[] = [];
        groups.forEach((group, gIndex) => {
            const groupId = `Group_${gIndex === 0 ? 'A' : 'B'}`;
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    newGroupMatches.push({
                        id: `gm_${gIndex}_${i}_${j}`, round: 0, matchIndex: 0, groupId,
                        player1: group[i], player2: group[j], score1: 0, score2: 0,
                        winnerId: null, isBye: false, isFinished: false
                    });
                }
            }
        });
        setGroupMatches(newGroupMatches);
        setPhase('groups');
    };

    const getStandings = (groupId: string) => {
        const groupPl = config.players.filter((p, i) => (config.players.length >= 6 ? i % 2 === (groupId === 'Group_A' ? 0 : 1) : true));
        const standings = groupPl.map(p => ({ player: p, played: 0, won: 0, lost: 0, points: 0, legDiff: 0 }));

        groupMatches.filter(m => m.groupId === groupId && m.isFinished).forEach(m => {
            const p1Stat = standings.find(s => s.player.id === m.player1?.id);
            const p2Stat = standings.find(s => s.player.id === m.player2?.id);
            if (p1Stat && p2Stat) {
                p1Stat.played++; p2Stat.played++;
                p1Stat.legDiff += (m.score1 - m.score2);
                p2Stat.legDiff += (m.score2 - m.score1);
                
                // JAVÍTVA BUG: Most már a veszteség (V oszlop) is frissül!
                if (m.winnerId === p1Stat.player.id) { 
                    p1Stat.won++; 
                    p1Stat.points += 2; 
                    p2Stat.lost++; // P2 veszített
                } else if (m.winnerId === p2Stat.player.id) { 
                    p2Stat.won++; 
                    p2Stat.points += 2; 
                    p1Stat.lost++; // P1 veszített
                }
            }
        });

        return standings.sort((a, b) => b.points - a.points || b.legDiff - a.legDiff);
    };

    const isGroupStageFinished = () => {
        return groupMatches.length > 0 && groupMatches.every(m => m.isFinished);
    };

    const advanceToKnockout = () => {
        triggerHaptic();
        let qualified: TournamentPlayer[] = [];
        if (config.players.length >= 6) {
            const stA = getStandings('Group_A'); const stB = getStandings('Group_B');
            qualified = [stA[0].player, stB[1].player, stB[0].player, stA[1].player]; 
        } else {
            const st = getStandings('Group_A');
            qualified = st.slice(0, 4).map(s => s.player); 
        }
        generateKnockoutStage(qualified);
        setPhase('knockout');
    };

    const generateKnockoutStage = (participants: TournamentPlayer[]) => {
        const rounds = Math.max(1, Math.ceil(Math.log2(participants.length)));
        setNumRounds(rounds);

        const numSlots = Math.pow(2, rounds);
        const paddedPlayers: (TournamentPlayer | null)[] = [...participants];
        while (paddedPlayers.length < numSlots) { paddedPlayers.push(null); }

        const initialMatches: Match[] = [];
        for (let r = 0; r < rounds; r++) {
            const matchesInRound = Math.pow(2, rounds - r - 1);
            for (let m = 0; m < matchesInRound; m++) {
                if (r === 0) {
                    const p1 = paddedPlayers[m * 2]; const p2 = paddedPlayers[m * 2 + 1];
                    const isBye = !p1 || !p2;
                    initialMatches.push({ id: `r${r}_m${m}`, round: r, matchIndex: m, player1: p1 || null, player2: p2 || null, score1: 0, score2: 0, winnerId: isBye ? (p1 ? p1.id : p2 ? p2.id : null) : null, isBye, isFinished: isBye });
                } else {
                    initialMatches.push({ id: `r${r}_m${m}`, round: r, matchIndex: m, player1: null, player2: null, score1: 0, score2: 0, winnerId: null, isBye: false, isFinished: false });
                }
            }
        }

        let advancedMatches = [...initialMatches];
        initialMatches.forEach(match => {
            if (match.isBye && match.winnerId) {
                const winner = match.player1?.id === match.winnerId ? match.player1 : match.player2;
                if (winner) advancedMatches = advancePlayer(advancedMatches, match, winner);
            }
        });
        setMatches(advancedMatches);
    };

    const advancePlayer = (currentMatches: Match[], completedMatch: Match, winner: TournamentPlayer): Match[] => {
        const nextRound = completedMatch.round + 1;
        const nextMatchIndex = Math.floor(completedMatch.matchIndex / 2);
        return currentMatches.map(m => {
            if (m.round === nextRound && m.matchIndex === nextMatchIndex) {
                const isPlayer1 = completedMatch.matchIndex % 2 === 0;
                return { ...m, player1: isPlayer1 ? winner : m.player1, player2: !isPlayer1 ? winner : m.player2 };
            }
            return m;
        });
    };

    const handleSaveQuickEntry = () => {
        if (!quickEntryMatch) return;
        const target = config.setsToWin > 1 ? config.setsToWin : config.legsToWin;
        if ((qScore1 === target) === (qScore2 === target)) return;
        triggerHaptic();
        const p1Wins = qScore1 === target;
        const p2Wins = qScore2 === target;
        const winnerId = p1Wins && quickEntryMatch.player1 ? quickEntryMatch.player1.id : (p2Wins && quickEntryMatch.player2 ? quickEntryMatch.player2.id : null);
        
        if (quickEntryMatch.groupId) handleGroupMatchComplete(quickEntryMatch.id, qScore1, qScore2, winnerId);
        else handleKnockoutMatchComplete(quickEntryMatch.id, qScore1, qScore2, winnerId);
        
        setQuickEntryMatch(null);
    };

    const handleGroupMatchComplete = (matchId: string, s1: number, s2: number, winnerId: string | null) => {
        setGroupMatches(prev => prev.map(m => m.id === matchId ? { ...m, score1: s1, score2: s2, isFinished: true, winnerId } : m));
    };

    const handleKnockoutMatchComplete = (matchId: string, s1: number, s2: number, winnerId: string | null) => {
        let newMatches = matches.map(m => m.id === matchId ? { ...m, score1: s1, score2: s2, isFinished: !!winnerId, winnerId } : m);
        const completedMatch = newMatches.find(m => m.id === matchId);
        const winnerPlayer = winnerId === completedMatch?.player1?.id ? completedMatch?.player1 : completedMatch?.player2;
        if (winnerPlayer && completedMatch) newMatches = advancePlayer(newMatches, completedMatch, winnerPlayer);
        setMatches(newMatches);
    };

    const handleStartLiveMatch = (match: Match) => {
        if (!onPlayMatch || !match.player1 || !match.player2) return;
        triggerHaptic();
        onPlayMatch({
            gameMode: 'x01',
            startingScore: 501, checkout: 'double',
            checkIn: 'single', muteCaller: false,
            legsToWin: config.legsToWin, setsToWin: config.setsToWin,
            tournamentId: config.id,
            tournamentMatchId: match.id,
            tournamentPlayerIds: [match.player1.id, match.player2.id],
            isGroupMatch: !!match.groupId,
            players: [
                { name: match.player1.name, isBot: false, difficulty: 5, color: 'emerald' },
                { name: match.player2.name, isBot: false, difficulty: 5, color: 'rose' },
            ],
        });
    };

    const renderMatchCard = (match: Match) => {
        const isPlayable = match.player1 && match.player2 && !match.isFinished;
        const hasWinner = match.isFinished && match.winnerId;

        return (
            <div key={match.id} className={`relative flex flex-col bg-[#12141a] rounded-2xl border-2 transition-all ${isPlayable ? 'border-[#b655ff]/50 shadow-[0_0_20px_rgba(182,85,255,0.15)] hover:border-[#b655ff]' : hasWinner ? 'border-emerald-500/30' : 'border-slate-800 opacity-60'} overflow-hidden shrink-0`}>
                <div className={`p-3 flex justify-between items-center border-b border-slate-800 ${match.winnerId === match.player1?.id ? 'bg-emerald-500/10' : ''}`}>
                    <span className={`font-black text-sm uppercase truncate pr-2 ${match.player1 ? 'text-white' : 'text-slate-600'}`}>{match.player1?.name || 'TBD'}</span>
                    <span className={`font-mono text-lg font-black ${match.winnerId === match.player1?.id ? 'text-emerald-400' : 'text-slate-500'}`}>{match.isFinished && !match.isBye ? match.score1 : '-'}</span>
                </div>
                <div className={`p-3 flex justify-between items-center ${match.winnerId === match.player2?.id ? 'bg-emerald-500/10' : ''}`}>
                    <span className={`font-black text-sm uppercase truncate pr-2 ${match.player2 ? 'text-white' : 'text-slate-600'}`}>{match.player2?.name || 'TBD'}</span>
                    <span className={`font-mono text-lg font-black ${match.winnerId === match.player2?.id ? 'text-emerald-400' : 'text-slate-500'}`}>{match.isFinished && !match.isBye ? match.score2 : '-'}</span>
                </div>

                {isPlayable && (
                    <div className="bg-slate-900 p-2 flex gap-2 border-t border-slate-800">
                        {config.allowQuickEntry && (
                            <button onClick={() => { setQuickEntryMatch(match); setQScore1(match.score1); setQScore2(match.score2); triggerHaptic(); }} className="flex-1 min-h-11 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-colors">
                                <BoltIcon className="h-3 w-3" /> {tr('Gyors rögzítés', 'Quick entry')}
                            </button>
                        )}
                        {onPlayMatch && (
                            <button onClick={() => handleStartLiveMatch(match)} className="flex-1 min-h-11 bg-[#b655ff]/10 text-[#b655ff] hover:bg-[#b655ff]/20 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-colors">
                                <PlayIcon className="h-3 w-3" /> {tr('Játék a táblán', 'Play on board')}
                            </button>
                        )}
                    </div>
                )}
                {hasWinner && !match.isBye && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none"><CheckCircleIcon className="h-16 w-16 text-emerald-500" /></div>}
                {match.isBye && <div className="bg-slate-800 text-slate-400 text-[9px] font-black uppercase text-center py-1">{tr('Erőnyerő', 'Bye')}</div>}
            </div>
        );
    };

    // 1. Ágrajz generálása (csak legelső alkalommal, ha még nincs mentés)
    useEffect(() => {
        if (isGenerated) return;
        const timer = window.setTimeout(() => {
            if (config.format === 'groups_to_knockout') {
                generateGroupStage();
            } else {
                generateKnockoutStage(config.players);
            }
            setIsGenerated(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [isGenerated, config]);

    // 2. ÉLŐ MECCS EREDMÉNYÉNEK FOGADÁSA ÉS BEÍRÁSA (Biztonságosan, useRef-fel)
    const appliedLiveMatchRef = useRef<string | null>(null);

    useEffect(() => {
        if (liveMatchResult && liveMatchResult.tournamentMatchId && appliedLiveMatchRef.current !== liveMatchResult.tournamentMatchId) {
            appliedLiveMatchRef.current = liveMatchResult.tournamentMatchId; // Megjelöljük, hogy ezt már beírtuk!

            if (liveMatchResult.isGroupMatch) {
                handleGroupMatchComplete(liveMatchResult.tournamentMatchId, liveMatchResult.score1, liveMatchResult.score2, liveMatchResult.winnerId);
            } else {
                handleKnockoutMatchComplete(liveMatchResult.tournamentMatchId, liveMatchResult.score1, liveMatchResult.score2, liveMatchResult.winnerId);
            }
        }
    }, [liveMatchResult]);

    // 3. Automatikus Mentés minden változásnál
    useEffect(() => {
        if (matches.length > 0 || groupMatches.length > 0) {
            localStorage.setItem(`dartisan_tourney_${config.id}`, JSON.stringify({ matches, groupMatches, phase, numRounds }));
        }
    }, [matches, groupMatches, phase, numRounds, config.id]);


    return (
        <div className="fixed inset-0 z-[200] bg-[#0b0d11] text-slate-200 flex flex-col h-[100dvh]">
            <div className="flex items-center justify-between px-4 pb-4 pt-[calc(1rem+var(--app-safe-top))] shrink-0 bg-[#12141a] border-b border-slate-800 shadow-xl z-20">
                <button onClick={onBack} aria-label={tr('Vissza', 'Back')} className="h-11 w-11 shrink-0 flex items-center justify-center bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"><ArrowLeftIcon className="h-5 w-5 text-white" /></button>
                <div className="flex-1 min-w-0 mx-2 flex flex-col items-center">
                    <h1 title={config.name} className="max-w-full truncate text-base sm:text-xl font-black text-white uppercase italic tracking-widest leading-none">{config.name}</h1>
                    <span className="text-[10px] text-[#b655ff] font-bold uppercase tracking-widest mt-1">{phase === 'groups' ? tr('Csoportkör', 'Group stage') : tr('Kieséses szakasz', 'Knockout stage')}</span>
                </div>
                <div className="w-11"></div>
            </div>

            {phase === 'groups' && (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {['Group_A', config.players.length >= 6 ? 'Group_B' : null].filter(Boolean).map(gId => (
                        <div key={gId} className="mb-8 bg-slate-900/50 p-4 rounded-3xl border border-slate-800">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4"><TableCellsIcon className="h-5 w-5 text-cyan-400"/> {tr('Csoport', 'Group')} {gId === 'Group_A' ? 'A' : 'B'} {tr('tabella', 'standings')}</h2>
                            <div className="bg-[#12141a] rounded-xl overflow-hidden border border-slate-800 mb-6">
                                <table className="w-full text-left text-xs uppercase font-bold text-slate-400">
                                    <thead className="bg-slate-900"><tr><th className="p-3">{tr('Játékos', 'Player')}</th><th className="p-3 text-center" title={tr('Meccs', 'Played')}>M</th><th className="p-3 text-center text-emerald-400" title={tr('Győzelem', 'Won')}>{tr('Gy', 'W')}</th><th className="p-3 text-center text-rose-400" title={tr('Vereség', 'Lost')}>{tr('V', 'L')}</th><th className="p-3 text-center">{tr('Legkül.', 'Leg diff.')}</th><th className="p-3 text-center text-white">{tr('Pont', 'Pts')}</th></tr></thead>
                                    <tbody>
                                        {getStandings(gId!).map((s, i) => (
                                            <tr key={s.player.id} className="border-t border-slate-800">
                                                <td className="p-3 text-white font-black truncate max-w-[100px]"><span className="text-slate-600 mr-2">{i+1}.</span>{s.player.name}</td>
                                                <td className="p-3 text-center">{s.played}</td><td className="p-3 text-center text-emerald-400">{s.won}</td><td className="p-3 text-center text-rose-400">{s.lost}</td><td className="p-3 text-center">{s.legDiff > 0 ? '+'+s.legDiff : s.legDiff}</td><td className="p-3 text-center text-white font-black">{s.points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">{tr('Meccsek', 'Matches')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {groupMatches.filter(m => m.groupId === gId).map(renderMatchCard)}
                            </div>
                        </div>
                    ))}
                    {isGroupStageFinished() && (
                        <button onClick={advanceToKnockout} className="w-full h-16 bg-emerald-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-xl animate-bounce mb-8">
                            {tr('Csoportkör vége · indul a rájátszás', 'Group stage complete · start knockout')}
                        </button>
                    )}
                </div>
            )}

            {phase === 'knockout' && (
                <>
                {numRounds > 1 && <p className="sm:hidden shrink-0 px-4 py-2 text-center text-xs font-bold text-slate-400 border-b border-slate-800">← {tr('Húzd oldalra a további körökhöz', 'Swipe sideways for more rounds')} →</p>}
                <div className="flex-1 min-h-0 overflow-auto overscroll-contain custom-scrollbar p-4 sm:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-[#0b0d11] to-[#0b0d11]">
                    <div className="min-h-full w-max min-w-full flex items-start justify-center">
                    <div className="flex items-stretch gap-4 sm:gap-8">
                    {Array.from({ length: numRounds }, (_, i) => i).map((round) => (
                        <div key={round} className="flex flex-col shrink-0 w-64 gap-4">
                            <h2 className="h-7 text-center text-xs font-black text-slate-400 uppercase tracking-[0.25em]">{round === numRounds - 1 ? tr('Döntő', 'Final') : round === numRounds - 2 ? tr('Elődöntő', 'Semifinal') : `${tr('Kör', 'Round')} ${round + 1}`}</h2>
                            <div className="flex-1 flex flex-col justify-around gap-4">{matches.filter(m => m.round === round).map(renderMatchCard)}</div>
                        </div>
                    ))}
                    {matches.find(m => m.round === numRounds - 1)?.isFinished && (
                        <div className="flex flex-col items-center justify-center shrink-0 w-64">
                            <TrophyIcon className="h-24 w-24 text-[#b655ff] mb-4 drop-shadow-[0_0_30px_rgba(182,85,255,0.6)]" />
                            <h2 className="text-3xl font-black text-white uppercase italic tracking-widest text-center">{tr('Bajnok!', 'Champion!')}</h2>
                            <span className="text-xl text-[#b655ff] font-black uppercase mt-2 text-center">{matches.find(m => m.round === numRounds - 1)?.player1?.id === matches.find(m => m.round === numRounds - 1)?.winnerId ? matches.find(m => m.round === numRounds - 1)?.player1?.name : matches.find(m => m.round === numRounds - 1)?.player2?.name}</span>
                        </div>
                    )}
                    </div>
                    </div>
                </div>
                </>
            )}

            {/* GYORS RÖGZÍTÉS MODAL */}
            {quickEntryMatch && (
                <div ref={quickEntryDialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-entry-title" className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[#12141a] border border-slate-800 rounded-[2rem] p-4 sm:p-6 w-full max-w-sm my-auto shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 id="quick-entry-title" className="text-cyan-400 font-black uppercase tracking-widest flex items-center gap-2"><BoltIcon className="h-6 w-6" /> {tr('Eredmény', 'Result')}</h3>
                            <button onClick={() => setQuickEntryMatch(null)} aria-label={tr('Bezárás', 'Close')} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><XMarkIcon className="h-5 w-5" /></button>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 text-center">
                            <span className="text-xs text-slate-400 font-bold uppercase block mb-1">{tr('A győzelemhez szükséges:', 'First to:')}</span>
                            <span className="text-cyan-400 font-black text-sm uppercase">
                                {config.setsToWin > 1 ? `${config.setsToWin} ${tr('nyert szett', 'sets won')}` : `${config.legsToWin} ${tr('nyert leg', 'legs won')}`}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-8">
                            <div className="flex flex-col items-center min-w-0">
                                <span className="text-white font-black uppercase truncate w-full text-center mb-3">{quickEntryMatch.player1?.name}</span>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <button onClick={() => setQScore1(Math.max(0, qScore1 - 1))} aria-label={`${quickEntryMatch.player1?.name}: ${tr('csökkentés', 'decrease')}`} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-slate-800 text-white font-black text-xl hover:bg-slate-700 active:scale-95">-</button>
                                    <span className="text-3xl sm:text-4xl font-mono font-black text-white w-8 sm:w-10 text-center" aria-live="polite">{qScore1}</span>
                                    <button onClick={() => setQScore1(Math.min(config.setsToWin > 1 ? config.setsToWin : config.legsToWin, qScore1 + 1))} aria-label={`${quickEntryMatch.player1?.name}: ${tr('növelés', 'increase')}`} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-slate-800 text-white font-black text-xl hover:bg-slate-700 active:scale-95">+</button>
                                </div>
                            </div>

                            <div className="flex flex-col items-center min-w-0">
                                <span className="text-white font-black uppercase truncate w-full text-center mb-3">{quickEntryMatch.player2?.name}</span>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <button onClick={() => setQScore2(Math.max(0, qScore2 - 1))} aria-label={`${quickEntryMatch.player2?.name}: ${tr('csökkentés', 'decrease')}`} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-slate-800 text-white font-black text-xl hover:bg-slate-700 active:scale-95">-</button>
                                    <span className="text-3xl sm:text-4xl font-mono font-black text-white w-8 sm:w-10 text-center" aria-live="polite">{qScore2}</span>
                                    <button onClick={() => setQScore2(Math.min(config.setsToWin > 1 ? config.setsToWin : config.legsToWin, qScore2 + 1))} aria-label={`${quickEntryMatch.player2?.name}: ${tr('növelés', 'increase')}`} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-slate-800 text-white font-black text-xl hover:bg-slate-700 active:scale-95">+</button>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveQuickEntry} 
                            disabled={(qScore1 === (config.setsToWin > 1 ? config.setsToWin : config.legsToWin)) === (qScore2 === (config.setsToWin > 1 ? config.setsToWin : config.legsToWin))}
                            className="w-full h-16 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none bg-cyan-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-lg shadow-[0_10px_30px_rgba(6,182,212,0.3)] hover:opacity-90 active:scale-95 transition-all"
                        >
                            {tr('Mentés és továbbjutás', 'Save and advance')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
