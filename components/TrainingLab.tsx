'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftIcon, ArrowPathIcon, ArrowUturnLeftIcon, ChartBarIcon, PlayIcon } from '@heroicons/react/24/outline';
import type { Language } from '@/app/page';
import type { Dart } from '@/lib/x01';
import { adaptiveTargetAt, createTrainingSession, evaluateTraining, isTrainingSession, TRAINING_MODES, trainingTimeLimit, type TrainingMode, type TrainingSession } from '@/lib/training';
import { completedPlanDays, createTrainingPlan, isTrainingPlan, replanTrainingPlan, suggestedPlanFocus, type PlanFocus, type TrainingPlan } from '@/lib/trainingPlan';

type TrainingRecord = { id: string; mode: TrainingMode; score: number; hits: number; darts: number; completed: boolean; date: string; planId?: string; planDay?: number };

const FOCUS_LABEL = {
  balanced: { hu: 'Általános fejlődés', en: 'Balanced progress' },
  doubles: { hu: 'Duplák és kiszállók', en: 'Doubles and checkouts' },
  scoring: { hu: 'Ponttermelés', en: 'Scoring' },
  bull: { hu: 'Bull és célzás', en: 'Bull and accuracy' },
};

const COPY: Record<TrainingMode, { hu: string; en: string; huRule: string; enRule: string; accent: string }> = {
  double_ladder: { hu: 'Duplalétra', en: 'Double ladder', huRule: 'D1-től D20-ig haladj. Találatkor lépsz tovább. Legfeljebb 60 nyíl.', enRule: 'Climb from D1 to D20. Each hit advances you. Up to 60 darts.', accent: 'emerald' },
  random_doubles: { hu: 'Véletlen duplák időre', en: 'Timed random doubles', huRule: '20 véletlen dupla egymás után, 3 perc és legfeljebb 60 nyíl alatt.', enRule: 'Hit 20 random doubles in order within 3 minutes and 60 darts.', accent: 'cyan' },
  treble100: { hu: '100 nyíl a T20-ra', en: '100 darts at T20', huRule: 'Dobj 100 nyilat. Minden T20 találat számít; az összpontot is látod.', enRule: 'Throw 100 darts. Count T20 hits and total points.', accent: 'rose' },
  switch30: { hu: 'Tripla váltás', en: 'Treble switch', huRule: '30 nyíl: T20, T19, T18 ismétlődő sorrendben.', enRule: '30 darts: T20, T19 and T18 in repeating order.', accent: 'amber' },
  adaptive30: { hu: 'Alkalmazkodó célzás', en: 'Adaptive targeting', huRule: '10 kör, körönként 3 nyíl. Két találattal nehezebb cél jön; nulla találattal egy szinttel könnyebb. A következő cél mindig az előző körödből számolódik.', enRule: 'Ten rounds of three darts. Two hits raise the difficulty; no hits lower it. Your next target follows your actual results.', accent: 'cyan' },
  pressure_duel: { hu: 'Nyomáspárbaj', en: 'Pressure duel', huRule: '75 másodperc, legfeljebb 9 nyíl. A rivális három köre 60, 70 és 80 pont: 210 fölé kell jutnod, mielőtt elfogy az idő vagy a nyíl.', enRule: 'Seventy-five seconds and up to nine darts. The rival scores 60, 70 and 80 in three visits. Beat 210 before time or darts run out.', accent: 'purple' },
  bull30: { hu: 'Bull rutin', en: 'Bull routine', huRule: '30 nyíl a bullra. Külső bull 1, belső bull 2 pont.', enRule: '30 darts at the bull. Outer scores 1, inner scores 2.', accent: 'purple' },
  countup: { hu: 'Count-Up', en: 'Count-Up', huRule: '8 kör, összesen 24 nyíl. Gyűjts minél több pontot.', enRule: '8 rounds, 24 darts total. Score as many points as you can.', accent: 'emerald' },
  shanghai: { hu: 'Shanghai', en: 'Shanghai', huRule: '1-től 7-ig körönként 3 nyíl az aktuális szektorra. Sima + dupla + tripla egy körben: azonnali Shanghai.', enRule: 'Three darts per round on sectors 1 to 7. Single, double and treble in one round wins a Shanghai.', accent: 'rose' },
  halveit: { hu: 'Halve-It', en: 'Halve-It', huRule: '20, 19, 18, 17, 16, 15, Bull; három nyíl célonként. Ha nincs találat, feleződik a pontod.', enRule: '20, 19, 18, 17, 16, 15, Bull; three darts each. Miss all three and your score is halved.', accent: 'cyan' },
  baseball: { hu: 'Baseball darts', en: 'Baseball darts', huRule: '9 inning: minden körben az inning számát célozd. Sima 1, dupla 2, tripla 3 futás.', enRule: '9 innings: target that inning’s number. Single scores 1 run, double 2, treble 3.', accent: 'amber' },
  checkout170: { hu: '170-es kiszálló', en: '170 checkout', huRule: 'Három nyílból szállj ki 170-ről, dupla vagy belső bull legyen az utolsó.', enRule: 'Check out 170 in three darts, ending on a double or inner bull.', accent: 'rose' },
  ladder121: { hu: 'Fokozatos 121', en: 'Progressive 121', huRule: 'Szállj ki 121-ről, majd 122–125-ről. Mindegyikre legfeljebb 9 nyíl jut; dupla vagy belső bull legyen az utolsó.', enRule: 'Check out 121, then 122–125. You have up to 9 darts per target and must finish on a double or inner bull.', accent: 'emerald' },
  pressure60: { hu: '60 másodperces nyomás', en: '60-second pressure', huRule: 'Egy perc alatt gyűjts minél több pontot. Az óra fut, a dobásokat rögzíted.', enRule: 'Score as many points as possible in one minute. The clock runs while you record darts.', accent: 'purple' },
};

const ACCENT: Record<string, { text: string; border: string; glow: string }> = {
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500/40', glow: 'bg-emerald-500/10' },
  cyan: { text: 'text-cyan-400', border: 'border-cyan-500/40', glow: 'bg-cyan-500/10' },
  rose: { text: 'text-rose-400', border: 'border-rose-500/40', glow: 'bg-rose-500/10' },
  amber: { text: 'text-amber-400', border: 'border-amber-500/40', glow: 'bg-amber-500/10' },
  purple: { text: 'text-purple-400', border: 'border-purple-500/40', glow: 'bg-purple-500/10' },
};

function readSession(): TrainingSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem('dartisan_training_session') || 'null');
    return isTrainingSession(value) ? value : null;
  } catch { return null; }
}

function readRecords(): TrainingRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem('dartisan_training_records') || '[]');
    return Array.isArray(value) ? value.filter((row): row is TrainingRecord =>
      row && TRAINING_MODES.includes(row.mode) && Number.isFinite(row.score) && Number.isInteger(row.hits) &&
      Number.isInteger(row.darts) && typeof row.date === 'string' && typeof row.id === 'string').slice(0, 100) : [];
  } catch { return []; }
}

function readPlan(): TrainingPlan | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem('dartisan_training_plan') || 'null');
    return isTrainingPlan(value) ? value : null;
  } catch { return null; }
}

function formatDart(dart: Dart): string {
  if (dart.val === 0) return 'M';
  if (dart.val === 25) return dart.mult === 2 ? 'BULL' : '25';
  return `${dart.mult === 1 ? 'S' : dart.mult === 2 ? 'D' : 'T'}${dart.val}`;
}

export function TrainingLab({ lang, onBack, profileFocus }: { lang: Language; onBack: () => void; profileFocus?: PlanFocus }) {
  const [session, setSession] = useState<TrainingSession | null>(readSession);
  const [records, setRecords] = useState<TrainingRecord[]>(readRecords);
  const [plan, setPlan] = useState<TrainingPlan | null>(readPlan);
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const result = session ? evaluateTraining(session, new Date(clockNow)) : null;
  const isHu = lang === 'hu';

  useEffect(() => {
    if (session) localStorage.setItem('dartisan_training_session', JSON.stringify(session));
    else localStorage.removeItem('dartisan_training_session');
  }, [session]);

  useEffect(() => {
    localStorage.setItem('dartisan_training_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    if (plan) localStorage.setItem('dartisan_training_plan', JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [session?.mode]);

  const saveFinished = useCallback((finishedSession: TrainingSession) => {
    const finishedResult = evaluateTraining(finishedSession);
    if (!finishedResult.finished) return;
    const id = `${finishedSession.startedAt}-${finishedSession.mode}`;
    const record: TrainingRecord = {
      id, mode: finishedSession.mode, score: finishedResult.score, hits: finishedResult.hits,
      darts: finishedResult.progress, completed: finishedResult.completed, date: new Date().toISOString(),
      planId: finishedSession.planId, planDay: finishedSession.planDay,
    };
    setRecords(prev => prev.some(item => item.id === id) ? prev : [record, ...prev].slice(0, 100));
  }, []);

  useEffect(() => {
    if (!session || trainingTimeLimit(session.mode) === null || result?.finished) return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [session, result?.finished]);

  useEffect(() => {
    if (!session || !result?.finished) return;
    const timeout = window.setTimeout(() => saveFinished(session), 0);
    return () => window.clearTimeout(timeout);
  }, [session, result?.finished, saveFinished]);

  const start = (mode: TrainingMode, planDay?: number) => {
    const newSession = createTrainingSession(mode, Math.random, plan && planDay !== undefined ? { id: plan.id, day: planDay } : undefined);
    setSession(newSession);
    setClockNow(Date.parse(newSession.startedAt));
    setMult(1);
  };

  const throwDart = (val: number, multiplier = mult) => {
    if (!session || evaluateTraining(session).finished) return;
    const dart: Dart = { val, mult: val === 0 ? 1 : multiplier };
    const next = { ...session, darts: [...session.darts, dart] };
    setSession(next);
  };

  const exportCsv = () => {
    const rows = ['date,mode,score,hits,darts,completed', ...records.map(r =>
      [r.date, r.mode, r.score, r.hits, r.darts, r.completed].join(','))];
    const url = URL.createObjectURL(new Blob(['\uFEFF', rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dartisan-edzesek.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentCopy = session ? COPY[session.mode] : null;
  const currentAccent = currentCopy ? ACCENT[currentCopy.accent] : null;
  const modeRecords = session ? records.filter(r => r.mode === session.mode) : [];
  const bestByHits = session && ['double_ladder', 'random_doubles', 'treble100', 'switch30', 'bull30', 'adaptive30'].includes(session.mode);
  const modeCount = TRAINING_MODES.length;
  const personalBest = modeRecords.length ? Math.max(...modeRecords.map(r => bestByHits ? r.hits : r.score)) : null;
  const planCompleted = plan ? completedPlanDays(plan, records) : new Set<number>();
  const suggestedFocus = suggestedPlanFocus(records, profileFocus);
  const revisedPlan = plan ? replanTrainingPlan(plan, records) : null;
  const adaptiveState = session?.mode === 'adaptive30' ? adaptiveTargetAt(session.darts) : null;
  const previousAdaptiveState = session?.mode === 'adaptive30' && session.darts.length >= 3
    ? adaptiveTargetAt(session.darts.slice(0, Math.floor((session.darts.length - 1) / 3) * 3)) : null;

  return (
    <div className="min-h-full w-full bg-[#0b0d11] text-slate-200 px-4 sm:px-7 lg:px-10 pt-[calc(1rem+var(--app-safe-top))] pb-16">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center gap-4 mb-7 sm:mb-9">
          <button type="button" onClick={session ? () => setSession(null) : onBack} aria-label={isHu ? 'Vissza' : 'Back'} className="h-11 w-11 shrink-0 rounded-xl border border-slate-700 bg-[#171b23] flex items-center justify-center hover:bg-slate-800"><ArrowLeftIcon className="h-5 w-5" /></button>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">DARTISAN / {isHu ? 'EDZÉS' : 'TRAINING'}</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase italic tracking-tight leading-tight">{isHu ? 'Edzéslabor' : 'Training lab'}</h1>
          </div>
        </header>

        {!session ? (
          <>
            <div className="rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 via-[#151a23] to-[#101216] p-5 sm:p-7 mb-6">
              <p className="text-cyan-300 text-xs font-black uppercase tracking-widest mb-2">{modeCount} {isHu ? 'játszható edzés' : 'playable drills'}</p>
              <p className="text-white text-lg sm:text-xl font-bold max-w-2xl">{isHu ? 'Válassz célpontot, rögzíts minden nyilat, és kövesd a saját rekordodat.' : 'Pick a drill, record every dart and track your personal best.'}</p>
              <p className="text-slate-400 text-xs mt-3">{isHu ? 'Az eredmények ezen az eszközön tárolódnak.' : 'Results are saved on this device.'}</p>
            </div>
            <section className="rounded-3xl border border-emerald-500/25 bg-[#121a1b] p-5 sm:p-7 mb-6" aria-label={isHu ? 'Négyhetes edzésterv' : 'Four-week training plan'}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-black">{isHu ? '4 hét · 20 edzés' : '4 weeks · 20 drills'}</p>
                  <h2 className="text-xl sm:text-2xl font-black uppercase text-white mt-1">{isHu ? 'Személyre szabott edzésterv' : 'Personal training plan'}</h2>
                  <p className="text-xs text-slate-300 mt-2 max-w-2xl">{plan
                    ? `${isHu ? 'Fókusz' : 'Focus'}: ${isHu ? FOCUS_LABEL[plan.focus].hu : FOCUS_LABEL[plan.focus].en}. ${planCompleted.size}/20 ${isHu ? 'kész' : 'done'}.`
                    : `${records.length || profileFocus ? (isHu ? 'A mentett dobások és meccsek alapján javasolt fókusz' : 'Suggested focus from saved darts and matches') : (isHu ? 'Kezdő fókusz' : 'Starting focus')}: ${isHu ? FOCUS_LABEL[suggestedFocus].hu : FOCUS_LABEL[suggestedFocus].en}. ${isHu ? 'Heti öt edzés, saját tempóban.' : 'Five drills per week, at your own pace.'}`}</p>
                </div>
                {!plan && <button type="button" onClick={() => setPlan(createTrainingPlan(records, new Date(), crypto.randomUUID(), profileFocus))} className="h-11 px-5 shrink-0 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black uppercase hover:bg-emerald-400">{isHu ? 'Terv indítása' : 'Start plan'}</button>}
              </div>
              {plan && <div className="mt-5"><div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase text-slate-300"><span>{isHu ? 'Négyhetes haladás' : 'Four-week progress'}</span><span>{Math.round(planCompleted.size / 20 * 100)}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label={isHu ? 'Négyhetes edzésterv haladása' : 'Four-week training progress'} aria-valuenow={planCompleted.size} aria-valuemin={0} aria-valuemax={20}><div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${planCompleted.size / 20 * 100}%` }} /></div></div>}
              {plan && revisedPlan && revisedPlan !== plan && <button type="button" onClick={() => setPlan(revisedPlan)} className="mt-4 min-h-11 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 text-xs font-black uppercase text-cyan-200 hover:bg-cyan-500/20">{isHu ? `Következő hetek áttervezése: ${FOCUS_LABEL[revisedPlan.focus].hu}` : `Adapt remaining weeks: ${FOCUS_LABEL[revisedPlan.focus].en}`}</button>}
              {plan && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
                {Array.from({ length: 4 }, (_, week) => <div key={week} className="rounded-2xl border border-slate-700/70 bg-[#0b0d11] p-4">
                  <h3 className="text-xs uppercase tracking-widest text-emerald-400 font-black mb-3">{week + 1}. {isHu ? 'hét' : 'week'} <span className="float-right text-slate-400">{plan.days.slice(week * 5, week * 5 + 5).filter((_, day) => planCompleted.has(week * 5 + day)).length}/5</span></h3>
                  <div className="space-y-2">{plan.days.slice(week * 5, week * 5 + 5).map((mode, day) => {
                    const index = week * 5 + day;
                    const done = planCompleted.has(index);
                    return <button type="button" key={index} onClick={() => start(mode, index)} className={`w-full min-h-12 flex items-center gap-3 text-left rounded-xl px-3 py-2 border transition-colors ${done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-[#151920] text-white hover:border-emerald-500/50'}`}>
                      <span className="w-6 shrink-0 font-mono font-black text-xs">{done ? '✓' : `${day + 1}.`}</span>
                      <span className="text-xs font-bold leading-tight">{isHu ? COPY[mode].hu : COPY[mode].en}</span>
                    </button>;
                  })}</div>
                </div>)}
              </div>}
            </section>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              {TRAINING_MODES.map((mode, index) => {
                const copy = COPY[mode];
                const accent = ACCENT[copy.accent];
                const last = records.find(r => r.mode === mode);
                return (
                  <button key={mode} type="button" onClick={() => start(mode)} className={`min-h-44 rounded-2xl border ${accent.border} ${accent.glow} p-5 text-left flex flex-col hover:-translate-y-1 hover:bg-slate-800/80 transition-all focus-visible:outline-2 focus-visible:outline-cyan-400`}>
                    <span className={`text-xs font-black tracking-widest ${accent.text}`}>{String(index + 1).padStart(2, '0')} / {String(modeCount).padStart(2, '0')}</span>
                    <h2 className="text-lg sm:text-xl font-black uppercase text-white mt-3 mb-2">{isHu ? copy.hu : copy.en}</h2>
                    <p className="text-xs text-slate-300 leading-relaxed flex-1">{isHu ? copy.huRule : copy.enRule}</p>
                    <span className={`text-xs font-black uppercase mt-4 flex items-center gap-2 ${accent.text}`}><PlayIcon className="h-4 w-4" />{last ? (isHu ? 'Újra' : 'Play again') : (isHu ? 'Indítás' : 'Start')}</span>
                  </button>
                );
              })}
            </div>
            {records.length > 0 && (
              <section className="mt-8 rounded-3xl border border-slate-800 bg-[#12141a] p-5 sm:p-7">
                <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
                  <h2 className="text-lg font-black text-white uppercase flex items-center gap-2"><ChartBarIcon className="h-5 w-5 text-cyan-400" />{isHu ? 'Legutóbbi edzések' : 'Recent training'}</h2>
                  <button type="button" onClick={exportCsv} className="text-xs font-black text-cyan-400 border border-cyan-500/30 rounded-lg px-3 py-2 hover:bg-cyan-500/10">CSV export</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {records.slice(0, 8).map(r => <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#0b0d11] px-4 py-3 border border-slate-800 text-xs">
                    <div className="min-w-0"><div className="font-black text-white truncate">{isHu ? COPY[r.mode].hu : COPY[r.mode].en}</div><div className="text-slate-500 mt-1">{new Date(r.date).toLocaleDateString(isHu ? 'hu-HU' : 'en-US')} • {r.darts} {isHu ? 'nyíl' : 'darts'}</div></div>
                    <div className="font-mono font-black text-cyan-400 shrink-0">{r.score} {r.mode === 'ladder121' ? (isHu ? 'kiszálló' : 'checkouts') : (isHu ? 'pont' : 'pts')} · {r.hits} {isHu ? 'találat' : 'hits'}</div>
                  </div>)}
                </div>
              </section>
            )}
          </>
        ) : result && currentCopy && currentAccent && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 lg:gap-8 items-start">
            <div className="space-y-4">
              <div className={`rounded-3xl border ${currentAccent.border} ${currentAccent.glow} p-5 sm:p-7`}>
                <div className="flex items-start justify-between gap-4">
                  <div><p className={`text-xs font-black uppercase tracking-widest ${currentAccent.text}`}>{isHu ? 'Aktív edzés' : 'Active drill'}</p><h2 className="text-2xl sm:text-3xl font-black uppercase text-white mt-1">{isHu ? currentCopy.hu : currentCopy.en}</h2></div>
                  <button type="button" onClick={() => start(session.mode, session.planId === plan?.id ? session.planDay : undefined)} aria-label={isHu ? 'Újrakezdés' : 'Restart'} className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center hover:text-white"><ArrowPathIcon className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mt-3">{isHu ? currentCopy.huRule : currentCopy.enRule}</p>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="rounded-2xl bg-[#0b0d11] border border-slate-800 p-4"><p className="text-[10px] font-black text-slate-500 uppercase">{session.mode === 'pressure_duel' ? (isHu ? 'Győzelemhez' : 'To win') : (isHu ? 'Célpont' : 'Target')}</p><p className={`text-3xl sm:text-4xl font-black font-mono mt-1 ${currentAccent.text}`}>{result.target === 'Kész' && !isHu ? 'Done' : result.target}</p></div>
                  <div className="rounded-2xl bg-[#0b0d11] border border-slate-800 p-4"><p className="text-[10px] font-black text-slate-500 uppercase">{session.mode === 'ladder121' ? (isHu ? 'Kiszálló / találat' : 'Checkouts / hits') : (isHu ? 'Pont / találat' : 'Score / hits')}</p><p className="text-3xl sm:text-4xl font-black font-mono text-white mt-1">{result.score}<span className="text-sm text-slate-500 ml-2">/ {result.hits}</span></p></div>
                </div>
                <div className="mt-5 flex justify-between text-xs font-black text-slate-400"><span>{result.detail}</span><span>{result.progress}/{result.total} {isHu ? 'nyíl' : 'darts'}</span></div>
                {result.opponentScore !== null && <div className="mt-4 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3" aria-label={isHu ? 'Virtuális ellenfél állása' : 'Virtual rival score'}><div className="flex justify-between text-xs font-black uppercase text-purple-200"><span>{isHu ? 'Virtuális rivális' : 'Virtual rival'}</span><span className="font-mono">{result.opponentScore} / 210</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-purple-400" style={{ width: `${result.opponentScore / 210 * 100}%` }} /></div></div>}
                {result.remainingSeconds !== null && !result.finished && <p role="timer" className={`text-2xl font-black font-mono mt-4 ${result.remainingSeconds <= 10 ? 'text-rose-400' : 'text-cyan-300'}`}>{Math.floor(result.remainingSeconds / 60)}:{String(result.remainingSeconds % 60).padStart(2, '0')} <span className="text-xs uppercase text-slate-400">{isHu ? 'hátralévő idő' : 'remaining'}</span></p>}
                <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${result.finished ? 100 : Math.min(100, 100 * result.progress / result.total)}%` }} /></div>
                {adaptiveState && <div className="mt-5" aria-label={isHu ? 'Adaptív célszintek' : 'Adaptive target levels'}>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">{['S20', 'T20', 'T19', 'D20', 'D16', 'BULL'].map((target, index) => <span key={target} className={`rounded-lg border px-1 py-2 text-center font-mono text-xs font-black ${index === adaptiveState.level && !result.finished ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-slate-800 bg-[#0b0d11] text-slate-500'}`}>{target}</span>)}</div>
                  {session.darts.length >= 3 && session.darts.length % 3 === 0 && previousAdaptiveState && !result.finished && <p role="status" className="mt-2 text-xs font-semibold text-cyan-200">{adaptiveState.level > previousAdaptiveState.level ? (isHu ? 'Két vagy több találat: nehezebb cél következik.' : 'Two or more hits: the next target is harder.') : adaptiveState.level < previousAdaptiveState.level ? (isHu ? 'Találat nélkül: könnyebb cél következik.' : 'No hits: the next target is easier.') : (isHu ? 'A cél szintje most nem változott.' : 'The target level stays the same.')}</p>}
                </div>}
                {personalBest !== null && <p className="text-xs text-amber-400 font-bold mt-4">{isHu ? 'Személyes rekord ezen az eszközön' : 'Personal best on this device'}: {personalBest} {session.mode === 'ladder121' ? (isHu ? 'kiszálló' : 'checkouts') : bestByHits ? (isHu ? 'találat' : 'hits') : (isHu ? 'pont' : 'pts')}</p>}
                {result.finished && <div role="status" className={`mt-5 rounded-xl border p-4 font-black ${session.mode === 'pressure_duel' && !result.completed ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>{session.mode === 'pressure_duel' ? (result.completed ? (isHu ? 'Megnyerted a párbajt!' : 'You won the duel!') : (isHu ? 'A rivális nyert. Próbáld újra!' : 'The rival won. Try again!')) : (isHu ? 'Edzés befejezve!' : 'Drill complete!')} {result.detail}</div>}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#12141a] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-3"><h3 className="text-xs font-black uppercase text-slate-400">{isHu ? 'Utolsó nyilak' : 'Recent darts'}</h3><button type="button" disabled={!session.darts.length || result.finished} onClick={() => setSession({ ...session, darts: session.darts.slice(0, -1) })} className="flex items-center gap-1 text-xs font-black text-cyan-400 disabled:opacity-30"><ArrowUturnLeftIcon className="h-4 w-4" />{isHu ? 'Visszavonás' : 'Undo'}</button></div>
                <div className="flex flex-wrap gap-2 min-h-9">{session.darts.slice(-12).map((dart, index) => <span key={`${session.darts.length}-${index}`} className="px-2.5 py-1.5 bg-slate-800 rounded-lg font-mono text-xs font-black text-white">{formatDart(dart)}</span>)}{session.darts.length === 0 && <span className="text-xs text-slate-500">{isHu ? 'Még nincs dobás.' : 'No darts yet.'}</span>}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-[#12141a] p-4 sm:p-6 lg:p-7 shadow-2xl">
              <h3 className="text-sm font-black text-white uppercase mb-1">{isHu ? 'Nyíl rögzítése' : 'Record a dart'}</h3>
              <p className="text-xs text-slate-400 mb-5">{isHu ? 'Válaszd ki a szorzót, majd az eltalált szektort. A mellé dobott nyíl: M.' : 'Choose a multiplier, then the hit sector. Use M for a miss.'}</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {([1, 2, 3] as const).map(value => <button type="button" key={value} disabled={result.finished} onClick={() => setMult(value)} aria-pressed={mult === value} className={`h-12 rounded-xl text-sm font-black border ${mult === value ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-[#0b0d11] text-slate-300 border-slate-700 hover:border-cyan-500/50'} disabled:opacity-50`}>{value === 1 ? (isHu ? 'Sima' : 'Single') : value === 2 ? (isHu ? 'Dupla' : 'Double') : (isHu ? 'Tripla' : 'Treble')}</button>)}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 20 }, (_, i) => i + 1).map(number => <button type="button" key={number} disabled={result.finished} onClick={() => throwDart(number)} className="h-12 sm:h-13 rounded-xl bg-[#0b0d11] border border-slate-700 text-white font-black font-mono hover:bg-slate-700 hover:border-cyan-500/50 active:scale-95 disabled:opacity-40">{number}</button>)}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button type="button" disabled={result.finished} onClick={() => throwDart(0)} className="h-12 rounded-xl border border-slate-700 bg-[#0b0d11] text-slate-300 font-black hover:bg-slate-700 disabled:opacity-40">M</button>
                <button type="button" disabled={result.finished} onClick={() => throwDart(25, 1)} className="h-12 rounded-xl border border-slate-700 bg-[#0b0d11] text-amber-300 font-black hover:bg-slate-700 disabled:opacity-40">25</button>
                <button type="button" disabled={result.finished} onClick={() => throwDart(25, 2)} className="h-12 rounded-xl border border-slate-700 bg-[#0b0d11] text-rose-400 font-black hover:bg-slate-700 disabled:opacity-40">BULL</button>
              </div>
              {result.finished && <button type="button" onClick={() => setSession(null)} className="w-full h-12 rounded-xl bg-cyan-500 text-slate-950 font-black uppercase text-sm mt-5">{isHu ? 'Vissza az edzésekhez' : 'Back to drills'}</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
