'use client';

import { useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, PlayIcon } from '@heroicons/react/24/outline';
import type { Language } from '@/app/page';
import { replayFrame, turningPoints, type MatchVisit } from '../lib/matchReplay';

export type ReplayMatch = {
  id: string;
  visits: MatchVisit[];
  startingScore: number;
  playerNames: [string, string];
  checkIn: 'single' | 'double' | 'master';
  checkout: 'single' | 'double' | 'master';
};

export function MatchTimeMachine({ lang, replay, onStartGhost, loading, signedOut }: {
  lang: Language;
  replay: ReplayMatch | null;
  onStartGhost: (match: ReplayMatch) => void;
  loading: boolean;
  signedOut: boolean;
}) {
  const [position, setPosition] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = replay?.id === selectedId ? position : 0;
  const visits = replay?.visits || [];
  const frame = replayFrame(visits, active, replay?.startingScore || 501);
  const highlights = turningPoints(visits);
  const jump = (index: number) => { setSelectedId(replay?.id || null); setPosition(Math.max(0, Math.min(visits.length, index))); };
  const hu = lang === 'hu';
  const ghostReady = !!replay && replay.checkIn === 'single' && replay.visits.some(visit => visit.playerId === 0) && replay.playerNames.length === 2;
  const hitLabel = (hit: { val: number; mult: number }) => hit.val === 0 ? 'MISS' : hit.val === 25 ? hit.mult === 2 ? 'BULL' : '25' : `${['', 'S', 'D', 'T'][hit.mult]}${hit.val}`;

  return <section className="mb-6 rounded-3xl border border-cyan-500/25 bg-[#121821] p-5 sm:p-7" aria-label={hu ? 'Meccs-időgép' : 'Match time machine'}>
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
      <div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">DARTS DNA / 02</span>
        <h2 className="mt-1 text-xl sm:text-2xl font-black uppercase italic text-white">{hu ? 'Meccs-időgép' : 'Match time machine'}</h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl">{hu ? 'Lépj végig a legutóbbi rögzített meccs körösszegein, vagy játssz a saját korábbi tempód ellen.' : 'Step through the recorded visits from your latest match, or play against your earlier pace.'}</p>
      </div>
      <button type="button" onClick={() => replay && onStartGhost(replay)} disabled={!ghostReady} className="min-h-12 shrink-0 rounded-xl bg-cyan-400 px-5 text-xs font-black uppercase text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 inline-flex items-center justify-center gap-2"><PlayIcon className="h-4 w-4" />{hu ? 'Játék a fantom-énnel' : 'Play your ghost'}</button>
    </div>
    {!replay ? <p className="rounded-2xl border border-slate-700 bg-slate-950/50 p-5 text-sm text-slate-300">{loading ? (hu ? 'Meccsadatok betöltése…' : 'Loading match data…') : signedOut ? (hu ? 'A saját meccseidhez jelentkezz be.' : 'Sign in to see your own matches.') : (hu ? 'Az időgép a következő befejezett, bejelentkezve játszott X01 meccsed után jelenik meg. A korábbi meccsekből nem készült körnapló.' : 'Finish a signed-in X01 match to unlock the timeline. Older matches have no visit log.')}</p> : <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {frame.scores.map((score, index) => <div key={index} className={`rounded-2xl border p-3 sm:p-4 ${index === frame.current?.playerId ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/50'}`}><span className="block truncate text-[11px] font-bold uppercase text-slate-400">{replay.playerNames[index]}</span><strong className="block mt-1 text-3xl sm:text-4xl font-black tabular-nums text-white">{score}</strong></div>)}
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-xs font-black uppercase text-slate-300"><span>{hu ? `${frame.leg}. leg` : `Leg ${frame.leg}`}</span><span>{active} / {visits.length} {hu ? 'kör' : 'visits'}</span></div>
        <input type="range" min="0" max={visits.length} value={active} onChange={event => jump(Number(event.target.value))} aria-label={hu ? 'Meccs-idővonal' : 'Match timeline'} className="mt-4 w-full accent-cyan-400" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => jump(active - 1)} disabled={active === 0} aria-label={hu ? 'Előző kör' : 'Previous visit'} className="h-11 w-11 rounded-xl border border-slate-600 inline-flex items-center justify-center disabled:opacity-35"><ArrowLeftIcon className="h-5 w-5" /></button>
          <p className="min-w-0 text-center text-sm text-slate-200">{frame.current ? <><strong className="text-white">{replay.playerNames[frame.current.playerId] || (hu ? 'Játékos' : 'Player')}</strong> · {frame.current.bust ? (hu ? 'sok' : 'bust') : frame.current.checkout ? (hu ? 'kiszálló' : 'checkout') : `${frame.current.points} ${hu ? 'pont' : 'points'}`}{frame.current.hits.length > 0 && <span className="block mt-1 text-xs text-cyan-300">{frame.current.hits.map(hitLabel).join(' · ')}</span>}</> : (hu ? 'Meccskezdés' : 'Match start')}</p>
          <button type="button" onClick={() => jump(active + 1)} disabled={active === visits.length} aria-label={hu ? 'Következő kör' : 'Next visit'} className="h-11 w-11 rounded-xl border border-slate-600 inline-flex items-center justify-center disabled:opacity-35"><ArrowRightIcon className="h-5 w-5" /></button>
        </div>
      </div>
      {highlights.length > 0 && <div className="mt-5"><h3 className="text-xs font-black uppercase tracking-wide text-slate-300 mb-2">{hu ? 'Fordulópontok' : 'Turning points'}</h3><div className="grid sm:grid-cols-3 gap-2">{highlights.map(item => <button type="button" key={`${item.kind}-${item.visit.order}`} onClick={() => jump(visits.findIndex(visit => visit.order === item.visit.order) + 1)} className="min-h-20 rounded-xl border border-slate-700 bg-[#0c1017] p-3 text-left hover:border-cyan-400 focus-visible:outline-2 focus-visible:outline-cyan-400"><span className="block text-[10px] font-black uppercase text-cyan-300">{item.kind === 'checkout' ? (hu ? 'Legjobb kiszálló' : 'Best checkout') : item.kind === 'high' ? (hu ? 'Legnagyobb kör' : 'Highest visit') : (hu ? 'Drága sok' : 'Costly bust')}</span><strong className="block mt-1 text-lg text-white tabular-nums">{item.kind === 'bust' ? `${item.visit.scoreBefore} → ${item.visit.scoreBefore}` : `${item.visit.scoreBefore} → ${item.visit.scoreBefore - item.visit.points}`}</strong></button>)}</div></div>}
      {!ghostReady && <p className="mt-3 text-xs text-slate-500">{hu ? 'A fantommeccs egy korábbi, single-in X01 meccs után érhető el.' : 'Ghost play requires an earlier single-in X01 match.'}</p>}
    </>}
  </section>;
}
