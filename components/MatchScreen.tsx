// 1. RÉSZ - MatchScreen.tsx (Kérd a folytatást a következő üzenetben!)
'use client';

import { useState, useEffect, useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { 
    BackspaceIcon, TrophyIcon, ChartBarIcon, BoltIcon, XMarkIcon, 
    ComputerDesktopIcon, InformationCircleIcon, CheckCircleIcon, 
    ClockIcon, ArrowPathIcon, ShieldCheckIcon, FireIcon, ShareIcon, 
    ForwardIcon
} from '@heroicons/react/24/outline';

import type { Language } from '@/app/page';
import { db, auth, functions } from '../firebase';
import { doc, updateDoc, onSnapshot, increment, setDoc, getDoc, writeBatch, runTransaction, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { publicProfileData } from '../lib/publicProfile';
import { canCheckoutInDarts, canScoreInDarts, evaluateVisit, previewRemainingScore } from '../lib/x01';
import { recordQuestMatch } from '../lib/quests';
import { TutorialOverlay, shouldShowTutorial, type TutorialKey } from './TutorialOverlay';
import { HeatmapBoard, HeatmapLegend } from './HeatmapBoard';
import { isSector, normalizeHeatmapData, type HeatmapData } from '../lib/heatmap';
import { applyHeatmapEvent, enqueueHeatmapEvent, flushHeatmapQueue, hunterHeatmapEvent, matchHeatmapEvent, reverseHeatmapEvent, type HeatmapEvent } from '../lib/heatmapSync';
import type { MatchConfig } from './SetupScreen';
import { AppFeedback, type AppFeedbackState } from './AppFeedback';
import { orderedVisits, recordVisit, type MatchVisit } from '../lib/matchReplay';

export type Dart = { val: number; mult: number; heatmapEvent?: HeatmapEvent };
const SERVER_MATCH_ENABLED = process.env.NEXT_PUBLIC_SERVER_MATCH_ENABLED === 'true';
const AIM_NUMBERS = Array.from({ length: 20 }, (_, index) => index + 1);

export type PlayerData = { 
    id: number; name: string; isBot: boolean; difficulty: number; color: string; 
    score: number; setsWon: number; legsWon: number; totalPoints: number; totalDarts: number; 
    currentLegDarts: number; lastVisit: number | null; opened?: boolean;
    history: { score: number; dartsCount: number; points: number; roundDarts: Dart[]; openedBefore?: boolean }[];
    visitLog: MatchVisit[];
    count100: number; count140: number; count180: number; highestCheckout: number; 
    bestLegDarts: number | null; checkoutAttempts: number; checkoutSuccess: number; 
    first9Points: number; first9Darts: number; legAverages: number[];
    teamId?: number; customStartingScore?: number;  
};

const copyPlayers = (players: PlayerData[]): PlayerData[] => players.map(player => ({
    ...player,
    history: [...player.history],
    visitLog: [...(player.visitLog || [])],
    legAverages: [...player.legAverages],
}));

const displayedRemaining = (player: PlayerData, activePlayer: number, darts: Dart[], config: MatchConfig): number => {
    if (config.gameMode === 'practice' || player.id !== activePlayer || player.score <= 0 || darts.length === 0) return player.score;
    return previewRemainingScore(player.score, darts.map(dart => ({ val: dart.val, mult: dart.mult as 1 | 2 | 3 })), {
        checkIn: config.checkIn,
        checkout: config.checkout,
        opened: player.opened ?? (config.checkIn === 'single' || player.score < (player.customStartingScore ?? config.startingScore)),
    });
};
type OnlineRoom = {
    state: {
        currentLeg: number;
        hostDarts: number | null;
        guestDarts: number | null;
        hostLegsWon: number;
        guestLegsWon: number;
        hostSetsWon: number;
        guestSetsWon: number;
        winner: 'host' | 'guest' | null;
        resolvedLeg?: { number: number; winner: 'host' | 'guest'; setEnded: boolean; matchEnded: boolean };
    };
};

const triggerHaptic = (type: 'hit' | 'miss' | 'bust' | 'checkout' | 'tap') => {
    if (typeof window !== 'undefined' && localStorage.getItem('dartisan_haptic') !== 'false' && navigator.vibrate) {
        switch(type) {
            case 'tap': navigator.vibrate(20); break;
            case 'hit': navigator.vibrate(40); break;
            case 'miss': navigator.vibrate([30, 50, 30]); break; 
            case 'bust': navigator.vibrate([50, 100, 50, 100, 50]); break; 
            case 'checkout': navigator.vibrate([100, 50, 100, 50, 200]); break; 
        }
    }
};

const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return { x: centerX + (radius * Math.cos(angleInRadians)), y: centerY + (radius * Math.sin(angleInRadians)) };
};

const describeArc = (x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) => {
  const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
  const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const startInner = polarToCartesian(x, y, innerRadius, endAngle);
  const endInner = polarToCartesian(x, y, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [ "M", startOuter.x, startOuter.y, "A", outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y, "L", endInner.x, endInner.y, "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y, "Z" ].join(" ");
};

// ─── TV Mode dart coordinate mapper ──────────────────────────────────────────
const tvDartCoord = (val: number, mult: number, idx: number) => {
    const C = 150;
    const s = idx * 61 + val * 7 + mult * 13;
    if (val === 0) { // miss - outside board
        const a = ((s * 73) % 360 - 90) * Math.PI / 180;
        return { x: C + 158 * Math.cos(a), y: C + 158 * Math.sin(a) };
    }
    if (val === 25) {
        const a = ((s * 43) % 360 - 90) * Math.PI / 180;
        const r = mult === 2 ? 3 + (s % 4) : 9 + (s % 6);
        return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
    }
    const segIdx = DARTBOARD_ORDER.indexOf(val);
    const jitter = (s % 12) - 6;
    const a = (segIdx * 18 - 9 + 9 + jitter - 90) * Math.PI / 180;
    let r: number;
    if      (mult === 3) r = 83 + (s % 7);
    else if (mult === 2) r = 128 + (s % 7);
    else                 r = s % 2 === 0 ? 30 + (s % 45) : 92 + (s % 30);
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

const InteractiveDartboard = ({
    onDartSelect,
    currentDarts = [],
    playerColor  = 'emerald',
    lang,
}: {
    onDartSelect: (val: number, mult: number) => void;
    currentDarts?: Dart[];
    playerColor?: string;
    lang: Language;
}) => {
    const C = 150, SA = 18;
    const [keyboardSectorIndex, setKeyboardSectorIndex] = useState(0);
    const [keyboardRing, setKeyboardRing] = useState(1);
    const [keyboardSpecial, setKeyboardSpecial] = useState<'sector' | 'bull' | 'dbull' | 'miss'>('sector');
    const [keyboardFocused, setKeyboardFocused] = useState(false);
    const keyboardNumber = DARTBOARD_ORDER[keyboardSectorIndex];
    const ringMultiplier = [1, 3, 1, 2][keyboardRing];
    const keyboardTarget = keyboardSpecial === 'bull' ? (lang === 'hu' ? 'Külső bull, 25' : 'Outer bull, 25')
      : keyboardSpecial === 'dbull' ? (lang === 'hu' ? 'Belső bull, 50' : 'Inner bull, 50')
      : keyboardSpecial === 'miss' ? (lang === 'hu' ? 'Mellé' : 'Miss')
      : `${lang === 'hu' ? ['Belső sima', 'Tripla', 'Külső sima', 'Dupla'][keyboardRing] : ['Inner single', 'Triple', 'Outer single', 'Double'][keyboardRing]} ${keyboardNumber}`;
    const handleBoardKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            setKeyboardSpecial('sector');
            setKeyboardSectorIndex(index => (index + (event.key === 'ArrowRight' ? 1 : 19)) % 20);
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            setKeyboardSpecial('sector');
            setKeyboardRing(ring => (ring + (event.key === 'ArrowDown' ? 1 : 3)) % 4);
        } else if (event.key.toLowerCase() === 'b') {
            event.preventDefault();
            setKeyboardSpecial(event.shiftKey ? 'dbull' : 'bull');
        } else if (event.key.toLowerCase() === 'm') {
            event.preventDefault();
            setKeyboardSpecial('miss');
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (keyboardSpecial === 'miss') onDartSelect(0, 1);
            else if (keyboardSpecial === 'bull') onDartSelect(25, 1);
            else if (keyboardSpecial === 'dbull') onDartSelect(25, 2);
            else onDartSelect(keyboardNumber, ringMultiplier);
        }
    };
    const hex = playerColor === 'rose'   ? '#fb7185'
              : playerColor === 'cyan'   ? '#22d3ee'
              : playerColor === 'amber'  ? '#fbbf24'
              : playerColor === 'purple' ? '#b655ff'
              : '#34d399';

    // Build hit-overlay lookup from currentDarts
    const hitSingle  = new Set<number>();
    const hitTriple  = new Set<number>();
    const hitDouble  = new Set<number>();
    let bullHit = false, dbullHit = false;
    currentDarts.forEach(d => {
        if (d.val === 0)  return;
        if (d.val === 25) { d.mult === 2 ? dbullHit = true : bullHit = true; return; }
        if (d.mult === 3) hitTriple.add(d.val);
        else if (d.mult === 2) hitDouble.add(d.val);
        else hitSingle.add(d.val);
    });

    return (
        <svg viewBox="0 0 300 300" role="button" tabIndex={0} aria-label={`${keyboardTarget}. ${lang === 'hu' ? 'Balra és jobbra szektor, fel és le gyűrű, B bull, Shift+B belső bull, M mellé, Enter dobás.' : 'Left and right change sector, up and down change ring, B bull, Shift+B inner bull, M miss, Enter to throw.'}`} onKeyDown={handleBoardKeyDown} onFocus={() => setKeyboardFocused(true)} onBlur={() => setKeyboardFocused(false)} className="drop-shadow-2xl block h-auto max-w-full mx-auto select-none overflow-visible focus:outline-none" style={{ width: 'min(100%, calc(100dvh - 250px), 900px)' }}>
            {/* Background / miss zone */}
            <circle cx={C} cy={C} r={148} fill="#0b0d11" onClick={() => onDartSelect(0,1)} className="cursor-pointer hover:fill-slate-900 transition-colors" />

            {DARTBOARD_ORDER.map((num, i) => {
                const sa = i*SA - SA/2, ea = sa + SA;
                const isEven = i % 2 === 0;
                const single = isEven ? '#12141a' : '#f8fafc';
                const multi  = isEven ? '#e11d48' : '#10b981';
                const tp     = polarToCartesian(C, C, 142, sa + SA/2);
                return (
                    <g key={num}>
                        {/* ── Base segments ── */}
                        <path d={describeArc(C,C,15,80,sa,ea)}   fill={single} stroke="#1e293b" strokeWidth="0.5" onClick={()=>onDartSelect(num,1)} className="cursor-pointer hover:opacity-75 transition-opacity"/>
                        <path d={describeArc(C,C,80,90,sa,ea)}   fill={multi}  stroke="#1e293b" strokeWidth="0.5" onClick={()=>onDartSelect(num,3)} className="cursor-pointer hover:opacity-75 transition-opacity"/>
                        <path d={describeArc(C,C,90,125,sa,ea)}  fill={single} stroke="#1e293b" strokeWidth="0.5" onClick={()=>onDartSelect(num,1)} className="cursor-pointer hover:opacity-75 transition-opacity"/>
                        <path d={describeArc(C,C,125,135,sa,ea)} fill={multi}  stroke="#1e293b" strokeWidth="0.5" onClick={()=>onDartSelect(num,2)} className="cursor-pointer hover:opacity-75 transition-opacity"/>
                        <text x={tp.x} y={tp.y} fill="#94a3b8" fontSize="10" fontWeight="900" textAnchor="middle" alignmentBaseline="middle"
                              transform={`rotate(${sa+SA/2} ${tp.x} ${tp.y})`} pointerEvents="none">{num}</text>

                        {/* ── Hit overlays (show recorded darts) ── */}
                        {hitSingle.has(num) && <>
                            <path d={describeArc(C,C,15,80,sa,ea)}   fill={hex} opacity="0.55" pointerEvents="none"/>
                            <path d={describeArc(C,C,90,125,sa,ea)}  fill={hex} opacity="0.55" pointerEvents="none"/>
                        </>}
                        {hitTriple.has(num) && <path d={describeArc(C,C,80,90,sa,ea)}   fill={hex} opacity="0.8" pointerEvents="none"/>}
                        {hitDouble.has(num) && <path d={describeArc(C,C,125,135,sa,ea)} fill={hex} opacity="0.8" pointerEvents="none"/>}
                    </g>
                );
            })}

            {/* Bull */}
            <circle cx={C} cy={C} r={15}   fill="#10b981" stroke="#1e293b" strokeWidth="0.5" onClick={()=>onDartSelect(25,1)} className="cursor-pointer hover:opacity-75 transition-opacity"/>
            <circle cx={C} cy={C} r={6.35} fill="#e11d48" stroke="#1e293b" strokeWidth="0.5" onClick={()=>onDartSelect(25,2)} className="cursor-pointer hover:opacity-75 transition-opacity"/>
            {bullHit  && <circle cx={C} cy={C} r={15}   fill={hex} opacity="0.55" pointerEvents="none"/>}
            {dbullHit && <circle cx={C} cy={C} r={6.35} fill={hex} opacity="0.8"  pointerEvents="none"/>}

            {keyboardFocused && keyboardSpecial === 'sector' && <path d={describeArc(C, C, [15, 80, 90, 125][keyboardRing], [80, 90, 125, 135][keyboardRing], keyboardSectorIndex * SA - SA / 2, keyboardSectorIndex * SA + SA / 2)} fill="none" stroke="#22d3ee" strokeWidth="2.5" pointerEvents="none" />}
            {keyboardFocused && keyboardSpecial === 'bull' && <circle cx={C} cy={C} r={15} fill="none" stroke="#22d3ee" strokeWidth="2.5" pointerEvents="none" />}
            {keyboardFocused && keyboardSpecial === 'dbull' && <circle cx={C} cy={C} r={6.35} fill="none" stroke="#22d3ee" strokeWidth="2.5" pointerEvents="none" />}
            {keyboardFocused && keyboardSpecial === 'miss' && <circle cx={C} cy={C} r={147} fill="none" stroke="#22d3ee" strokeWidth="2.5" pointerEvents="none" />}

            {/* Dart index badges */}
            {currentDarts.map((d, di) => {
                const pos = tvDartCoord(d.val, d.mult, di);
                return (
                    <g key={di} pointerEvents="none">
                        <circle cx={pos.x} cy={pos.y} r="8"   fill={hex} opacity="0.9" stroke="#fff" strokeWidth="1.5"/>
                        <text   x={pos.x}  y={pos.y+0.5} fill="#000" fontSize="8" fontWeight="900" textAnchor="middle" alignmentBaseline="middle">{di+1}</text>
                    </g>
                );
            })}
        </svg>
    );
};

const StaminaChart = ({ averages, color, lang }: { averages: number[], color: string, lang: Language }) => {
    if (!averages || averages.length === 0) return <p className="text-[9px] text-slate-500 uppercase font-bold text-center mt-3">{lang === 'hu' ? 'Nincs elég leg a görbéhez' : 'Not enough legs for a trend yet'}</p>;
    const hexColor = color === 'emerald' ? '#34d399' : color === 'rose' ? '#fb7185' : color === 'cyan' ? '#22d3ee' : color === 'amber' ? '#fbbf24' : color === 'purple' ? '#b655ff' : '#34d399';
    if (averages.length === 1) {
        return (
            <div className="w-full h-24 relative mt-3 bg-slate-950/50 rounded-xl border border-slate-800 p-2 pt-5 flex items-center justify-center">
                <span className="absolute top-2 left-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">{lang === 'hu' ? 'Átlag alakulása / leg' : 'Average by leg'}</span>
                <div className="flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full" style={{backgroundColor: hexColor}}></div>
                    <span className="text-xl font-mono font-black text-white mt-1">{averages[0]}</span>
                </div>
            </div>
        );
    }
    const maxAvg = Math.max(...averages, 60);
    const minAvg = Math.max(0, Math.min(...averages, 40) - 5);
    const range = maxAvg - minAvg || 1;
    const points = averages.map((avg, index) => {
        const x = (index / (averages.length - 1)) * 100;
        const y = 100 - (((avg - minAvg) / range) * 100);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-32 relative mt-3 bg-slate-950/50 rounded-xl border border-slate-800 p-2 overflow-visible">
            <span className="absolute top-2 left-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">{lang === 'hu' ? 'Átlag alakulása / leg' : 'Average by leg'}</span>
            <div className="absolute top-10 bottom-6 left-6 right-6">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <polyline points={points} fill="none" stroke={hexColor} strokeWidth="3" className="opacity-70" />
                </svg>
                {averages.map((avg, index) => {
                    const x = (index / (averages.length - 1)) * 100;
                    const y = 100 - (((avg - minAvg) / range) * 100);
                    const isEven = index % 2 === 0;
                    return (
                        <div key={index} className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${x}%`, top: `${y}%` }}>
                            <span className={`text-[10px] sm:text-xs font-mono font-black text-white bg-slate-950/80 px-1 rounded-md absolute ${isEven ? 'bottom-3' : 'top-3'}`}>{avg}</span>
                            <div className="w-3 h-3 rounded-full border-[2px] border-slate-900" style={{ backgroundColor: hexColor }}></div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const t = {
  en: {
    matchShot: "Match Shot", winsMatch: "Wins the Match!", stats: "Match Statistics", player: "Player",
    avg: "Average", bestOut: "Best / High Out", back: "Back to Lobby", gameShot: "Game Shot!",
    takes: "takes the", set: "set", leg: "leg", next: "Next", bust: "No score", e180: "One hundred and eighty!",
    impossible: "Impossible score!", checkoutMsg: (v: number) => `${v} checkout!`,
    chalEnd: "Match Completed!", chalCode: "Waiting for opponent...", copy: "Copy Code",
    startGame: "Start Game", careerWon: "Opponent Defeated!", rulesTitle: "Rules", target: "Target",
    points: "Points", roundSoFar: "Round so far:", gameOver: "Game Over", youDidIt: "You Did It!",
    finalScore: "Final Score:", playAgain: "Play Again", waitLegTitle: "Leg Completed!",
    waitLegDesc: "You finished this leg. Waiting for your friend to finish theirs...",
    waitMatchTitle: "Match in Progress", waitMatchDesc: "You finished your required legs. Waiting for final results from your friend.",
    oppPlaying: "Opponent is currently playing their leg...", atcRules1: "Throw from 1 to 20 sequentially, then the Bull.",
    atcRules2: "Singles, doubles, and triples all count as a hit.", atcRules3: "Keep throwing at the target number until you hit it.",
    bobsRules1: "Start with 27 points. Targets are Doubles from 1 to 20, then Bull.",
    bobsRules2: "Hitting the target double adds its value to your score.",
    bobsRules3: "If you miss the target with all 3 darts, its value is subtracted.",
    bobsRules4: "If your score drops below zero, it's immediately Game Over!",
    c121Rules1: "You have 9 darts to check out the current score.",
    c121Rules2: "Start at 121. If you check out in 9 darts, you move to 122.",
    c121Rules3: "If you fail to check out in 9 darts, it's Game Over.",
    c121Rules4: "Double out is mandatory. Busting uses your darts but resets your score.",
    careerRule1: "You are playing a World Championship bracket match against an AI opponent.",
    careerRule2: "Win the required number of legs to eliminate them and advance to the next round.",
    careerRule3: "If you lose, you can retry this stage anytime.", newRecord: "New Record!",
    dartsLeft: "Darts Left", hunterRules1: "The AI gives you a specific target (e.g., D16, T20).",
    hunterRules2: "Throw 3 darts at the target and record your hits.",
    hunterRules3: "Your target hits appear in your personal hit map. This alone does not measure aiming accuracy.",
    mathRules1: "No dartboard needed! You must calculate in your head.",
    mathRules2: "You are given a scenario (e.g., Score: 84, you hit T14).",
    mathRules3: "Type the remaining score as fast as possible. 10 rounds."
  },
  hu: {
    matchShot: "Meccs Nyertese", winsMatch: "Megnyerte a meccset!", stats: "Meccs Statisztika", player: "Játékos",
    avg: "Átlag", bestOut: "Legjobb Kiszálló", back: "Vissza a Lobbyba", gameShot: "Kiszálló!",
    takes: "nyerte a", set: "szettet", leg: "leget", next: "Következő", bust: "Sok", e180: "Száznyolcvan!",
    impossible: "Lehetetlen pontszám!", checkoutMsg: (v: number) => `${v}, kiszálló!`,
    chalEnd: "Mérkőzés Vége!", chalCode: "Várakozás az ellenfélre...", copy: "Kód Másolása",
    startGame: "Játék Indítása", careerWon: "Ellenfél Legyőzve!", rulesTitle: "Játékszabályok", target: "Cél",
    points: "Pont", roundSoFar: "Kör eddig:", gameOver: "Game Over", youDidIt: "Megcsináltad!",
    finalScore: "Végső Pont:", playAgain: "Újra", waitLegTitle: "Leg Befejezve!",
    waitLegDesc: "Kiszálltál ebből a legből! Most várunk, hogy a barátod is bedobja a magáét.",
    waitMatchTitle: "Mérkőzés Értékelése", waitMatchDesc: "Ledobtad az összes leget! Várakozás a barátod végső eredményeire.",
    oppPlaying: "Az ellenfél épp most játssza a leget...", atcRules1: "Dobj sorban 1-től 20-ig, a végén pedig a Bull-ra.",
    atcRules2: "A szimpla, dupla és tripla szektor is érvényes találatnak számít.",
    atcRules3: "Addig kell dobnod egy számra, amíg el nem találod.",
    bobsRules1: "27 pontról indulsz. A célpontok a Duplák 1-től 20-ig (végül a Bull).",
    bobsRules2: "Ha eltalálod az aktuális Duplát, az értéke hozzáadódik a pontjaidhoz.",
    bobsRules3: "Ha egyetlen nyíllal sem találod el az adott körben, az értéke levonódik.",
    bobsRules4: "Ha a pontod nulla alá esik, azonnal Game Over!",
    c121Rules1: "9 nyílból kell megdobnod az aktuális kiszállót.",
    c121Rules2: "121-ról indulsz. Ha 9 nyílból kiszállsz, a következő körben 122 jön.",
    c121Rules3: "Ha elfogy a 9 nyíl és nem szálltál ki, a játéknak vége.",
    c121Rules4: "A kiszálló dupla! Ha besokallsz, a pontod visszaáll a kör elejére, de a nyilaid fogynak.",
    careerRule1: "Egy Világbajnoki ágrajz-mérkőzést játszol egy Mesterséges Intelligencia ellen.",
    careerRule2: "Nyerd meg a megadott számú leget az ellenfél kiejtéséhez és a továbbjutáshoz.",
    careerRule3: "Ha kikapsz, bármikor újrapróbálhatod ezt a szintet.", newRecord: "Új Rekord!",
    dartsLeft: "Hátralévő Nyíl", hunterRules1: "Az AI ad egy célpontot (pl. D16, T20).",
    hunterRules2: "Dobj rá 3 nyíllal, és rögzítsd, hányszor találtad el.",
    hunterRules3: "A célponttalálatok megjelennek a személyes találati térképen. Ebből önmagában nem számolható célzási pontosság.",
    mathRules1: "Nincs szükség táblára! Fejben kell számolnod.",
    mathRules2: "Kapsz egy szituációt (pl. 82-ről dobsz egy T14-et).",
    mathRules3: "Írd be a maradék pontot! 10 kérdést kapsz, légy gyors és pontos."
  }
};

const OUTSHOTS_SMART: Record<number, { safe: string, pro: string }> = { 
    170:{safe:"T20 T20 BULL", pro:"T20 T20 BULL"}, 167:{safe:"T20 T19 BULL", pro:"T20 T19 BULL"}, 
    164:{safe:"T20 T18 BULL", pro:"T20 T18 BULL"}, 161:{safe:"T20 T17 BULL", pro:"T20 T17 BULL"}, 
    160:{safe:"T20 T20 D20", pro:"T20 T20 D20"}, 158:{safe:"T20 T20 D19", pro:"T20 T20 D19"}, 
    156:{safe:"T20 T20 D18", pro:"T20 T20 D18"}, 152:{safe:"T20 T20 D16", pro:"T20 T20 D16"}, 
    150:{safe:"T20 T18 D18", pro:"T20 T18 D18"}, 144:{safe:"T20 T20 D12", pro:"T20 T20 D12"}, 
    130:{safe:"20 T20 BULL", pro:"T20 20 BULL"}, 121:{safe:"17 T18 BULL", pro:"T20 T11 D14"}, 
    120:{safe:"20 T20 D20", pro:"T20 20 D20"}, 100:{safe:"20 20 D20", pro:"T20 D20"}, 
    90:{safe:"20 T20 D5", pro:"T18 D18"}, 82:{safe:"BULL D16", pro:"T14 D20"}, 
    80:{safe:"20 20 D20", pro:"T20 D10"}, 78:{safe:"18 20 D20", pro:"T18 D12"}, 
    76:{safe:"16 20 D20", pro:"T20 D8"}, 74:{safe:"14 20 D20", pro:"T14 D16"}, 
    72:{safe:"12 20 D20", pro:"T16 D12"}, 70:{safe:"10 20 D20", pro:"T18 D8"}, 
    68:{safe:"8 20 D20", pro:"T20 D4"}, 60:{safe:"20 D20", pro:"S20 D20"} 
};

const OUTSHOTS_CLASSIC: Record<number, string> = {
    119:"T19 T10 D16", 118:"T20 18 D20", 117:"T20 17 D20", 116:"T20 16 D20", 115:"T20 15 D20", 114:"T20 14 D20", 113:"T20 13 D20", 112:"T20 12 D20", 111:"T20 11 D20", 110:"T20 10 D20", 109:"T20 9 D20", 108:"T20 16 D16", 107:"T19 10 D20", 106:"T20 10 D18", 105:"T19 16 D16", 104:"T18 10 D20", 103:"T19 10 D18", 102:"T20 10 D16", 101:"T17 10 D20", 99:"T19 10 D16", 98:"T20 D19", 97:"T19 D20", 96:"T20 D18", 95:"T19 D19", 94:"T18 D20", 93:"T19 D18", 92:"T20 D16", 91:"T17 D20", 89:"T19 D16", 88:"T16 D20", 87:"T17 D18", 86:"T18 D16", 85:"T15 D20", 84:"T20 D12", 83:"T17 D16", 81:"T15 D18", 79:"T13 D20", 77:"T15 D16", 75:"T17 D12", 73:"T19 D8", 71:"T13 D16", 69:"T15 D12", 67:"T17 D8", 66:"T10 D18", 65:"T11 D16", 64:"T16 D8", 63:"T13 D12", 62:"T10 D16", 61:"T15 D8"
};

const COLOR_STYLES: Record<string, string> = { 
    emerald: 'text-emerald-400 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)] bg-emerald-500', 
    rose: 'text-rose-400 border-rose-500 shadow-[0_0_30px_rgba(225,29,72,0.15)] bg-rose-500', 
    cyan: 'text-cyan-400 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.15)] bg-cyan-500', 
    amber: 'text-amber-400 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)] bg-amber-500', 
    purple: 'text-[#b655ff] border-[#b655ff] shadow-[0_0_30px_rgba(182,85,255,0.15)] bg-[#b655ff]' 
};

const HUNTER_TARGETS = ['D20', 'D16', 'D10', 'D8', 'D12', 'T20', 'T19', 'T18', 'BULL'];
const randomHunterTarget = () => HUNTER_TARGETS[Math.floor(Math.random() * HUNTER_TARGETS.length)];
const makeMathQuestion = () => {
    const isTreble = Math.random() > 0.3;
    const start = Math.floor(Math.random() * 80) + 60;
    const dartVal = Math.floor(Math.random() * 20) + 1;
    const mult = isTreble ? 3 : (Math.random() > 0.5 ? 2 : 1);
    return { start, dartText: (mult === 3 ? 'T' : mult === 2 ? 'D' : 'S') + dartVal, ans: start - dartVal * mult };
};

interface MatchScreenProps {
    config: MatchConfig;
    onBackToSetup: () => void;
    onMatchComplete?: (matchData: PlayerData[]) => void;
    onRematch?: () => void;
    lang: Language;
}

export function MatchScreen({ config, onBackToSetup, onMatchComplete, onRematch, lang }: MatchScreenProps) {
  const [feedback, setFeedback] = useState<AppFeedbackState | null>(null);
  const txt = t[lang];
  const isAsync = config.gameMode === 'challenge' && !!config.challengeCode;
  const role = config.localRole || 'host'; 
  const oppRole = role === 'host' ? 'guest' : 'host';
  
  const [asyncState, setAsyncState] = useState<'playing' | 'waiting_leg' | 'waiting_match'>(config.resumeState?.asyncState === 'waiting_leg' ? 'waiting_leg' : 'playing');
  const [fbSyncData, setFbSyncData] = useState<OnlineRoom | null>(null);
  const [pendingOnlineDarts, setPendingOnlineDarts] = useState<number | null>(config.resumeState?.pendingOnlineDarts ?? null);
  const [isSubmittingAsyncLeg, setIsSubmittingAsyncLeg] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [browserOnline, setBrowserOnline] = useState(true);
  const resolvedLegRef = useRef(config.resumeState?.resolvedLegNumber || 0);
  const resolvingLegRef = useRef(0);
  const restoringOnlineRef = useRef(isAsync && !!config.resumeState);

  useEffect(() => {
      if (!isAsync) return;
      const syncConnection = () => setBrowserOnline(navigator.onLine);
      syncConnection();
      window.addEventListener('online', syncConnection);
      window.addEventListener('offline', syncConnection);
      return () => {
          window.removeEventListener('online', syncConnection);
          window.removeEventListener('offline', syncConnection);
      };
  }, [isAsync]);
  
  const [players, setPlayers] = useState<PlayerData[]>(() => {
    if (config.resumeState) {
        return config.resumeState.players.map((p) => ({ ...p, color: p.color || 'emerald', legAverages: p.legAverages || [], visitLog: Array.isArray(p.visitLog) ? p.visitLog : [] }));
    }
    return config.players.map((p, i: number) => {
        const startingScore = p.customStartingScore ?? config.startingScore;
        return { 
            id: i, name: p.name, isBot: p.isBot, difficulty: p.difficulty, color: p.color || 'emerald', 
            score: startingScore, setsWon: 0, legsWon: 0, totalPoints: 0, totalDarts: 0, 
            currentLegDarts: 0, lastVisit: null, opened: config.checkIn === 'single', history: [], visitLog: [], count100: 0, count140: 0, count180: 0,
            highestCheckout: 0, bestLegDarts: null, checkoutAttempts: 0, checkoutSuccess: 0, 
            first9Points: 0, first9Darts: 0, legAverages: [],
            teamId: p.teamId, customStartingScore: p.customStartingScore  
        };
    });
  });
  
  const [activePlayer, setActivePlayer] = useState<number>(config.resumeState ? config.resumeState.activePlayer : 0);
  const [legNumber, setLegNumber] = useState(config.resumeState?.legNumber || 1);
  const [isLegWinner, setIsLegWinner] = useState(config.resumeState ? config.resumeState.isLegWinner : false);
  const [isSetWinner, setIsSetWinner] = useState(config.resumeState ? config.resumeState.isSetWinner : false);
  const [isMatchWinner, setIsMatchWinner] = useState(config.resumeState ? config.resumeState.isMatchWinner : false);
  
  const [isVerified, setIsVerified] = useState(true); 
  
  const [celebration, setCelebration] = useState<{type: 'checkout', main: string, sub: string, color: string} | null>(null);
  const [inputMode, setInputMode] = useState<'detailed' | 'fast' | 'board'>(() => {
    const resumedMode = config.resumeState?.inputMode;
    if (config.gameMode === 'practice' && resumedMode !== 'board') return 'detailed';
    if (config.checkIn !== 'single' && resumedMode === 'fast') return 'detailed';
    if (resumedMode === 'detailed' || resumedMode === 'fast' || resumedMode === 'board') return resumedMode;
    if (config.checkIn !== 'single') return 'detailed';
    if (config.gameMode === 'career' || config.tournamentId) return 'detailed';
    const savedMode = typeof window !== 'undefined' && localStorage.getItem('dartisan_pref_input');
    return savedMode === 'detailed' || savedMode === 'board' ? savedMode : 'fast';
  });
  const [input, setInput] = useState('');
  const [fastError, setFastError] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState<number | null>(null);
  const [checkoutDarts, setCheckoutDarts] = useState<1 | 2 | 3>(3);
  const [checkoutDoubleConfirmed, setCheckoutDoubleConfirmed] = useState(false);
  const [currentDarts, setCurrentDarts] = useState<Dart[]>(config.resumeState ? config.resumeState.currentDarts || [] : []);
  const [aimTarget, setAimTarget] = useState<string>(() => {
      const resumed = config.resumeState?.aimTarget;
      return resumed && isSector(resumed) ? resumed : '';
  });
  const [heatmapPending, setHeatmapPending] = useState(0);
  const [heatmapSyncError, setHeatmapSyncError] = useState('');
  const reversedHeatmapEvents = useRef(new Set<string>());
  const recordedHunterRound = useRef('');
  const [activeMult, setActiveMult] = useState<1 | 2 | 3>(1);
  const [checkoutStrategy, setCheckoutStrategy] = useState<'safe' | 'pro'>(() => {
    const resumedStrategy = config.resumeState?.checkoutStrategy;
    if (resumedStrategy === 'safe' || resumedStrategy === 'pro') return resumedStrategy;
    return typeof window !== 'undefined' && localStorage.getItem('dartisan_strategy') === 'pro' ? 'pro' : 'safe';
  });
  
  const [quickButtons, setQuickButtons] = useState<number[]>(() => {
      if (typeof window === 'undefined') return [60, 100, 140];
      try {
          const saved = JSON.parse(localStorage.getItem('dartisan_quick_buttons') || 'null');
          if (Array.isArray(saved) && saved.length === 3 && saved.every(n => Number.isInteger(n) && n >= 0 && n <= 180)) return saved;
      } catch { /* Ignore malformed browser storage. */ }
      return [60, 100, 140];
  });
  const [favoriteDouble, setFavoriteDouble] = useState<string>("D16");

  useEffect(() => {
      const fetchSettings = async () => {
          if (typeof window !== 'undefined') {
              const storedFav = localStorage.getItem('dartisan_fav_double');
              if (storedFav) setFavoriteDouble(storedFav);
          }

          const user = auth.currentUser;
          if (user && !user.isAnonymous) {
              const docSnap = await getDoc(doc(db, 'users', user.uid));
              if (docSnap.exists() && docSnap.data().settings) {
                  const s = docSnap.data().settings;
                  if (s.fastBtns && s.fastBtns.length > 0) setQuickButtons(s.fastBtns);
                  if (s.favDouble) setFavoriteDouble(s.favDouble);
              }
          }
      };
      fetchSettings();
  }, []);

  const [practiceStatus, setPracticeStatus] = useState<'playing' | 'won' | 'lost' | 'won_121_round'>('playing');
  const [practiceTarget, setPracticeTarget] = useState(1);
  const [bobsScore, setBobsScore] = useState(27);
  const [bobsRoundScore, setBobsRoundScore] = useState(0);
  const [c121Target, setC121Target] = useState(121);
  const [c121DartsLeft, setC121DartsLeft] = useState(9);
  const [c121Record, setC121Record] = useState(() => { 
      if (typeof window !== 'undefined') return parseInt(localStorage.getItem('dartisan_121_record') || '0'); 
      return 0; 
  });
  const [hunterRound, setHunterRound] = useState(1);
  const [hunterTargetStr, setHunterTargetStr] = useState(HUNTER_TARGETS[0]);
  const [hunterTotalHits, setHunterTotalHits] = useState(0);
  const [mathRound, setMathRound] = useState(1);
  const [mathScore, setMathScore] = useState(0);
  const [mathQuestion, setMathQuestion] = useState(makeMathQuestion);
  const [mathInput, setMathInput] = useState('');

  const [tvMode, setTvMode] = useState(false);

  // Tutorial: show once per mode
  const getTutorialKey = (): TutorialKey | null => {
      if (config.gameMode === 'x01') return 'x01';
      if (config.gameMode === 'career') return 'career';
      if (config.gameMode === 'challenge') return 'challenge';
      if (config.gameMode === 'practice') {
          const pt = config.practiceType;
          if (pt === 'around') return 'practice_atc';
          if (pt === 'bobs27') return 'practice_bobs';
          if (pt === '121') return 'practice_121';
          if (pt === 'hunter') return 'practice_hunter';
      }
      return null;
  };
  const tutKey = getTutorialKey();
  const [showTutorial, setShowTutorial] = useState(() => tutKey ? shouldShowTutorial(tutKey) : false);
  const [fullHeatmapData, setFullHeatmapData] = useState<HeatmapData>(() => config.resumeState?.heatmapSession || {});

  const sendHeatmapEvent = useCallback((event: HeatmapEvent) => {
      const user = auth.currentUser;
      if (!user || user.isAnonymous || event.uid !== user.uid) return;
      try {
          setHeatmapPending(enqueueHeatmapEvent(localStorage, event));
          void flushHeatmapQueue(db, localStorage, user.uid).then(result => {
              setHeatmapPending(result.pending);
              setHeatmapSyncError(result.error || '');
          });
      } catch (error) {
          console.error('Heatmap queue could not be saved:', error);
          setHeatmapSyncError('local-storage');
      }
  }, []);

  useEffect(() => {
      const user = auth.currentUser;
      if (!user || user.isAnonymous) return;
      const sync = () => {
          void flushHeatmapQueue(db, localStorage, user.uid).then(result => {
              setHeatmapPending(result.pending);
              setHeatmapSyncError(result.error || '');
          });
      };
      sync();
      window.addEventListener('online', sync);
      return () => window.removeEventListener('online', sync);
  }, []);

  useEffect(() => {
      localStorage.setItem('dartisan_tv_sync', JSON.stringify({
          players, activePlayer, currentDarts, config,
          liveScore: players[activePlayer] ? displayedRemaining(players[activePlayer], activePlayer, currentDarts, config) : null,
      }));
  }, [players, activePlayer, currentDarts, config]);

  const getBotDart = useCallback((difficulty: number, currentScore: number): Dart => {
      const rand = Math.random() * 100;
      const diffLevel = Math.max(1, Math.min(10, difficulty)); 
      
      if (currentScore <= 40 && currentScore % 2 === 0) {
          const targetD = currentScore / 2;
          const doubleHitChance = 5 + (diffLevel * 6); 
          if (rand < doubleHitChance) return { val: targetD, mult: 2 };
          if (rand < doubleHitChance + 30) return { val: targetD, mult: 1 };
          if (rand < doubleHitChance + 45) return { val: targetD === 20 ? 1 : targetD === 16 ? 8 : 1, mult: 1 }; 
          return { val: 0, mult: 0 }; 
      }
      if (currentScore > 60) {
          const t20Chance = diffLevel * 4.5;       
          const t19Chance = diffLevel * 1;       
          const s20Chance = 30 + (diffLevel * 4);  
          if (rand < t20Chance) return { val: 20, mult: 3 };
          if (rand < t20Chance + t19Chance) return { val: 19, mult: 3 };
          if (rand < t20Chance + t19Chance + s20Chance) return { val: 20, mult: 1 };
          if (Math.random() > 0.5) return { val: 5, mult: 1 };
          return { val: 1, mult: 1 };
      }
      let targetSingle = currentScore > 40 ? currentScore - 40 : currentScore - 16;
      if (targetSingle <= 0 || targetSingle > 20) targetSingle = 10;
      const setupChance = 40 + (diffLevel * 4); 
      if (rand < setupChance) return { val: targetSingle, mult: 1 };
      return { val: Math.floor(Math.random() * 20) + 1, mult: 1 };
  }, []);

  const handleFastEnterRef = useRef<((pts: number, fromBot: boolean, darts?: 1 | 2 | 3) => void) | null>(null);
  const processDartRef = useRef<((val: number, mult: number, fromBot: boolean) => void) | null>(null);
  const statsSavedRef = useRef(false);
  const matchIdRef = useRef<string>(config.resumeState?.matchId || crypto.randomUUID());

  useEffect(() => {
    const currentPlayer = players[activePlayer];
    if (!currentPlayer?.isBot || isLegWinner || isSetWinner || isMatchWinner || practiceStatus !== 'playing' || asyncState !== 'playing' || showTutorial) return;

    if (config.ghostReplay && currentDarts.length === 0) {
      const sourceLegs = [...new Set(config.ghostReplay.visits.filter(visit => visit.playerId === 0).map(visit => visit.leg))];
      const sourceLeg = sourceLegs[(legNumber - 1) % sourceLegs.length];
      const sourceVisits = config.ghostReplay.visits.filter(visit => visit.playerId === 0 && visit.leg === sourceLeg);
      const turnIndex = currentPlayer.visitLog.filter(visit => visit.leg === legNumber).length;
      const source = sourceVisits[turnIndex];
      if (source && source.scoreBefore === currentPlayer.score &&
          canScoreInDarts(source.enteredPoints, source.darts as 1 | 2 | 3) &&
          (!source.checkout || canCheckoutInDarts(source.enteredPoints, source.darts as 1 | 2 | 3, config.checkout))) {
        const timer = setTimeout(() => handleFastEnterRef.current?.(source.enteredPoints, true, source.darts as 1 | 2 | 3), 1500);
        return () => clearTimeout(timer);
      }
    }

    if (inputMode === 'fast') {
        if (currentDarts.length === 0) {
            const timer = setTimeout(() => {
                let turnTotal = 0;
                for (let i = 0; i < 3; i++) {
                    const dart = getBotDart(currentPlayer.difficulty, currentPlayer.score - turnTotal);
                    const dartPoints = dart.val * dart.mult;
                    const predictedScore = currentPlayer.score - (turnTotal + dartPoints);
                    if (config.checkout !== 'single') {
                        if (predictedScore < 0 || predictedScore === 1) break;
                        if (predictedScore === 0 && dart.mult !== 2 && !(config.checkout === 'master' && dart.mult === 3)) break;
                    } else {
                        if (predictedScore < 0) break;
                    }
                    turnTotal += dartPoints;
                    if (predictedScore === 0) break;
                }
                if (handleFastEnterRef.current) handleFastEnterRef.current(turnTotal, true);
            }, 1500); 
            return () => clearTimeout(timer);
        }
    } else {
        if (currentDarts.length < 3) {
            const timer = setTimeout(() => {
                let currentSubScore = currentPlayer.score;
                currentDarts.forEach(d => currentSubScore -= (d.val * d.mult));
                const dart = getBotDart(currentPlayer.difficulty, currentSubScore);
                if (processDartRef.current) processDartRef.current(dart.val, dart.mult, true);
            }, 800); 
            return () => clearTimeout(timer);
        }
    }
  }, [activePlayer, currentDarts, inputMode, isLegWinner, isSetWinner, isMatchWinner, practiceStatus, asyncState, showTutorial, getBotDart, config.checkout, config.ghostReplay, players, legNumber]);

  const generateAiFeedback = (player: PlayerData) => {
      const avg = ((player.totalPoints / (player.totalDarts || 1)) * 3).toFixed(1);
      const first9Avg = ((player.first9Points / (player.first9Darts || 1)) * 3).toFixed(1);
      const checkoutPct = player.checkoutAttempts > 0 ? Math.round((player.checkoutSuccess / player.checkoutAttempts) * 100) : 0;
      if (lang === 'en') {
          const scoring = parseFloat(avg) > 60 ? `Strong scoring (${avg} average). ` : parseFloat(avg) < 40 ? `Your scoring can improve (${avg} average). ` : 'Steady, balanced scoring. ';
          const opening = parseFloat(first9Avg) > parseFloat(avg) + 12 ? `Your opening nine darts were strong (${first9Avg}), but the pace dropped later. ` : '';
          const checkout = checkoutPct >= 35 ? `Excellent checkout accuracy (${checkoutPct}%).` : checkoutPct > 0 && checkoutPct < 15 ? `Checkout accuracy needs work (${checkoutPct}%). Try Bob's 27.` : '';
          return scoring + opening + checkout;
      }
      let text = '';
      if (parseFloat(avg) > 60) text += `Erőteljes tömegdobás (${avg} átlag). `;
      else if (parseFloat(avg) < 40) text += `A tömegeken van még mit javítani (${avg} átlag). `;
      else text += `Kiegyensúlyozott, stabil tömegdobás. `;

      if (parseFloat(first9Avg) > parseFloat(avg) + 12) text += `Kiváló kezdésed van a legben (Első 9: ${first9Avg}), de a végére elfáradsz. `;
      if (checkoutPct >= 35) text += `A kiszállóid sebészi pontosságúak (${checkoutPct}%). Profi munka!`;
      else if (checkoutPct > 0 && checkoutPct < 15) text += `A kiszállókon viszont rengeteget bizonytalankodtál (${checkoutPct}%). Bob's 27 gyakorlást javasolok!`;

      return text || 'Még nincs elég adat az értékeléshez.';
  };

  const generateMathQuestion = useCallback(() => setMathQuestion(makeMathQuestion()), []);

  const saveQuickButtonUsage = (score: number) => {
      const statsStr = localStorage.getItem('dartisan_fast_history'); 
      const stats = statsStr ? JSON.parse(statsStr) : {};
      stats[score] = (stats[score] || 0) + 1; 
      localStorage.setItem('dartisan_fast_history', JSON.stringify(stats));
      setQuickButtons(prev => { 
          if (stats[score] >= 2 && !prev.includes(score)) { 
              const newBtns = [prev[1], prev[2], score]; 
              localStorage.setItem('dartisan_quick_buttons', JSON.stringify(newBtns)); 
              return newBtns; 
          } 
          return prev; 
      });
  };

  const syncTeamState = (np: PlayerData[], activeIdx: number) => {
      const activeP = np[activeIdx];
      if (activeP.teamId !== undefined) {
          np.forEach(pl => {
              if (pl.id !== activeIdx && pl.teamId === activeP.teamId) {
                  pl.score = activeP.score;
                  pl.legsWon = activeP.legsWon;
                  pl.setsWon = activeP.setsWon;
                  pl.currentLegDarts = activeP.currentLegDarts;
              }
          });
      }
  };

  const hasMatchProgress = currentDarts.length > 0 || players.some(player => player.totalDarts > 0 || player.legsWon > 0 || player.setsWon > 0);

  useEffect(() => {
    if (isMatchWinner || config.gameMode === 'practice' || (!isAsync && !hasMatchProgress)) localStorage.removeItem('dartisan_save');
    else localStorage.setItem('dartisan_save', JSON.stringify({
            players, activePlayer, isLegWinner, isSetWinner, isMatchWinner,
            legNumber,
            config: { ...config, resumeState: undefined }, currentDarts,
            inputMode, checkoutStrategy, asyncState, aimTarget, heatmapSession: fullHeatmapData,
            matchId: matchIdRef.current,
            authUid: isAsync ? auth.currentUser?.uid : undefined,
            onlineLeg: isAsync ? (fbSyncData?.state?.currentLeg ?? config.resumeState?.onlineLeg ?? 1) : undefined,
            resolvedLegNumber: isAsync ? resolvedLegRef.current : undefined,
            pendingOnlineDarts: isAsync ? pendingOnlineDarts ?? undefined : undefined,
        }));
  }, [players, activePlayer, legNumber, isLegWinner, isSetWinner, isMatchWinner, currentDarts, config, isAsync, hasMatchProgress, inputMode, checkoutStrategy, asyncState, fbSyncData, aimTarget, fullHeatmapData, pendingOnlineDarts]);

  useEffect(() => {
      if (isMatchWinner && config.gameMode !== 'practice' && players.length > 1 && !statsSavedRef.current) {
          statsSavedRef.current = true;
          const saveStats = async () => {
              const p = players[0];
              const isWin = isAsync ? fbSyncData?.state?.winner === role : p.setsWon >= config.setsToWin;
              recordQuestMatch(localStorage, {
                  matchId: matchIdRef.current,
                  won: isWin,
                  againstBot: !!players[1]?.isBot,
                  count140: p.count140,
                  count180: p.count180,
                  bestLegDarts: p.bestLegDarts,
              });
              const user = auth.currentUser;
              if (user && !user.isAnonymous) {
                  const userRef = doc(db, "users", user.uid);
                  if (SERVER_MATCH_ENABLED && !isAsync) {
                      try {
                          const awardMatch = httpsCallable(functions, 'awardLocalMatch');
                          await awardMatch({ matchId: matchIdRef.current, mode: config.gameMode, won: isWin,
                              metrics: {
                                  totalDarts: p.totalDarts, totalPoints: p.totalPoints,
                                  count100: p.count100, count140: p.count140, count180: p.count180,
                                  checkoutAttempts: p.checkoutAttempts, checkoutSuccess: p.checkoutSuccess,
                                  first9Points: p.first9Points, first9Darts: p.first9Darts,
                                  highestCheckout: p.highestCheckout,
                              },
                          });
                      } catch (error) {
                          console.error('Server match award failed:', error);
                      }
                  } else if (!SERVER_MATCH_ENABLED) {
                    const userDocSnap = await getDoc(userRef);
                    const currentMaxOut = userDocSnap.exists() ? (userDocSnap.data().highestCheckout || 0) : 0;
                    const newMaxOut = Math.max(currentMaxOut, p.highestCheckout);
                    const xpGained = isWin ? (config.gameMode === 'career' ? 100 : 50) : 10;
                    const statsUpdate = {
                      xp: increment(xpGained),
                      weeklyXp: increment(xpGained),
                      matchesWon: increment(isWin ? 1 : 0),
                      matchesPlayed: increment(1),
                      totalDarts: increment(p.totalDarts),
                      totalPoints: increment(p.totalPoints),
                      count100: increment(p.count100),
                      count140: increment(p.count140),
                      count180: increment(p.count180),
                      checkoutAttempts: increment(p.checkoutAttempts),
                      checkoutSuccess: increment(p.checkoutSuccess),
                      first9Points: increment(p.first9Points),
                      first9Darts: increment(p.first9Darts),
                      highestCheckout: newMaxOut,
                  };
                  const batch = writeBatch(db);
                  batch.update(userRef, statsUpdate);
                  batch.set(doc(db, 'publicProfiles', user.uid), publicProfileData(statsUpdate), { merge: true });
                  try {
                      await batch.commit();
                  } catch (error) {
                      console.error("Hiba az alap stats mentésnél:", error);
                      return;
                  }

                  // Klub XP növelése, ha a játékos klubban van
                  const clubId = userDocSnap.exists() ? userDocSnap.data().clubId : null;
                  if (clubId) {
                      updateDoc(doc(db, 'clubs', clubId), { totalXp: increment(xpGained) })
                        .catch(err => console.error("Klub XP hiba:", err));
                  }
                  }

                  const matchRef = doc(db, 'users', user.uid, 'matchHistory', matchIdRef.current);
                  setDoc(matchRef, {
                      date: new Date().toISOString(),
                      mode: config.gameMode,
                      opponent: players.slice(1).map(player => player.name).join(', ') || 'Unknown',
                      won: isWin,
                      score: `${p.setsWon} - ${Math.max(0, ...players.slice(1).map(player => player.setsWon))}`,
                      startingScore: p.customStartingScore ?? config.startingScore,
                      checkIn: config.checkIn,
                      checkout: config.checkout,
                      players: players.map(player => player.name),
                      visits: orderedVisits(players).slice(-500),
                      stats: {
                          average: ((p.totalPoints / (p.totalDarts || 1)) * 3),
                          first9Average: ((p.first9Points / (p.first9Darts || 1)) * 3),
                          checkoutPct: p.checkoutAttempts > 0 ? (p.checkoutSuccess / p.checkoutAttempts) : 0,
                          checkoutAttempts: p.checkoutAttempts,
                          checkoutSuccess: p.checkoutSuccess,
                          totalPoints: p.totalPoints,
                          totalDarts: p.totalDarts,
                          first9Points: p.first9Points,
                          first9Darts: p.first9Darts,
                          highestCheckout: p.highestCheckout,
                          count100: p.count100,
                          count140: p.count140,
                          count180: p.count180,
                          bestLegDarts: p.bestLegDarts
                      },
                      hitMap: fullHeatmapData || {}
                  }).catch(err => console.error("Hiba a részletes match history mentésnél:", err));
              }
          };
          saveStats();
      }
  }, [isMatchWinner, config, players]);

  async function resolveAsyncLeg(observedState: { currentLeg: number }) {
      await runTransaction(db, async transaction => {
          const roomRef = doc(db, 'matches', config.challengeCode!);
          const snapshot = await transaction.get(roomRef);
          if (!snapshot.exists()) return;
          const state = snapshot.data().state;
          if (state.currentLeg !== observedState.currentLeg || state.hostDarts === null || state.guestDarts === null || state.winner) return;
          const winner = state.hostDarts <= state.guestDarts ? 'host' : 'guest';
          let hostLegsWon = (state.hostLegsWon || 0) + (winner === 'host' ? 1 : 0);
          let guestLegsWon = (state.guestLegsWon || 0) + (winner === 'guest' ? 1 : 0);
          let hostSetsWon = state.hostSetsWon || 0;
          let guestSetsWon = state.guestSetsWon || 0;
          const setEnded = (winner === 'host' ? hostLegsWon : guestLegsWon) >= config.legsToWin;
          if (setEnded) {
              if (winner === 'host') hostSetsWon += 1;
              else guestSetsWon += 1;
              hostLegsWon = 0;
              guestLegsWon = 0;
          }
          const matchEnded = (winner === 'host' ? hostSetsWon : guestSetsWon) >= config.setsToWin;
          transaction.update(roomRef, {
              'state.hostDarts': null, 'state.guestDarts': null,
              'state.hostLegsWon': hostLegsWon, 'state.guestLegsWon': guestLegsWon,
              'state.hostSetsWon': hostSetsWon, 'state.guestSetsWon': guestSetsWon,
              'state.currentLeg': state.currentLeg + 1,
              'state.resolvedLeg': { number: state.currentLeg, winner, setEnded, matchEnded },
              'state.winner': matchEnded ? winner : null,
          });
      });
  }

  useEffect(() => {
      if (!isAsync || !config.challengeCode) return;
      const unsubscribe = onSnapshot(doc(db, "matches", config.challengeCode), (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              const state = data.state;
              setFbSyncData(data as OnlineRoom);
              if (restoringOnlineRef.current) {
                  restoringOnlineRef.current = false;
                  resolvedLegRef.current = state.resolvedLeg?.number || 0;
                  const legAdvanced = state.currentLeg > (config.resumeState?.onlineLeg || 1);
                  if (legAdvanced) {
                      setLegNumber(state.currentLeg);
                      setPlayers(prev => prev.map(player => ({ ...player,
                          score: player.customStartingScore ?? config.startingScore,
                          currentLegDarts: 0, opened: config.checkIn === 'single', history: [], lastVisit: null,
                      })));
                      setCurrentDarts([]);
                      setIsLegWinner(false); setIsSetWinner(false);
                      setPendingOnlineDarts(null);
                  }
                  setAsyncState(!legAdvanced && (state[`${role}Darts`] !== null || config.resumeState?.pendingOnlineDarts) ? 'waiting_leg' : 'playing');
                  if (state.winner) setIsMatchWinner(true);
              }
              if (state[`${role}Darts`] !== null) {
                  setPendingOnlineDarts(null);
                  setOnlineError(null);
              }
              setPlayers(prev => prev.map((player, index) => {
                  const playerRole = index === 0 ? role : oppRole;
                  return { ...player, legsWon: state[`${playerRole}LegsWon`] || 0, setsWon: state[`${playerRole}SetsWon`] || 0 };
              }));

              const resolved = state.resolvedLeg;
              if (resolved && resolved.number > resolvedLegRef.current) {
                  resolvedLegRef.current = resolved.number;
                  setPendingOnlineDarts(null);
                  setOnlineError(null);
                  setAsyncState('playing');
                  if (resolved.matchEnded) setIsMatchWinner(true);
                  else if (resolved.setEnded) setIsSetWinner(true);
                  else setIsLegWinner(true);
              } else if (!SERVER_MATCH_ENABLED && browserOnline && role === 'host' && state.hostDarts !== null && state.guestDarts !== null && !state.winner && resolvingLegRef.current !== state.currentLeg) {
                  resolvingLegRef.current = state.currentLeg;
                  resolveAsyncLeg(state).catch(error => {
                      resolvingLegRef.current = 0;
                      console.error('Online leg resolution failed:', error);
                      setOnlineError(lang === 'hu' ? 'A leg kiértékelése nem sikerült. A kapcsolat helyreállása után újra próbáljuk.' : 'Could not resolve the leg. We will retry when the connection returns.');
                  });
              }
          } else {
              setOnlineError(lang === 'hu' ? 'A szoba már nem érhető el. Lépj vissza a kezdőlapra.' : 'This room is no longer available. Return to the home screen.');
          }
      }, error => {
          console.error('Online room synchronization failed:', error);
          setOnlineError(lang === 'hu' ? 'Nem sikerült szinkronizálni a szobát. Ellenőrizd a kapcsolatot és a bejelentkezést.' : 'Could not sync the room. Check your connection and sign-in.');
      });
      return () => unsubscribe();
  }, [isAsync, config.challengeCode, role, oppRole, config.legsToWin, config.setsToWin, config.resumeState?.onlineLeg, config.resumeState?.pendingOnlineDarts, config.startingScore, config.checkIn, lang, browserOnline]);

  const finishAsyncLeg = async (totalDartsUsed: number) => {
      if (!config.challengeCode) return;
      setPendingOnlineDarts(totalDartsUsed);
      setAsyncState('waiting_leg');
      setIsSubmittingAsyncLeg(true);
      setOnlineError(null);
      try {
          if (SERVER_MATCH_ENABLED) {
              const submitLeg = httpsCallable<{ roomId: string; darts: number; expectedLeg: number }, { status: string }>(functions, 'submitOnlineLeg');
              await submitLeg({ roomId: config.challengeCode, darts: totalDartsUsed, expectedLeg: fbSyncData?.state?.currentLeg || 1 });
          } else {
              await updateDoc(doc(db, 'matches', config.challengeCode), { [`state.${role}Darts`]: totalDartsUsed });
          }
          setPendingOnlineDarts(null);
      }
      catch (error) {
          console.error('Online leg upload failed:', error);
          setOnlineError(lang === 'hu' ? 'A leg eredménye nem ment fel. Az Újraküldés gombbal próbáld újra.' : 'The leg result was not uploaded. Use Resend to try again.');
      } finally { setIsSubmittingAsyncLeg(false); }
  };

  const announceScore = useCallback((scoreStr: string, is180: boolean = false, isBust: boolean = false, isCheckout: boolean = false) => {
    if (config.muteCaller || localStorage.getItem('dartisan_sound_master') === 'false' || !('speechSynthesis' in window)) return;
    if (is180 && localStorage.getItem('dartisan_sound_180') === 'false') return;
    if (isCheckout && localStorage.getItem('dartisan_sound_legwin') === 'false') return;
    window.speechSynthesis.cancel(); 
    const u = new SpeechSynthesisUtterance(); 
    u.lang = lang === 'hu' ? 'hu-HU' : 'en-GB';
    if (isBust) u.text = scoreStr ? `${scoreStr}, ${txt.bust}` : txt.bust; 
    else if (is180) { u.text = txt.e180; u.pitch = 1.1; } 
    else u.text = scoreStr;
    window.speechSynthesis.speak(u);
  }, [lang, txt, config.muteCaller]);

  const triggerCelebration = useCallback((type: 'checkout', main: string, sub: string, color: string) => { 
      setCelebration({ type, main, sub, color }); 
      setTimeout(() => setCelebration(null), 2500); 
      triggerHaptic('checkout');
  }, []);

  const getCheckoutTable = (s: number, dartsLeft: number): { text: string, isSmart: boolean } | null => {
    if (config.gameMode === 'practice' && config.practiceType !== '121') return null;
    if (config.checkout === 'single') {
        if (s < 1) return null;
        if (s >= 1 && s <= 20) return { text: `${s}`, isSmart: false };
        if (s <= 40 && s % 2 === 0) return { text: `D${s / 2}`, isSmart: false };
        if (s <= 60 && s % 3 === 0) return { text: `T${s / 3}`, isSmart: false };
        return null;
    }
    if (s > dartsLeft * 60 || s < 2) return null;

    if (favoriteDouble && dartsLeft >= 2) {
        const favValues: Record<string, number> = { 'D20': 40, 'D16': 32, 'D10': 20, 'D8': 16, 'D12': 24 };
        const favDoubleVal = favValues[favoriteDouble];
        if (favDoubleVal && s > favDoubleVal) {
            const setup = s - favDoubleVal; 
            if (setup <= 20) return { text: `${setup} -> ${favoriteDouble}`, isSmart: true };
            if (setup === 25) return { text: `25 -> ${favoriteDouble}`, isSmart: true };
            if (setup === 50) return { text: `BULL -> ${favoriteDouble}`, isSmart: true };
            if (setup % 3 === 0 && setup <= 60 && setup >= 9) return { text: `T${setup/3} -> ${favoriteDouble}`, isSmart: true };
        }
    }

    if (OUTSHOTS_SMART[s]) return { text: checkoutStrategy === 'safe' ? OUTSHOTS_SMART[s].safe : OUTSHOTS_SMART[s].pro, isSmart: true };
    if (OUTSHOTS_CLASSIC[s]) return { text: OUTSHOTS_CLASSIC[s], isSmart: false };
    if (s === 50) return { text: "BULL", isSmart: false }; 
    if (s <= 40 && s % 2 === 0) return { text: `D${s / 2}`, isSmart: false };
    if (s < 40) { 
        let d = 16; if (s < 33) d = 8; if (s < 17) d = 4; if (s < 9) d = 2; if (s < 5) d = 1; 
        const r = s - (d * 2); if (r > 0 && r <= 20) return { text: `${r} D${d}`, isSmart: false }; 
    }
    if (s <= 60) { 
        if (s - 40 <= 20 && s - 40 > 0) return { text: `${s - 40} D20`, isSmart: false }; 
        if (s - 32 <= 20 && s - 32 > 0) return { text: `${s - 32} D16`, isSmart: false }; 
        if (s - 36 <= 20 && s - 36 > 0) return { text: `${s - 36} D18`, isSmart: false }; 
    }
    return null;
  };

  const nextPlayerIdx = useCallback(() => { 
      if (isAsync) return 0; 
      return (activePlayer + 1) % players.length; 
  }, [activePlayer, players.length, isAsync]);

  const updateRoundStats = (playerObj: PlayerData, pts: number) => { 
      if (pts === 180) playerObj.count180 += 1; 
      else if (pts >= 140) playerObj.count140 += 1; 
      else if (pts >= 100) playerObj.count100 += 1; 
  };

  const recordHeatmapLocal = useCallback((event: HeatmapEvent) => {
      setFullHeatmapData(prev => applyHeatmapEvent(prev, event));
      sendHeatmapEvent(event);
  }, [sendHeatmapEvent]);

  const undoHeatmapDart = (dart: Dart) => {
      const event = dart.heatmapEvent;
      if (!event || reversedHeatmapEvents.current.has(event.id)) return;
      reversedHeatmapEvents.current.add(event.id);
      recordHeatmapLocal(reverseHeatmapEvent(event));
  };

  const handleWin = useCallback((playerIndex: number, checkoutValue: number, winningDartsInRound: number, winningDarts: Dart[] = []) => {
    const pColor = players[playerIndex].color; 
    announceScore(txt.checkoutMsg(checkoutValue), false, false, true);
    const willWinLeg = players[playerIndex].legsWon + 1 >= config.legsToWin;
    const willWinSet = willWinLeg && (players[playerIndex].setsWon + 1 >= config.setsToWin);
    
    if (!willWinSet && checkoutValue >= 100 && !players[playerIndex].isBot) triggerCelebration('checkout', `${checkoutValue}`, txt.gameShot, pColor);
    else triggerHaptic('checkout');

    setPlayers(prev => {
      const np = copyPlayers(prev);
      const activeP = np[playerIndex];
      recordVisit(np, playerIndex, { leg: legNumber, scoreBefore: activeP.score,
        points: checkoutValue, enteredPoints: checkoutValue, darts: winningDartsInRound,
        bust: false, checkout: true, hits: winningDarts.map(dart => ({ val: dart.val, mult: dart.mult })) });
      
      const legDarts = activeP.currentLegDarts + winningDartsInRound;
      const startingPScore = activeP.customStartingScore ?? config.startingScore;
      const thisLegAvg = legDarts > 0 ? (startingPScore / legDarts) * 3 : 0;
      activeP.legAverages.push(parseFloat(thisLegAvg.toFixed(1)));

      activeP.score = 0; 
      activeP.legsWon += 1; 
      activeP.currentLegDarts += winningDartsInRound; 
      activeP.totalDarts += winningDartsInRound; 
      activeP.totalPoints += checkoutValue; 
      activeP.lastVisit = checkoutValue;
      activeP.checkoutAttempts = Math.max(activeP.checkoutAttempts, activeP.checkoutSuccess + 1);
      activeP.checkoutSuccess += 1;
      if (checkoutValue > activeP.highestCheckout) activeP.highestCheckout = checkoutValue;
      if (activeP.bestLegDarts === null || activeP.currentLegDarts < activeP.bestLegDarts) activeP.bestLegDarts = activeP.currentLegDarts;
      
      if (activeP.legsWon >= config.legsToWin) {
          activeP.legsWon = 0; 
          activeP.setsWon += 1; 
          
          np.forEach(pl => {
              if(pl.teamId === undefined || pl.teamId !== activeP.teamId) pl.legsWon = 0;
          }); 
          
          if (activeP.setsWon >= config.setsToWin) setIsMatchWinner(true); 
          else setIsSetWinner(true);
      } else {
          setIsLegWinner(true);
      }

      syncTeamState(np, playerIndex);
      return np;
    });
  }, [config, players, announceScore, triggerCelebration, txt, legNumber]);

  const processDart = useCallback((val: number, mult: number, fromBot = false) => {
    if (isLegWinner || isSetWinner || isMatchWinner || practiceStatus === 'lost' || practiceStatus === 'won' || practiceStatus === 'won_121_round' || showTutorial || currentDarts.length >= 3 || asyncState !== 'playing') return;
    const activeP = players[activePlayer]; 
    if (activeP.isBot && !fromBot) return;
    const dartPoints = val * mult;

    if (val === 0) triggerHaptic('miss'); else triggerHaptic('hit');
    const heatmapEvent = !activeP.isBot && config.gameMode !== 'practice'
        ? matchHeatmapEvent(auth.currentUser?.uid || 'guest', config.dartSetupId || 'default', val, mult, aimTarget || null)
        : null;
    if (heatmapEvent) recordHeatmapLocal(heatmapEvent);
    const recordedDart: Dart = { val, mult, ...(heatmapEvent ? { heatmapEvent } : {}) };
    
    if (config.gameMode === 'practice') {
        const newDarts = [...currentDarts, { val, mult }]; 
        
        if (config.practiceType === 'ai_drill') {
            if (val === config.drillTarget) announceScore('Hit'); else announceScore('Miss');
            setCurrentDarts(newDarts);
            return;
        }

        if (config.practiceType === 'around') { 
            if (val === practiceTarget) { 
                announceScore('Hit'); 
                if (practiceTarget === 25) { setPracticeStatus('won'); triggerCelebration('checkout', 'WINNER', 'ATC Complete', activeP.color); } 
                else { setPracticeTarget(prev => prev === 20 ? 25 : prev + 1); } 
            } else { announceScore('Miss'); }
            setCurrentDarts(newDarts);
            return; 
        } 
        
        if (config.practiceType === 'bobs27') { 
            if (val === practiceTarget && mult === 2) { setBobsRoundScore(prev => prev + (practiceTarget * 2)); announceScore('Hit'); } 
            else { announceScore('Miss'); }
            setCurrentDarts(newDarts);
            return; 
        }

        if (config.practiceType === '121') {
            let tScore = activeP.score; 
            let validPts = 0;
            for (const d of newDarts) { tScore -= (d.val * d.mult); validPts += (d.val * d.mult); }

            const isOut = ((tScore === 0 && mult === 2) || (tScore === 0 && val === 25 && mult === 2));
            const isBust = (tScore < 0 || tScore === 1 || (tScore === 0 && !isOut));

            setC121DartsLeft(prev => prev - 1);

            if (isOut) {
                announceScore(txt.checkoutMsg(validPts), false, false, true);
                triggerCelebration('checkout', `${validPts}`, 'Siker!', activeP.color);
                if (c121Target > c121Record) { setC121Record(c121Target); localStorage.setItem('dartisan_121_record', c121Target.toString()); }
                setPracticeStatus('won_121_round');
                setTimeout(() => { 
                    const nextTarget = c121Target + 1; setC121Target(nextTarget); setC121DartsLeft(9); 
                    setPlayers(prev => { const np = copyPlayers(prev); np[0].score = nextTarget; np[0].history = []; return np; });
                    setCurrentDarts([]); setPracticeStatus('playing'); 
                }, 2000); 
                return;
            }
            if (isBust) { 
                triggerHaptic('bust'); announceScore('Sok', false, true); 
                const forfeited = 3 - newDarts.length;
                setC121DartsLeft(prev => prev - forfeited);
                setTimeout(() => { 
                    setCurrentDarts([]); 
                    if (c121DartsLeft - 1 - forfeited <= 0) setPracticeStatus('lost'); 
                }, 600); 
                return; 
            }

            setCurrentDarts(newDarts);
            if (newDarts.length === 3) {
                announceScore(validPts.toString());
                setTimeout(() => { 
                    setPlayers(prev => { const np = copyPlayers(prev); np[0].score -= validPts; np[0].history.push({ score: np[0].score, dartsCount: 3, points: validPts, roundDarts: newDarts }); return np; });
                    setCurrentDarts([]); 
                    if (c121DartsLeft - 1 <= 0) setPracticeStatus('lost'); 
                }, 600);
            }
            return;
        }
    }

    const allDarts = [...currentDarts, recordedDart];
    const visit = evaluateVisit(activeP.score, allDarts.map(d => ({ val: d.val, mult: (d.val === 0 ? 1 : d.mult) as 1 | 2 | 3 })), {
        checkIn: config.checkIn,
        checkout: config.checkout,
        opened: activeP.opened ?? (config.checkIn === 'single' || activeP.score < (activeP.customStartingScore ?? config.startingScore)),
    });
    const validPts = visit.scored;
    const isFirst9 = (activeP.currentLegDarts + currentDarts.length) < 9;
    
    if (activeP.score <= 170 && mult === 2 && val !== 0) {
        setPlayers(prev => { const n = [...prev]; n[activePlayer].checkoutAttempts += 1; return n; }); 
    }
    
    if (isFirst9) {
        const previousScored = currentDarts.length === 0 ? 0 : evaluateVisit(activeP.score,
            currentDarts.map(d => ({ val: d.val, mult: (d.val === 0 ? 1 : d.mult) as 1 | 2 | 3 })),
            { checkIn: config.checkIn, checkout: config.checkout, opened: activeP.opened ?? config.checkIn === 'single' }).scored;
        setPlayers(prev => {
            const next = prev.map(player => ({ ...player }));
            next[activePlayer].first9Points += visit.scored - previousScored;
            next[activePlayer].first9Darts += 1;
            return next;
        });
    }

    const isOut = visit.checkout;
    
    if (isOut) {
        setCurrentDarts(allDarts);
        if (isAsync) { 
            announceScore(txt.checkoutMsg(validPts), false, false, true);
            triggerHaptic('checkout');
            setPlayers(prev => { 
                const np = copyPlayers(prev);
                const pl = np[activePlayer]; 
                recordVisit(np, activePlayer, { leg: legNumber, scoreBefore: pl.score,
                    points: validPts, enteredPoints: allDarts.reduce((sum, dart) => sum + dart.val * dart.mult, 0),
                    darts: allDarts.length, bust: false, checkout: true,
                    hits: allDarts.map(dart => ({ val: dart.val, mult: dart.mult })) });
                const legDarts = pl.currentLegDarts + allDarts.length;
                const startingPScore = pl.customStartingScore ?? config.startingScore;
                const thisLegAvg = legDarts > 0 ? (startingPScore / legDarts) * 3 : 0;
                pl.legAverages.push(parseFloat(thisLegAvg.toFixed(1)));
                pl.totalDarts += allDarts.length; pl.currentLegDarts += allDarts.length; pl.totalPoints += validPts; pl.score = 0; pl.opened = true; pl.lastVisit = validPts;
                pl.checkoutAttempts = Math.max(pl.checkoutAttempts, pl.checkoutSuccess + 1);
                pl.checkoutSuccess += 1;
                pl.highestCheckout = Math.max(pl.highestCheckout, validPts);
                pl.bestLegDarts = pl.bestLegDarts === null ? legDarts : Math.min(pl.bestLegDarts, legDarts);
                
                syncTeamState(np, activePlayer);
                return np; 
            }); 
            finishAsyncLeg(activeP.currentLegDarts + allDarts.length); 
        } else {
            handleWin(activePlayer, validPts, currentDarts.length + 1, allDarts);
        }
        return; 
    }

    const isBust = visit.bust;
    if (isBust) {
      triggerHaptic('bust'); announceScore(validPts.toString(), false, true);
      setPlayers(prev => { 
          const np = copyPlayers(prev);
          const pl = np[activePlayer]; 
          recordVisit(np, activePlayer, { leg: legNumber, scoreBefore: pl.score,
              points: 0, enteredPoints: allDarts.reduce((sum, dart) => sum + dart.val * dart.mult, 0),
              darts: allDarts.length, bust: true, checkout: false,
              hits: allDarts.map(dart => ({ val: dart.val, mult: dart.mult })) });
          pl.history.push({ score: pl.score, dartsCount: allDarts.length, points: 0, roundDarts: allDarts, openedBefore: pl.opened });
          pl.totalDarts += allDarts.length; pl.currentLegDarts += allDarts.length; pl.lastVisit = 0; pl.opened = visit.opened;
          
          syncTeamState(np, activePlayer);
          return np; 
      });
      setCurrentDarts([]); setActivePlayer(nextPlayerIdx()); 
      return;
    }

    setCurrentDarts(allDarts);
    if (allDarts.length === 3) { 
        if (validPts === 180) announceScore('', true, false); 
        else announceScore(validPts.toString()); 
    }
  }, [activePlayer, config, currentDarts, handleWin, isLegWinner, isSetWinner, isMatchWinner, practiceStatus, practiceTarget, showTutorial, asyncState, nextPlayerIdx, players, announceScore, c121DartsLeft, c121Target, c121Record, txt, aimTarget, recordHeatmapLocal, finishAsyncLeg, isAsync, triggerCelebration, legNumber]);

  const handleDartPress = (val: number, overrideMult?: number) => { 
      triggerHaptic('tap');
      const usedMult = overrideMult || activeMult;
      if (val === 25 && usedMult === 3) return; 
      processDart(val, val === 0 ? 1 : usedMult);
      setActiveMult(1); 
  };

  const handleFastEnter = useCallback((overridePts?: number, confirmedDarts?: 1 | 2 | 3, doubleConfirmed = false, fromBot = false) => {
    if ((input === '' && overridePts === undefined) || isLegWinner || isSetWinner || isMatchWinner || config.gameMode === 'practice' || asyncState !== 'playing') return;
    const pts = overridePts !== undefined ? overridePts : parseInt(input); 
    
    if (!Number.isInteger(pts) || !canScoreInDarts(pts, 3)) {
        triggerHaptic('bust');
        setFastError(txt.impossible);
        return;
    }
    setFastError('');
    
    const activeP = players[activePlayer]; 
    if (activeP.isBot && !fromBot) return;
    const tScore = activeP.score - pts;
    const isBust = config.checkout !== 'single' ? (tScore < 0 || tScore === 1) : (tScore < 0);
    const isOut = tScore === 0;
    if (isOut && !activeP.isBot && confirmedDarts === undefined) {
        setPendingCheckout(pts);
        setCheckoutDarts(3);
        setCheckoutDoubleConfirmed(false);
        return;
    }
    const usedDarts = confirmedDarts ?? 3;
    if (isOut && !canCheckoutInDarts(pts, usedDarts, config.checkout)) return;
    if (isOut && config.checkout !== 'single' && !activeP.isBot && !doubleConfirmed) return;
    triggerHaptic('hit'); saveQuickButtonUsage(pts);
    
    if (!isBust && activeP.currentLegDarts < 9) {
        const first9Darts = Math.min(usedDarts, 9 - activeP.currentLegDarts);
        setPlayers(prev => {
            const next = prev.map(player => ({ ...player }));
            next[activePlayer].first9Points += Math.round(pts * first9Darts / usedDarts);
            next[activePlayer].first9Darts += first9Darts;
            return next;
        });
    }

    if (isBust) {
       triggerHaptic('bust'); announceScore(pts.toString(), false, true); 
       setPlayers(prev => { 
           const np = copyPlayers(prev);
           const pl = np[activePlayer]; 
           const dartsBeforeBust = pl.currentLegDarts;
           recordVisit(np, activePlayer, { leg: legNumber, scoreBefore: pl.score,
             points: 0, enteredPoints: pts, darts: usedDarts, bust: true, checkout: false, hits: [] });
           pl.history.push({ score: pl.score, dartsCount: usedDarts, points: 0, roundDarts: [] });
           pl.totalDarts += usedDarts; pl.currentLegDarts += usedDarts; pl.lastVisit = 0;
           if (dartsBeforeBust < 9) pl.first9Darts += Math.min(usedDarts, 9 - dartsBeforeBust);
           
           syncTeamState(np, activePlayer);
           return np; 
       });
       setInput(''); setActivePlayer(nextPlayerIdx()); return;
    }

    if (isOut) { 
        if (isAsync) { 
            triggerHaptic('checkout'); announceScore(txt.checkoutMsg(pts), false, false, true);
            setPlayers(prev => { 
                const np = copyPlayers(prev);
                const pl = np[activePlayer]; 
                recordVisit(np, activePlayer, { leg: legNumber, scoreBefore: pl.score,
                  points: pts, enteredPoints: pts, darts: usedDarts, bust: false, checkout: true, hits: [] });
                const legDarts = pl.currentLegDarts + usedDarts;
                const startingPScore = pl.customStartingScore ?? config.startingScore;
                const thisLegAvg = legDarts > 0 ? (startingPScore / legDarts) * 3 : 0;
                pl.legAverages.push(parseFloat(thisLegAvg.toFixed(1)));
                pl.totalDarts += usedDarts; pl.currentLegDarts += usedDarts; pl.totalPoints += pts; pl.score = 0; pl.lastVisit = pts;
                pl.checkoutAttempts = Math.max(pl.checkoutAttempts, pl.checkoutSuccess + 1);
                pl.checkoutSuccess += 1;
                pl.highestCheckout = Math.max(pl.highestCheckout, pts);
                pl.bestLegDarts = pl.bestLegDarts === null ? legDarts : Math.min(pl.bestLegDarts, legDarts);
                
                syncTeamState(np, activePlayer);
                return np; 
            }); 
            finishAsyncLeg(activeP.currentLegDarts + usedDarts); 
        } else {
            handleWin(activePlayer, pts, usedDarts); 
        }
    } else { 
        if (pts === 180) announceScore('', true, false); else announceScore(pts.toString());
        setPlayers(prev => { 
            const np = copyPlayers(prev);
            const pl = np[activePlayer]; 
            recordVisit(np, activePlayer, { leg: legNumber, scoreBefore: pl.score,
              points: pts, enteredPoints: pts, darts: usedDarts, bust: false, checkout: false, hits: [] });
            pl.score = tScore; 
            pl.history.push({ score: pl.score + pts, dartsCount: usedDarts, points: pts, roundDarts: [] });
            pl.totalPoints += pts; pl.totalDarts += usedDarts; pl.currentLegDarts += usedDarts; pl.lastVisit = pts;
            updateRoundStats(pl, pts); 
            
            syncTeamState(np, activePlayer);
            return np; 
        });
        setActivePlayer(nextPlayerIdx()); 
    }  
    setInput('');
  }, [input, isLegWinner, isSetWinner, isMatchWinner, config.gameMode, config.checkout, asyncState, players, activePlayer, txt, nextPlayerIdx, handleWin, announceScore, legNumber, isAsync]);

  useEffect(() => { handleFastEnterRef.current = (pts, fromBot, darts) => handleFastEnter(pts, darts, false, fromBot); }, [handleFastEnter]);
  useEffect(() => { processDartRef.current = (val, mult, fromBot) => processDart(val, mult, fromBot); }, [processDart]);

  useEffect(() => {
    if (currentDarts.length === 3 && !isLegWinner && !isSetWinner && !isMatchWinner && practiceStatus === 'playing') {
      const timer = setTimeout(() => {
        if (config.gameMode === 'practice') {
            if (config.practiceType === 'bobs27') {
                let fs = bobsScore; if (bobsRoundScore === 0) fs -= (practiceTarget * 2); else fs += bobsRoundScore;
                setBobsScore(fs); setBobsRoundScore(0);
                if (fs < 0) { setPracticeStatus('lost'); announceScore('', false, true); } 
                else if (practiceTarget === 25) { setPracticeStatus('won'); triggerCelebration('checkout', 'WINNER', "Bob's 27 Complete", players[0].color); } 
                else { setPracticeTarget(prev => prev === 20 ? 25 : prev + 1); }
            }
            if (config.practiceType !== '121') setCurrentDarts([]);
        } else {
            const activeP = players[activePlayer]; 
            const visit = evaluateVisit(activeP.score, currentDarts.map(d => ({ val: d.val, mult: (d.val === 0 ? 1 : d.mult) as 1 | 2 | 3 })), {
                checkIn: config.checkIn, checkout: config.checkout,
                opened: activeP.opened ?? (config.checkIn === 'single' || activeP.score < (activeP.customStartingScore ?? config.startingScore)),
            });
            const v = visit.scored;
            setPlayers(prev => { 
                const np = copyPlayers(prev);
                const pl = np[activePlayer]; 
                const openedBefore = pl.opened;
                recordVisit(np, activePlayer, { leg: legNumber, scoreBefore: pl.score,
                  points: v, enteredPoints: currentDarts.reduce((sum, dart) => sum + dart.val * dart.mult, 0),
                  darts: 3, bust: false, checkout: false,
                  hits: currentDarts.map(dart => ({ val: dart.val, mult: dart.mult })) });
                pl.score -= v; pl.opened = visit.opened;
                pl.history.push({ score: pl.score + v, dartsCount: 3, points: v, roundDarts: currentDarts, openedBefore });
                pl.totalPoints += v; pl.totalDarts += 3; pl.currentLegDarts += 3; pl.lastVisit = v; 
                updateRoundStats(pl, v); 
                
                syncTeamState(np, activePlayer);
                return np; 
            });
            setCurrentDarts([]); setActivePlayer(nextPlayerIdx()); 
        }
      }, 600); 
      return () => clearTimeout(timer);
    }
  }, [currentDarts, activePlayer, isLegWinner, isSetWinner, isMatchWinner, practiceStatus, bobsScore, bobsRoundScore, practiceTarget, nextPlayerIdx, config, players, legNumber]);

  const handleHunterHit = (hits: number) => {
      if (practiceStatus !== 'playing' || !Number.isInteger(hits) || hits < 0 || hits > 3) return;
      const roundKey = `${hunterRound}:${hunterTargetStr}`;
      if (recordedHunterRound.current === roundKey) return;
      recordedHunterRound.current = roundKey;
      triggerHaptic('tap'); setHunterTotalHits(prev => prev + hits);
      recordHeatmapLocal(hunterHeatmapEvent(auth.currentUser?.uid || 'guest', config.dartSetupId || 'default', hunterTargetStr, hits));
      if (hunterRound >= 10) { setPracticeStatus('won'); triggerCelebration('checkout', `${hunterTotalHits + hits}/30`, 'Heatmap Updated!', players[0].color); } 
      else { setHunterRound(prev => prev + 1); setHunterTargetStr(randomHunterTarget()); }
  };

  const handleMathEnter = () => {
      triggerHaptic('tap');
      if (mathInput === '') return;
      if (parseInt(mathInput) === mathQuestion.ans) { announceScore("Correct"); setMathScore(prev => prev + 1); } 
      else { announceScore("Wrong"); }
      if (mathRound >= 10) { setPracticeStatus('won'); triggerCelebration('checkout', `${mathScore + (parseInt(mathInput) === mathQuestion.ans ? 1 : 0)}/10`, 'Agytréning Kész!', players[0].color); } 
      else { setMathRound(prev => prev + 1); setMathInput(''); generateMathQuestion(); }
  };

  const handleUndo = () => {
    if (isLegWinner || isSetWinner || isMatchWinner || practiceStatus !== 'playing' || asyncState !== 'playing') return;
    triggerHaptic('tap');
    setIsVerified(false);

    if (config.gameMode === 'practice') {
        if (config.practiceType === 'math' && mathInput.length > 0) { setMathInput(mathInput.slice(0, -1)); return; }
        if (currentDarts.length === 0) return;
        const lastDart = currentDarts[currentDarts.length - 1];
        if (config.practiceType === 'around' && lastDart.val === (practiceTarget === 25 ? 20 : practiceTarget === 1 ? 1 : practiceTarget - 1)) { setPracticeTarget(prev => prev === 25 ? 20 : prev - 1); }
        if (config.practiceType === 'bobs27' && lastDart.val === practiceTarget && lastDart.mult === 2) { setBobsRoundScore(prev => prev - (practiceTarget * 2)); }
        if (config.practiceType === '121') { setC121DartsLeft(prev => prev + 1); }
        setCurrentDarts(currentDarts.slice(0, -1)); return;
    }

    if (inputMode === 'fast' && input.length > 0) { setFastError(''); setInput(input.slice(0, -1)); return; }
    if ((inputMode === 'detailed' || inputMode === 'board') && currentDarts.length > 0 && !players[activePlayer].isBot) {
        undoHeatmapDart(currentDarts[currentDarts.length - 1]);
        setCurrentDarts(currentDarts.slice(0, -1)); return;
    }
    if (!players.some(p => p.history.length > 0)) return;
    
    const prevPlayerIdx = activePlayer === 0 ? players.length - 1 : activePlayer - 1;
    const lastVisit = players[prevPlayerIdx].history.at(-1);
    if (!lastVisit) return;
    lastVisit?.roundDarts.forEach(undoHeatmapDart);
    setPlayers(prev => {
        const np = copyPlayers(prev);
        const pl = np[prevPlayerIdx]; 
        const lh = pl.history[pl.history.length - 1];
        if (lh.points === 180) pl.count180 = Math.max(0, pl.count180 - 1); 
        else if (lh.points >= 140) pl.count140 = Math.max(0, pl.count140 - 1); 
        else if (lh.points >= 100) pl.count100 = Math.max(0, pl.count100 - 1);
        np[prevPlayerIdx] = { 
            ...pl, score: lh.score, opened: lh.openedBefore ?? (config.checkIn === 'single' || lh.score < (pl.customStartingScore ?? config.startingScore)), totalPoints: pl.totalPoints - lh.points, totalDarts: pl.totalDarts - lh.dartsCount,
            currentLegDarts: pl.currentLegDarts - lh.dartsCount, history: pl.history.slice(0, -1), visitLog: pl.visitLog.slice(0, -1), lastVisit: pl.history.length > 1 ? pl.history[pl.history.length - 2].points : null
        };
        
        syncTeamState(np, prevPlayerIdx);
        return np;
    }); 
    setActivePlayer(prevPlayerIdx);
  };

  const handleNextLegOrSet = () => { 
      if (config.gameMode === 'practice') { 
          setPracticeTarget(1); setBobsScore(27); setBobsRoundScore(0); 
          if (config.practiceType === '121') { setC121Target(121); setC121DartsLeft(9); setPlayers(prev => [{...prev[0], score: 121, history: []}]); }
          if (config.practiceType === 'hunter') { setHunterRound(1); setHunterTotalHits(0); setHunterTargetStr(HUNTER_TARGETS[0]); recordedHunterRound.current = ''; }
          if (config.practiceType === 'math') { setMathRound(1); setMathScore(0); setMathInput(''); generateMathQuestion(); }
          setPracticeStatus('playing'); setCurrentDarts([]); return; 
      }
      
      setPlayers(prev => prev.map(pl => ({ 
          ...pl, 
          score: pl.customStartingScore ?? config.startingScore, 
          currentLegDarts: 0, opened: config.checkIn === 'single',
          history: [], 
          lastVisit: null 
      }))); 
      setLegNumber(prev => prev + 1);
      setCurrentDarts([]); setIsLegWinner(false); setIsSetWinner(false); setAsyncState('playing');
      const tp = players.reduce((sum, pl) => sum + pl.legsWon + (pl.setsWon * config.legsToWin), 0); 
      if (!isAsync) setActivePlayer(tp % players.length);
  };
  
  const handleExit = () => { 
      if (isMatchWinner || config.gameMode === 'practice' || (!isAsync && !hasMatchProgress)) localStorage.removeItem('dartisan_save');
      onBackToSetup(); 
  };

  const handleDeleteCompletedRoom = async () => {
      if (!isAsync || role !== 'host' || !config.challengeCode || !fbSyncData?.state?.winner) return;
      try {
          await deleteDoc(doc(db, 'matches', config.challengeCode));
          localStorage.removeItem('dartisan_save');
          onBackToSetup();
      } catch (error) {
          console.error('Room deletion failed', error);
          setFeedback({ kind: 'notice', message: lang === 'hu' ? 'A szoba törlése nem sikerült. Próbáld újra.' : 'Could not delete the room. Please try again.' });
      }
  };

  const handleCSVExport = () => {
      const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
      let csv = "\uFEFFJatekos,Atlag,Elso 9 Atlag,Kiszallo %,Legjobb Kiszallo,180,140,100+\n";
      players.forEach(p => {
          const avg = ((p.totalPoints / (p.totalDarts || 1)) * 3).toFixed(2);
          const f9avg = ((p.first9Points / (p.first9Darts || 1)) * 3).toFixed(2);
          const checkout = p.checkoutAttempts > 0 ? Math.round((p.checkoutSuccess / p.checkoutAttempts) * 100) : 0;
          csv += [p.name, avg, f9avg, `${checkout}%`, p.highestCheckout, p.count180, p.count140, p.count100].map(csvCell).join(',') + '\n';
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Dartisan_Meccs_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShareMatch = async () => {
    const pl = players[0];
    const dartsSum = Math.max(pl.totalDarts, 1);
    const avg = ((pl.totalPoints / dartsSum) * 3).toFixed(1);
    const coPct = pl.checkoutAttempts > 0 ? Math.round((pl.checkoutSuccess / pl.checkoutAttempts) * 100) : 0;
    const isHu = lang === 'hu';
    const textHU = `🎯 Dartisan Eredmény\nJátékmód: ${config.gameMode.toUpperCase()}\nÁtlagom: ${avg}\nKiszálló: ${coPct}% (Max: ${pl.highestCheckout > 0 ? pl.highestCheckout : '-'})\n100+: ${pl.count100} | 140+: ${pl.count140} | 180: ${pl.count180}\n\nLégy te is Dartisan!`;
    const textEN = `🎯 Dartisan Result\nMode: ${config.gameMode.toUpperCase()}\nAverage: ${avg}\nCheckout: ${coPct}% (High: ${pl.highestCheckout > 0 ? pl.highestCheckout : '-'})\n100+: ${pl.count100} | 140+: ${pl.count140} | 180: ${pl.count180}\n\nBecome a Dartisan!`;
    const text = isHu ? textHU : textEN;

    if (navigator.share) {
        try { await navigator.share({ title: isHu ? 'Dartisan Meccs Eredmény' : 'Dartisan Match Result', text: text, }); } 
        catch (error) { console.log("Megosztás megszakítva vagy hiba történt.", error); }
    } else {
        try {
          await navigator.clipboard.writeText(text);
          setFeedback({ kind: 'notice', message: isHu ? 'Eredmény a vágólapra másolva!' : 'Result copied to clipboard!' });
        } catch {
          setFeedback({ kind: 'notice', message: isHu ? 'A másolás nem sikerült. Ellenőrizd a böngésző engedélyeit.' : 'Could not copy the result. Check browser permissions.' });
        }
    }
  };

  const displayPlayers = players;
  const safePlayer = players[activePlayer] || players[0];
  const pendingFastPoints = inputMode === 'fast' && !safePlayer?.isBot && /^\d{1,3}$/.test(input) ? Number(input) : null;
  const fastPreviewRemaining = pendingFastPoints !== null && canScoreInDarts(pendingFastPoints, 3)
      && safePlayer && safePlayer.score - pendingFastPoints >= 0
      && (config.checkout === 'single' || safePlayer.score - pendingFastPoints !== 1)
      ? safePlayer.score - pendingFastPoints : null;
  const lastCompletedPlayer = isAsync || players.length === 1 || isLegWinner || isSetWinner || isMatchWinner
      ? safePlayer
      : players[(activePlayer - 1 + players.length) % players.length];
  const matchWinnerPlayer = players.reduce((winner, player) => player.setsWon > winner.setsWon ? player : winner, players[0]);
  const winnerColorTheme = COLOR_STYLES[matchWinnerPlayer?.color] || COLOR_STYLES.emerald;
  const legWinnerPlayer = isAsync
      ? (fbSyncData?.state?.resolvedLeg?.winner === role ? players[0] : players[1])
      : safePlayer;
  const checkoutDartsValid = pendingCheckout === null || canCheckoutInDarts(pendingCheckout, checkoutDarts, config.checkout);
  const activeColorTheme = COLOR_STYLES[safePlayer?.color] || COLOR_STYLES['emerald']; 
  const colTxt = activeColorTheme.split(' ')[0] || 'text-emerald-400'; 
  const colBg = activeColorTheme.split(' ')[3] || 'bg-emerald-500';

  const isBotTurn = safePlayer?.isBot && !isAsync;
  const activeRemaining = fastPreviewRemaining ?? (safePlayer ? displayedRemaining(safePlayer, activePlayer, currentDarts, config) : 0);
  const isStandalonePractice = config.gameMode === 'practice' && (config.practiceType === 'hunter' || config.practiceType === 'math');
  const practiceName = config.practiceType === 'around' ? 'Around Clock' : config.practiceType === 'bobs27' ? "Bob's 27" : config.practiceType === '121' ? '121 Challenge' : config.practiceType === 'hunter' ? (lang === 'hu' ? 'Célpont vadász' : 'Target Hunter') : config.practiceType === 'math' ? 'Darts Math' : (lang === 'hu' ? 'AI edzés' : 'AI drill');
  const recordedSectorHits = Object.values(normalizeHeatmapData(fullHeatmapData)).reduce((total, entry) => total + entry.hits, 0);

  const recObj = getCheckoutTable(activeRemaining, 3 - currentDarts.length);

  return (
    <div className="fixed inset-0 bg-[#0b0d11] text-slate-200 flex flex-col overflow-x-hidden overflow-y-auto tracking-tight pt-[calc(1rem+var(--app-safe-top))]">
      <AppFeedback feedback={feedback} lang={lang} onClose={() => setFeedback(null)} />
      <div className="w-full max-w-[1100px] px-3 sm:px-6 mx-auto mb-2 flex items-center justify-between shrink-0">
        <div className="text-[10px] sm:text-xs font-black tracking-[0.2em] text-emerald-400 uppercase">Dartisan <span className="text-slate-500">· {config.gameMode === 'challenge' ? (lang === 'hu' ? 'Online meccs' : 'Online match') : (lang === 'hu' ? 'Mérkőzés' : 'Match')}</span></div>
        <div className="flex items-center gap-2">
          {tutKey && <button onClick={() => setShowTutorial(true)} aria-label={lang === 'hu' ? 'Játékszabályok' : 'Game rules'} className="h-9 w-9 flex items-center justify-center text-slate-300 hover:text-amber-400 bg-slate-900 rounded-full border border-slate-700 font-black">?</button>}
          <button onClick={() => window.open('/tv', '_blank')} aria-label={lang === 'hu' ? 'TV nézet megnyitása' : 'Open TV view'} className="h-9 min-w-9 px-2 text-slate-300 hover:text-cyan-400 bg-slate-900 rounded-full border border-slate-700 text-[10px] font-black uppercase">TV</button>
          <button onClick={handleExit} aria-label={lang === 'hu' ? 'Vissza a kezdőképernyőre' : 'Back to home'} className="h-9 w-9 flex items-center justify-center text-slate-300 hover:text-rose-400 bg-slate-900 rounded-full border border-slate-700"><XMarkIcon className="h-5 w-5" /></button>
        </div>
      </div>

      <div className={`w-full max-w-[1100px] px-3 sm:px-6 pb-2 grid gap-2 sm:gap-3 mx-auto shrink-0 ${displayPlayers.length > 2 ? 'grid-cols-2 md:grid-cols-4' : displayPlayers.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {displayPlayers.map((pl) => {
              const pColStyle = COLOR_STYLES[pl.color] || COLOR_STYLES.emerald;
              const pColTxt = pColStyle.split(' ')[0];
              const pColBor = pColStyle.split(' ')[1];
              return (
                  <div key={pl.id} aria-current={activePlayer === pl.id ? 'true' : undefined} className={`min-w-0 min-h-[110px] sm:min-h-[124px] rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center border-2 transition-colors duration-300 ${activePlayer === pl.id ? `bg-slate-800/90 ${pColBor}` : 'bg-slate-900/75 border-slate-700/70'}`}>
                      <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wide truncate w-full text-center px-2 ${activePlayer === pl.id ? pColTxt : 'text-slate-300'}`}>{pl.name}</span>
                      <span aria-label={pl.id === activePlayer && fastPreviewRemaining !== null ? (lang === 'hu' ? `Előnézet: ${fastPreviewRemaining} pont marad` : `Preview: ${fastPreviewRemaining} points remaining`) : undefined} className={`text-4xl sm:text-5xl lg:text-6xl font-black font-mono leading-none tabular-nums ${activePlayer === pl.id ? 'text-white' : 'text-slate-200'}`}>{config.gameMode === 'practice' ? config.practiceType === 'bobs27' ? bobsScore : config.practiceType === 'hunter' ? hunterTotalHits : config.practiceType === 'math' ? mathScore : config.practiceType === 'around' ? practiceTarget === 25 ? 'BULL' : practiceTarget : pl.score : pl.id === activePlayer && fastPreviewRemaining !== null ? fastPreviewRemaining : displayedRemaining(pl, activePlayer, currentDarts, config)}</span>
                      <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">{config.gameMode === 'practice' ? practiceName : <>{lang === 'hu' ? 'Szett' : 'Set'} {pl.setsWon} · {lang === 'hu' ? 'Leg' : 'Leg'} {pl.legsWon}</>}</span>
                      {config.gameMode !== 'practice' && <span className="text-[10px] sm:text-xs font-bold text-slate-400 tabular-nums">{lang === 'hu' ? 'Utolsó kör' : 'Last visit'}: <span className="text-white font-black">{pl.lastVisit ?? '—'}</span></span>}
                  </div>
              );
          })}
      </div>

      {isAsync && (asyncState !== 'playing' || onlineError || !browserOnline) && (
        <div role="status" aria-live="polite" className="w-full max-w-[1100px] mx-auto px-3 sm:px-6 pb-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-cyan-100">{asyncState === 'waiting_leg'
                ? pendingOnlineDarts !== null
                  ? (isSubmittingAsyncLeg ? (lang === 'hu' ? 'Leg eredményének feltöltése…' : 'Uploading leg result…') : (lang === 'hu' ? 'A leg eredménye még nincs megerősítve' : 'Leg result not confirmed yet'))
                  : (lang === 'hu' ? 'Várakozás az ellenfélre' : 'Waiting for opponent')
                : (lang === 'hu' ? 'Online meccs' : 'Online match')}</p>
              {onlineError && <p className="mt-1 text-xs font-semibold text-rose-200">{onlineError}</p>}
              {!browserOnline && <p className="mt-1 text-xs font-semibold text-cyan-200">{lang === 'hu' ? 'Nincs internetkapcsolat. A meccs helyben megmarad; csatlakozz újra a folytatáshoz.' : 'You are offline. The match remains saved on this device; reconnect to continue.'}</p>}
              {asyncState === 'waiting_leg' && pendingOnlineDarts === null && !onlineError && <p className="mt-1 text-xs text-slate-300">{lang === 'hu' ? 'A te eredményed rögzítve. A következő leg akkor indul, ha a másik játékos is végez.' : 'Your result is saved. The next leg starts when the other player finishes.'}</p>}
            </div>
            {pendingOnlineDarts !== null && !isSubmittingAsyncLeg && <button type="button" onClick={() => void finishAsyncLeg(pendingOnlineDarts)} disabled={!browserOnline} className="min-h-11 shrink-0 rounded-xl bg-cyan-400 px-4 text-xs font-black uppercase text-slate-950 disabled:opacity-40">{lang === 'hu' ? 'Újraküldés' : 'Resend'}</button>}
          </div>
        </div>
      )}

      {config.gameMode === 'practice' && (
        <section aria-label={lang === 'hu' ? 'Edzés állása' : 'Training progress'} className="w-full max-w-[1100px] mx-auto px-3 sm:px-6 pb-3 shrink-0">
          <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/10 to-[#12141a] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-2"><span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{practiceName}</span><span className="text-[10px] font-black text-slate-400">{config.practiceType === 'around' ? `${practiceTarget === 25 ? 21 : practiceTarget}/21` : config.practiceType === 'bobs27' ? `${practiceTarget === 25 ? 21 : practiceTarget}/21` : config.practiceType === 'hunter' ? `${hunterRound}/10` : config.practiceType === 'math' ? `${mathRound}/10` : config.practiceType === '121' ? `${c121DartsLeft} ${lang === 'hu' ? 'nyíl maradt' : 'darts left'}` : `${currentDarts.length}/3`}</span></div>
            <p className="text-sm sm:text-base font-black text-white">{config.practiceType === 'around' ? `${lang === 'hu' ? 'Célpont' : 'Target'}: ${practiceTarget === 25 ? 'BULL' : practiceTarget}` : config.practiceType === 'bobs27' ? `${lang === 'hu' ? 'Célpont' : 'Target'}: ${practiceTarget === 25 ? 'D-BULL' : `D${practiceTarget}`} · ${lang === 'hu' ? 'Pont' : 'Score'}: ${bobsScore}` : config.practiceType === '121' ? `${lang === 'hu' ? 'Kiszálló' : 'Checkout'}: ${c121Target} · ${lang === 'hu' ? 'Maradék' : 'Remaining'}: ${players[0]?.score}` : config.practiceType === 'hunter' ? `${lang === 'hu' ? 'Célpont' : 'Target'}: ${hunterTargetStr} · ${hunterTotalHits}/30 ${lang === 'hu' ? 'találat' : 'hits'}` : config.practiceType === 'math' ? `${mathQuestion.start} − ${mathQuestion.dartText} = ?` : `${lang === 'hu' ? 'Célpont' : 'Target'}: ${config.drillTarget ?? 20}`}</p>
            {config.practiceType === 'hunter' && practiceStatus === 'playing' && <div className="grid grid-cols-4 gap-2 mt-3">{[0, 1, 2, 3].map(hits => <button key={hits} type="button" onClick={() => handleHunterHit(hits)} className="min-h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 font-black text-sm hover:bg-cyan-500/25">{hits} {lang === 'hu' ? 'találat' : 'hits'}</button>)}</div>}
            {config.practiceType === 'math' && practiceStatus === 'playing' && <form onSubmit={event => { event.preventDefault(); handleMathEnter(); }} className="flex gap-2 mt-3"><input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={lang === 'hu' ? 'Eredmény' : 'Answer'} value={mathInput} onChange={event => setMathInput(event.target.value.replace(/\D/g, '').slice(0, 3))} className="min-w-0 flex-1 h-12 rounded-xl bg-slate-950 border border-slate-700 px-4 text-white font-mono font-bold outline-none focus:border-cyan-400"/><button type="submit" disabled={!mathInput} className="h-12 px-4 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black uppercase disabled:opacity-40">{lang === 'hu' ? 'Ellenőrzés' : 'Check'}</button></form>}
            {practiceStatus === 'won_121_round' && <p className="text-xs font-bold text-emerald-300 mt-2">{lang === 'hu' ? 'Sikeres kiszálló! A következő célpont indul.' : 'Checkout complete! The next target is starting.'}</p>}
          </div>
        </section>
      )}

      <div className="w-full max-w-[1100px] px-3 sm:px-6 mx-auto pb-2 grid grid-cols-3 gap-2 shrink-0">
        <div className="min-w-0 rounded-xl bg-slate-900/70 border border-slate-800 px-2 py-2 text-center"><div className="text-[9px] uppercase font-black tracking-wide text-slate-400">{lang === 'hu' ? 'Soron' : 'Turn'}</div><div className={`text-sm font-black truncate ${colTxt}`}>{safePlayer?.name}</div></div>
        <div className="min-w-0 rounded-xl bg-slate-900/70 border border-slate-800 px-2 py-2 text-center"><div className="text-[9px] uppercase font-black tracking-wide text-slate-400">{lang === 'hu' ? 'Legutóbbi kör' : 'Latest visit'}</div><div className="text-sm font-black text-white tabular-nums">{lastCompletedPlayer?.lastVisit ?? '—'}</div><div className="text-[9px] text-slate-400 truncate">{lastCompletedPlayer?.lastVisit != null ? lastCompletedPlayer.name : '\u00a0'}</div></div>
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-2 py-2 text-center"><div className="text-[9px] uppercase font-black tracking-wide text-slate-400">{lang === 'hu' ? '3 nyilas átlag' : '3-dart avg'}</div><div className="text-sm font-black text-white tabular-nums">{safePlayer?.totalDarts ? ((safePlayer.totalPoints / safePlayer.totalDarts) * 3).toFixed(1) : '—'}</div></div>
      </div>

      <div className={`px-3 sm:px-6 bg-[#12141a] border-t border-slate-800 rounded-t-[2.5rem] w-full max-w-[1100px] mx-auto flex-col relative ${isStandalonePractice ? 'hidden' : 'flex'} ${inputMode === 'board' ? 'shrink-0 pt-2 pb-2' : 'shrink-0 pt-3 pb-6 sm:pb-4 md:flex-1 md:shrink md:min-h-[540px]'}`}>

        {/* Checkout suggestion bar */}
        <div className={`w-full flex items-center justify-center transition-all ${recObj ? 'min-h-[46px] mb-3' : 'hidden'}`}>
             {recObj ? (
                <div className={`${recObj.isSmart && checkoutStrategy === 'pro' ? 'bg-[#b655ff]/10 border-[#b655ff]/30 text-[#b655ff]' : `bg-cyan-500/10 border-cyan-500/20 text-cyan-400`} px-4 sm:px-6 py-2 rounded-xl border flex items-center justify-center w-full shadow-inner`}>
                    <span className="font-mono text-sm sm:text-base font-black tracking-[0.15em] sm:tracking-[0.2em] uppercase italic w-full text-center">
                        🎯 {recObj.text}
                    </span>
                    {recObj.isSmart && activeRemaining <= 170 && (
                        <button onClick={(e) => { e.stopPropagation(); triggerHaptic('tap'); setCheckoutStrategy(prev => prev === 'safe' ? 'pro' : 'safe') }} className="ml-2 shrink-0">
                            {checkoutStrategy === 'pro' ? <FireIcon className="h-5 w-5 text-[#b655ff]" /> : <ShieldCheckIcon className="h-5 w-5 text-cyan-400" />}
                        </button>
                    )}
                </div>
             ) : (
                <div className="h-full w-full" />
             )}
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 w-full mb-3 shrink-0">
            <button onClick={() => setInputMode('detailed')} disabled={currentDarts.length > 0 && inputMode !== 'detailed'} className={`flex-1 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase border transition-all disabled:opacity-40 ${inputMode === 'detailed' ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-950 text-slate-600 border-slate-800'}`}>Pro</button>
            <button onClick={() => setInputMode('board')} disabled={currentDarts.length > 0 && inputMode !== 'board'} className={`flex-1 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase border transition-all disabled:opacity-40 ${inputMode === 'board'    ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-950 text-slate-600 border-slate-800'}`}>{lang === 'hu' ? 'Tábla' : 'Board'}</button>
            <button onClick={() => setInputMode('fast')} disabled={config.checkIn !== 'single' || config.gameMode === 'practice' || currentDarts.length > 0 && inputMode !== 'fast'} title={config.gameMode === 'practice' ? (lang === 'hu' ? 'Az edzéshez nyilankénti bevitel szükséges' : 'Training requires dart-by-dart input') : config.checkIn !== 'single' ? (lang === 'hu' ? 'Dupla vagy Master beszállónál nyilankénti bevitel szükséges' : 'Dart-by-dart input is required for double or Master entry') : undefined} className={`flex-1 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase border transition-all ${inputMode === 'fast' ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-950 text-slate-600 border-slate-800'} disabled:opacity-40 disabled:cursor-not-allowed`}>Fast</button>
        </div>

        {(inputMode === 'detailed' || inputMode === 'board') && config.gameMode !== 'practice' && (
            <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                <label htmlFor="aim-target" className="shrink-0 font-bold">{lang === 'hu' ? 'Célpont' : 'Aiming at'}</label>
                <select id="aim-target" value={aimTarget} onChange={event => setAimTarget(event.target.value)} disabled={safePlayer.isBot}
                    aria-label={lang === 'hu' ? 'Célzott szektor a következő nyilakhoz' : 'Aimed sector for next darts'}
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 font-bold text-white outline-none focus:border-cyan-400 disabled:opacity-50">
                    <option value="">{lang === 'hu' ? 'Nincs megadva · csak találatok' : 'Not selected · hits only'}</option>
                    <option value="25">25</option><option value="50">Bull (50)</option>
                    {(['T', 'D', 'S'] as const).map(prefix => <optgroup key={prefix} label={prefix === 'T' ? 'Tripla' : prefix === 'D' ? 'Dupla' : 'Sima'}>
                        {AIM_NUMBERS.map(number => <option key={`${prefix}${number}`} value={`${prefix}${number}`}>{prefix}{number}</option>)}
                    </optgroup>)}
                </select>
            </div>
        )}
        {heatmapSyncError && <p role="status" className="mb-2 text-center text-xs text-slate-400">{heatmapSyncError === 'local-storage'
            ? (lang === 'hu' ? 'A hőtérkép helyi mentése nem sikerült. Ellenőrizd a böngésző tárhelyét.' : 'Could not save heatmap locally. Check browser storage.')
            : (lang === 'hu' ? `${heatmapPending} nyíl helyben mentve; kapcsolat esetén szinkronizáljuk.` : `${heatmapPending} throws saved locally; syncing when connected.`)}</p>}

        {/* ── PRO / DETAILED INPUT ── */}
        {inputMode === 'detailed' && (
            <div className="flex flex-col gap-2 sm:gap-3 md:flex-1">
            {/* Dart slots */}
            <div className="flex justify-between gap-2 h-12 sm:h-14 shrink-0">
                {[0, 1, 2].map((i) => (
                    <div key={i} className={`flex-1 rounded-xl border flex items-center justify-center font-mono text-lg sm:text-xl font-black ${currentDarts[i] ? `bg-slate-800 text-white shadow-lg` : 'bg-slate-950/50 border-slate-800 text-slate-800'}`}>
                        {currentDarts[i] ? ((currentDarts[i].mult === 3 ? 'T' : currentDarts[i].mult === 2 ? 'D' : '') + (currentDarts[i].val === 0 ? 'M' : currentDarts[i].val)) : ''}
                    </div>
                ))}
                <button onClick={handleUndo} aria-label={lang === 'hu' ? 'Utolsó dobás visszavonása' : 'Undo last throw'} className="w-14 sm:w-16 bg-slate-800/60 rounded-xl flex items-center justify-center border border-slate-700 text-slate-400 active:scale-90">
                    <BackspaceIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
            </div>
            {/* Multiplier */}
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setActiveMult(1)} className={`h-11 sm:h-13 md:h-14 rounded-xl font-black text-[10px] sm:text-xs md:text-base transition-all ${activeMult === 1 ? 'bg-white text-black' : 'bg-slate-800 text-slate-500'}`}>SINGLE</button>
                <button onClick={() => setActiveMult(2)} className={`h-11 sm:h-13 md:h-14 rounded-xl font-black text-[10px] sm:text-xs md:text-base transition-all ${activeMult === 2 ? `bg-emerald-500 text-black` : 'bg-slate-800 text-slate-500'}`}>DOUBLE</button>
                <button onClick={() => setActiveMult(3)} className={`h-11 sm:h-13 md:h-14 rounded-xl font-black text-[10px] sm:text-xs md:text-base transition-all ${activeMult === 3 ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}>TRIPLE</button>
            </div>
            {/* Numbers 1-20 + 0 */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:flex-1 md:grid-rows-5">
                {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
                    <button key={n} onClick={() => handleDartPress(n)}
                        className="h-10 sm:h-12 md:h-full md:min-h-14 bg-slate-800/60 rounded-lg font-black text-sm sm:text-base md:text-2xl active:scale-90 transition-transform">{n}</button>
                ))}
                <button onClick={() => handleDartPress(0)}
                    className="h-10 sm:h-12 md:h-full md:min-h-14 bg-slate-900 rounded-lg font-black text-sm md:text-2xl text-slate-600 active:scale-90 transition-transform border border-slate-800">0</button>
                <button onClick={() => handleDartPress(25)} disabled={activeMult === 3}
                    className={`h-10 sm:h-12 md:h-full md:min-h-14 rounded-lg font-black text-xs md:text-lg col-span-3 transition-all ${activeMult === 3 ? 'opacity-40 bg-slate-900' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'}`}>BULL</button>
                <button onClick={() => handleDartPress(0)}
                    className="h-10 sm:h-12 md:h-full md:min-h-14 bg-slate-800/30 rounded-lg font-black text-[10px] md:text-base col-span-1 text-slate-600 uppercase active:scale-90 border border-slate-800">Miss</button>
            </div>
            </div>
        )}

        {/* ── BOARD INPUT ── */}
        {inputMode === 'board' && (
            <div className="flex flex-col gap-2 pb-2">
            {/* Pending dart slots above board */}
            <div className="flex gap-2 shrink-0">
                {[0,1,2].map(i=>{
                    const d=currentDarts[i];
                    return <div key={i} className={`flex-1 h-10 rounded-xl border flex items-center justify-center font-mono font-black text-sm transition-all ${d?'bg-slate-800 text-white border-slate-600 shadow-lg':'bg-slate-950/50 border-slate-800 text-slate-800'}`}>
                        {d?((d.mult===3?'T':d.mult===2?'D':'')+(d.val===0?'M':d.val)):'' }
                    </div>;
                })}
                <button onClick={handleUndo} aria-label={lang === 'hu' ? 'Utolsó dobás visszavonása' : 'Undo last throw'} className="w-12 bg-slate-800/60 rounded-xl flex items-center justify-center border border-slate-700 text-slate-400 active:scale-90">
                    <BackspaceIcon className="h-5 w-5"/>
                </button>
            </div>
            <div className="w-full flex items-center justify-center relative">
                <InteractiveDartboard
                    onDartSelect={(val, mult) => handleDartPress(val, mult)}
                    currentDarts={currentDarts}
                    playerColor={safePlayer?.color}
                    lang={lang}
                />
            </div>
            </div>
        )}

        {/* ── FAST INPUT ── */}
        {inputMode === 'fast' && (
            <div className="flex flex-col gap-2 sm:gap-3 md:flex-1">
            {/* Quick score buttons */}
            <div className="flex gap-2">
                {quickButtons.map(qb => (
                    <button key={qb} disabled={isBotTurn} onClick={() => handleFastEnter(qb)}
                        className="flex-1 bg-slate-800/80 text-emerald-400 border border-slate-700 h-10 sm:h-12 rounded-xl font-mono font-black text-sm sm:text-base active:scale-95 transition-transform">{qb}</button>
                ))}
            </div>
            {/* Score display */}
            <div className="flex justify-between items-center px-4 sm:px-6 h-14 sm:h-16 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                <span className="font-mono text-4xl sm:text-5xl font-black text-white">{input || (isBotTurn ? '' : '0')}</span>
                <button onClick={handleUndo} aria-label={lang === 'hu' ? 'Utolsó dobás visszavonása' : 'Undo last throw'} className="p-2 text-slate-700 active:scale-90"><BackspaceIcon className="h-8 w-8 sm:h-9 sm:w-9"/></button>
            </div>
            <p role={fastError ? 'alert' : undefined} className="min-h-4 px-1 text-xs font-semibold text-rose-400">{fastError}</p>
            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:flex-1 md:grid-rows-4">
                {[1,2,3,4,5,6,7,8,9,0].map(n => (
                    <button key={n} disabled={isBotTurn} onClick={() => { triggerHaptic('tap'); if(asyncState==='playing' && !isBotTurn) { setFastError(''); setInput(input+n); } }}
                        className={`h-14 sm:h-16 md:h-full md:min-h-18 rounded-xl bg-slate-800/40 text-2xl sm:text-3xl md:text-4xl font-black text-slate-200 active:scale-95 transition-transform ${n === 0 ? 'col-span-2' : ''}`}>{n}</button>
                ))}
                <button disabled={isBotTurn} onClick={() => handleFastEnter()}
                    className={`h-14 sm:h-16 md:h-full md:min-h-18 rounded-xl ${colBg} text-slate-950 text-[11px] sm:text-xs md:text-xl font-black uppercase active:scale-95 transition-transform`}>Enter</button>
            </div>
            </div>
        )}
      </div>

      {config.gameMode === 'practice' && (practiceStatus === 'won' || practiceStatus === 'lost') && (
        <div role="dialog" aria-modal="true" aria-label={lang === 'hu' ? 'Edzés eredménye' : 'Training result'} className="fixed inset-0 z-[110] bg-[#0b0d11]/95 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-cyan-500/30 bg-[#121821] p-6 sm:p-8 text-center shadow-2xl">
            <TrophyIcon className={`w-14 h-14 mx-auto mb-4 ${practiceStatus === 'won' ? 'text-emerald-400' : 'text-rose-400'}`} />
            <h2 className="text-2xl font-black text-white uppercase mb-2">{practiceStatus === 'won' ? (lang === 'hu' ? 'Edzés kész!' : 'Training complete!') : (lang === 'hu' ? 'Edzés vége' : 'Training over')}</h2>
            <p className="text-sm text-slate-300 mb-6">{practiceName}</p>
            <div className="grid grid-cols-2 gap-3"><button type="button" onClick={handleExit} className="h-12 rounded-xl bg-slate-700 text-white text-xs font-black uppercase">{lang === 'hu' ? 'Vissza' : 'Back'}</button><button type="button" onClick={handleNextLegOrSet} className="h-12 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black uppercase">{lang === 'hu' ? 'Újra' : 'Retry'}</button></div>
          </div>
        </div>
      )}

      {pendingCheckout !== null && (
        <div className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={lang === 'hu' ? 'Kiszálló megerősítése' : 'Confirm checkout'}>
          <div className="w-full max-w-md rounded-3xl border border-emerald-500/40 bg-[#121821] p-5 sm:p-7 shadow-2xl">
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">{lang === 'hu' ? 'Kiszálló megerősítése' : 'Confirm checkout'}</h2>
            <p className="text-slate-300 text-sm mb-5">{lang === 'hu' ? `A ${pendingCheckout} pontos kör hány nyílból sikerült?` : `How many darts did the ${pendingCheckout}-point checkout take?`}</p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {([1, 2, 3] as const).map(count => (
                <button key={count} type="button" onClick={() => setCheckoutDarts(count)} aria-pressed={checkoutDarts === count}
                  className={`h-16 rounded-xl text-xl font-black border ${checkoutDarts === count ? 'bg-emerald-400 text-slate-950 border-emerald-300' : 'bg-slate-800 text-white border-slate-700'}`}>{count}</button>
              ))}
            </div>
            {config.checkout !== 'single' && (
              <button type="button" onClick={() => setCheckoutDoubleConfirmed(value => !value)} aria-pressed={checkoutDoubleConfirmed}
                className={`w-full min-h-14 rounded-xl border px-4 mb-5 text-sm font-bold text-left ${checkoutDoubleConfirmed ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 bg-slate-800 text-slate-200'}`}>
                {checkoutDoubleConfirmed ? '✓ ' : '○ '}{config.checkout === 'master' ? (lang === 'hu' ? 'Az utolsó nyíl dupla, tripla vagy belső bull volt' : 'The final dart was a double, treble or inner bull') : (lang === 'hu' ? 'Az utolsó nyíl dupla vagy belső bull volt' : 'The final dart was a double or inner bull')}
              </button>
            )}
            {!checkoutDartsValid && <p className="text-rose-300 text-sm mb-4">{lang === 'hu' ? 'Ennyi pont nem érhető el a kiválasztott nyílszámmal.' : 'This score is impossible with the selected number of darts.'}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setPendingCheckout(null)} className="flex-1 h-14 rounded-xl bg-slate-700 text-white font-bold">{lang === 'hu' ? 'Mégse' : 'Cancel'}</button>
              <button type="button" disabled={!checkoutDartsValid || (config.checkout !== 'single' && !checkoutDoubleConfirmed)}
                onClick={() => { handleFastEnter(pendingCheckout, checkoutDarts, checkoutDoubleConfirmed); setPendingCheckout(null); }}
                className="flex-1 h-14 rounded-xl bg-emerald-400 text-slate-950 font-black disabled:opacity-40">{lang === 'hu' ? 'Megerősítés' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {(isLegWinner || isSetWinner) && !isMatchWinner && asyncState === 'playing' && (
        <div className="fixed inset-0 z-[100] bg-[#0b0d11]/95 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isSetWinner ? (lang === 'hu' ? 'Szett vége' : 'Set complete') : (lang === 'hu' ? 'Leg vége' : 'Leg complete')}>
          <div className="w-full max-w-md rounded-3xl border border-emerald-500/40 bg-[#121821] p-6 sm:p-8 text-center shadow-2xl">
            <TrophyIcon className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-black text-white mb-2">{isSetWinner ? (lang === 'hu' ? 'Szett vége!' : 'Set complete!') : txt.waitLegTitle}</h2>
            <p className="text-emerald-300 font-bold mb-6">{legWinnerPlayer?.name} {lang === 'hu' ? 'nyerte ezt a leget.' : 'won this leg.'}</p>
            <div className="grid grid-cols-2 gap-3 mb-7">
              {players.map(player => (
                <div key={player.id} className="rounded-xl bg-slate-900 border border-slate-700 p-3">
                  <div className="text-xs text-slate-400 truncate">{player.name}</div>
                  <div className="font-black text-white">S:{player.setsWon} L:{player.legsWon}</div>
                </div>
              ))}
            </div>
            <button type="button" onClick={handleNextLegOrSet} className="w-full h-14 rounded-xl bg-emerald-400 text-slate-950 font-black uppercase">
              {lang === 'hu' ? 'Következő leg' : 'Next leg'}
            </button>
          </div>
        </div>
      )}
      
      {isMatchWinner && config.gameMode !== 'practice' && asyncState === 'playing' && (
        <div className="fixed inset-0 z-[100] bg-[#0b0d11]/95 flex flex-col items-center pt-12 px-4 pb-24 overflow-y-auto">
            <div className="fixed inset-0 z-0 opacity-[0.08] pointer-events-none scale-150 transform rotate-[-15deg] flex items-center justify-center">
                <HeatmapBoard data={normalizeHeatmapData(fullHeatmapData)} lang={lang} />
            </div>
            
            <TrophyIcon className="h-24 w-24 text-[#b655ff] mb-3 mt-4 drop-shadow-[0_0_20px_rgba(182,85,255,0.5)] shrink-0 z-10" />
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-2 uppercase italic tracking-tighter leading-none z-10 text-center">
                {config.gameMode === 'career' && matchWinnerPlayer?.id === 0 ? txt.careerWon : txt.matchShot}
            </h2>
            <p className={`${winnerColorTheme.split(' ')[0]} text-lg sm:text-xl mb-6 font-black uppercase tracking-widest z-10 text-center`}>
                {matchWinnerPlayer?.name} {txt.winsMatch}
            </p>

            <div className={`w-full max-w-2xl grid grid-cols-2 ${config.tournamentId || config.gameMode === 'career' ? 'sm:grid-cols-2' : onRematch && !isAsync ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2 sm:gap-3 mb-6 shrink-0 z-10`}>
                <button onClick={handleExit} className="min-h-12 rounded-xl bg-slate-800 text-white text-xs sm:text-sm font-black uppercase hover:bg-slate-700">{txt.back}</button>
                {isAsync && role === 'host' && fbSyncData?.state?.winner && <button onClick={handleDeleteCompletedRoom} className="min-h-12 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/40 text-xs sm:text-sm font-black uppercase hover:bg-rose-500/25">{lang === 'hu' ? 'Szoba törlése' : 'Delete room'}</button>}
                {config.tournamentId || config.gameMode === 'career' ? (
                    <button onClick={() => onMatchComplete ? onMatchComplete(players) : handleExit()} className="min-h-12 rounded-xl bg-[#b655ff] text-white text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2">{lang === 'hu' ? 'Következő' : 'Next'} <ForwardIcon className="h-4 w-4" /></button>
                ) : (
                    <>
                        {onRematch && !isAsync && <button onClick={onRematch} className="min-h-12 rounded-xl bg-emerald-500 text-slate-950 text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2"><ArrowPathIcon className="h-4 w-4" /> {lang === 'hu' ? 'Újrajátszás' : 'Rematch'}</button>}
                        <button onClick={handleShareMatch} className={`min-h-12 rounded-xl ${winnerColorTheme.split(' ')[3]} text-slate-950 text-xs sm:text-sm font-black uppercase flex items-center justify-center gap-2`}><ShareIcon className="h-4 w-4" /> {lang === 'hu' ? 'Megosztás' : 'Share'}</button>
                        <button onClick={handleCSVExport} className="min-h-12 rounded-xl bg-slate-700 text-white text-xs sm:text-sm font-black uppercase">CSV export</button>
                    </>
                )}
            </div>
            
            <div className="w-full max-w-2xl bg-[#12141a]/90 backdrop-blur-lg rounded-[2.5rem] border border-slate-800 p-4 sm:p-8 mb-10 shrink-0 flex flex-col gap-8 z-10 shadow-2xl">
              <div className="flex-1 flex flex-col gap-6">
                 {players.map(pl => (
                   <div key={pl.id} className={`p-4 sm:p-6 rounded-2xl border ${pl.id === activePlayer ? 'bg-slate-800/80 border-slate-600 shadow-md' : 'bg-slate-900/40 border-slate-800/50'}`}>
                     <div className="flex justify-between items-start sm:items-center mb-6 gap-2">
                        <div className="flex flex-col text-left overflow-hidden">
                            <span className={`text-lg sm:text-xl font-black uppercase truncate ${pl.id === activePlayer ? colTxt : 'text-slate-300'}`}>
                                {pl.teamId !== undefined && <span className="text-[10px] bg-slate-700 text-white px-2 py-1 rounded-md mr-2 align-middle">T{pl.teamId + 1}</span>}
                                {pl.name}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{lang === 'hu' ? 'Első 9 nyíl' : 'First 9 darts'}: {pl.first9Darts ? ((pl.first9Points / pl.first9Darts) * 3).toFixed(1) : '—'}</span>
                        </div>
                        <div className="text-right shrink-0">
                           <span className="text-4xl sm:text-5xl font-mono font-black text-white leading-none">{pl.totalDarts ? ((pl.totalPoints / pl.totalDarts) * 3).toFixed(1) : '—'}</span>
                           <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-500 ml-1 sm:ml-2">AVG</span>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 text-center">
                         <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                             <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase mb-1">{lang === 'hu' ? 'Kiszálló %' : 'Checkout %'}</span>
                             <span className="text-lg sm:text-xl font-mono font-black text-white">{pl.checkoutAttempts > 0 ? Math.round((pl.checkoutSuccess / pl.checkoutAttempts) * 100) : 0}%</span>
                         </div>
                         <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                             <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase mb-1">{lang === 'hu' ? 'Max kiszálló' : 'Highest checkout'}</span>
                             <span className="text-lg sm:text-xl font-mono font-black text-cyan-400">{pl.highestCheckout > 0 ? pl.highestCheckout : '-'}</span>
                         </div>
                         <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                             <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase mb-1">{lang === 'hu' ? 'Legjobb leg' : 'Best leg'}</span>
                             <span className="text-lg sm:text-xl font-mono font-black text-cyan-400">{(pl.bestLegDarts || 0) > 0 ? `${pl.bestLegDarts} ${lang === 'hu' ? 'nyíl' : pl.bestLegDarts === 1 ? 'dart' : 'darts'}` : '-'}</span>
                         </div>
                         <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-2">
                             <span className="text-lg sm:text-xl font-mono font-black text-rose-500">{pl.count180}</span>
                             <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase">x 180</span>
                         </div>
                     </div>
                     <StaminaChart averages={pl.legAverages} color={pl.color} lang={lang} />
                   </div>
                 ))}
              </div>

              <div className="p-4 sm:p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-start gap-3 sm:gap-4">
                  <ComputerDesktopIcon className="h-8 w-8 sm:h-10 sm:w-10 text-indigo-400 shrink-0 mt-1"/>
                  <div className="flex flex-col">
                      <p className="text-[10px] sm:text-xs font-black text-indigo-300 uppercase tracking-[0.2em] mb-1 sm:mb-2">{lang === 'hu' ? 'Meccsértékelés' : 'Match review'}</p>
                        <p className="text-xs sm:text-sm text-indigo-100 font-bold italic leading-relaxed">&ldquo;{generateAiFeedback(players[0])}&rdquo;</p>
                  </div>
              </div>
              
              <div className="w-full flex flex-col items-center justify-center border border-slate-800 rounded-3xl p-4 sm:p-6 bg-slate-950/50">
                  <h3 className="text-xs font-black text-cyan-300 uppercase tracking-widest mb-4 text-center">{lang === 'hu' ? 'Személyes találati térkép' : 'Personal hit map'}</h3>
                  <div className="w-full max-w-[360px]"><HeatmapBoard data={normalizeHeatmapData(fullHeatmapData)} lang={lang} /></div>
                  <div className="mt-4"><HeatmapLegend lang={lang} /></div>
                  {recordedSectorHits === 0 && <p role="status" className="text-xs text-cyan-200 text-center mt-3 max-w-sm">{lang === 'hu' ? 'Ehhez a meccshez nincs szektoronként rögzített találat. A Fast bevitel csak az összpontszámot menti; a találati térképhez válaszd a Pro vagy a Tábla módot.' : 'No sector hits were recorded for this match. Fast input saves only the total score; use Pro or Board input to build a hit map.'}</p>}
                  <p className="text-xs text-slate-400 text-center mt-3">{lang === 'hu' ? 'A színek a rögzített találatok számát mutatják, nem a célzási pontosságot.' : 'Colors show recorded hit counts, not aiming accuracy.'}</p>
              </div>
            </div>

        </div>
      )}

      {/* ── Tutorial overlay (shown once per mode) ───────────────────────── */}
      {showTutorial && tutKey && (
          <TutorialOverlay tutorialKey={tutKey} lang={lang} onClose={() => setShowTutorial(false)} />
      )}

      {/* ── TV Mode fullscreen dartboard overlay ─────────────────────────── */}
      {tvMode && (
        <div className="fixed inset-0 z-[300] bg-[#050508] flex flex-col select-none">
          {/* Close */}
          <button onClick={() => setTvMode(false)}
              aria-label={lang === 'hu' ? 'TV nézet bezárása' : 'Close TV view'} className="absolute top-[calc(1rem+var(--app-safe-top))] right-4 z-10 p-2.5 bg-slate-800 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors">
              <XMarkIcon className="h-6 w-6 text-white" />
          </button>

          {/* Score header */}
          <div className="flex items-stretch border-b border-slate-800 shrink-0">
              {players.map((pl) => {
                  const isAct = pl.id === activePlayer;
                  const pCol = COLOR_STYLES[pl.color]?.split(' ')[0] || 'text-emerald-400';
                  return (
                      <div key={pl.id} className={`flex-1 py-4 text-center transition-all ${isAct ? 'opacity-100 bg-slate-900/60' : 'opacity-30'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${pCol}`}>{pl.name}</p>
                          <p className="text-6xl sm:text-8xl font-black text-white font-mono leading-none mt-1">{displayedRemaining(pl, activePlayer, currentDarts, config)}</p>
                          <p className="text-[10px] text-slate-500 font-bold mt-1">S:{pl.setsWon} L:{pl.legsWon}</p>
                          <div className="flex justify-center gap-2 mt-2">
                              {[0,1,2].map(di => {
                                  const d = isAct ? currentDarts[di] : null;
                                  return (
                                      <span key={di} className={`h-7 w-12 rounded-lg border font-mono text-xs font-black flex items-center justify-center ${d ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-900 border-slate-800 text-slate-700'}`}>
                                          {d ? `${d.mult>1?(d.mult===3?'T':'D'):''}${d.val===0?'M':d.val===25?'B':d.val}` : '—'}
                                      </span>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
          </div>

          {/* Dartboard with live dart markers */}
          <div className="flex-1 flex items-center justify-center p-4">
              <svg viewBox="0 0 300 300" className="h-full w-full" style={{ maxHeight: '70vmin', maxWidth: '70vmin' }}>
                  <circle cx="150" cy="150" r="149" fill="#050508" />
                  <circle cx="150" cy="150" r="148" fill="#0b0d11" />
                  {DARTBOARD_ORDER.map((num, i) => {
                      const sa = i * 18 - 9, ea = sa + 18;
                      const isEven = i % 2 === 0;
                      const segBase = isEven ? '#1a1a1a' : '#d4d4d4';
                      const tp = polarToCartesian(150, 150, 142, sa + 9);
                      return (
                          <g key={num}>
                              <path d={describeArc(150,150,15,80,sa,ea)}   fill={segBase}                            stroke="#050508" strokeWidth="0.5" />
                              <path d={describeArc(150,150,80,90,sa,ea)}   fill={isEven ? '#e11d48' : '#10b981'}    stroke="#050508" strokeWidth="0.5" />
                              <path d={describeArc(150,150,90,125,sa,ea)}  fill={segBase}                            stroke="#050508" strokeWidth="0.5" />
                              <path d={describeArc(150,150,125,135,sa,ea)} fill={isEven ? '#e11d48' : '#10b981'}    stroke="#050508" strokeWidth="0.5" />
                              <text x={tp.x} y={tp.y} fill="#64748b" fontSize="10" fontWeight="900"
                                  textAnchor="middle" alignmentBaseline="middle"
                                  transform={`rotate(${sa+9+90} ${tp.x} ${tp.y})`}>{num}</text>
                          </g>
                      );
                  })}
                  <circle cx="150" cy="150" r="15"   fill="#10b981" stroke="#050508" strokeWidth="0.5" />
                  <circle cx="150" cy="150" r="6.35" fill="#e11d48" stroke="#050508" strokeWidth="0.5" />

                  {/* Dart markers for current turn */}
                  {currentDarts.map((d, di) => {
                      const pos = tvDartCoord(d.val, d.mult, di);
                      const pCol = safePlayer?.color === 'rose' ? '#fb7185' : safePlayer?.color === 'cyan' ? '#22d3ee' : safePlayer?.color === 'amber' ? '#fbbf24' : safePlayer?.color === 'purple' ? '#b655ff' : '#34d399';
                      return (
                          <g key={di}>
                              {/* Shadow */}
                              <circle cx={pos.x+1} cy={pos.y+1} r="7" fill="black" opacity="0.5" />
                              {/* Dart body */}
                              <circle cx={pos.x} cy={pos.y} r="7" fill={pCol} stroke="white" strokeWidth="1.5" opacity="0.95" />
                              {/* Index */}
                              <text x={pos.x} y={pos.y+0.5} fill="black" fontSize="8" fontWeight="900"
                                  textAnchor="middle" alignmentBaseline="middle">{di + 1}</text>
                          </g>
                      );
                  })}

                  {/* Subtle crosshair for aiming reference */}
                  {currentDarts.length === 0 && (
                      <g opacity="0.15">
                          <line x1="140" y1="150" x2="160" y2="150" stroke="#64748b" strokeWidth="1" />
                          <line x1="150" y1="140" x2="150" y2="160" stroke="#64748b" strokeWidth="1" />
                      </g>
                  )}
              </svg>
          </div>

          {/* Bottom label */}
          <div className="text-center pb-3 shrink-0">
              <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">
                  {currentDarts.length === 0 ? (lang === 'hu' ? 'Várakozás a dobásra…' : 'Waiting for a dart…') : lang === 'hu' ? `${currentDarts.length}/3 nyíl bedobva` : `${currentDarts.length}/3 darts thrown`}
              </p>
          </div>
        </div>
      )}
    </div>
  );
}
