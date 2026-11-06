'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftIcon, ArrowPathIcon, ArrowUturnLeftIcon, ChartBarIcon, PlayIcon } from '@heroicons/react/24/outline';
import type { Language } from '@/app/page';
import type { Dart } from '@/lib/x01';
import { createTrainingSession, evaluateTraining, isTrainingSession, TRAINING_MODES, type TrainingMode, type TrainingSession } from '@/lib/training';

type TrainingRecord = { id: string; mode: TrainingMode; score: number; hits: number; darts: number; completed: boolean; date: string };

const COPY: Record<TrainingMode, { hu: string; en: string; huRule: string; enRule: string; accent: string }> = {
  double_ladder: { hu: 'Duplalétra', en: 'Double ladder', huRule: 'D1-től D20-ig haladj. Találatkor lépsz tovább. Legfeljebb 60 nyíl.', enRule: 'Climb from D1 to D20. Each hit advances you. Up to 60 darts.', accent: 'emerald' },
  random_doubles: { hu: 'Véletlen duplák', en: 'Random doubles', huRule: '20 véletlen dupla egymás után, legfeljebb 60 nyílból.', enRule: 'Hit 20 random doubles in order, within 60 darts.', accent: 'cyan' },
  treble100: { hu: '100 nyíl a T20-ra', en: '100 darts at T20', huRule: 'Dobj 100 nyilat. Minden T20 találat számít; az összpontot is látod.', enRule: 'Throw 100 darts. Count T20 hits and total points.', accent: 'rose' },
  switch30: { hu: 'Tripla váltás', en: 'Treble switch', huRule: '30 nyíl: T20, T19, T18 ismétlődő sorrendben.', enRule: '30 darts: T20, T19 and T18 in repeating order.', accent: 'amber' },
  bull30: { hu: 'Bull rutin', en: 'Bull routine', huRule: '30 nyíl a bullra. Külső bull 1, belső bull 2 pont.', enRule: '30 darts at the bull. Outer scores 1, inner scores 2.', accent: 'purple' },
  countup: { hu: 'Count-Up', en: 'Count-Up', huRule: '8 kör, összesen 24 nyíl. Gyűjts minél több pontot.', enRule: '8 rounds, 24 darts total. Score as many points as you can.', accent: 'emerald' },
  shanghai: { hu: 'Shanghai', en: 'Shanghai', huRule: '1-től 7-ig körönként 3 nyíl az aktuális szektorra. Sima + dupla + tripla egy körben: azonnali Shanghai.', enRule: 'Three darts per round on sectors 1 to 7. Single, double and treble in one round wins a Shanghai.', accent: 'rose' },
  halveit: { hu: 'Halve-It', en: 'Halve-It', huRule: '20, 19, 18, 17, 16, 15, Bull; három nyíl célonként. Ha nincs találat, feleződik a pontod.', enRule: '20, 19, 18, 17, 16, 15, Bull; three darts each. Miss all three and your score is halved.', accent: 'cyan' },
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

function formatDart(dart: Dart): string {
  if (dart.val === 0) return 'M';
  if (dart.val === 25) return dart.mult === 2 ? 'BULL' : '25';
  return `${dart.mult === 1 ? 'S' : dart.mult === 2 ? 'D' : 'T'}${dart.val}`;
}

export function TrainingLab({ lang, onBack }: { lang: Language; onBack: () => void }) {
  const [session, setSession] = useState<TrainingSession | null>(readSession);
  const [records, setRecords] = useState<TrainingRecord[]>(readRecords);
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const result = session ? evaluateTraining(session) : null;
  const isHu = lang === 'hu';

  useEffect(() => {
    if (session) localStorage.setItem('dartisan_training_session', JSON.stringify(session));
    else localStorage.removeItem('dartisan_training_session');
  }, [session]);

  useEffect(() => {
    localStorage.setItem('dartisan_training_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [session?.mode]);

  const start = (mode: TrainingMode) => {
    setSession(createTrainingSession(mode));
    setMult(1);
  };

  const throwDart = (val: number, multiplier = mult) => {
    if (!session || result?.finished) return;
    const dart: Dart = { val, mult: val === 0 ? 1 : multiplier };
    const next = { ...session, darts: [...session.darts, dart] };
    const nextResult = evaluateTraining(next);
    setSession(next);
    if (nextResult.finished) {
      const record: TrainingRecord = {
        id: `${session.startedAt}-${session.mode}`, mode: session.mode, score: nextResult.score,
        hits: nextResult.hits, darts: nextResult.progress, completed: nextResult.completed, date: new Date().toISOString(),
      };
      setRecords(prev => {
        return [record, ...prev.filter(item => item.id !== record.id)].slice(0, 100);
      });
    }
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
  const bestByHits = session && ['double_ladder', 'random_doubles', 'treble100', 'switch30', 'bull30'].includes(session.mode);
  const personalBest = modeRecords.length ? Math.max(...modeRecords.map(r => bestByHits ? r.hits : r.score)) : null;

  return (
    <div className="min-h-full w-full bg-[#0b0d11] text-slate-200 px-4 sm:px-7 lg:px-10 py-6 sm:py-9 pb-16">
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
              <p className="text-cyan-300 text-xs font-black uppercase tracking-widest mb-2">{isHu ? '8 játszható edzés' : '8 playable drills'}</p>
              <p className="text-white text-lg sm:text-xl font-bold max-w-2xl">{isHu ? 'Válassz célpontot, rögzíts minden nyilat, és kövesd a saját rekordodat.' : 'Pick a drill, record every dart and track your personal best.'}</p>
              <p className="text-slate-400 text-xs mt-3">{isHu ? 'Az eredmények ezen az eszközön tárolódnak.' : 'Results are saved on this device.'}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              {TRAINING_MODES.map((mode, index) => {
                const copy = COPY[mode];
                const accent = ACCENT[copy.accent];
                const last = records.find(r => r.mode === mode);
                return (
                  <button key={mode} type="button" onClick={() => start(mode)} className={`min-h-44 rounded-2xl border ${accent.border} ${accent.glow} p-5 text-left flex flex-col hover:-translate-y-1 hover:bg-slate-800/80 transition-all focus-visible:outline-2 focus-visible:outline-cyan-400`}>
                    <span className={`text-xs font-black tracking-widest ${accent.text}`}>{String(index + 1).padStart(2, '0')} / 08</span>
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
                    <div className="font-mono font-black text-cyan-400 shrink-0">{r.score} {isHu ? 'pont' : 'pts'} · {r.hits} {isHu ? 'találat' : 'hits'}</div>
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
                  <button type="button" onClick={() => start(session.mode)} aria-label={isHu ? 'Újrakezdés' : 'Restart'} className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center hover:text-white"><ArrowPathIcon className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mt-3">{isHu ? currentCopy.huRule : currentCopy.enRule}</p>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="rounded-2xl bg-[#0b0d11] border border-slate-800 p-4"><p className="text-[10px] font-black text-slate-500 uppercase">{isHu ? 'Célpont' : 'Target'}</p><p className={`text-3xl sm:text-4xl font-black font-mono mt-1 ${currentAccent.text}`}>{result.target === 'Kész' && !isHu ? 'Done' : result.target}</p></div>
                  <div className="rounded-2xl bg-[#0b0d11] border border-slate-800 p-4"><p className="text-[10px] font-black text-slate-500 uppercase">{isHu ? 'Pont / találat' : 'Score / hits'}</p><p className="text-3xl sm:text-4xl font-black font-mono text-white mt-1">{result.score}<span className="text-sm text-slate-500 ml-2">/ {result.hits}</span></p></div>
                </div>
                <div className="mt-5 flex justify-between text-xs font-black text-slate-400"><span>{result.detail}</span><span>{result.progress}/{result.total} {isHu ? 'nyíl' : 'darts'}</span></div>
                <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${Math.min(100, 100 * result.progress / result.total)}%` }} /></div>
                {personalBest !== null && <p className="text-xs text-amber-400 font-bold mt-4">{isHu ? 'Személyes rekord ezen az eszközön' : 'Personal best on this device'}: {personalBest} {bestByHits ? (isHu ? 'találat' : 'hits') : (isHu ? 'pont' : 'pts')}</p>}
                {result.finished && <div role="status" className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300 font-black">{isHu ? 'Edzés befejezve!' : 'Drill complete!'} {result.detail}</div>}
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
