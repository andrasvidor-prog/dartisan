'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
    BackspaceIcon, TrophyIcon, ChartBarIcon, BoltIcon, XMarkIcon, 
    ComputerDesktopIcon, InformationCircleIcon, CheckCircleIcon, 
    ClockIcon, ArrowPathIcon 
} from '@heroicons/react/24/outline';
import type { MatchConfig } from './SetupScreen';
import type { Language } from '@/app/page';

import { db, auth } from '../firebase';
import { doc, updateDoc, onSnapshot, increment, setDoc, getDoc, collection } from 'firebase/firestore';

export type Dart = { val: number; mult: number };

export type PlayerData = { 
    id: number; 
    name: string; 
    isBot: boolean; 
    difficulty: number; 
    color: string; 
    score: number; 
    setsWon: number; 
    legsWon: number; 
    totalPoints: number; 
    totalDarts: number; 
    currentLegDarts: number; 
    lastVisit: number | null; 
    history: { score: number; dartsCount: number; points: number; roundDarts: Dart[] }[]; 
    count100: number; 
    count140: number; 
    count180: number; 
    highestCheckout: number; 
    bestLegDarts: number | null; 
    checkoutAttempts: number; 
    checkoutSuccess: number; 
    first9Points: number; 
    first9Darts: number; 
};

// --- DARTBOARD HEATMAP LOGIKA (SVG GENERÁTOR) ---
const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) => {
  const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
  const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const startInner = polarToCartesian(x, y, innerRadius, endAngle);
  const endInner = polarToCartesian(x, y, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  return [
    "M", startOuter.x, startOuter.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
    "L", endInner.x, endInner.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y,
    "Z"
  ].join(" ");
};

const DartboardHeatmap = ({ heatmapData }: { heatmapData: Record<string, { hits: number, throws: number }> }) => {
    const size = 300;
    const center = size / 2;
    const sliceAngle = 360 / 20;

    let maxHits = 1;
    Object.values(heatmapData).forEach(data => {
        if (data.hits > maxHits) maxHits = data.hits;
    });

    const getHeatColor = (target: string, isBlackOrGreen: boolean, isDoubleOrTreble: boolean) => {
        const hits = heatmapData[target]?.hits || 0;
        
        // Ha NINCS adat, megtartjuk az eredeti tábla színeit
        if (hits === 0) {
            let baseColor = isBlackOrGreen 
                ? (isDoubleOrTreble ? '#10b981' : '#12141a') 
                : (isDoubleOrTreble ? '#e11d48' : '#f8fafc'); 
            if (target === '25') return '#10b981'; 
            if (target === '50') return '#e11d48';
            return baseColor;
        }

        // Ha VAN adat, Tudományos Hőtérkép skálát használunk: Kék -> Zöld -> Sárga -> Piros
        const heatRatio = hits / maxHits; // 0.0 - 1.0
        const hue = (1 - heatRatio) * 240; // 240 (Kék) - 0 (Piros)
        return `hsl(${hue}, 100%, 50%)`;
    };

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="drop-shadow-2xl">
            <circle cx={center} cy={center} r={140} fill="#0b0d11" />
            
            {DARTBOARD_ORDER.map((num, i) => {
                const startAngle = i * sliceAngle - (sliceAngle / 2);
                const endAngle = startAngle + sliceAngle;
                const isEven = i % 2 === 0;

                return (
                    <g key={num}>
                        <path d={describeArc(center, center, 15, 80, startAngle, endAngle)} fill={getHeatColor(`S${num}`, isEven, false)} stroke="#1e293b" strokeWidth="1" />
                        <path d={describeArc(center, center, 80, 90, startAngle, endAngle)} fill={getHeatColor(`T${num}`, isEven, true)} stroke="#1e293b" strokeWidth="1" />
                        <path d={describeArc(center, center, 90, 125, startAngle, endAngle)} fill={getHeatColor(`S${num}`, isEven, false)} stroke="#1e293b" strokeWidth="1" />
                        <path d={describeArc(center, center, 125, 135, startAngle, endAngle)} fill={getHeatColor(`D${num}`, isEven, true)} stroke="#1e293b" strokeWidth="1" />
                        
                        <text x={polarToCartesian(center, center, 145, startAngle + (sliceAngle / 2)).x} y={polarToCartesian(center, center, 145, startAngle + (sliceAngle / 2)).y} fill="#94a3b8" fontSize="10" fontWeight="900" textAnchor="middle" alignmentBaseline="middle" transform={`rotate(${startAngle + (sliceAngle / 2)} ${polarToCartesian(center, center, 145, startAngle + (sliceAngle / 2)).x} ${polarToCartesian(center, center, 145, startAngle + (sliceAngle / 2)).y})`}>
                            {num}
                        </text>
                    </g>
                );
            })}
            
            <circle cx={center} cy={center} r={15} fill={getHeatColor('25', true, false)} stroke="#1e293b" strokeWidth="1" />
            <circle cx={center} cy={center} r={6.35} fill={getHeatColor('50', false, true)} stroke="#1e293b" strokeWidth="1" />
        </svg>
    );
};

// --- FORDÍTÁSOK ---
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
    hunterRules3: "This builds your AI Heatmap for smart checkout suggestions!",
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
    c121Rules2: "121-ről indulsz. Ha 9 nyílból kiszállsz, a következő körben 122 jön.",
    c121Rules3: "Ha elfogy a 9 nyíl és nem szálltál ki, a játéknak vége.",
    c121Rules4: "A kiszálló dupla! Ha besokallsz, a pontod visszaáll a kör elejére, de a nyilaid fogynak.",
    careerRule1: "Egy Világbajnoki ágrajz-mérkőzést játszol egy Mesterséges Intelligencia ellen.",
    careerRule2: "Nyerd meg a megadott számú leget az ellenfél kiejtéséhez és a továbbjutáshoz.",
    careerRule3: "Ha kikapsz, bármikor újrapróbálhatod ezt a szintet.", newRecord: "Új Rekord!",
    dartsLeft: "Hátralévő Nyíl", hunterRules1: "Az AI ad egy célpontot (pl. D16, T20).",
    hunterRules2: "Dobj rá 3 nyíllal, és rögzítsd, hányszor találtad el.",
    hunterRules3: "Ebből az AI felépíti a személyes Hőtérképedet, ami alapján később okos kiszállókat javasol!",
    mathRules1: "Nincs szükség táblára! Fejben kell számolnod.",
    mathRules2: "Kapsz egy szituációt (pl. 82-ről dobsz egy T14-et).",
    mathRules3: "Írd be a maradék pontot! 10 kérdést kapsz, légy gyors és pontos."
  }
};

const OUTSHOTS: Record<number, string> = { 170:"T20 T20 BULL", 167:"T20 T19 BULL", 164:"T20 T18 BULL", 161:"T20 T17 BULL", 160:"T20 T20 D20", 158:"T20 T20 D19", 157:"T20 T19 D20", 156:"T20 T20 D18", 155:"T20 T19 D19", 154:"T20 T18 D20", 153:"T20 T19 D18", 152:"T20 T20 D16", 151:"T20 T17 D20", 150:"T20 T18 D18", 149:"T20 T19 D16", 148:"T20 T16 D20", 147:"T20 T17 D18", 146:"T20 T18 D16", 145:"T20 T15 D20", 144:"T20 T20 D12", 143:"T20 T17 D16", 142:"T20 T14 D20", 141:"T20 T15 D18", 140:"T20 T20 D10", 139:"T20 T13 D20", 138:"T20 T18 D12", 137:"T20 T17 D13", 136:"T20 T20 D8", 135:"T20 T13 D18", 134:"T20 T14 D16", 133:"T20 T19 D8", 132:"T20 T16 D12", 131:"T20 T13 D16", 130:"T20 20 BULL", 129:"T19 T16 D12", 128:"T18 T14 D16", 127:"T20 T17 D8", 126:"T19 19 BULL", 125:"25 T20 D20", 124:"T20 T16 D8", 123:"T19 T16 D9", 122:"T18 18 BULL", 121:"T20 T11 D14", 120:"T20 20 D20", 119:"T19 T10 D16", 118:"T20 18 D20", 117:"T20 17 D20", 116:"T20 16 D20", 115:"T20 15 D20", 114:"T20 14 D20", 113:"T20 13 D20", 112:"T20 12 D20", 111:"T20 11 D20", 110:"T20 10 D20", 109:"T20 9 D20", 108:"T20 16 D16", 107:"T19 10 D20", 106:"T20 10 D18", 105:"T19 16 D16", 104:"T18 10 D20", 103:"T19 10 D18", 102:"T20 10 D16", 101:"T17 10 D20", 100:"T20 D20", 99:"T19 10 D16", 98:"T20 D19", 97:"T19 D20", 96:"T20 D18", 95:"T19 D19", 94:"T18 D20", 93:"T19 D18", 92:"T20 D16", 91:"T17 D20", 90:"T20 D15", 89:"T19 D16", 88:"T16 D20", 87:"T17 D18", 86:"T18 D16", 85:"T15 D20", 84:"T20 D12", 83:"T17 D16", 82:"T14 D20", 81:"T15 D18", 80:"T20 D10", 79:"T13 D20", 78:"T18 D12", 77:"T15 D16", 76:"T20 D8", 75:"T17 D12", 74:"T14 D16", 73:"T19 D8", 72:"T16 D12", 71:"T13 D16", 70:"T18 D8", 69:"T15 D12", 68:"T20 D4", 67:"T17 D8", 66:"T10 D18", 65:"T11 D16", 64:"T16 D8", 63:"T13 D12", 62:"T10 D16", 61:"T15 D8" };

const COLOR_STYLES: Record<string, string> = { 
    emerald: 'text-emerald-400 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)] bg-emerald-500', 
    rose: 'text-rose-400 border-rose-500 shadow-[0_0_30px_rgba(225,29,72,0.15)] bg-rose-500', 
    cyan: 'text-cyan-400 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.15)] bg-cyan-500', 
    amber: 'text-amber-400 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)] bg-amber-500', 
    purple: 'text-[#b655ff] border-[#b655ff] shadow-[0_0_30px_rgba(182,85,255,0.15)] bg-[#b655ff]' 
};

const HUNTER_TARGETS = ['D20', 'D16', 'D10', 'D8', 'D12', 'T20', 'T19', 'T18', 'BULL'];

interface MatchScreenProps { 
    config: MatchConfig; 
    onBackToSetup: () => void; 
    lang: Language; 
}

export function MatchScreen({ config, onBackToSetup, lang }: MatchScreenProps) {
  const txt = t[lang];
  
  const isAsync = config.gameMode === 'challenge' && !!config.challengeCode;
  const role = config.localRole || 'host'; 
  const oppRole = role === 'host' ? 'guest' : 'host';
  
  const [asyncState, setAsyncState] = useState<'playing' | 'waiting_leg' | 'waiting_match'>('playing');
  const [fbSyncData, setFbSyncData] = useState<any>(null);
  
  const [players, setPlayers] = useState<PlayerData[]>(() => {
    if (config.resumeState) {
        return config.resumeState.players.map((p: any) => ({ ...p, color: p.color || 'emerald' }));
    }
    return config.players.map((p, i) => ({ 
        id: i, name: p.name, isBot: p.isBot, difficulty: p.difficulty, color: p.color || 'emerald', 
        score: config.startingScore, setsWon: 0, legsWon: 0, totalPoints: 0, totalDarts: 0, 
        currentLegDarts: 0, lastVisit: null, history: [], count100: 0, count140: 0, count180: 0, 
        highestCheckout: 0, bestLegDarts: null, checkoutAttempts: 0, checkoutSuccess: 0, 
        first9Points: 0, first9Darts: 0 
    }));
  });
  
  const [activePlayer, setActivePlayer] = useState<number>(config.resumeState ? config.resumeState.activePlayer : 0);
  const [isLegWinner, setIsLegWinner] = useState(config.resumeState ? config.resumeState.isLegWinner : false);
  const [isSetWinner, setIsSetWinner] = useState(config.resumeState ? config.resumeState.isSetWinner : false);
  const [isMatchWinner, setIsMatchWinner] = useState(config.resumeState ? config.resumeState.isMatchWinner : false);
  
  const [celebration, setCelebration] = useState<{type: '180' | 'checkout', main: string, sub: string, color: string} | null>(null);
  
  const [inputMode, setInputMode] = useState<'detailed' | 'fast'>(config.gameMode === 'career' ? 'detailed' : 'fast');
  const [input, setInput] = useState('');
  const [currentDarts, setCurrentDarts] = useState<Dart[]>(config.resumeState ? config.resumeState.currentDarts || [] : []);
  const [activeMult, setActiveMult] = useState<1 | 2 | 3>(1);
  
  const [quickButtons, setQuickButtons] = useState<number[]>(() => {
    if (typeof window !== 'undefined') { 
        const savedBtns = localStorage.getItem('dartisan_quick_buttons'); 
        if (savedBtns) return JSON.parse(savedBtns); 
    }
    return [26, 41, 60];
  });

  // GYAKORLÓ ÁLLAPOTOK
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
  const [mathQuestion, setMathQuestion] = useState<{ start: number, dartText: string, ans: number }>({ start: 0, dartText: '', ans: 0 });
  const [mathInput, setMathInput] = useState('');

  const [showRulesOverlay, setShowRulesOverlay] = useState<boolean>(['practice', 'career'].includes(config.gameMode) && !config.resumeState);

  // --- AI ÉS HŐTÉRKÉP ADATOK ---
  const [favoriteDouble, setFavoriteDouble] = useState<string | null>(null);
  const [fullHeatmapData, setFullHeatmapData] = useState<Record<string, {hits: number, throws: number}>>({});

  useEffect(() => {
      const fetchHeatmap = async () => {
          const user = auth.currentUser;
          if (!user) return;
          try {
              const docSnap = await getDoc(doc(db, 'users', user.uid, 'stats', 'heatmap'));
              if (docSnap.exists()) {
                  const data = docSnap.data() as Record<string, {hits: number, throws: number}>;
                  setFullHeatmapData(data);
                  
                  let bestHitRate = -1;
                  let bestTarget = null;
                  
                  for (const [target, stats] of Object.entries(data)) {
                      if (target.startsWith('D') && stats.throws >= 9) {
                          const rate = stats.hits / stats.throws;
                          if (rate > bestHitRate) { 
                              bestHitRate = rate; 
                              bestTarget = target; 
                          }
                      }
                  }
                  if (bestTarget) setFavoriteDouble(bestTarget);
              }
          } catch (e) { console.error("Hiba a hőtérkép betöltésekor:", e); }
      };
      fetchHeatmap();
  }, []);

  // --- AI ÉRTÉKELÉS (COACH) MECCS VÉGÉN ---
  const generateAiFeedback = (player: PlayerData) => {
      const avg = ((player.totalPoints / (player.totalDarts || 1)) * 3).toFixed(1);
      const first9Avg = ((player.first9Points / (player.first9Darts || 1)) * 3).toFixed(1);
      const checkoutPct = player.checkoutAttempts > 0 ? Math.round((player.checkoutSuccess / player.checkoutAttempts) * 100) : 0;
      
      let text = '';
      if (parseFloat(avg) > 60) {
          text += `Kiváló tömegdobás (${avg} átlag). `;
      } else if (parseFloat(avg) < 40) {
          text += `A tömegeken van még mit csiszolni (${avg} átlag). `;
      } else {
          text += `Stabil, átlagos tömegdobás. `;
      }

      if (parseFloat(first9Avg) > parseFloat(avg) + 10) {
          text += `Erősen kezded a leget (Első 9: ${first9Avg}), de a végére elfáradsz. `;
      }

      if (checkoutPct >= 30) {
          text += `A kiszállóid halálosak voltak (${checkoutPct}%). Profi munka!`;
      } else if (checkoutPct > 0 && checkoutPct < 15) {
          text += `A kiszállókon viszont rengeteget remegtél (${checkoutPct}%). Érdemes lenne Bob's 27-et játszanod!`;
      }

      return text || 'Még nincs elég adat az értékeléshez.';
  };

  const generateMathQuestion = useCallback(() => {
      const isTreble = Math.random() > 0.3;
      const start = Math.floor(Math.random() * 80) + 40; 
      const dartVal = Math.floor(Math.random() * 20) + 1;
      const mult = isTreble ? 3 : (Math.random() > 0.5 ? 2 : 1);
      const dartText = (mult === 3 ? 'T' : mult === 2 ? 'D' : 'S') + dartVal;
      const ans = start - (dartVal * mult);
      setMathQuestion({ start, dartText, ans });
  }, []);

  useEffect(() => {
      if (config.gameMode === 'practice' && config.practiceType === 'math' && !showRulesOverlay && mathRound === 1 && mathScore === 0) {
          generateMathQuestion();
      }
  }, [config, showRulesOverlay, mathRound, mathScore, generateMathQuestion]);

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

  useEffect(() => {
    if (!isAsync) {
        if (isMatchWinner || config.gameMode === 'practice') {
            localStorage.removeItem('dartisan_save');
        } else {
            localStorage.setItem('dartisan_save', JSON.stringify({ players, activePlayer, isLegWinner, isSetWinner, isMatchWinner, config, currentDarts }));
        }
    }
  }, [players, activePlayer, isLegWinner, isSetWinner, isMatchWinner, currentDarts, config, isAsync]);

  // --- TELJES STATISZTIKA MENTÉSE A FIREBASE-BE (PROFILHOZ) ---
  useEffect(() => {
      if (isMatchWinner && config.gameMode !== 'practice') {
          const user = auth.currentUser;
          if (user) {
              const p = players[0]; // A helyi játékos
              const isWin = p.setsWon >= config.setsToWin;

              // 1. Frissítjük a kumulatív adatait (XP, Összes Darts, stb.)
              const userRef = doc(db, "users", user.uid);
              updateDoc(userRef, { 
                  xp: increment(isWin ? (config.gameMode === 'career' ? 100 : 50) : 10), 
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
                  first9Darts: increment(p.first9Darts)
              }).catch(err => console.error("Hiba az alap stats mentésnél:", err));

              // 2. Létrehozunk egy Részletes Meccs Történetet (Ebből építjük majd a Profil grafikonokat!)
              const matchRef = doc(collection(db, 'users', user.uid, 'matchHistory'));
              setDoc(matchRef, {
                  date: new Date().toISOString(),
                  mode: config.gameMode,
                  opponent: players[1]?.name || 'Unknown',
                  won: isWin,
                  stats: {
                      average: ((p.totalPoints / (p.totalDarts || 1)) * 3),
                      first9Average: ((p.first9Points / (p.first9Darts || 1)) * 3),
                      checkoutPct: p.checkoutAttempts > 0 ? (p.checkoutSuccess / p.checkoutAttempts) : 0,
                      highestCheckout: p.highestCheckout,
                      count100: p.count100,
                      count140: p.count140,
                      count180: p.count180,
                      bestLegDarts: p.bestLegDarts
                  }
              }).catch(err => console.error("Hiba a részletes match history mentésnél:", err));
          }
      }
  }, [isMatchWinner, config, players]);

  useEffect(() => {
      if (!isAsync || !config.challengeCode) return;
      const unsubscribe = onSnapshot(doc(db, "matches", config.challengeCode), (docSnap: any) => {
          if (docSnap.exists()) {
              const data = docSnap.data(); 
              setFbSyncData(data);
              setPlayers(prev => { 
                  const np = [...prev]; 
                  if (np[1]) { 
                      np[1].legsWon = data.state[`${oppRole}LegsWon`] || 0; 
                      np[1].setsWon = data.state[`${oppRole}SetsWon`] || 0; 
                  } 
                  return np; 
              });
              
              if (asyncState === 'waiting_leg' && data.state[`${role}Darts`] !== null && data.state[`${oppRole}Darts`] !== null) {
                  evaluateAsyncLeg(data);
              }
          }
      });
      return () => unsubscribe();
  }, [isAsync, config.challengeCode, asyncState, role, oppRole]);

  const evaluateAsyncLeg = async (data: any) => {
      const myDarts = data.state[`${role}Darts`]; 
      const oppDarts = data.state[`${oppRole}Darts`];
      let winnerIdx = 0; 
      if (oppDarts < myDarts) winnerIdx = 1; 
      else if (oppDarts === myDarts) winnerIdx = role === 'host' ? 0 : 1; 

      setPlayers(prev => {
          const np = prev.map(pl => ({ ...pl })); 
          np[winnerIdx].legsWon += 1;
          
          if (np[winnerIdx].legsWon >= config.legsToWin) { 
              np[winnerIdx].legsWon = 0; 
              np[winnerIdx].setsWon += 1; 
              if (np[winnerIdx].setsWon >= config.setsToWin) { 
                  setIsMatchWinner(true); 
                  setAsyncState('playing'); 
              } else { 
                  setIsSetWinner(true); 
                  setAsyncState('playing'); 
              } 
          } else { 
              setIsLegWinner(true); 
              setAsyncState('playing'); 
          }
          return np;
      });

      if (role === 'host') {
          const newHostLegs = winnerIdx === 0 ? (data.state.hostLegsWon || 0) + 1 : (data.state.hostLegsWon || 0);
          const newGuestLegs = winnerIdx === 1 ? (data.state.guestLegsWon || 0) + 1 : (data.state.guestLegsWon || 0);
          await updateDoc(doc(db, "matches", config.challengeCode!), { 
              [`state.hostDarts`]: null, 
              [`state.guestDarts`]: null, 
              [`state.hostLegsWon`]: newHostLegs, 
              [`state.guestLegsWon`]: newGuestLegs, 
              [`state.currentLeg`]: data.state.currentLeg + 1 
          });
      }
  };

  const finishAsyncLeg = async (totalDartsUsed: number) => {
      setAsyncState('waiting_leg');
      try { 
          await updateDoc(doc(db, "matches", config.challengeCode!), { 
              [`state.${role}Darts`]: totalDartsUsed 
          }); 
      } catch (error) { 
          console.error("Hiba a leg feltöltésekor:", error); 
      }
  };

  const announceScore = useCallback((scoreStr: string, is180: boolean = false, isBust: boolean = false) => {
    if (config.muteCaller || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); 
    const u = new SpeechSynthesisUtterance(); 
    u.lang = lang === 'hu' ? 'hu-HU' : 'en-GB';
    
    if (isBust) u.text = scoreStr ? `${scoreStr}, ${txt.bust}` : txt.bust; 
    else if (is180) { u.text = txt.e180; u.pitch = 1.1; } 
    else u.text = scoreStr;
    
    window.speechSynthesis.speak(u);
  }, [lang, txt, config.muteCaller]);

  const triggerCelebration = useCallback((type: '180' | 'checkout', main: string, sub: string, color: string) => { 
      setCelebration({ type, main, sub, color }); 
      setTimeout(() => setCelebration(null), 2500); 
  }, []);

  const getCheckoutTable = (s: number, dartsLeft: number): { text: string, isSmart: boolean } | null => {
    if (config.gameMode === 'practice' && config.practiceType !== '121') return null;
    if (config.checkout === 'single') {
        return { text: s <= 20 ? `${s}` : (s <= 40 && s % 2 === 0 ? `D${s/2}` : (s <= 60 && s % 3 === 0 ? `T${s/3}` : "In play...")), isSmart: false };
    }
    if (s > dartsLeft * 60 || s < 2) return null;

    if (favoriteDouble && dartsLeft >= 2) {
        const favValues: Record<string, number> = { 'D20': 40, 'D16': 32, 'D10': 20, 'D8': 16, 'D12': 24 };
        const favDoubleVal = favValues[favoriteDouble];
        
        if (favDoubleVal && s > favDoubleVal) {
            const setup = s - favDoubleVal; 
            
            if (setup <= 20) return { text: `${setup} ${favoriteDouble}`, isSmart: true };
            if (setup === 25) return { text: `25 ${favoriteDouble}`, isSmart: true };
            if (setup === 50) return { text: `BULL ${favoriteDouble}`, isSmart: true };
            if (setup % 3 === 0 && setup <= 60 && setup >= 9) return { text: `T${setup/3} ${favoriteDouble}`, isSmart: true };
        }
    }

    if (OUTSHOTS[s]) return { text: OUTSHOTS[s], isSmart: false };
    if (s === 50) return { text: "BULL", isSmart: false }; 
    if (s <= 40 && s % 2 === 0) return { text: `D${s / 2}`, isSmart: false };
    
    if (s < 40) { 
        let d = 16; 
        if (s < 33) d = 8; 
        if (s < 17) d = 4; 
        if (s < 9) d = 2; 
        if (s < 5) d = 1; 
        const r = s - (d * 2); 
        if (r > 0 && r <= 20) return { text: `${r} D${d}`, isSmart: false }; 
    }
    
    if (s <= 60) { 
        if (s - 40 <= 20 && s - 40 > 0) return { text: `${s - 40} D20`, isSmart: false }; 
        if (s - 32 <= 20 && s - 32 > 0) return { text: `${s - 32} D16`, isSmart: false }; 
        if (s - 36 <= 20 && s - 36 > 0) return { text: `${s - 36} D18`, isSmart: false }; 
    }
    return dartsLeft >= 3 ? { text: "Combo...", isSmart: false } : null;
  };

  const nextPlayerIdx = useCallback(() => { 
      if (isAsync) return 0; 
      return (activePlayer + 1) % players.length; 
  }, [activePlayer, players.length, isAsync]);

  const updateRoundStats = (playerObj: PlayerData, pts: number) => { 
      if (pts === 180) { 
          playerObj.count180 += 1; 
          if (!playerObj.isBot) triggerCelebration('180', '180', 'MAXIMUM!', playerObj.color); 
      } else if (pts >= 140) {
          playerObj.count140 += 1; 
      } else if (pts >= 100) {
          playerObj.count100 += 1; 
      }
  };

  const recordHeatmapLocal = (val: number, mult: number) => {
      const prefix = mult === 3 ? 'T' : mult === 2 ? 'D' : 'S';
      const key = `${prefix}${val}`;
      setFullHeatmapData(prev => ({
          ...prev,
          [key]: {
              hits: (prev[key]?.hits || 0) + 1,
              throws: (prev[key]?.throws || 0) + 1
          }
      }));
  };

  const handleWin = useCallback((playerIndex: number, checkoutValue: number, winningDartsInRound: number) => {
    const pColor = players[playerIndex].color; 
    announceScore(txt.checkoutMsg(checkoutValue));
    
    if (checkoutValue >= 100 && !players[playerIndex].isBot) {
        triggerCelebration('checkout', `${checkoutValue}`, txt.gameShot, pColor);
    }

    setPlayers(prev => {
      const np = prev.map(pl => ({ ...pl })); 
      const activeP = np[playerIndex];
      
      activeP.score = 0; 
      activeP.legsWon += 1; 
      activeP.currentLegDarts += winningDartsInRound; 
      activeP.totalDarts += winningDartsInRound; 
      activeP.totalPoints += checkoutValue; 
      activeP.checkoutSuccess += 1;
      
      if (activeP.currentLegDarts <= 9) { 
          activeP.first9Points += checkoutValue; 
          activeP.first9Darts += winningDartsInRound; 
      }
      
      if (checkoutValue > activeP.highestCheckout) activeP.highestCheckout = checkoutValue;
      if (activeP.bestLegDarts === null || activeP.currentLegDarts < activeP.bestLegDarts) {
          activeP.bestLegDarts = activeP.currentLegDarts;
      }
      
      if (activeP.legsWon >= config.legsToWin) {
          activeP.legsWon = 0; 
          activeP.setsWon += 1; 
          np.forEach(pl => pl.legsWon = 0); 
          
          if (activeP.setsWon >= config.setsToWin) {
              setIsMatchWinner(true); 
          } else {
              setIsSetWinner(true);
          }
      } else {
          setIsLegWinner(true);
      }
      return np;
    });
  }, [config, players, announceScore, triggerCelebration, txt]);

  const processDart = useCallback((val: number, mult: number) => {
    if (isLegWinner || isSetWinner || isMatchWinner || practiceStatus === 'lost' || practiceStatus === 'won' || practiceStatus === 'won_121_round' || showRulesOverlay || currentDarts.length >= 3 || asyncState !== 'playing') return;
    
    const activeP = players[activePlayer]; 
    const dartPoints = val * mult;

    if (!activeP.isBot && val !== 0 && config.gameMode !== 'practice') {
        recordHeatmapLocal(val, mult);
    }
    
    // --- GYAKORLÓ MÓDOK LOGIKÁJA ---
    if (config.gameMode === 'practice') {
        const newDarts = [...currentDarts, { val, mult }]; 
        setCurrentDarts(newDarts);
        
        if (config.practiceType === 'around') { 
            if (val === practiceTarget) { 
                announceScore('Hit'); 
                if (practiceTarget === 25) { 
                    setPracticeStatus('won'); 
                    triggerCelebration('checkout', 'WINNER', 'ATC Complete', activeP.color); 
                } else { 
                    setPracticeTarget(prev => prev === 20 ? 25 : prev + 1); 
                } 
            } else {
                announceScore('Miss'); 
            }
            return; 
        } 
        
        if (config.practiceType === 'bobs27') { 
            if (val === practiceTarget && mult === 2) { 
                setBobsRoundScore(prev => prev + (practiceTarget * 2)); 
                announceScore('Hit'); 
            } else {
                announceScore('Miss'); 
            }
            return; 
        }

        if (config.practiceType === '121') {
            let tScore = activeP.score; 
            let validPts = 0;
            
            for (const d of newDarts) { 
                tScore -= (d.val * d.mult); 
                validPts += (d.val * d.mult); 
            }
            
            let isOut = ((tScore === 0 && mult === 2) || (tScore === 0 && val === 25 && mult === 2));
            let isBust = (tScore < 0 || tScore === 1 || (tScore === 0 && !isOut));

            const newDartsLeft = c121DartsLeft - 1; 
            setC121DartsLeft(newDartsLeft);

            if (isOut) {
                announceScore(txt.checkoutMsg(validPts)); 
                triggerCelebration('checkout', `${validPts}`, 'Round Won!', activeP.color);
                if (c121Target > c121Record) { 
                    setC121Record(c121Target); 
                    localStorage.setItem('dartisan_121_record', c121Target.toString()); 
                }
                setPracticeStatus('won_121_round');
                setTimeout(() => { 
                    const nextTarget = c121Target + 1; 
                    setC121Target(nextTarget); 
                    setC121DartsLeft(9); 
                    setPlayers(prev => { 
                        const np = [...prev]; 
                        np[0].score = nextTarget; 
                        np[0].history = []; 
                        return np; 
                    }); 
                    setCurrentDarts([]); 
                    setPracticeStatus('playing'); 
                }, 2500); 
                return;
            }
            
            if (isBust) { 
                announceScore(validPts.toString(), false, true); 
                setTimeout(() => { 
                    setCurrentDarts([]); 
                    if (newDartsLeft <= 0) setPracticeStatus('lost'); 
                }, 600); 
                return; 
            }
            
            if (newDartsLeft <= 0 && currentDarts.length === 2) { 
                announceScore(dartPoints.toString()); 
                setTimeout(() => { setPracticeStatus('lost'); }, 600); 
                return; 
            }
            
            if (newDarts.length === 3) {
                announceScore(validPts.toString());
                setTimeout(() => { 
                    setPlayers(prev => { 
                        const np = [...prev]; 
                        np[0].score -= validPts; 
                        np[0].history.push({ score: np[0].score, dartsCount: 3, points: validPts, roundDarts: newDarts }); 
                        return np; 
                    }); 
                    setCurrentDarts([]); 
                    if (newDartsLeft <= 0) setPracticeStatus('lost'); 
                }, 600);
            }
            return;
        }
    }

    // --- NORMÁL LOGIKA (X01 / VS / CAREER) ---
    let tScore = activeP.score; 
    let opened = activeP.score < config.startingScore; 
    let validPts = 0;
    
    const isFirst9 = (activeP.currentLegDarts + currentDarts.length) < 9;
    
    if (tScore <= 170 && mult === 2 && val !== 0) { 
        setPlayers(prev => { 
            const n = [...prev]; 
            n[activePlayer].checkoutAttempts += 1; 
            return n; 
        }); 
    }
    
    const allDarts = [...currentDarts, { val, mult }];
    for (const d of allDarts) { 
        if (config.checkIn === 'double' && !opened) { 
            if (d.mult === 2 && d.val !== 0) { 
                opened = true; 
                tScore -= (d.val * d.mult); 
                validPts += (d.val * d.mult); 
            } 
        } else { 
            tScore -= (d.val * d.mult); 
            validPts += (d.val * d.mult); 
        } 
    }

    if (isFirst9) { 
        setPlayers(prev => { 
            const n = [...prev]; 
            n[activePlayer].first9Points += (val * mult); 
            n[activePlayer].first9Darts += 1; 
            return n; 
        }); 
    }

    let isOut = config.checkout === 'double' ? ((tScore === 0 && mult === 2) || (tScore === 0 && val === 25 && mult === 2)) : (tScore === 0);
    
    if (isOut && opened) { 
        setCurrentDarts([...currentDarts, { val, mult }]);
        if (isAsync) { 
            announceScore(txt.checkoutMsg(validPts)); 
            setPlayers(prev => { 
                const np = prev.map(pl => ({ ...pl })); 
                const pl = np[activePlayer]; 
                pl.totalDarts += allDarts.length; 
                pl.currentLegDarts += allDarts.length; 
                pl.totalPoints += validPts; 
                pl.score = 0; 
                return np; 
            }); 
            finishAsyncLeg(activeP.currentLegDarts + allDarts.length); 
        } else {
            handleWin(activePlayer, validPts, currentDarts.length + 1); 
        }
        return; 
    }

    let isBust = config.checkout === 'double' ? (tScore < 0 || tScore === 1 || (tScore === 0 && !isOut)) : (tScore < 0); 
    
    if (isBust) {
      announceScore(validPts.toString(), false, true);
      setPlayers(prev => { 
          const np = prev.map(pl => ({ ...pl })); 
          const pl = np[activePlayer]; 
          pl.history.push({ score: pl.score, dartsCount: allDarts.length, points: 0, roundDarts: allDarts }); 
          pl.totalDarts += allDarts.length; 
          pl.currentLegDarts += allDarts.length; 
          pl.lastVisit = 0; 
          return np; 
      });
      setCurrentDarts([]); 
      setActivePlayer(nextPlayerIdx()); 
      return;
    }

    setCurrentDarts(allDarts);
    
    if (allDarts.length === 3) { 
        if (validPts === 180) announceScore('', true, false); 
        else announceScore(validPts.toString()); 
    }
  }, [activePlayer, config, currentDarts, handleWin, isLegWinner, isSetWinner, isMatchWinner, practiceStatus, practiceTarget, showRulesOverlay, asyncState, nextPlayerIdx, players, announceScore, c121DartsLeft, c121Target, c121Record, txt]);

  const handleDartPress = (val: number) => { 
      if (val === 25 && activeMult === 3) return; 
      processDart(val, activeMult); 
      setActiveMult(1); 
  };

  useEffect(() => {
    if (currentDarts.length === 3 && !isLegWinner && !isSetWinner && !isMatchWinner && practiceStatus === 'playing') {
      const timer = setTimeout(() => {
        if (config.gameMode === 'practice') {
            if (config.practiceType === 'bobs27') {
                let fs = bobsScore; 
                if (bobsRoundScore === 0) fs -= (practiceTarget * 2); 
                else fs += bobsRoundScore;
                
                setBobsScore(fs); 
                setBobsRoundScore(0);
                
                if (fs < 0) { 
                    setPracticeStatus('lost'); 
                    announceScore('', false, true); 
                } else if (practiceTarget === 25) { 
                    setPracticeStatus('won'); 
                    triggerCelebration('checkout', 'WINNER', "Bob's 27 Complete", players[0].color); 
                } else {
                    setPracticeTarget(prev => prev === 20 ? 25 : prev + 1);
                }
            }
            if (config.practiceType !== '121') setCurrentDarts([]);
        } else {
            const activeP = players[activePlayer]; 
            let opened = activeP.score < config.startingScore; 
            let v = 0;
            
            for (const d of currentDarts) { 
                if (config.checkIn === 'double' && !opened) { 
                    if (d.mult === 2 && d.val !== 0) { opened = true; v += (d.val * d.mult); } 
                } else {
                    v += (d.val * d.mult); 
                }
            }
            
            setPlayers(prev => { 
                const np = prev.map(pl => ({ ...pl })); 
                const pl = np[activePlayer]; 
                pl.score -= v; 
                pl.history.push({ score: pl.score, dartsCount: 3, points: v, roundDarts: currentDarts }); 
                pl.totalPoints += v; 
                pl.totalDarts += 3; 
                pl.currentLegDarts += 3; 
                pl.lastVisit = v; 
                updateRoundStats(pl, v); 
                return np; 
            });
            setCurrentDarts([]); 
            setActivePlayer(nextPlayerIdx());
        }
      }, 600); 
      return () => clearTimeout(timer);
    }
  }, [currentDarts, activePlayer, isLegWinner, isSetWinner, isMatchWinner, practiceStatus, bobsScore, bobsRoundScore, practiceTarget, nextPlayerIdx, config, players]);

  const handleHunterHit = async (hits: number) => {
      setHunterTotalHits(prev => prev + hits);
      
      const user = auth.currentUser;
      if (user) {
          try {
              const heatmapRef = doc(db, 'users', user.uid, 'stats', 'heatmap');
              await setDoc(heatmapRef, {
                  [hunterTargetStr]: { hits: increment(hits), throws: increment(3) }
              }, { merge: true });
              
              setFullHeatmapData(prev => ({
                  ...prev,
                  [hunterTargetStr]: { 
                      hits: (prev[hunterTargetStr]?.hits || 0) + hits, 
                      throws: (prev[hunterTargetStr]?.throws || 0) + 3 
                  }
              }));
          } catch (error) { 
              console.error("Hőtérkép mentés hiba:", error); 
          }
      }

      if (hunterRound >= 10) { 
          setPracticeStatus('won'); 
          triggerCelebration('checkout', `${hunterTotalHits + hits}/30`, 'Heatmap Updated!', players[0].color); 
      } else { 
          setHunterRound(prev => prev + 1); 
          setHunterTargetStr(HUNTER_TARGETS[Math.floor(Math.random() * HUNTER_TARGETS.length)]); 
      }
  };

  const handleMathEnter = () => {
      if (mathInput === '') return;
      
      if (parseInt(mathInput) === mathQuestion.ans) {
          announceScore("Correct");
          setMathScore(prev => prev + 1);
      } else {
          announceScore("Wrong");
      }
      
      if (mathRound >= 10) { 
          setPracticeStatus('won'); 
          triggerCelebration('checkout', `${mathScore + (parseInt(mathInput) === mathQuestion.ans ? 1 : 0)}/10`, 'Agytréning Kész!', players[0].color); 
      } else { 
          setMathRound(prev => prev + 1); 
          setMathInput(''); 
          generateMathQuestion(); 
      }
  };

  const handleFastEnter = (overridePts?: number) => {
    if ((input === '' && overridePts === undefined) || isLegWinner || isSetWinner || isMatchWinner || players[activePlayer]?.isBot || config.gameMode === 'practice' || asyncState !== 'playing') return;
    
    const pts = overridePts !== undefined ? overridePts : parseInt(input); 
    
    if (pts > 180 || [163, 166, 169, 172, 173, 175, 176, 178, 179].includes(pts)) { 
        alert(txt.impossible); 
        setInput(''); 
        return; 
    }
    
    saveQuickButtonUsage(pts);

    const activeP = players[activePlayer]; 
    const tScore = activeP.score - pts;
    let isBust = config.checkout === 'double' ? (tScore < 0 || tScore === 1) : (tScore < 0);
    
    if (activeP.currentLegDarts < 9) { 
        setPlayers(prev => { 
            const n = [...prev]; 
            n[activePlayer].first9Points += pts; 
            n[activePlayer].first9Darts += 3; 
            return n; 
        }); 
    }

    if (isBust) {
       announceScore(pts.toString(), false, true); 
       setPlayers(prev => { 
           const np = prev.map(pl => ({ ...pl })); 
           const pl = np[activePlayer]; 
           pl.history.push({ score: pl.score, dartsCount: 3, points: 0, roundDarts: [] }); 
           pl.totalDarts += 3; 
           pl.currentLegDarts += 3; 
           pl.lastVisit = 0; 
           return np; 
       });
       setInput(''); 
       setActivePlayer(nextPlayerIdx()); 
       return;
    }

    if (tScore === 0) { 
        if (isAsync) { 
            announceScore(txt.checkoutMsg(pts)); 
            setPlayers(prev => { 
                const np = prev.map(pl => ({ ...pl })); 
                const pl = np[activePlayer]; 
                pl.totalDarts += 3; 
                pl.currentLegDarts += 3; 
                pl.totalPoints += pts; 
                pl.score = 0; 
                return np; 
            }); 
            finishAsyncLeg(activeP.currentLegDarts + 3); 
        } else {
            handleWin(activePlayer, pts, 3); 
        }
    } else { 
        if (pts === 180) announceScore('', true, false); 
        else announceScore(pts.toString());
        
        setPlayers(prev => { 
            const np = prev.map(pl => ({ ...pl })); 
            const pl = np[activePlayer]; 
            pl.score = tScore; 
            pl.history.push({ score: pl.score + pts, dartsCount: 3, points: pts, roundDarts: [] }); 
            pl.totalPoints += pts; 
            pl.totalDarts += 3; 
            pl.currentLegDarts += 3; 
            pl.lastVisit = pts; 
            updateRoundStats(pl, pts); 
            return np; 
        });
        setActivePlayer(nextPlayerIdx()); 
    } 
    setInput('');
  };

  const handleUndo = () => {
    if (isLegWinner || isSetWinner || isMatchWinner || practiceStatus !== 'playing' || asyncState !== 'playing') return;
    
    if (config.gameMode === 'practice') {
        if (config.practiceType === 'math' && mathInput.length > 0) { 
            setMathInput(mathInput.slice(0, -1)); 
            return; 
        }
        if (currentDarts.length === 0) return;
        
        const lastDart = currentDarts[currentDarts.length - 1];
        if (config.practiceType === 'around' && lastDart.val === (practiceTarget === 25 ? 20 : practiceTarget === 1 ? 1 : practiceTarget - 1)) {
            setPracticeTarget(prev => prev === 25 ? 20 : prev - 1);
        }
        if (config.practiceType === 'bobs27' && lastDart.val === practiceTarget && lastDart.mult === 2) {
            setBobsRoundScore(prev => prev - (practiceTarget * 2));
        }
        if (config.practiceType === '121') {
            setC121DartsLeft(prev => prev + 1);
        }
        setCurrentDarts(currentDarts.slice(0, -1)); 
        return;
    }

    if (inputMode === 'fast' && input.length > 0) { 
        setInput(input.slice(0, -1)); 
        return; 
    }
    
    if (inputMode === 'detailed' && currentDarts.length > 0 && !players[activePlayer].isBot) { 
        setCurrentDarts(currentDarts.slice(0, -1)); 
        return; 
    }
    
    if (!players.some(p => p.history.length > 0)) return;
    
    const prevPlayerIdx = activePlayer === 0 ? players.length - 1 : activePlayer - 1;
    setPlayers(prev => {
        const np = prev.map(pl => ({ ...pl })); 
        const pl = np[prevPlayerIdx]; 
        const lh = pl.history[pl.history.length - 1];
        
        if (lh.points === 180) pl.count180 = Math.max(0, pl.count180 - 1); 
        else if (lh.points >= 140) pl.count140 = Math.max(0, pl.count140 - 1); 
        else if (lh.points >= 100) pl.count100 = Math.max(0, pl.count100 - 1);
        
        np[prevPlayerIdx] = { 
            ...pl, 
            score: lh.score, 
            totalPoints: pl.totalPoints - lh.points, 
            totalDarts: pl.totalDarts - lh.dartsCount, 
            currentLegDarts: pl.currentLegDarts - lh.dartsCount, 
            history: pl.history.slice(0, -1), 
            lastVisit: pl.history.length > 1 ? pl.history[pl.history.length - 2].points : null 
        };
        return np;
    }); 
    setActivePlayer(prevPlayerIdx);
  };

  const handleNextLegOrSet = () => { 
      if (config.gameMode === 'practice') { 
          setPracticeTarget(1); 
          setBobsScore(27); 
          setBobsRoundScore(0); 
          
          if (config.practiceType === '121') { 
              setC121Target(121); 
              setC121DartsLeft(9); 
              setPlayers(prev => [{...prev[0], score: 121, history: []}]); 
          }
          if (config.practiceType === 'hunter') { 
              setHunterRound(1); 
              setHunterTotalHits(0); 
          }
          if (config.practiceType === 'math') { 
              setMathRound(1); 
              setMathScore(0); 
              generateMathQuestion(); 
          }
          
          setPracticeStatus('playing'); 
          setCurrentDarts([]); 
          return; 
      }
      
      setPlayers(prev => prev.map(pl => ({ ...pl, score: config.startingScore, currentLegDarts: 0, history: [], lastVisit: null }))); 
      setCurrentDarts([]); 
      setIsLegWinner(false); 
      setIsSetWinner(false); 
      setAsyncState('playing');
      
      const tp = players.reduce((sum, pl) => sum + pl.legsWon + (pl.setsWon * config.legsToWin), 0); 
      if (!isAsync) setActivePlayer(tp % players.length);
  };
  
  const handleExit = () => { 
      localStorage.removeItem('dartisan_save'); 
      
      const user = auth.currentUser;
      if (user && Object.keys(fullHeatmapData).length > 0) {
          setDoc(doc(db, 'users', user.uid, 'stats', 'heatmap'), fullHeatmapData, { merge: true })
            .catch(err => console.error("Kilépési mentés hiba:", err));
      }
      
      onBackToSetup(); 
  };

  const rotatedPlayers = isAsync ? players : [...players.slice(activePlayer), ...players.slice(0, activePlayer)];
  const safePlayer = players[activePlayer] || players[0];
  const activeColorTheme = COLOR_STYLES[safePlayer?.color] || COLOR_STYLES['emerald']; 
  const colTxt = activeColorTheme.split(' ')[0] || 'text-emerald-400'; 
  const colBor = activeColorTheme.split(' ')[1] || 'border-emerald-500'; 
  const colBg = activeColorTheme.split(' ')[3] || 'bg-emerald-500';

  return (
    <div className="h-screen bg-[#0b0d11] text-slate-200 flex flex-col overflow-hidden tracking-tight relative">
      
      {/* KÜLÖNBÖZŐ OVERLAY-EK (Szabályok, Győzelem, Várakozás) */}
      {asyncState === 'waiting_leg' && (
          <div className="absolute inset-0 z-[120] bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
              <ClockIcon className="h-24 w-24 mb-6 text-amber-500 animate-spin-slow" />
              <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">{txt.waitLegTitle}</h2>
              <p className="text-slate-400 font-bold mb-8 max-w-xs">{txt.waitLegDesc}</p>
              <div className="bg-[#12141a] border border-amber-500/30 p-8 rounded-3xl mb-8 shadow-[0_0_30px_rgba(245,158,11,0.1)] w-full max-w-sm">
                  <p className="text-[10px] text-amber-500 uppercase font-black mb-2">A Te Nyilaid Ebben A Legben:</p>
                  <span className="text-6xl font-mono font-black text-white">{players[0].currentLegDarts}</span>
              </div>
              <button onClick={onBackToSetup} className="w-full max-w-sm h-14 rounded-xl bg-slate-800 text-white font-black uppercase shadow-xl hover:bg-slate-700">Kilépés a Menübe</button>
          </div>
      )}

      {showRulesOverlay && (
        <div className="absolute inset-0 z-[110] bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
            <InformationCircleIcon className={`h-24 w-24 mb-6 ${config.gameMode === 'career' ? 'text-[#b655ff]' : (config.practiceType === 'hunter' ? 'text-rose-500' : config.practiceType === 'math' ? 'text-indigo-500' : 'text-cyan-400')}`} />
            <h2 className="text-4xl font-black text-white mb-6 uppercase italic tracking-tighter">{txt.rulesTitle}</h2>
            
            <div className={`bg-[#12141a] border p-8 rounded-3xl mb-8 max-w-sm w-full text-left shadow-2xl ${config.gameMode === 'career' ? 'border-[#b655ff]/30 shadow-[0_0_30px_rgba(182,85,255,0.1)]' : (config.practiceType === 'hunter' ? 'border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)]' : config.practiceType === 'math' ? 'border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)]')}`}>
                {config.gameMode === 'practice' ? (
                    <>
                        <h3 className={`${config.practiceType === 'hunter' ? 'text-rose-400' : config.practiceType === 'math' ? 'text-indigo-400' : 'text-cyan-400'} font-black uppercase tracking-widest text-sm mb-4`}>
                            {config.practiceType === 'hunter' ? 'Célpont Vadász' : config.practiceType === 'math' ? 'Darts Math' : 'Gyakorlás'}
                        </h3>
                        {config.practiceType === 'hunter' && (
                            <ul className="text-slate-300 text-sm font-bold flex flex-col gap-4 list-none">
                                <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-rose-400 shrink-0" /> <span>{txt.hunterRules1}</span></li>
                                <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-rose-400 shrink-0" /> <span>{txt.hunterRules2}</span></li>
                                <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-rose-400 shrink-0" /> <span>{txt.hunterRules3}</span></li>
                            </ul>
                        )}
                        {config.practiceType === 'math' && (
                            <ul className="text-slate-300 text-sm font-bold flex flex-col gap-4 list-none">
                                <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-indigo-400 shrink-0" /> <span>{txt.mathRules1}</span></li>
                                <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-indigo-400 shrink-0" /> <span>{txt.mathRules2}</span></li>
                                <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-indigo-400 shrink-0" /> <span>{txt.mathRules3}</span></li>
                            </ul>
                        )}
                        {['around', 'bobs27', '121'].includes(config.practiceType || '') && (
                            <ul className="text-slate-300 text-sm font-bold flex flex-col gap-4 list-none">
                                <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-cyan-400 shrink-0" /> <span>Kövesd a képernyőn az utasításokat és dobj pontosan!</span></li>
                            </ul>
                        )}
                    </>
                ) : (
                    <>
                        <h3 className={`${config.gameMode === 'career' ? 'text-[#b655ff]' : 'text-emerald-400'} font-black uppercase tracking-widest text-sm mb-4`}>
                            {config.gameMode === 'career' ? players[1]?.name : 'Játék Indítása'}
                        </h3>
                    </>
                )}
            </div>
            <button onClick={() => setShowRulesOverlay(false)} className={`w-full max-w-sm h-16 rounded-2xl text-white text-xl font-black uppercase tracking-widest active:scale-95 transition-all ${config.gameMode === 'career' ? 'bg-[#b655ff] shadow-[0_10px_30px_rgba(182,85,255,0.3)]' : (config.practiceType === 'hunter' ? 'bg-rose-500 shadow-[0_10px_30px_rgba(244,63,94,0.3)]' : config.practiceType === 'math' ? 'bg-indigo-500 shadow-[0_10px_30px_rgba(99,102,241,0.3)]' : 'bg-cyan-500 shadow-[0_10px_30px_rgba(6,182,212,0.3)] text-slate-950')}`}>{txt.startGame}</button>
        </div>
      )}

      {celebration && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none bg-black/80 backdrop-blur-md transition-all px-4">
            <div className="text-center animate-pulse"><h1 className={`text-[25vw] md:text-[8rem] lg:text-[10rem] font-black ${COLOR_STYLES[celebration.color]?.split(' ')[0]} italic tracking-tighter leading-none pr-4`}>{celebration.main}</h1><p className="text-[6vw] md:text-4xl font-black text-white uppercase mt-2">{celebration.sub}</p></div>
        </div>
      )}

      {practiceStatus === 'lost' && (
        <div className="absolute inset-0 z-50 bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center">
             <TrophyIcon className="h-24 w-24 mb-6 text-rose-500 grayscale" />
             <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">{txt.gameOver}</h2>
             {config.practiceType === 'bobs27' && (<p className="text-slate-400 mb-8 font-bold text-xl uppercase tracking-widest mt-4">{txt.finalScore} <span className="text-rose-400 font-black">{bobsScore}</span></p>)}
             {config.practiceType === '121' && (<div className="mb-8 mt-4 flex flex-col gap-2"><p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Elért Szint: <span className="text-white font-black text-xl">{c121Target}</span></p><p className="text-amber-500 font-black text-xs uppercase tracking-widest border border-amber-500/30 bg-amber-500/10 px-4 py-2 rounded-xl inline-block shadow-[0_0_20px_rgba(245,158,11,0.2)]">Személyes Rekord: {c121Record}</p></div>)}
             <div className="flex gap-4 w-full max-w-sm mt-8">
                 <button onClick={handleExit} className="flex-1 h-16 rounded-2xl bg-slate-800 text-white text-lg font-black uppercase shadow-xl">{txt.back}</button>
                 <button onClick={handleNextLegOrSet} className={`flex-1 h-16 rounded-2xl bg-cyan-500 text-slate-950 text-lg font-black uppercase shadow-xl`}>{txt.playAgain}</button>
             </div>
        </div>
      )}

      {practiceStatus === 'won' && (
        <div className="absolute inset-0 z-50 bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center">
             <TrophyIcon className="h-24 w-24 mb-6 text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]" />
             <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">Gyakorlás Kész!</h2>
             {config.practiceType === 'hunter' && (<p className="text-slate-400 mb-8 font-bold text-xl uppercase tracking-widest mt-4">Sikeres Találatok: <span className="text-rose-400 font-black">{hunterTotalHits}/30</span></p>)}
             {config.practiceType === 'math' && (<p className="text-slate-400 mb-8 font-bold text-xl uppercase tracking-widest mt-4">Helyes Válaszok: <span className="text-indigo-400 font-black">{mathScore}/10</span></p>)}
             <div className="flex gap-4 w-full max-w-sm mt-8">
                 <button onClick={handleExit} className="flex-1 h-16 rounded-2xl bg-slate-800 text-white text-lg font-black uppercase shadow-xl">{txt.back}</button>
                 <button onClick={handleNextLegOrSet} className={`flex-1 h-16 rounded-2xl bg-cyan-500 text-slate-950 text-lg font-black uppercase shadow-xl`}>{txt.playAgain}</button>
             </div>
        </div>
      )}

      {isMatchWinner && config.gameMode !== 'practice' && asyncState === 'playing' && (
        <div className="absolute inset-0 z-50 bg-[#0b0d11]/95 flex flex-col items-center p-6 overflow-y-auto">
            <TrophyIcon className="h-20 w-20 text-amber-400 mb-2 mt-4 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] shrink-0" />
            <h2 className="text-4xl font-black text-white mb-1 uppercase italic tracking-tighter">{config.gameMode === 'career' && activePlayer === 0 ? txt.careerWon : txt.matchShot}</h2>
            <p className={`${colTxt} text-lg mb-8 font-black uppercase tracking-widest`}>{safePlayer?.name} {txt.winsMatch}</p>
            
            <div className="w-full max-w-2xl bg-[#12141a] rounded-[2rem] border border-slate-800 p-6 mb-8 shrink-0 flex flex-col lg:flex-row gap-6">
              
              <div className="flex-1">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">{txt.stats}</h3>
                  <div className="flex flex-col gap-3">
                     <div className="grid grid-cols-4 gap-2 pb-2 border-b border-slate-800 text-[9px] font-bold text-slate-500 uppercase text-center">
                         <span className="text-left col-span-2">{txt.player}</span> 
                         <span>{txt.avg}</span> 
                         <span>CO %</span>
                     </div>
                     {players.map(pl => (
                       <div key={pl.id} className={`grid grid-cols-4 gap-2 items-center text-center p-3 rounded-xl border ${pl.id === activePlayer ? 'bg-slate-800/80 border-slate-600 shadow-md' : 'bg-slate-900/40 border-slate-800/50'}`}>
                         <div className="flex flex-col text-left col-span-2">
                             <span className={`text-sm font-black uppercase truncate ${pl.id === activePlayer ? colTxt : 'text-slate-300'}`}>{pl.name}</span>
                             <span className="text-[9px] text-slate-500 font-bold uppercase">Első 9: {((pl.first9Points/(pl.first9Darts||1))*3).toFixed(1)}</span>
                         </div>
                         <span className="text-base font-mono font-black text-white">{((pl.totalPoints/(pl.totalDarts||1))*3).toFixed(1)}</span>
                         <span className="text-sm font-mono font-bold text-slate-300">{pl.checkoutAttempts > 0 ? Math.round((pl.checkoutSuccess / pl.checkoutAttempts) * 100) : 0}%</span>
                         
                         <div className="col-span-4 mt-2 pt-2 border-t border-slate-800/50 flex justify-between text-[10px] font-mono text-slate-400">
                             <span>100+: {pl.count100}</span>
                             <span>140+: {pl.count140}</span>
                             <span>180: {pl.count180}</span>
                             <span className="text-amber-400">High: {pl.highestCheckout > 0 ? pl.highestCheckout : '-'}</span>
                         </div>
                       </div>
                     ))}
                  </div>

                  <div className="mt-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                          <ComputerDesktopIcon className="h-4 w-4"/> AI Értékelés
                      </p>
                      <p className="text-xs text-indigo-200 font-bold italic">
                          {generateAiFeedback(players[0])}
                      </p>
                  </div>
              </div>

              <div className="w-full lg:w-64 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-6">
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] mb-4">Személyes Hőtérkép</h3>
                  <div className="w-48 h-48 relative">
                      <DartboardHeatmap heatmapData={fullHeatmapData} />
                  </div>
                  <p className="text-[9px] text-slate-500 text-center mt-4 font-bold uppercase">
                      Kék = Ritka <br/> Piros = Forró / Gyakori
                  </p>
              </div>

            </div>
            <button onClick={handleExit} className={`w-full max-w-xs h-16 rounded-2xl ${colBg} text-slate-950 text-xl font-black uppercase shrink-0 mb-8 shadow-xl`}>{txt.back}</button>
        </div>
      )}

      {(isLegWinner || isSetWinner) && !isMatchWinner && config.gameMode !== 'practice' && asyncState === 'playing' && (
        <div className="absolute inset-0 z-50 bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center">
            <TrophyIcon className={`h-20 w-20 ${colTxt} mb-4 animate-bounce`} />
            <h2 className="text-4xl font-black text-white mb-2 uppercase italic">{txt.gameShot}</h2>
            <p className="text-slate-400 mb-8 font-mono font-bold tracking-widest">{safePlayer?.name} {txt.takes} {isSetWinner ? txt.set : txt.leg}</p>
            <button onClick={handleNextLegOrSet} className={`w-full max-w-xs h-16 rounded-2xl ${colBg} text-slate-950 text-xl font-black uppercase shadow-xl`}>{txt.next} {isSetWinner ? txt.set : txt.leg}</button>
        </div>
      )}

      <button onClick={handleExit} className="absolute top-4 right-4 z-40 p-2 text-slate-600 hover:text-rose-500 bg-slate-900/80 rounded-full border border-slate-800"><XMarkIcon className="h-5 w-5" /></button>

      {/* --- JÁTÉKTÉR --- */}
      {config.gameMode === 'practice' ? (
        <div className="w-full px-4 pt-10 pb-2 h-44 flex items-center justify-center">
            <div className={`w-full h-full bg-[#12141a] rounded-[2rem] border flex flex-col items-center justify-center transition-all ${config.practiceType === 'hunter' ? 'border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.1)]' : config.practiceType === 'math' ? 'border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.1)]' : 'border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)]'}`}>
                {config.practiceType === 'math' && (
                    <>
                        <div className="flex w-full justify-between px-6 absolute top-14"><span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Kör: {mathRound}/10</span><span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Pont: {mathScore}</span></div>
                        <div className="flex items-center gap-6 mt-4">
                            <div className="flex flex-col items-center"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Kiinduló</span><span className="text-5xl font-black text-white font-mono leading-none">{mathQuestion.start}</span></div>
                            <span className="text-2xl font-black text-slate-600">-</span>
                            <div className="flex flex-col items-center"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Eldobott Nyíl</span><span className="text-5xl font-black text-indigo-400 font-mono leading-none">{mathQuestion.dartText}</span></div>
                        </div>
                    </>
                )}
                {config.practiceType === 'hunter' && (
                    <>
                        <div className="flex w-full justify-between px-6 absolute top-14"><span className="text-[10px] font-black uppercase tracking-widest text-rose-400">Kör: {hunterRound}/10</span><span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Találatok: {hunterTotalHits}</span></div>
                        <div className="flex flex-col items-center justify-center mt-4"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Következő Célpont:</span><span className="text-7xl font-black text-white font-mono leading-none">{hunterTargetStr}</span></div>
                    </>
                )}
                {config.practiceType === '121' && (
                    <div className="flex items-center gap-8 mt-2">
                        <div className="flex flex-col items-center justify-center bg-slate-900 border border-slate-800 p-4 rounded-2xl relative">{c121Record > 0 && <span className="absolute -top-3 text-[8px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Rec: {c121Record}</span>}<span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{txt.target}</span><span className="text-6xl font-black text-white font-mono leading-none">{players[0].score}</span></div>
                        <div className="flex flex-col items-center justify-center"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{txt.dartsLeft}</span><span className={`text-6xl font-black font-mono leading-none ${c121DartsLeft <= 3 ? 'text-rose-500 animate-pulse' : 'text-cyan-400'}`}>{c121DartsLeft}</span></div>
                    </div>
                )}
                {['around', 'bobs27'].includes(config.practiceType || '') && (
                    <div className="flex items-end gap-6">
                        <div className="flex flex-col items-center"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{txt.target}</span><span className="text-6xl font-black text-white font-mono leading-none">{practiceTarget === 25 ? 'BULL' : config.practiceType === 'bobs27' ? `D${practiceTarget}` : practiceTarget}</span></div>
                        {config.practiceType === 'bobs27' && (<div className="flex flex-col items-center pl-6 border-l border-slate-800"><span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{txt.points}</span><span className={`text-5xl font-black font-mono leading-none ${bobsScore < 0 ? 'text-rose-500' : 'text-amber-400'}`}>{bobsScore}</span></div>)}
                    </div>
                )}
            </div>
        </div>
      ) : (
          <div className="w-full px-4 pt-10 pb-2 flex gap-3 h-44 overflow-hidden">
             {rotatedPlayers.map((pl) => {
                 const isAct = activePlayer === pl.id; 
                 let actScore = pl.score;
                 
                 if (isAct && !isAsync) { 
                     let t = pl.score; 
                     let o = pl.score < config.startingScore; 
                     for (const d of currentDarts) { 
                         if (config.checkIn === 'double' && !o) { 
                             if (d.mult === 2 && d.val !== 0) { o = true; t -= (d.val * d.mult); } 
                         } else { 
                             t -= (d.val * d.mult); 
                         } 
                     } 
                     actScore = t; 
                 } 
                 else if (isAsync && pl.id === 0) { 
                     let t = pl.score; 
                     let o = pl.score < config.startingScore; 
                     for (const d of currentDarts) { 
                         if (config.checkIn === 'double' && !o) { 
                             if (d.mult === 2 && d.val !== 0) { o = true; t -= (d.val * d.mult); } 
                         } else { 
                             t -= (d.val * d.mult); 
                         } 
                     } 
                     actScore = t; 
                 }

                 if (isAsync && pl.id === 1) {
                     return (
                     <div key={pl.id} className={`flex-1 rounded-3xl flex flex-col items-center justify-center border-2 transition-all duration-500 bg-slate-900/30 border-rose-500/30 opacity-80`}>
                         <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">{pl.name}</span>
                         {fbSyncData && fbSyncData.state[`${oppRole}Darts`] !== null ? (<div className="flex flex-col items-center my-2 text-rose-400"><CheckCircleIcon className="h-10 w-10 mb-1" /><span className="text-[10px] font-black uppercase">Leg Kész</span></div>) : (<div className="flex flex-col items-center my-2 text-slate-500"><ArrowPathIcon className="h-10 w-10 mb-1 animate-spin" /><span className="text-[10px] font-black uppercase">Dobásra Vár...</span></div>)}
                         <div className="flex gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{config.setsToWin > 1 && (<span>S:<span className="text-white ml-1">{pl.setsWon}</span></span>)}<span>L:<span className="text-white ml-1">{pl.legsWon}</span></span></div>
                     </div>
                     );
                 }
                 
                 const plColorObj = COLOR_STYLES[pl.color] || COLOR_STYLES['emerald']; 
                 const pColorTxt = plColorObj.split(' ')[0] || 'text-emerald-400'; 
                 const pColorBor = plColorObj.split(' ')[1] || 'border-emerald-500'; 
                 const pColorShdw = plColorObj.split(' ')[2] || 'shadow-none';

                 return (
                 <div key={pl.id} className={`${players.length <= 2 ? 'flex-1' : 'flex-none w-[45%]'} rounded-3xl flex flex-col items-center justify-center border-2 transition-all duration-500 ${(isAct || (isAsync && pl.id===0)) ? `bg-slate-800/80 ${pColorBor} ${pColorShdw} scale-100` : 'bg-slate-900/30 border-slate-800/50 opacity-50 scale-95'}`}>
                     <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${(isAct || (isAsync && pl.id===0)) ? pColorTxt : 'text-slate-500'} truncate px-2`}>{pl.isBot ? <ComputerDesktopIcon className="h-3 w-3 inline" /> : null} {pl.name}</span>
                     <span className="text-[4.5rem] font-black text-white font-mono leading-none my-1 drop-shadow-lg">{actScore}</span>
                     <div className="flex gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{config.setsToWin > 1 && (<span className={pl.setsWon === config.setsToWin - 1 ? "text-amber-400 animate-pulse" : ""}>S:<span className="text-white ml-1">{pl.setsWon}</span></span>)}<span className={pl.legsWon === config.legsToWin - 1 ? "text-amber-400 animate-pulse" : ""}>L:<span className="text-white ml-1">{pl.legsWon}</span></span><span>A:<span className="text-white ml-1">{((pl.totalPoints/(pl.totalDarts||1))*3).toFixed(1)}</span></span><span>LAST:<span className="text-white ml-1">{pl.lastVisit !== null ? pl.lastVisit : '-'}</span></span></div>
                 </div>
                 );
             })}
          </div>
      )}
        
      <div className="h-8 flex items-center justify-center mb-1">
          {(() => {
              if (config.gameMode === 'practice' && config.practiceType !== '121') return <div className="px-4 py-1 opacity-0">.</div>;
              const activeP = isAsync ? players[0] : (players[activePlayer] || players[0]); 
              let t = activeP.score; 
              let o = activeP.score < config.startingScore;
              
              for (const d of currentDarts) { 
                  if (config.checkIn === 'double' && !o) { 
                      if (d.mult === 2 && d.val !== 0) { o = true; t -= (d.val * d.mult); } 
                  } else { 
                      t -= (d.val * d.mult); 
                  } 
              }
              
              const recObj = getCheckoutTable(t, config.practiceType === '121' ? c121DartsLeft : (3 - currentDarts.length));
              
              if (recObj) {
                  const prefix = recObj.isSmart ? "🤖 AI OKOS SÚGÓ: " : ((t <= 100 && inputMode === 'fast') ? "AI TIP: " : "");
                  return (<div className={`${recObj.isSmart ? 'bg-[#b655ff]/20 border-[#b655ff]/40' : `${colBg}/10 border ${colBor}/20`} px-4 py-1 rounded-lg animate-pulse`}><span className={`${recObj.isSmart ? 'text-[#b655ff]' : colTxt} font-mono text-[13px] font-black tracking-[0.2em] uppercase italic`}>{prefix}{recObj.text}</span></div>);
              }
              return <div className="px-4 py-1 opacity-0">.</div>;
          })()}
      </div>

      {/* --- INPUT FELÜLET --- */}
      <div className={`p-4 bg-[#12141a] border-t border-slate-800 rounded-t-[2.5rem] w-full max-w-md mx-auto h-full flex flex-col transition-opacity ${(!isAsync && safePlayer?.isBot) || asyncState !== 'playing' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        {config.gameMode !== 'practice' && (
            <div className="flex gap-2 w-full mb-4">
              <button onClick={() => setInputMode('detailed')} disabled={(safePlayer?.isBot && !isAsync)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 border disabled:opacity-50 ${inputMode === 'detailed' ? 'bg-slate-700 text-white border-slate-500 shadow-xl' : 'bg-slate-950 text-slate-600 border-slate-800'}`}><ChartBarIcon className="h-4 w-4" /> Pro</button>
              <button onClick={() => setInputMode('fast')} disabled={(safePlayer?.isBot && !isAsync)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 border disabled:opacity-50 ${inputMode === 'fast' ? 'bg-slate-700 text-white border-slate-500 shadow-xl' : 'bg-slate-950 text-slate-600 border-slate-800'}`}><BoltIcon className="h-4 w-4" /> Fast</button>
            </div>
        )}

        {config.gameMode === 'practice' && config.practiceType === 'math' && (
            <div className="flex flex-col gap-4 mt-auto mb-8">
                <div className="flex justify-between items-center px-4 h-16 bg-slate-950 rounded-2xl border border-indigo-500/30 shadow-inner"><span className="font-mono text-5xl font-black text-white">{mathInput || '?'}</span><button onClick={handleUndo} className="p-2 text-slate-700 active:scale-90"><BackspaceIcon className="h-8 w-8"/></button></div>
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (<button key={num} onClick={() => { if(mathInput.length < 3) setMathInput(mathInput + num) }} className="h-16 rounded-xl bg-slate-800/60 border border-slate-700 text-3xl font-black text-indigo-100 active:scale-95">{num}</button>))}
                    <button onClick={handleMathEnter} className={`h-16 col-span-2 rounded-xl bg-indigo-500 text-white text-xl font-black uppercase active:scale-95 shadow-[0_5px_20px_rgba(99,102,241,0.3)]`}>Kész</button>
                </div>
            </div>
        )}

        {config.gameMode === 'practice' && config.practiceType === 'hunter' && (
            <div className="flex flex-col gap-4 mt-auto mb-12">
                <p className="text-center text-slate-500 font-bold uppercase tracking-widest text-xs mb-2">Hány nyíllal találtad el a Célpontot?</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleHunterHit(0)} className="h-24 rounded-2xl bg-slate-900 border border-slate-700 text-slate-500 text-2xl font-black uppercase active:scale-95 transition-all">0 Találat</button>
                    <button onClick={() => handleHunterHit(1)} className="h-24 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-2xl font-black uppercase active:scale-95 transition-all">1 Találat</button>
                    <button onClick={() => handleHunterHit(2)} className="h-24 rounded-2xl bg-rose-500/40 border border-rose-500/60 text-rose-100 text-2xl font-black uppercase active:scale-95 transition-all">2 Találat</button>
                    <button onClick={() => handleHunterHit(3)} className="h-24 rounded-2xl bg-rose-500 border border-rose-400 text-white text-2xl font-black uppercase active:scale-95 shadow-[0_10px_30px_rgba(244,63,94,0.4)] transition-all">3 Találat!</button>
                </div>
            </div>
        )}

        {((config.gameMode !== 'practice' && inputMode === 'detailed') || (config.gameMode === 'practice' && ['around', 'bobs27', '121'].includes(config.practiceType || ''))) && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between gap-2 h-12">
                {[0, 1, 2].map((i) => (<div key={i} className={`flex-1 rounded-xl border flex items-center justify-center font-mono text-lg font-black ${currentDarts[i] ? `bg-slate-800 ${config.gameMode === 'practice' ? 'border-cyan-500 text-cyan-400' : colBor + ' text-white'}` : 'bg-slate-950/50 border-slate-800 text-slate-800'}`}>{currentDarts[i] ? ((currentDarts[i].mult === 3 ? 'T' : currentDarts[i].mult === 2 ? 'D' : '') + (currentDarts[i].val === 0 ? 'M' : currentDarts[i].val)) : ''}</div>))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setActiveMult(1)} className={`h-11 rounded-xl font-black text-[9px] ${activeMult === 1 ? 'bg-white text-black' : 'bg-slate-800 text-slate-500'}`}>SINGLE</button>
              <button onClick={() => setActiveMult(2)} className={`h-11 rounded-xl font-black text-[9px] ${activeMult === 2 ? (config.gameMode === 'practice' ? 'bg-cyan-500 text-slate-900' : `${colBg} text-black`) : 'bg-slate-800 text-slate-500'}`}>DOUBLE</button>
              <button onClick={() => setActiveMult(3)} className={`h-11 rounded-xl font-black text-[9px] ${activeMult === 3 ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}>TRIPLE</button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((num) => (<button key={num} onClick={() => handleDartPress(num)} className="h-10 bg-slate-800/60 rounded-lg font-black text-base active:scale-90">{num}</button>))}
              <button onClick={() => handleDartPress(25)} disabled={activeMult === 3} className={`h-10 rounded-lg font-black text-[9px] col-span-2 ${activeMult === 3 ? 'opacity-40' : 'bg-indigo-500/10 text-indigo-400'}`}>BULL</button>
              <button onClick={() => handleDartPress(0)} className="h-10 bg-slate-800/60 rounded-lg font-black text-[9px] text-slate-500 uppercase">Miss</button>
              <button onClick={handleUndo} className="h-10 bg-slate-800/60 col-span-2 rounded-lg flex items-center justify-center active:scale-90"><BackspaceIcon className="h-5 w-5" /></button>
            </div>
          </div>
        )}

        {config.gameMode !== 'practice' && inputMode === 'fast' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">{quickButtons.map(qb => (<button key={qb} onClick={() => handleFastEnter(qb)} className="flex-1 bg-slate-800/80 text-emerald-400 border border-slate-700 h-10 rounded-xl font-mono font-black text-sm active:bg-slate-700">{qb}</button>))}</div>
            <div className="flex justify-between items-center px-4 h-14 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner"><span className="font-mono text-4xl font-black text-white">{input || '0'}</span><button onClick={handleUndo} className="p-2 text-slate-700 active:scale-90"><BackspaceIcon className="h-8 w-8"/></button></div>
            <div className="grid grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (<button key={num} onClick={() => {if(asyncState === 'playing') setInput(input + num)}} className="h-14 rounded-xl bg-slate-800/40 text-2xl font-black text-slate-200 active:scale-95">{num}</button>))}<button onClick={() => handleFastEnter()} className={`h-14 col-span-2 rounded-xl ${colBg} text-slate-950 text-lg font-black uppercase active:scale-95`}>Enter</button></div>
          </div>
        )}
      </div>
    </div>
  );
}