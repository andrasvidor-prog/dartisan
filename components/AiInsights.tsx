'use client';

import { useMemo, useState } from 'react';
import { ChartBarIcon, EyeIcon } from '@heroicons/react/24/outline';
import type { Language } from '@/app/page';
import type { DatedDnaMatch } from '../lib/weeklyGoal';
import { scoutOpponents, winRecipe, type ScoutMatch, type WinSignal } from '../lib/matchIntelligence';

const metricName = (kind: WinSignal['kind'], hu: boolean) => ({
  average: hu ? '3 nyilas átlag' : 'Three-dart average',
  first9: hu ? 'Első 9 nyíl' : 'First nine',
  checkout: hu ? 'Kiszálló' : 'Checkout',
  high: hu ? '100+ körök / meccs' : '100+ visits / match',
})[kind];

export function AiInsights({ lang, matches, scoutMatches, loading, signedOut, loadError }: {
  lang: Language;
  matches: DatedDnaMatch[];
  scoutMatches: ScoutMatch[];
  loading: boolean;
  signedOut: boolean;
  loadError: boolean;
}) {
  const hu = lang === 'hu';
  const [selectedName, setSelectedName] = useState('');
  const scouts = useMemo(() => scoutOpponents(scoutMatches), [scoutMatches]);
  const recipe = useMemo(() => winRecipe(matches), [matches]);
  const selected = scouts.find(scout => scout.name === selectedName) || scouts[0];
  const empty = loading ? (hu ? 'Meccsadatok betöltése…' : 'Loading match data…')
    : signedOut ? (hu ? 'Jelentkezz be a saját meccseid elemzéséhez.' : 'Sign in to analyze your matches.')
      : loadError ? (hu ? 'A meccsadatokat most nem sikerült betölteni. Próbáld újra később.' : 'Could not load match data. Please try again later.')
      : (hu ? 'Játssz bejelentkezve X01 meccset, és itt megjelennek a minták.' : 'Play a signed-in X01 match to see patterns here.');

  return <section className="mb-6 grid gap-3 lg:grid-cols-2" aria-label={hu ? 'Meccsintelligencia' : 'Match intelligence'}>
    <div className="min-w-0 rounded-3xl border border-cyan-500/25 bg-[#121821] p-5 sm:p-7">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">DARTS DNA / 06</span>
      <h2 className="mt-1 flex items-center gap-2 text-xl font-black uppercase italic text-white sm:text-2xl"><EyeIcon className="h-6 w-6 shrink-0 text-cyan-300" />{hu ? 'Ellenfél-felderítő' : 'Opponent scout'}</h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-400 sm:text-sm">{hu ? 'Az ismétlődő ellenfelek meccsei és a ténylegesen naplózott köreik alapján.' : 'Based on repeated opponents and their actually recorded visits.'}</p>
      {!selected ? <p className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">{empty}</p> : <>
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={hu ? 'Ellenfél kiválasztása' : 'Select opponent'}>
          {scouts.map(scout => <button type="button" key={scout.name} onClick={() => setSelectedName(scout.name)} aria-pressed={selected.name === scout.name} className={`min-h-11 max-w-full truncate rounded-xl border px-4 text-xs font-black ${selected.name === scout.name ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-950/50 text-slate-300'}`}>{scout.name}</button>)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [hu ? 'Meccsek' : 'Matches', String(selected.matches)],
            [hu ? 'Győzelmeid' : 'Your wins', `${selected.wins}/${selected.matches}`],
            [hu ? 'Ellenfél átlaga' : 'Opponent avg.', selected.average === null ? '—' : selected.average.toFixed(1)],
            [hu ? '100+ körei' : '100+ visits', selected.recordedVisits ? String(selected.highVisits) : '—'],
          ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/50 p-3"><span className="block text-[10px] font-bold uppercase text-slate-400">{label}</span><strong className="mt-1 block text-xl font-black tabular-nums text-white">{value}</strong></div>)}
        </div>
        {selected.recordedVisits ? <p className="mt-4 text-xs leading-relaxed text-slate-300">{hu ? `${selected.recordedVisits} naplózott ellenfélkör: ${selected.busts} sok, ${selected.checkouts} kiszálló. A körátlag csak ezekből a dobásokból számolódik.` : `${selected.recordedVisits} recorded opponent visits: ${selected.busts} busts, ${selected.checkouts} checkouts. The average uses only those visits.`}</p>
          : <p className="mt-4 text-xs leading-relaxed text-slate-400">{hu ? 'Ezekből a régebbi meccsekből még nincs ellenfélkör-napló. Az átlag és a dobásminta a következő rögzített meccsekből jelenik meg.' : 'These older matches have no opponent visit log. Average and scoring patterns appear after newly recorded matches.'}</p>}
        {selected.recordedVisits >= 6 && <div className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs leading-relaxed text-cyan-100"><strong className="block font-black uppercase text-cyan-300">{hu ? 'Mire figyelj' : 'Watch for'}</strong>{selected.highVisits / selected.recordedVisits >= 0.25
          ? (hu ? `A naplózott köreinek ${Math.round(selected.highVisits / selected.recordedVisits * 100)}%-a 100+ pont. A stabil ponttermelés különösen fontos ellene.` : `${Math.round(selected.highVisits / selected.recordedVisits * 100)}% of recorded visits scored 100+. Steady scoring matters against this opponent.`)
          : selected.busts >= 2
            ? (hu ? `${selected.busts} sok szerepel a naplóban. A kiszálló előtt érdemes biztos duplára előkészíteni.` : `${selected.busts} busts appear in the log. Set up a comfortable double before finishing.`)
            : (hu ? 'Az eddigi dobások alapján nincs kiugró ponttermelési vagy sokminta. Az első három kör után nézd újra az állást.' : 'No strong scoring or bust pattern yet. Reassess after the first three visits.')}</div>}
        <p className="mt-3 text-[11px] text-slate-500">{selected.matches < 3 ? (hu ? 'Korai minta: 3+ meccs után megbízhatóbb.' : 'Early signal: more reliable after 3+ matches.') : (hu ? 'Korábbi eredmények; nem jóslat a következő meccsre.' : 'Past results, not a prediction of the next match.')}</p>
      </>}
    </div>
    <div className="min-w-0 rounded-3xl border border-[#b655ff]/25 bg-[#151821] p-5 sm:p-7">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c783ff]">DARTS DNA / 07</span>
      <h2 className="mt-1 flex items-center gap-2 text-xl font-black uppercase italic text-white sm:text-2xl"><ChartBarIcon className="h-6 w-6 shrink-0 text-[#c783ff]" />{hu ? 'Győzelmi recept' : 'Winning recipe'}</h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-400 sm:text-sm">{hu ? 'Az utolsó 30 mentett X01 meccs győzelmeit és vereségeit hasonlítja össze.' : 'Compares wins and losses from up to 30 saved X01 matches.'}</p>
      {!recipe.wins || !recipe.losses ? <p className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">{recipe.wins || recipe.losses ? (hu ? 'Ehhez győztes és vesztes X01 meccs is kell. Az első összehasonlítás ezek után jelenik meg.' : 'A winning and a losing X01 match are needed for a comparison.') : empty}</p> : <>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black uppercase"><span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-300">{recipe.wins} {hu ? 'győzelem' : 'wins'}</span><span className="rounded-full bg-rose-500/10 px-3 py-1.5 text-rose-300">{recipe.losses} {hu ? 'vereség' : 'losses'}</span></div>
        {recipe.signals.length ? <div className="mt-4 space-y-2">{recipe.signals.map(signal => <div key={signal.kind} className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"><span className="text-xs font-black uppercase text-[#c783ff]">{metricName(signal.kind, hu)}</span><div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="text-slate-300">{hu ? 'Győzelemnél' : 'On wins'} <strong className="tabular-nums text-white">{signal.winnerValue}{signal.kind === 'checkout' ? '%' : ''}</strong></span><span className="text-slate-400">{hu ? 'Vereségnél' : 'On losses'} <strong className="tabular-nums text-white">{signal.loserValue}{signal.kind === 'checkout' ? '%' : ''}</strong></span></div></div>)}</div>
          : <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">{hu ? 'A mért mutatókban még nincs olyan különbség, amely a győzelmeknél nagyobb lenne. Játssz további meccseket.' : 'No measured metric is higher in wins yet. Play more matches to reveal a useful pattern.'}</p>}
        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">{hu ? 'Az eltérés együtt járhat a győzelemmel, de nem bizonyítja az okát.' : 'The differences correlate with wins; they do not prove the cause.'}{recipe.wins < 3 || recipe.losses < 3 ? ` ${hu ? 'Kevés adat: legalább 3–3 meccs ajánlott.' : 'Small sample: aim for at least 3 of each.'}` : ''}</p>
      </>}
    </div>
  </section>;
}
