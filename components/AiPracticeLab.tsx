'use client';

import { useMemo, useState } from 'react';
import { ArrowTrendingUpIcon, PlayIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { User } from 'firebase/auth';
import type { Language } from '@/app/page';
import type { MatchConfig } from './SetupScreen';
import type { DartsDna } from '../lib/dartsDna';
import { checkoutRoutes, dartName } from '../lib/checkoutRoutes';
import { parseDrillTarget } from '../lib/targetDrill';
import { weeklyGoal, type DatedDnaMatch } from '../lib/weeklyGoal';
import type { CheckoutRule } from '../lib/x01';

export function AiPracticeLab({ dna, matches, lang, currentUser, onStartDrill }: {
  dna: DartsDna;
  matches: DatedDnaMatch[];
  lang: Language;
  currentUser: User | null;
  onStartDrill: (config: MatchConfig) => void;
}) {
  const hu = lang === 'hu';
  const [scoreText, setScoreText] = useState('121');
  const [dartsLeft, setDartsLeft] = useState<1 | 2 | 3>(3);
  const [rule, setRule] = useState<CheckoutRule>('double');
  const score = Number(scoreText);
  const validScore = /^\d+$/.test(scoreText) && Number.isInteger(score) && score >= 1 && score <= 170;
  const routes = useMemo(() => checkoutRoutes(validScore ? score : 0, dartsLeft, rule), [validScore, score, dartsLeft, rule]);
  const target = parseDrillTarget(dna.weakestTarget?.target) || parseDrillTarget('T20')!;
  const goal = weeklyGoal(matches);
  const goalTitle = goal.kind === 'matches' ? (hu ? 'Játssz 2 meccset' : 'Play 2 matches')
    : goal.kind === 'checkout' ? (hu ? `3 meccs legalább ${goal.threshold}% kiszállóval` : `3 matches with ${goal.threshold}%+ checkout`)
      : goal.kind === 'first9' ? (hu ? `3 meccs ${goal.threshold}+ első 9-es átlaggal` : `3 matches with ${goal.threshold}+ first-nine average`)
        : (hu ? `3 meccs ${goal.threshold}+ háromnyilas átlaggal` : `3 matches with ${goal.threshold}+ three-dart average`);
  const startMatch = (kind: 'drill' | 'goal') => onStartDrill({
    gameMode: kind === 'drill' ? 'practice' : 'x01',
    practiceType: kind === 'drill' ? 'ai_drill' : undefined,
    drillTarget: kind === 'drill' ? target.val : undefined,
    drillTargetKey: kind === 'drill' ? target.key : undefined,
    startingScore: kind === 'drill' ? 0 : 501,
    setsToWin: 1, legsToWin: 1, checkIn: 'single', checkout: 'double', muteCaller: false,
    players: [
      { name: currentUser?.displayName || (hu ? 'Játékos' : 'Player'), isBot: false, difficulty: 5, color: 'cyan' },
      ...(kind === 'goal' ? [{ name: hu ? 'Edzőpartner' : 'Training partner', isBot: true, difficulty: Math.max(2, Math.min(8, Math.round((dna.average || 50) / 10))), color: 'purple' as const }] : []),
    ],
  });

  return <section className="mb-6 grid lg:grid-cols-2 gap-3" aria-label={hu ? 'Kiszálló és személyes edzés' : 'Checkout and personal training'}>
    <div className="rounded-3xl border border-cyan-500/25 bg-[#121821] p-5 sm:p-7">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">DARTS DNA / 03</span>
      <h2 className="mt-1 text-xl sm:text-2xl font-black uppercase italic text-white">{hu ? 'Kiszállóútvonalak' : 'Checkout routes'}</h2>
      <p className="mt-2 mb-5 text-xs sm:text-sm text-slate-400">{hu ? 'Adj meg egy maradékot és a rendelkezésre álló nyilakat. A célpontok szabályosan ellenőrzött lehetőségek, nem találati garanciák.' : 'Enter a remaining score and darts left. These are rules-checked options, not guaranteed hits.'}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[10px] font-black uppercase text-slate-400"><span>{hu ? 'Maradék pont' : 'Remaining'}</span><input type="number" min="1" max="170" inputMode="numeric" value={scoreText} onChange={event => setScoreText(event.target.value)} className="h-12 w-28 rounded-xl border border-slate-600 bg-slate-950 px-3 text-xl font-black tabular-nums text-white outline-none focus:border-cyan-400" /></label>
        <div className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase text-slate-400">{hu ? 'Nyíl maradt' : 'Darts left'}</span><div className="flex gap-1">{([1, 2, 3] as const).map(count => <button type="button" key={count} onClick={() => setDartsLeft(count)} aria-pressed={dartsLeft === count} className={`h-12 w-11 rounded-xl border text-sm font-black ${dartsLeft === count ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-600 bg-slate-950 text-slate-300'}`}>{count}</button>)}</div></div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-4" role="group" aria-label={hu ? 'Kiszállószabály' : 'Checkout rule'}>{([['double', hu ? 'Dupla' : 'Double'], ['master', 'Master'], ['single', hu ? 'Sima' : 'Single']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setRule(value)} aria-pressed={rule === value} className={`min-h-10 rounded-xl border px-3 text-[11px] font-black uppercase ${rule === value ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-950/50 text-slate-400'}`}>{label}</button>)}</div>
      <div className="mt-5 space-y-2" aria-live="polite">{!validScore ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{hu ? 'Adj meg 1 és 170 közötti egész pontszámot.' : 'Enter a whole number from 1 to 170.'}</p> : routes.kind === 'none' ? <p className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-300">{hu ? 'Ennyi nyílból nincs szabályos kiszálló vagy értelmes előkészítés. Válassz több nyilat, vagy folytasd a pontgyűjtést.' : 'No legal finish or useful setup with these darts. Select more darts or keep scoring.'}</p> : <><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{routes.kind === 'finish' ? (hu ? 'Lehetséges kiszállók' : 'Possible finishes') : (hu ? 'Kiszálló nincs · előkészítés' : 'No finish · setup routes')}</p>{routes.routes.map((route, index) => <div key={`${route.remaining}-${route.darts.map(dartName).join('-')}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/50 p-3"><div className="min-w-0"><span className="text-[10px] font-black text-cyan-300">{index === 0 ? (hu ? 'AJÁNLOTT' : 'SUGGESTED') : (hu ? 'ALTERNATÍVA' : 'ALTERNATIVE')}</span><strong className="block break-words text-base sm:text-lg font-black text-white">{route.darts.map(dartName).join(' → ')}</strong></div><span className="shrink-0 text-right text-[10px] font-bold text-slate-400">{route.remaining ? `${hu ? 'marad' : 'left'} ${route.remaining}` : (hu ? 'kiszálló' : 'finish')}<span className="block mt-1">{route.risk === 'low' ? (hu ? 'kisebb kockázat' : 'lower risk') : route.risk === 'high' ? (hu ? 'nagyobb kockázat' : 'higher risk') : (hu ? 'közepes kockázat' : 'medium risk')}</span></span></div>)}</>}</div>
    </div>
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl border border-[#b655ff]/25 bg-[#151821] p-5 sm:p-7 flex-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c783ff]">DARTS DNA / 04</span>
        <h2 className="mt-1 text-xl sm:text-2xl font-black uppercase italic text-white">{hu ? 'Gyenge pontból erősség' : 'Turn a weak target around'}</h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">{dna.weakestTarget ? (hu ? `A ${target.key} célpontra ${dna.weakestTarget.hits}/${dna.weakestTarget.attempts} találatot mértünk. Egy 30 nyilas gyakorlattal nézd meg, most hol tartasz.` : `You hit ${target.key} ${dna.weakestTarget.hits}/${dna.weakestTarget.attempts} times. Check your current level in a 30-dart drill.`) : (hu ? 'Még nincs elég célzott mérés. Kezdj egy 30 nyilas T20 alapedzéssel; a célzott dobások később személyre szabják ezt a feladatot.' : 'Not enough aimed darts yet. Start with a 30-dart T20 baseline; later aimed darts will personalize this drill.')}</p>
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/50 p-4"><strong className="text-3xl font-black text-white">{target.key}</strong><span className="text-xs font-bold text-slate-400">30 {hu ? 'nyíl' : 'darts'}<br />0 $ OpenAI</span></div>
        <button type="button" onClick={() => startMatch('drill')} className="mt-4 min-h-12 w-full rounded-xl bg-[#b655ff] px-5 text-xs font-black uppercase text-slate-950 inline-flex items-center justify-center gap-2"><PlayIcon className="h-4 w-4" />{hu ? 'Célzott edzés indítása' : 'Start target drill'}</button>
      </div>
      <div className="rounded-3xl border border-cyan-500/25 bg-[#121821] p-5 sm:p-7">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">DARTS DNA / 05</span>
        <h2 className="mt-1 text-xl sm:text-2xl font-black uppercase italic text-white">{hu ? 'Személyes heti cél' : 'Personal weekly goal'}</h2>
        <p className="mt-2 text-sm font-bold text-white">{goalTitle}</p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={goal.target} aria-label={hu ? 'Heti cél állása' : 'Weekly goal progress'}><div className="h-full rounded-full bg-cyan-400" style={{ width: `${goal.progress / goal.target * 100}%` }} /></div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400"><span>{goal.progress}/{goal.target} {hu ? 'teljesítve' : 'completed'}</span><span><ArrowTrendingUpIcon className="inline h-4 w-4" /> {goal.weekStart}</span></div>
        <p className="mt-3 text-xs text-slate-400">{hu ? 'A bejelentkezve befejezett X01 meccsek alapján számoljuk. Hétfőn új hét kezdődik.' : 'Based on completed signed-in X01 matches. A new week starts Monday.'}</p>
        {!currentUser && <p className="mt-2 text-xs font-bold text-cyan-200">{hu ? 'Jelentkezz be a meccs előtt, hogy beleszámítson a heti célba.' : 'Sign in before the match for it to count toward your weekly goal.'}</p>}
        <button type="button" onClick={() => startMatch('goal')} className="mt-4 min-h-11 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 text-xs font-black uppercase text-cyan-200 inline-flex items-center gap-2"><SparklesIcon className="h-4 w-4" />{hu ? '501 meccs indítása' : 'Start a 501 match'}</button>
      </div>
    </div>
  </section>;
}
