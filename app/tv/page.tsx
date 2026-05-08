'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowsPointingOutIcon, EyeSlashIcon, EyeIcon } from '@heroicons/react/24/outline';

export default function TvModePage() {
    const [syncData, setSyncData] = useState<any>(null);
    const [chromaKey, setChromaKey] = useState<'bg-[#00FF00]' | 'bg-[#0000FF]' | 'bg-transparent'>('bg-[#0000FF]'); // Képed alapján alapból Kék
    const [position, setPosition] = useState<'bottom' | 'top-left' | 'top-right'>('bottom');
    const [showEditor, setShowEditor] = useState(true);

    // Valós idejű adatszinkronizáció a főablakból
    useEffect(() => {
        const fetchSyncData = () => {
            const data = localStorage.getItem('dartisan_tv_sync');
            if (data) {
                try {
                    setSyncData(JSON.parse(data));
                } catch (e) {
                    console.error("TV Sync hiba", e);
                }
            }
        };

        // Kezdeti betöltés
        fetchSyncData();

        // Figyeljük a storage változásokat (ha másik tabon frissül)
        window.addEventListener('storage', fetchSyncData);
        
        // Biztonsági frissítés másodpercenként kétszer (ha ugyanazon a tabon vagy ablakon belül mozog valami)
        const interval = setInterval(fetchSyncData, 500);

        return () => {
            window.removeEventListener('storage', fetchSyncData);
            clearInterval(interval);
        };
    }, []);

    // Ha nincs adat, egy várakozó képernyőt mutatunk
    if (!syncData || !syncData.players || syncData.players.length === 0) {
        return (
            <div className={`fixed inset-0 ${chromaKey} flex items-center justify-center`}>
                <div className="bg-[#12141a] p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center">
                    <ArrowsPointingOutIcon className="h-16 w-16 text-slate-500 animate-pulse mb-4" />
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest">TV Mód Készenlétben</h2>
                    <p className="text-slate-400 font-bold mt-2">Indíts el egy meccset a főablakban!</p>
                </div>
            </div>
        );
    }

    const p1 = syncData.players[0];
    const p2 = syncData.players[1] || { name: 'Várakozás...', score: 0, setsWon: 0, legsWon: 0 };
    const setsToWin = syncData.config?.setsToWin || 1;

    return (
        <div className={`fixed inset-0 z-[999] ${chromaKey} flex flex-col transition-colors duration-300`}>
            
            {/* EDITOR PANEL (OBS-ben elrejthető vagy kivágható) */}
            {showEditor ? (
                <div className="absolute top-4 left-4 z-10 bg-[#12141a]/95 backdrop-blur-md p-4 rounded-2xl border border-slate-700 shadow-2xl w-72 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <ArrowsPointingOutIcon className="h-5 w-5 text-cyan-400"/> TV Editor
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditor(false)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white" title="Editor elrejtése">
                                <EyeSlashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Háttér (Chroma Key)</label>
                        <div className="flex gap-2">
                            <button onClick={() => setChromaKey('bg-[#00FF00]')} className={`flex-1 h-8 rounded-md bg-[#00FF00] border-2 ${chromaKey === 'bg-[#00FF00]' ? 'border-white' : 'border-transparent'}`}></button>
                            <button onClick={() => setChromaKey('bg-[#0000FF]')} className={`flex-1 h-8 rounded-md bg-[#0000FF] border-2 ${chromaKey === 'bg-[#0000FF]' ? 'border-white' : 'border-transparent'}`}></button>
                            <button onClick={() => setChromaKey('bg-transparent')} className={`flex-1 h-8 rounded-md bg-slate-800 border-2 text-[10px] font-black text-slate-400 ${chromaKey === 'bg-transparent' ? 'border-white text-white' : 'border-transparent'}`}>ÁTLÁTSZÓ</button>
                        </div>

                        <label className="text-[10px] font-black text-slate-500 uppercase mt-2">Pozíció</label>
                        <select value={position} onChange={(e) => setPosition(e.target.value as any)} className="bg-slate-900 text-xs font-bold text-white rounded-lg p-2 border border-slate-700 outline-none">
                            <option value="bottom">Lent Középen</option>
                            <option value="top-left">Bal Felül</option>
                            <option value="top-right">Jobb Felül</option>
                        </select>
                    </div>
                </div>
            ) : (
                <button onClick={() => setShowEditor(true)} className="absolute top-4 left-4 z-10 p-3 bg-black/50 hover:bg-black/80 rounded-full text-white/50 hover:text-white backdrop-blur-sm transition-all shadow-lg">
                    <EyeIcon className="h-5 w-5" />
                </button>
            )}

            {/* A TÉNYLEGES SCOREBOARD (Amit a nézők látnak) */}
            <div className={`absolute ${position === 'bottom' ? 'bottom-8 left-1/2 -translate-x-1/2' : position === 'top-left' ? 'top-8 left-8' : 'top-8 right-8'} transition-all duration-500`}>
                
                <div className="bg-[#0b0d11]/95 backdrop-blur-md border-2 border-slate-800 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col min-w-[400px]">
                    {/* Fejléc */}
                    <div className="bg-slate-900 flex text-[10px] font-black uppercase text-slate-500 tracking-widest text-center border-b border-slate-800">
                        <div className="flex-[3] py-1 text-left px-4">Játékos</div>
                        {setsToWin > 1 && <div className="flex-1 py-1 border-l border-slate-800">Set</div>}
                        <div className="flex-1 py-1 border-l border-slate-800">Leg</div>
                        <div className="flex-1 py-1 border-l border-slate-800 text-white">Pont</div>
                    </div>

                    {/* Játékos 1 (Aktív játékos jelzővel) */}
                    <div className={`flex items-center border-b border-slate-800 transition-colors ${syncData.activePlayer === 0 ? 'bg-slate-800/80' : 'bg-[#12141a]'}`}>
                        <div className={`flex-[3] px-4 py-3 font-black text-lg uppercase truncate flex items-center gap-2 ${syncData.activePlayer === 0 ? 'text-emerald-400' : 'text-white'}`}>
                            {syncData.activePlayer === 0 && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>}
                            {p1.name}
                        </div>
                        {setsToWin > 1 && <div className="flex-1 py-3 text-center font-bold text-slate-300 bg-slate-900/30 text-lg border-l border-slate-800">{p1.setsWon}</div>}
                        <div className="flex-1 py-3 text-center font-bold text-slate-300 bg-slate-900/30 text-lg border-l border-slate-800">{p1.legsWon}</div>
                        <div className={`flex-1 py-3 text-center font-black text-2xl border-l border-slate-800 ${syncData.activePlayer === 0 ? 'bg-slate-900 text-emerald-400' : 'bg-slate-950 text-white'}`}>{p1.score}</div>
                    </div>

                    {/* Játékos 2 (Aktív játékos jelzővel) */}
                    <div className={`flex items-center transition-colors ${syncData.activePlayer === 1 ? 'bg-slate-800/80' : 'bg-[#12141a]'}`}>
                        <div className={`flex-[3] px-4 py-3 font-black text-lg uppercase truncate flex items-center gap-2 ${syncData.activePlayer === 1 ? 'text-amber-400' : 'text-white'}`}>
                            {syncData.activePlayer === 1 && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>}
                            {p2.name}
                        </div>
                        {setsToWin > 1 && <div className="flex-1 py-3 text-center font-bold text-slate-300 bg-slate-900/30 text-lg border-l border-slate-800">{p2.setsWon}</div>}
                        <div className="flex-1 py-3 text-center font-bold text-slate-300 bg-slate-900/30 text-lg border-l border-slate-800">{p2.legsWon}</div>
                        <div className={`flex-1 py-3 text-center font-black text-2xl border-l border-slate-800 ${syncData.activePlayer === 1 ? 'bg-slate-900 text-amber-400' : 'bg-slate-950 text-white'}`}>{p2.score}</div>
                    </div>
                </div>

            </div>
        </div>
    );
}