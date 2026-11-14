'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, ArrowPathIcon, BoltIcon, ChartBarIcon, FireIcon, MegaphoneIcon, PlayIcon, SparklesIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import { buildDartsDna, type DnaAim, type DnaMatch } from '../lib/dartsDna';
import { createLocalNarrative } from '../lib/localCoach';
import { AiCoach } from './AiCoach';
import type { MatchConfig } from './SetupScreen';
import type { Language } from '@/app/page';

type AiMode = 'tactics' | 'broadcast' | 'rival';
type StudioTab = 'dna' | 'planner';
const apiUrl = process.env.NEXT_PUBLIC_DARTISAN_AI_URL?.replace(/\/$/, '') || '';

const words = {
  hu: {
    eyebrow: 'DARTISAN / AI STÚDIÓ', title: 'A játékod ujjlenyomata',
    subtitle: 'Valódi meccsek és célzott nyilak alapján. Minden szám mögött ott van a minta.',
    dna: 'Darts DNS', planner: 'Heti terv', matches: 'meccs alapján',
    low: 'Kezdődő minta', medium: 'Alakuló minta', high: 'Erős minta',
    average: '3 nyilas átlag', first9: 'Első 9 nyíl', checkout: 'Kiszálló', winRate: 'Győzelem',
    trend: 'Utolsó 5 vs. előző 5', consistency: 'Ingadozás',
    dataNeeded: 'Játssz néhány mentett meccset, hogy kirajzolódjon a Darts DNS-ed. A Nyomáslabor már most használható.',
    signedOut: 'A személyes elemzéshez jelentkezz be, hogy elérjem a mentett meccseidet.',
    error: 'A meccsadatokat most nem sikerült betölteni. A Nyomáslabort ettől még használhatod.',
    best: 'Biztosabb célpont', weak: 'Fejlesztendő célpont',
    targetNote: 'Csak legalább 8 célzott nyíllal mért szektorokat hasonlítok össze.',
    missions: 'Nyomáslabor', missionIntro: 'Indíts olyan kihívást, amely a jelenlegi játékprofilodhoz illik.',
    start: 'Indítás', mission1: 'Dupla-mentőakció', mission2: '121-es finálé', mission3: 'Boss-meccs',
    mission1Desc: 'Bob’s 27: minden dupla számít.',
    mission2Desc: 'Indulj 121-ről, és zárj duplával.',
    mission3Desc: '501 egy bot ellen. A cél: döntés nyomás alatt.',
    aiTitle: 'AI műsorvezető és edző', aiIntro: 'Egy gombnyomás = egy rövid API-kérés. Nincs automatikus hívás dobásonként.',
    localIntro: 'Próbáld ki a három stílust a mentett meccseid számaival. Ez a változat a készüléken állítja össze a szöveget.',
    free: 'OpenAI-költség: 0 $', aiEstimate: 'Becsült OpenAI-költség: 0,0002–0,0006 $ / új elemzés. A felolvasás a készülék hangját használja.',
    tactics: 'Taktikai dosszié', broadcast: 'Meccsfilm', rival: 'Rivális hang',
    tacticsDesc: 'Három konkrét erősség, gyenge pont és következő lépés.',
    broadcastDesc: 'Sportközvetítés a legutóbbi meccseid számaiból.',
    rivalDesc: 'Játékos, csipkelődő kihívás a következő meccshez.',
    analyze: 'Elemzés kérése', localAnalyze: 'Helyi összefoglaló', unavailable: 'Az élő AI még nincs bekötve. A helyi összefoglaló ingyenesen működik a mentett meccseiddel.',
    localEstimate: 'Helyi összefoglaló: 0 $ OpenAI-költség. Az élő AI később külön kapcsolható be.',
    signIn: 'Az AI-kérésekhez jelentkezz be.',
    failed: 'Az AI-válasz most nem érhető el. Próbáld újra később.',
    loading: 'Elemzés készül…', speak: 'Felolvasás', stop: 'Leállítás',
    quickstarter: 'Villámrajt', finisher: 'Kiszállóvadász', scorer: 'Pontgyáros', builder: 'Épülő játékprofil',
    focusDoubles: 'Következő fókusz: duplák', focusOpening: 'Következő fókusz: első kilenc nyíl', focusScoring: 'Következő fókusz: ponttermelés', focusConsistency: 'Következő fókusz: meccsstabilitás',
  },
  en: {
    eyebrow: 'DARTISAN / AI STUDIO', title: 'Your darts fingerprint',
    subtitle: 'Built from real matches and aimed darts. Find the pattern behind the numbers.',
    dna: 'Darts DNA', planner: 'Weekly plan', matches: 'recorded matches',
    low: 'Early signal', medium: 'Emerging pattern', high: 'Strong pattern',
    average: '3-dart average', first9: 'First nine', checkout: 'Checkout', winRate: 'Wins',
    trend: 'Last 5 vs previous 5', consistency: 'Variation',
    dataNeeded: 'Play a few saved matches to reveal your Darts DNA. The Pressure Lab is already available.',
    signedOut: 'Sign in to analyze your saved matches.',
    error: 'Match data could not load. You can still use the Pressure Lab.',
    best: 'Stronger target', weak: 'Target to improve',
    targetNote: 'Only sectors with at least eight aimed darts are compared.',
    missions: 'Pressure Lab', missionIntro: 'Start a challenge matched to your current playing profile.',
    start: 'Start', mission1: 'Double rescue', mission2: '121 finale', mission3: 'Boss match',
    mission1Desc: 'Bob’s 27: every double matters.',
    mission2Desc: 'Start at 121 and finish on a double.',
    mission3Desc: '501 against a bot. Make decisions under pressure.',
    aiTitle: 'AI broadcaster and coach', aiIntro: 'One button press makes one short API request. No automatic call after every dart.',
    localIntro: 'Try three styles based on your recorded matches. This version builds the text on your device.',
    free: 'OpenAI cost: $0', aiEstimate: 'Estimated OpenAI cost: $0.0002–$0.0006 per new analysis. Read aloud uses your device voice.',
    tactics: 'Tactical dossier', broadcast: 'Match movie', rival: 'Rival voice',
    tacticsDesc: 'Three evidence-based strengths, gaps and next steps.',
    broadcastDesc: 'A sports recap from your most recent match numbers.',
    rivalDesc: 'A playful challenge for your next match.',
    analyze: 'Generate', localAnalyze: 'Local recap', unavailable: 'Live AI is not connected yet. The local recap works for free with your recorded matches.',
    localEstimate: 'Local recap: $0 OpenAI cost. Live AI can be enabled separately later.',
    signIn: 'Sign in before requesting an AI response.',
    failed: 'The AI response is unavailable. Please try again later.',
    loading: 'Analyzing…', speak: 'Read aloud', stop: 'Stop',
    quickstarter: 'Fast starter', finisher: 'Checkout hunter', scorer: 'Power scorer', builder: 'Building your game',
    focusDoubles: 'Next focus: doubles', focusOpening: 'Next focus: first nine', focusScoring: 'Next focus: scoring', focusConsistency: 'Next focus: match consistency',
  },
};

const value = (number: number | null, suffix = '') => number === null ? '—' : `${number}${suffix}`;
const accuracy = (aim: DnaAim) => `${Math.round(aim.hits / aim.attempts * 100)}%`;

export function AiStudio({ onBack, onStartDrill, lang, currentUser }: {
  onBack: () => void;
  onStartDrill: (config: MatchConfig) => void;
  lang: Language;
  currentUser: User | null;
}) {
  const t = words[lang];
  const [tab, setTab] = useState<StudioTab>('dna');
  const [matches, setMatches] = useState<DnaMatch[]>([]);
  const [aims, setAims] = useState<DnaAim[]>([]);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const [failedUid, setFailedUid] = useState<string | null>(null);
  const [mode, setMode] = useState<AiMode>('tactics');
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const signedUser = currentUser && !currentUser.isAnonymous ? currentUser : null;
  const ready = !!signedUser && loadedUid === signedUser.uid;
  const loading = !!signedUser && !ready && failedUid !== signedUser.uid;
  const loadError = !!signedUser && failedUid === signedUser.uid;
  const dna = useMemo(() => buildDartsDna(ready ? matches : [], ready ? aims : []), [ready, matches, aims]);

  useEffect(() => {
    const user = signedUser;
    if (!user) return;
    let alive = true;
    Promise.all([
      getDocs(query(collection(db, 'users', user.uid, 'matchHistory'), orderBy('date', 'desc'), limit(20))),
      getDocs(collection(db, 'users', user.uid, 'stats', 'aims', 'targets')),
    ]).then(([history, targets]) => {
      if (!alive) return;
      setMatches(history.docs.map(item => {
        const data = item.data();
        const stats = data.stats || {};
        const metric = (key: string) => typeof stats[key] === 'number' && Number.isFinite(stats[key]) ? stats[key] as number : null;
        return {
          won: data.won === true,
          average: metric('average'), first9Average: metric('first9Average'),
          checkoutRate: metric('checkoutAttempts') === 0 || (metric('checkoutAttempts') === null && metric('checkoutPct') === 0)
            ? null : metric('checkoutPct'),
          count100: metric('count100') || 0, count140: metric('count140') || 0, count180: metric('count180') || 0,
        };
      }));
      setAims(targets.docs.flatMap(item => {
        const data = item.data();
        return typeof data.target === 'string' && typeof data.attempts === 'number' && typeof data.hits === 'number'
          ? [{ target: data.target, attempts: data.attempts, hits: data.hits }] : [];
      }));
      setLoadedUid(user.uid);
    }).catch(() => { if (alive) setFailedUid(user.uid); });
    return () => { alive = false; };
  }, [signedUser]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const startMission = (kind: 'doubles' | 'finale' | 'boss') => {
    const botDifficulty = dna.average === null ? 4 : Math.max(2, Math.min(8, Math.round(dna.average / 10)));
    onStartDrill({
      gameMode: kind === 'boss' ? 'x01' : 'practice',
      practiceType: kind === 'doubles' ? 'bobs27' : kind === 'finale' ? '121' : undefined,
      startingScore: kind === 'boss' ? 501 : kind === 'finale' ? 121 : 0,
      setsToWin: 1, legsToWin: kind === 'boss' ? 3 : 1,
      checkIn: 'single', checkout: 'double', muteCaller: false,
      players: [
        { name: signedUser?.displayName || (lang === 'hu' ? 'Játékos' : 'Player'), isBot: false, difficulty: 5, color: 'cyan' },
        ...(kind === 'boss' ? [{ name: lang === 'hu' ? 'Boss' : 'Boss', isBot: true, difficulty: botDifficulty, color: 'purple' as const }] : []),
      ],
    });
  };

  const runAi = async () => {
    if (!apiUrl) { setAiError(''); setAiText(createLocalNarrative(mode, lang, dna)); return; }
    const user = signedUser;
    if (!user) { setAiError(t.signIn); return; }
    setAiBusy(true); setAiError(''); setAiText('');
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${apiUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode, lang, dna, matches: (ready ? matches : []).slice(0, 10) }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.text !== 'string') throw new Error(typeof data.error === 'string' ? data.error : t.failed);
      setAiText(data.text);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : t.failed);
    } finally { setAiBusy(false); }
  };

  const readAloud = () => {
    if (!('speechSynthesis' in window) || !aiText) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(aiText);
    utterance.lang = lang === 'hu' ? 'hu-HU' : 'en-US';
    utterance.rate = 1.02;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  if (tab === 'planner') return <AiCoach lang={lang} onBack={() => setTab('dna')} onStartDrill={onStartDrill} />;

  const profiles = { quickstarter: t.quickstarter, finisher: t.finisher, scorer: t.scorer, builder: t.builder };
  const focus = dna.focus === 'doubles' ? t.focusDoubles : dna.focus === 'opening' ? t.focusOpening : dna.focus === 'consistency' ? t.focusConsistency : t.focusScoring;
  const aiModes: { id: AiMode; icon: typeof SparklesIcon; title: string; desc: string }[] = [
    { id: 'tactics', icon: ChartBarIcon, title: t.tactics, desc: t.tacticsDesc },
    { id: 'broadcast', icon: MegaphoneIcon, title: t.broadcast, desc: t.broadcastDesc },
    { id: 'rival', icon: FireIcon, title: t.rival, desc: t.rivalDesc },
  ];

  return <div className="min-h-full w-full bg-[#0b0d11] text-slate-200 px-4 sm:px-7 lg:px-10 pt-[calc(1rem+var(--app-safe-top))] pb-20">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center gap-4 mb-7">
        <button onClick={onBack} aria-label={lang === 'hu' ? 'Vissza' : 'Back'} className="h-11 w-11 shrink-0 rounded-xl border border-slate-700 bg-[#171b23] flex items-center justify-center"><ArrowLeftIcon className="h-5 w-5" /></button>
        <div className="min-w-0">
          <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.22em] flex items-center gap-1"><SparklesIcon className="h-3 w-3" /> {t.eyebrow}</span>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white uppercase italic tracking-tight leading-tight">{t.title}</h1>
        </div>
      </header>
      <p className="text-slate-400 text-sm max-w-2xl mb-6">{t.subtitle}</p>
      <div className="flex gap-2 mb-6" role="tablist">
        {([['dna', t.dna], ['planner', t.planner]] as const).map(([id, label]) =>
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`px-5 py-3 rounded-xl border text-xs font-black uppercase tracking-wide ${tab === id ? 'bg-cyan-500 text-slate-950 border-cyan-500' : 'bg-[#12141a] border-slate-700 text-slate-300'}`}>{label}</button>)}
      </div>

      <section className="rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-[#151a23] to-[#101216] p-5 sm:p-7 mb-5">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">DARTS DNA / 01</span>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold uppercase text-slate-300">{t[dna.confidence]} · {dna.matches} {t.matches}</span>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl sm:text-5xl font-black text-white uppercase italic">{profiles[dna.profile]}</h2>
            <p className="text-cyan-300 text-xs font-bold uppercase tracking-wide mt-2">{focus}</p>
          </div>
          {dna.momentum !== null && <div className="rounded-xl bg-slate-950/60 border border-slate-700 p-3 text-right"><span className="block text-[10px] text-slate-400 uppercase font-bold">{t.trend}</span><strong className={`text-xl font-black tabular-nums ${dna.momentum >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{dna.momentum >= 0 ? '+' : ''}{dna.momentum}</strong></div>}
        </div>
        {loading ? <div role="status" className="flex items-center gap-2 text-sm text-slate-400"><ArrowPathIcon className="h-5 w-5 animate-spin" /> {t.loading}</div>
          : <>
            {(loadError || !signedUser || dna.matches === 0) && <p className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300 mb-5">{loadError ? t.error : !signedUser ? t.signedOut : t.dataNeeded}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {[[t.average, value(dna.average)], [t.first9, value(dna.first9Average)], [t.checkout, value(dna.checkoutRate, '%')], [t.winRate, value(dna.winRate, '%')]].map(([label, metric]) =>
                <div key={label} className="rounded-2xl bg-[#0c1017] border border-slate-700/80 p-4"><span className="block text-[10px] uppercase font-black tracking-wide text-slate-400">{label}</span><strong className="block mt-2 text-2xl sm:text-3xl font-black text-white tabular-nums">{metric}</strong></div>)}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              {dna.strongestTarget && <p className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm"><span className="text-slate-300">{t.best}</span> <strong className="text-emerald-300">{dna.strongestTarget.target} · {accuracy(dna.strongestTarget)}</strong></p>}
              {dna.weakestTarget && <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-sm"><span className="text-slate-300">{t.weak}</span> <strong className="text-rose-300">{dna.weakestTarget.target} · {accuracy(dna.weakestTarget)}</strong></p>}
            </div>
            {(dna.strongestTarget || dna.weakestTarget) && <p className="text-[11px] text-slate-500 mt-3">{t.targetNote}</p>}
          </>}
      </section>

      <section className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2"><BoltIcon className="h-5 w-5 text-cyan-400" /><h2 className="text-xl sm:text-2xl font-black text-white uppercase italic">{t.missions}</h2><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-300">{t.free}</span></div>
        <p className="text-xs text-slate-400 mb-4">{t.missionIntro}</p>
        <div className="grid md:grid-cols-3 gap-3">
          {([['doubles', t.mission1, t.mission1Desc], ['finale', t.mission2, t.mission2Desc], ['boss', t.mission3, t.mission3Desc]] as const).map(([kind, title, desc], index) =>
            <button key={kind} onClick={() => startMission(kind)} className={`group rounded-2xl border p-5 text-left min-h-40 flex flex-col transition-colors hover:border-cyan-400 ${dna.focus === 'doubles' && index === 0 || (dna.focus === 'opening' || dna.focus === 'consistency') && index === 2 || dna.focus === 'scoring' && index === 1 ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-700 bg-[#12141a]'}`}>
              <span className="text-[10px] uppercase font-black text-cyan-400 tracking-widest">0{index + 1} / 03</span>
              <strong className="text-lg font-black text-white uppercase mt-3">{title}</strong>
              <span className="text-xs text-slate-400 mt-1 flex-1">{desc}</span>
              <span className="mt-4 text-xs font-black uppercase text-cyan-300 flex items-center gap-2"><PlayIcon className="h-4 w-4" /> {t.start}</span>
            </button>)}
        </div>
      </section>

      <section className="rounded-3xl border border-[#b655ff]/25 bg-[#12141a] p-5 sm:p-7">
        <div className="flex items-center gap-2"><SparklesIcon className="h-5 w-5 text-[#b655ff]" /><h2 className="text-xl sm:text-2xl font-black text-white uppercase italic">{t.aiTitle}</h2></div>
        <p className="text-xs text-slate-400 mt-2 mb-5">{apiUrl ? t.aiIntro : t.localIntro}</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {aiModes.map(item => <button key={item.id} onClick={() => { window.speechSynthesis?.cancel(); setSpeaking(false); setMode(item.id); setAiText(''); setAiError(''); }} aria-pressed={mode === item.id} className={`rounded-2xl border p-4 text-left min-h-28 ${mode === item.id ? 'border-[#b655ff] bg-[#b655ff]/10' : 'border-slate-700 bg-[#0c1017]'}`}><item.icon className="h-5 w-5 text-[#b655ff] mb-3" /><strong className="block text-sm text-white">{item.title}</strong><span className="block text-xs text-slate-400 mt-1">{item.desc}</span></button>)}
        </div>
        <button onClick={runAi} disabled={aiBusy || loading} className="mt-5 min-h-12 px-6 rounded-xl bg-[#b655ff] text-slate-950 text-xs font-black uppercase disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-2">{aiBusy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}{aiBusy ? t.loading : apiUrl ? t.analyze : t.localAnalyze}</button>
        <p className="text-[11px] text-slate-400 mt-3">{apiUrl ? t.aiEstimate : t.localEstimate}</p>
        {!apiUrl && <p className="text-xs text-slate-400 mt-3">{t.unavailable}</p>}
        {aiError && <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-sm text-rose-200">{aiError}</p>}
        {aiText && <div className="mt-5 rounded-2xl bg-[#0c1017] border border-slate-700 p-4 sm:p-5"><p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{aiText}</p><button onClick={readAloud} className="mt-4 inline-flex items-center gap-2 text-xs uppercase font-black text-cyan-300"><SpeakerWaveIcon className="h-4 w-4" /> {speaking ? t.stop : t.speak}</button></div>}
      </section>
    </div>
  </div>;
}
