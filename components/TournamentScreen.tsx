'use client';

import { useEffect, useRef, useState } from 'react';
import { 
    TrophyIcon, UsersIcon, Cog6ToothIcon, UserPlusIcon, 
    TrashIcon, ArrowRightIcon, ArrowLeftIcon, ArrowPathRoundedSquareIcon,
    BoltIcon, UserGroupIcon, ArrowsRightLeftIcon, CheckCircleIcon
} from '@heroicons/react/24/outline';
import type { Language } from '@/app/page';

export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'groups_to_knockout';

export interface TournamentPlayer {
    id: string;
    name: string;
    seed?: number;
}

export interface TournamentConfig {
    id: string;
    name: string;
    format: TournamentFormat;
    legsToWin: number;
    setsToWin: number;
    allowQuickEntry: boolean; // Ha igaz, külső táblán játszott meccsek eredményét csak bepötyögjük
    players: TournamentPlayer[];
}

interface TournamentScreenProps {
    lang: Language;
    onBack: () => void;
    onStartTournament: (config: TournamentConfig) => void;
}

export function TournamentScreen({ onBack, onStartTournament, lang }: TournamentScreenProps) {
    const tr = (hu: string, en: string) => lang === 'hu' ? hu : en;
    const dialogRef = useRef<HTMLDivElement>(null);
    const onBackRef = useRef(onBack);
    useEffect(() => { onBackRef.current = onBack; }, [onBack]);
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
            .filter(element => element.getClientRects().length > 0);
        focusable()[0]?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); onBackRef.current(); return; }
            if (event.key !== 'Tab') return;
            const controls = focusable();
            const first = controls[0];
            const last = controls.at(-1);
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        dialog.addEventListener('keydown', handleKeyDown);
        return () => {
            dialog.removeEventListener('keydown', handleKeyDown);
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, []);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    
    // --- TORNABEÁLLÍTÁSOK STATE ---
    const [tourneyName, setTourneyName] = useState(() => lang === 'hu' ? 'Dartisan Bajnokság' : 'Dartisan Championship');
    const [format, setFormat] = useState<TournamentFormat>('single_elimination');
    const [legsToWin, setLegsToWin] = useState(3);
    const [setsToWin, setSetsToWin] = useState(1);
    const [allowQuickEntry, setAllowQuickEntry] = useState(true);

    // --- JÁTÉKOSOK STATE ---
    const [players, setPlayers] = useState<TournamentPlayer[]>([]);
    const [newPlayerName, setNewPlayerName] = useState('');

    // --- SEGÉDFÜGGVÉNYEK ---
    const triggerHaptic = () => { if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(20); };

    const handleAddPlayer = () => {
        if (!newPlayerName.trim()) return;
        triggerHaptic();
        setPlayers(prev => [...prev, { id: `p_${Date.now()}_${Math.random().toString(36).substring(2,7)}`, name: newPlayerName.trim() }]);
        setNewPlayerName('');
    };

    const handleRemovePlayer = (id: string) => {
        triggerHaptic();
        setPlayers(prev => prev.filter(p => p.id !== id));
    };

    const shufflePlayers = () => {
        triggerHaptic();
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        setPlayers(shuffled);
    };

    const addDummyPlayers = (count: number) => {
        triggerHaptic();
        const dummies: TournamentPlayer[] = Array.from({length: count}).map((_, i) => ({
            id: `bot_${Date.now()}_${i}`,
            name: `${tr('Játékos', 'Player')} ${players.length + i + 1}`
        }));
        setPlayers(prev => [...prev, ...dummies]);
    };

    const handleStart = () => {
        triggerHaptic();
        const config: TournamentConfig = {
            id: `tourney_${Date.now()}`,
            name: tourneyName.trim(),
            format,
            legsToWin,
            setsToWin,
            allowQuickEntry,
            players: players.map((p, i) => ({ ...p, seed: i + 1 })) // Kevert sorrend alapján seedelés
        };
        onStartTournament(config);
    };

    // Ellenőrizzük, hogy hány "Erőnyerő" (Bye) kell a kieséses szakaszhoz
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(players.length || 1)));
    const byesNeeded = nextPowerOf2 - players.length;

    return (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tournament-title" className="fixed inset-0 z-[200] bg-[#0b0d11] text-slate-200 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col h-[100dvh]">
            
            {/* FEJLÉC */}
            <div className="flex items-center justify-between px-4 pb-4 pt-[calc(1rem+var(--app-safe-top))] sm:px-8 sm:pb-8 shrink-0 relative z-10">
                <button onClick={step === 1 ? onBack : () => setStep((step - 1) as 1|2)} aria-label={tr('Vissza', 'Back')} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 shadow-lg transition-all">
                    <ArrowLeftIcon className="h-6 w-6 text-white" />
                </button>
                <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
                    <TrophyIcon className="h-8 w-8 text-[#b655ff] mb-1 drop-shadow-[0_0_15px_rgba(182,85,255,0.5)]" />
                    <h1 id="tournament-title" className="text-xl font-black text-white uppercase italic tracking-widest leading-none">{tr('Tornaszervező', 'Tournament builder')}</h1>
                </div>
            </div>

            {/* PROGRESS BAR */}
            <div className="w-full max-w-3xl mx-auto px-8 mb-8 shrink-0">
                <div className="flex justify-between relative">
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-800 -z-10 -translate-y-1/2 rounded-full"></div>
                    <div className="absolute top-1/2 left-0 h-1 bg-[#b655ff] -z-10 -translate-y-1/2 rounded-full transition-all duration-500" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>
                    
                    {[1, 2, 3].map((num) => (
                        <div key={num} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 ${step >= num ? 'bg-[#b655ff] text-white shadow-[0_0_20px_rgba(182,85,255,0.4)] scale-110' : 'bg-slate-800 text-slate-500'}`}>
                            {step > num ? <CheckCircleIcon className="h-6 w-6" /> : num}
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-3 px-1">
                    <span className={`text-[10px] font-bold uppercase ${step >= 1 ? 'text-[#b655ff]' : 'text-slate-600'}`}>{tr('Alapok', 'Basics')}</span>
                    <span className={`text-[10px] font-bold uppercase ${step >= 2 ? 'text-[#b655ff]' : 'text-slate-600'}`}>{tr('Játékosok', 'Players')}</span>
                    <span className={`text-[10px] font-bold uppercase ${step >= 3 ? 'text-[#b655ff]' : 'text-slate-600'}`}>{tr('Áttekintés', 'Review')}</span>
                </div>
            </div>

            {/* TARTALOM */}
            <div className="flex-1 w-full max-w-3xl mx-auto px-4 pb-40">
                
                {/* 1. LÉPÉS: ALAPBEÁLLÍTÁSOK */}
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-6">
                        
                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <label htmlFor="tourney-name" className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{tr('Bajnokság neve', 'Tournament name')}</label>
                            <input id="tourney-name" type="text" maxLength={48} value={tourneyName} onChange={(e) => setTourneyName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-xl font-black italic focus:border-[#b655ff] outline-none transition-colors" placeholder={tr('Pl.: Péntek esti kupa', 'E.g. Friday Night Cup')} />
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">{tr('Lebonyolítási forma', 'Tournament format')}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={() => {triggerHaptic(); setFormat('single_elimination')}} className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition-all ${format === 'single_elimination' ? 'bg-[#b655ff]/10 border-[#b655ff]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                                    <TrophyIcon className={`h-10 w-10 mb-2 ${format === 'single_elimination' ? 'text-[#b655ff]' : 'text-slate-500'}`} />
                                    <span className={`font-black uppercase text-sm ${format === 'single_elimination' ? 'text-white' : 'text-slate-400'}`}>{tr('Egyenes kiesés', 'Single elimination')}</span>
                                    <span className="text-[10px] text-slate-500 font-bold mt-1">{tr('A vesztes azonnal kiesik', 'The loser is eliminated')}</span>
                                </button>
                                
                                <button onClick={() => {triggerHaptic(); setFormat('groups_to_knockout')}} className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition-all ${format === 'groups_to_knockout' ? 'bg-[#b655ff]/10 border-[#b655ff]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                                    <UserGroupIcon className={`h-10 w-10 mb-2 ${format === 'groups_to_knockout' ? 'text-[#b655ff]' : 'text-slate-500'}`} />
                                    <span className={`font-black uppercase text-sm ${format === 'groups_to_knockout' ? 'text-white' : 'text-slate-400'}`}>{tr('Csoportkör + rájátszás', 'Groups + knockout')}</span>
                                    <span className="text-[10px] text-slate-500 font-bold mt-1">{tr('Körmérkőzés, majd kieséses', 'Round robin, then knockout')}</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col items-center">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{tr('Szettek', 'Sets')}</p>
                                <div className="flex gap-2">
                                    {[1, 3, 5].map(n => (
                                        <button key={n} onClick={() => {triggerHaptic(); setSetsToWin(n)}} aria-pressed={setsToWin === n} className={`w-12 h-12 rounded-xl font-black text-lg transition-all ${setsToWin === n ? 'bg-[#b655ff] text-white shadow-[0_0_15px_rgba(182,85,255,0.4)]' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>{n}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col items-center">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{tr('Legek', 'Legs')}</p>
                                <div className="flex gap-2">
                                    {[1, 3, 5].map(n => (
                                        <button key={n} onClick={() => {triggerHaptic(); setLegsToWin(n)}} aria-pressed={legsToWin === n} className={`w-12 h-12 rounded-xl font-black text-lg transition-all ${legsToWin === n ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>{n}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button type="button" aria-pressed={allowQuickEntry} className="w-full text-left bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex items-center justify-between cursor-pointer group" onClick={() => {triggerHaptic(); setAllowQuickEntry(!allowQuickEntry)}}>
                            <div className="flex flex-col pr-4">
                                <span className="text-sm font-black text-white uppercase flex items-center gap-2"><BoltIcon className="h-5 w-5 text-cyan-400" /> {tr('Gyors eredményrögzítés', 'Quick result entry')}</span>
                                <span className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">{tr('Külső táblán játszott meccsek eredményeit dobásonkénti rögzítés nélkül is felviheted.', 'Record results played on another board without entering every dart.')}</span>
                            </div>
                            <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 shrink-0 ${allowQuickEntry ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                                <div className={`w-6 h-6 bg-white rounded-full transition-transform duration-300 ${allowQuickEntry ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                        </button>

                        <button onClick={() => setStep(2)} disabled={!tourneyName.trim()} className="w-full h-16 bg-[#b655ff] text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-[0_10px_30px_rgba(182,85,255,0.3)] hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2 mt-4">
                            {tr('Tovább a játékosokhoz', 'Continue to players')} <ArrowRightIcon className="h-6 w-6" />
                        </button>
                    </div>
                )}

                {/* 2. LÉPÉS: JÁTÉKOSOK */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 flex flex-col gap-6">
                        
                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-4">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><UserPlusIcon className="h-5 w-5 text-emerald-400" /> {tr('Új játékos hozzáadása', 'Add a player')}</h2>
                            <div className="flex gap-2">
                                <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()} aria-label={tr('Játékos neve', 'Player name')} placeholder={tr('Játékos neve...', 'Player name...')} className="min-w-0 flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-black focus:border-emerald-500 outline-none transition-colors" />
                                <button onClick={handleAddPlayer} aria-label={tr('Játékos hozzáadása', 'Add player')} className="w-14 h-14 shrink-0 bg-emerald-500 text-slate-900 rounded-xl flex items-center justify-center hover:bg-emerald-400 active:scale-95 transition-all"><UserPlusIcon className="h-6 w-6 font-black" /></button>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => addDummyPlayers(4)} className="flex-1 min-h-11 bg-slate-800 text-slate-300 text-[10px] font-black uppercase rounded-lg hover:bg-slate-700">{tr('+4 minta játékos', '+4 sample players')}</button>
                                <button onClick={() => addDummyPlayers(8)} className="flex-1 min-h-11 bg-slate-800 text-slate-300 text-[10px] font-black uppercase rounded-lg hover:bg-slate-700">{tr('+8 minta játékos', '+8 sample players')}</button>
                            </div>
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-[#b655ff]/30 shadow-[0_0_30px_rgba(182,85,255,0.1)] flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <UsersIcon className="h-5 w-5 text-[#b655ff]" /> {tr('Résztvevők', 'Participants')} ({players.length})
                                </h2>
                                <button onClick={shufflePlayers} disabled={players.length < 2} className="px-4 py-2 bg-[#b655ff]/20 text-[#b655ff] border border-[#b655ff]/50 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-[#b655ff]/30 disabled:opacity-50 transition-all">
                                    <ArrowsRightLeftIcon className="h-4 w-4" /> {tr('Sorrend keverése', 'Shuffle order')}
                                </button>
                            </div>

                            {players.length === 0 ? (
                                <div className="text-center p-8 border border-dashed border-slate-700 rounded-2xl text-slate-500 font-bold uppercase text-xs">{tr('Még nincs hozzáadva játékos.', 'No players added yet.')}</div>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                                    {players.map((p, idx) => (
                                        <div key={p.id} className="flex items-center justify-between bg-slate-900 border border-slate-700 p-3 rounded-xl animate-in fade-in">
                                            <div className="flex items-center gap-4">
                                                <span className="w-6 text-center text-[#b655ff] font-black font-mono text-sm">{idx + 1}.</span>
                                                <span className="text-white font-black uppercase">{p.name}</span>
                                            </div>
                                            <button onClick={() => handleRemovePlayer(p.id)} aria-label={tr(`${p.name} eltávolítása`, `Remove ${p.name}`)} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"><TrashIcon className="h-5 w-5" /></button>
                                        </div>
                                    ))}
                                    {byesNeeded > 0 && format === 'single_elimination' && (
                                        <div className="mt-2 p-3 bg-[#b655ff]/10 border border-[#b655ff]/30 rounded-xl flex items-start gap-3">
                                            <TrophyIcon className="h-5 w-5 text-[#b655ff] shrink-0 mt-0.5" />
                                            <div className="flex flex-col">
                                                <span className="text-[#b655ff] font-black uppercase text-[10px]">{tr('Automatikus erőnyerők', 'Automatic byes')}</span>
                                                <span className="text-slate-400 font-bold text-[10px] mt-1">{tr(`${players.length} játékoshoz ${byesNeeded} automatikus erőnyerő helyet adunk az első körben.`, `${byesNeeded} automatic bye spots will be added for ${players.length} players in round one.`)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button onClick={() => setStep(3)} disabled={players.length < 3} className="w-full h-16 bg-[#b655ff] text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-[0_10px_30px_rgba(182,85,255,0.3)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 mt-2">
                            {tr('Áttekintés és sorsolás', 'Review and draw')} <ArrowRightIcon className="h-6 w-6" />
                        </button>
                    </div>
                )}

                {/* 3. LÉPÉS: ÁTTEKINTÉS */}
                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4 flex flex-col gap-6">
                        
                        <div className="bg-[#b655ff] p-8 rounded-3xl shadow-[0_15px_40px_rgba(182,85,255,0.4)] relative overflow-hidden text-center">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><TrophyIcon className="h-32 w-32" /></div>
                            <span className="text-white/80 font-black text-[10px] uppercase tracking-[0.3em] block mb-2 relative z-10">{tr('Készen állsz a kezdésre?', 'Ready to begin?')}</span>
                            <h2 className="text-3xl font-black text-white uppercase italic tracking-widest mb-6 relative z-10">{tourneyName}</h2>
                            
                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                    <span className="block text-white/70 text-[9px] font-black uppercase tracking-widest mb-1">{tr('Formátum', 'Format')}</span>
                                    <span className="block text-white font-black uppercase text-xs">{format === 'single_elimination' ? tr('Kieséses', 'Knockout') : tr('Csoportkörös', 'Groups')}</span>
                                </div>
                                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                    <span className="block text-white/70 text-[9px] font-black uppercase tracking-widest mb-1">{tr('Játékosok', 'Players')}</span>
                                    <span className="block text-white font-black uppercase text-xl">{players.length} {tr('fő', 'players')}</span>
                                </div>
                                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                    <span className="block text-white/70 text-[9px] font-black uppercase tracking-widest mb-1">{tr('Meccs hossza', 'Match length')}</span>
                                    <span className="block text-white font-black uppercase text-xs">S{setsToWin} / L{legsToWin}</span>
                                </div>
                                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                    <span className="block text-white/70 text-[9px] font-black uppercase tracking-widest mb-1">{tr('Gyors bevitel', 'Quick entry')}</span>
                                    <span className={`block font-black uppercase text-xs ${allowQuickEntry ? 'text-cyan-300' : 'text-rose-300'}`}>{allowQuickEntry ? tr('Be', 'On') : tr('Ki', 'Off')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex items-start gap-4">
                            <Cog6ToothIcon className="h-6 w-6 text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-slate-400 text-xs font-bold leading-relaxed">{tr('Indítás után elkészül az ágrajz, és új játékost már nem adhatsz hozzá.', 'Starting creates the bracket. You cannot add players afterward.')}</p>
                        </div>

                        <button onClick={handleStart} className="w-full h-20 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest text-xl shadow-[0_15px_40px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 mt-4">
                            {tr('Sorsolás és torna indítása', 'Draw and start tournament')} <ArrowPathRoundedSquareIcon className="h-8 w-8" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
