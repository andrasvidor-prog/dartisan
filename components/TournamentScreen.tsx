'use client';

import { useState } from 'react';
import { 
    TrophyIcon, UsersIcon, Cog6ToothIcon, UserPlusIcon, 
    TrashIcon, ArrowRightIcon, ArrowLeftIcon, ArrowPathRoundedSquareIcon,
    BoltIcon, UserGroupIcon, ArrowsRightLeftIcon, CheckCircleIcon
} from '@heroicons/react/24/outline';

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
    onBack: () => void;
    onStartTournament: (config: TournamentConfig) => void;
}

export function TournamentScreen({ onBack, onStartTournament }: TournamentScreenProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    
    // --- TORNABEÁLLÍTÁSOK STATE ---
    const [tourneyName, setTourneyName] = useState('Dartisan Bajnokság');
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
            name: `Játékos ${players.length + i + 1}`
        }));
        setPlayers(prev => [...prev, ...dummies]);
    };

    const handleStart = () => {
        triggerHaptic();
        const config: TournamentConfig = {
            id: `tourney_${Date.now()}`,
            name: tourneyName,
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
        <div className="fixed inset-0 z-[200] bg-[#0b0d11] text-slate-200 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col h-[100dvh]">
            
            {/* FEJLÉC */}
            <div className="flex items-center justify-between p-4 sm:p-8 shrink-0 relative z-10">
                <button onClick={step === 1 ? onBack : () => setStep((step - 1) as 1|2)} className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 shadow-lg transition-all">
                    <ArrowLeftIcon className="h-6 w-6 text-white" />
                </button>
                <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
                    <TrophyIcon className="h-8 w-8 text-[#b655ff] mb-1 drop-shadow-[0_0_15px_rgba(182,85,255,0.5)]" />
                    <h1 className="text-xl font-black text-white uppercase italic tracking-widest leading-none">Tornaszervező</h1>
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
                    <span className={`text-[10px] font-bold uppercase ${step >= 1 ? 'text-[#b655ff]' : 'text-slate-600'}`}>Alapok</span>
                    <span className={`text-[10px] font-bold uppercase ${step >= 2 ? 'text-[#b655ff]' : 'text-slate-600'}`}>Játékosok</span>
                    <span className={`text-[10px] font-bold uppercase ${step >= 3 ? 'text-[#b655ff]' : 'text-slate-600'}`}>Áttekintés</span>
                </div>
            </div>

            {/* TARTALOM */}
            <div className="flex-1 w-full max-w-3xl mx-auto px-4 pb-40">
                
                {/* 1. LÉPÉS: ALAPBEÁLLÍTÁSOK */}
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col gap-6">
                        
                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Bajnokság Neve</label>
                            <input type="text" maxLength={48} value={tourneyName} onChange={(e) => setTourneyName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-xl font-black italic focus:border-[#b655ff] outline-none transition-colors" placeholder="Pl: Péntek Esti Kupa" />
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">Lebonyolítási Forma</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={() => {triggerHaptic(); setFormat('single_elimination')}} className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition-all ${format === 'single_elimination' ? 'bg-[#b655ff]/10 border-[#b655ff]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                                    <TrophyIcon className={`h-10 w-10 mb-2 ${format === 'single_elimination' ? 'text-[#b655ff]' : 'text-slate-500'}`} />
                                    <span className={`font-black uppercase text-sm ${format === 'single_elimination' ? 'text-white' : 'text-slate-400'}`}>Egyenes Kiesés</span>
                                    <span className="text-[10px] text-slate-500 font-bold mt-1">A vesztes azonnal kiesik</span>
                                </button>
                                
                                <button onClick={() => {triggerHaptic(); setFormat('groups_to_knockout')}} className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition-all ${format === 'groups_to_knockout' ? 'bg-[#b655ff]/10 border-[#b655ff]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                                    <UserGroupIcon className={`h-10 w-10 mb-2 ${format === 'groups_to_knockout' ? 'text-[#b655ff]' : 'text-slate-500'}`} />
                                    <span className={`font-black uppercase text-sm ${format === 'groups_to_knockout' ? 'text-white' : 'text-slate-400'}`}>Csoportkör + Rájátszás</span>
                                    <span className="text-[10px] text-slate-500 font-bold mt-1">Körmérkőzés, majd kieséses</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col items-center">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Szettek</label>
                                <div className="flex gap-2">
                                    {[1, 3, 5].map(n => (
                                        <button key={n} onClick={() => {triggerHaptic(); setSetsToWin(n)}} className={`w-12 h-12 rounded-xl font-black text-lg transition-all ${setsToWin === n ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>{n}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col items-center">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Legek</label>
                                <div className="flex gap-2">
                                    {[1, 3, 5].map(n => (
                                        <button key={n} onClick={() => {triggerHaptic(); setLegsToWin(n)}} className={`w-12 h-12 rounded-xl font-black text-lg transition-all ${legsToWin === n ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}>{n}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex items-center justify-between cursor-pointer group" onClick={() => {triggerHaptic(); setAllowQuickEntry(!allowQuickEntry)}}>
                            <div className="flex flex-col pr-4">
                                <span className="text-sm font-black text-white uppercase flex items-center gap-2"><BoltIcon className="h-5 w-5 text-cyan-400" /> Gyors Eredményrögzítés</span>
                                <span className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">Ha aktiválod, egyetlen gombnyomással (pl. &quot;2-1, átlag 68&quot;) is felviheted a külső táblákon játszott meccsek eredményét, anélkül, hogy a táblagépbe dobásonként pötyögnéd be.</span>
                            </div>
                            <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 shrink-0 ${allowQuickEntry ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                                <div className={`w-6 h-6 bg-white rounded-full transition-transform duration-300 ${allowQuickEntry ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                        </div>

                        <button onClick={() => setStep(2)} className="w-full h-16 bg-[#b655ff] text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-[0_10px_30px_rgba(182,85,255,0.3)] hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4">
                            Tovább a Játékosokhoz <ArrowRightIcon className="h-6 w-6" />
                        </button>
                    </div>
                )}

                {/* 2. LÉPÉS: JÁTÉKOSOK */}
                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-4 flex flex-col gap-6">
                        
                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-4">
                            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><UserPlusIcon className="h-5 w-5 text-emerald-400" /> Új Játékos Hozzáadása</h2>
                            <div className="flex gap-2">
                                <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()} placeholder="Játékos neve..." className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-black focus:border-emerald-500 outline-none transition-colors" />
                                <button onClick={handleAddPlayer} className="w-14 h-14 bg-emerald-500 text-slate-900 rounded-xl flex items-center justify-center hover:bg-emerald-400 active:scale-95 transition-all"><UserPlusIcon className="h-6 w-6 font-black" /></button>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => addDummyPlayers(4)} className="flex-1 py-2 bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-lg hover:bg-slate-700">+4 Teszt Játékos</button>
                                <button onClick={() => addDummyPlayers(8)} className="flex-1 py-2 bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-lg hover:bg-slate-700">+8 Teszt Játékos</button>
                            </div>
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-[#b655ff]/30 shadow-[0_0_30px_rgba(182,85,255,0.1)] flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <UsersIcon className="h-5 w-5 text-[#b655ff]" /> Résztvevők ({players.length})
                                </h2>
                                <button onClick={shufflePlayers} disabled={players.length < 2} className="px-4 py-2 bg-[#b655ff]/20 text-[#b655ff] border border-[#b655ff]/50 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-[#b655ff]/30 disabled:opacity-50 transition-all">
                                    <ArrowsRightLeftIcon className="h-4 w-4" /> Keverés (Sorsolás)
                                </button>
                            </div>

                            {players.length === 0 ? (
                                <div className="text-center p-8 border border-dashed border-slate-700 rounded-2xl text-slate-500 font-bold uppercase text-xs">Még nincs hozzáadva játékos.</div>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                                    {players.map((p, idx) => (
                                        <div key={p.id} className="flex items-center justify-between bg-slate-900 border border-slate-700 p-3 rounded-xl animate-in fade-in">
                                            <div className="flex items-center gap-4">
                                                <span className="w-6 text-center text-[#b655ff] font-black font-mono text-sm">{idx + 1}.</span>
                                                <span className="text-white font-black uppercase">{p.name}</span>
                                            </div>
                                            <button onClick={() => handleRemovePlayer(p.id)} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"><TrashIcon className="h-5 w-5" /></button>
                                        </div>
                                    ))}
                                    {byesNeeded > 0 && format === 'single_elimination' && (
                                        <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                                            <TrophyIcon className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                            <div className="flex flex-col">
                                                <span className="text-amber-500 font-black uppercase text-[10px]">Tipp: Automatikus Erőnyerők</span>
                                                <span className="text-slate-400 font-bold text-[9px] mt-1">A sorsoláshoz páros ágrajz szükséges (pl. 4, 8, 16). Jelenleg {players.length} játékosod van, így a rendszer automatikusan {byesNeeded} db &quot;Erőnyerő&quot; (Bye) pozíciót fog kiosztani az első körben.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button onClick={() => setStep(3)} disabled={players.length < 3} className="w-full h-16 bg-[#b655ff] text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-[0_10px_30px_rgba(182,85,255,0.3)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 mt-2">
                            Áttekintés & Sorsolás <ArrowRightIcon className="h-6 w-6" />
                        </button>
                    </div>
                )}

                {/* 3. LÉPÉS: ÁTTEKINTÉS */}
                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right-4 flex flex-col gap-6">
                        
                        <div className="bg-[#b655ff] p-8 rounded-3xl shadow-[0_15px_40px_rgba(182,85,255,0.4)] relative overflow-hidden text-center">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><TrophyIcon className="h-32 w-32" /></div>
                            <span className="text-white/80 font-black text-[10px] uppercase tracking-[0.3em] block mb-2 relative z-10">Készen állsz a kezdésre?</span>
                            <h2 className="text-3xl font-black text-white uppercase italic tracking-widest mb-6 relative z-10">{tourneyName}</h2>
                            
                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                    <span className="block text-white/70 text-[9px] font-black uppercase tracking-widest mb-1">Formátum</span>
                                    <span className="block text-white font-black uppercase text-xs">{format === 'single_elimination' ? 'Kieséses' : 'Csoportkörös'}</span>
                                </div>
                                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                    <span className="block text-white/70 text-[9px] font-black uppercase tracking-widest mb-1">Játékosok</span>
                                    <span className="block text-white font-black uppercase text-xl">{players.length} Fő</span>
                                </div>
                                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                    <span className="block text-white/70 text-[9px] font-black uppercase tracking-widest mb-1">Meccs Hossz</span>
                                    <span className="block text-white font-black uppercase text-xs">S{setsToWin} / L{legsToWin}</span>
                                </div>
                                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                                    <span className="block text-white/70 text-[9px] font-black uppercase tracking-widest mb-1">Gyors Bevitel</span>
                                    <span className={`block font-black uppercase text-xs ${allowQuickEntry ? 'text-cyan-300' : 'text-rose-300'}`}>{allowQuickEntry ? 'BE' : 'KI'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl flex items-start gap-4">
                            <Cog6ToothIcon className="h-6 w-6 text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-slate-400 text-xs font-bold leading-relaxed">Ha rányomsz az Indítás gombra, a rendszer legenerálja az ágrajzot és hivatalosan megkezdődik a torna. Ezt követően új játékost már nem adhatsz hozzá!</p>
                        </div>

                        <button onClick={handleStart} className="w-full h-20 bg-emerald-500 text-slate-900 rounded-[2rem] font-black uppercase tracking-widest text-xl shadow-[0_15px_40px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 mt-4">
                            Sorsolás & Torna Indítása <ArrowPathRoundedSquareIcon className="h-8 w-8" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
