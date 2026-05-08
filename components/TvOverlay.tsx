'use client';

import { useState } from 'react';
import { XMarkIcon, ArrowsPointingOutIcon, EyeSlashIcon, EyeIcon } from '@heroicons/react/24/outline';

interface TvOverlayProps {
    p1Name: string;
    p2Name: string;
    p1Score: number;
    p2Score: number;
    p1Sets: number;
    p2Sets: number;
    p1Legs: number;
    p2Legs: number;
    setsToWin: number;
    legsToWin: number;
    onClose: () => void;
}

export function TvOverlay({ p1Name, p2Name, p1Score, p2Score, p1Sets, p2Sets, p1Legs, p2Legs, setsToWin, legsToWin, onClose }: TvOverlayProps) {
    const [chromaKey, setChromaKey] = useState<'bg-[#00FF00]' | 'bg-[#0000FF]' | 'bg-transparent'>('bg-[#00FF00]');
    const [position, setPosition] = useState<'bottom' | 'top-left' | 'top-right'>('bottom');
    const [showEditor, setShowEditor] = useState(true);

    return (
        <div className={`fixed inset-0 z-[999] ${chromaKey} flex flex-col transition-colors duration-300`}>
            
            {/* EDITOR PANEL (Ezt az OBS-ben ki lehet vágni, vagy elrejteni) */}
            {showEditor ? (
                <div className="absolute top-4 left-4 z-10 bg-[#12141a]/95 backdrop-blur-md p-4 rounded-2xl border border-slate-700 shadow-2xl w-72 animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><ArrowsPointingOutIcon className="h-5 w-5 text-cyan-400"/> TV Editor</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditor(false)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white"><EyeSlashIcon className="h-4 w-4" /></button>
                            <button onClick={onClose} className="p-1.5 bg-rose-500/20 rounded-lg text-rose-500 hover:bg-rose-500 hover:text-white"><XMarkIcon className="h-4 w-4" /></button>
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
                <button onClick={() => setShowEditor(true)} className="absolute top-4 left-4 z-10 p-3 bg-black/50 hover:bg-black/80 rounded-full text-white/50 hover:text-white backdrop-blur-sm transition-all"><EyeIcon className="h-5 w-5" /></button>
            )}

            {/* A TÉNYLEGES SCOREBOARD (Ezt veszi fel az OBS) */}
            <div className={`absolute ${position === 'bottom' ? 'bottom-8 left-1/2 -translate-x-1/2' : position === 'top-left' ? 'top-8 left-8' : 'top-8 right-8'} transition-all duration-500`}>
                
                <div className="bg-[#0b0d11]/95 backdrop-blur-md border-2 border-slate-800 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col min-w-[400px]">
                    {/* Fejléc */}
                    <div className="bg-slate-900 flex text-[10px] font-black uppercase text-slate-500 tracking-widest text-center border-b border-slate-800">
                        <div className="flex-[3] py-1 text-left px-4">Játékos</div>
                        {setsToWin > 1 && <div className="flex-1 py-1 border-l border-slate-800">Set</div>}
                        <div className="flex-1 py-1 border-l border-slate-800">Leg</div>
                        <div className="flex-1 py-1 border-l border-slate-800 text-white">Pont</div>
                    </div>

                    {/* Játékos 1 */}
                    <div className="flex items-center bg-[#12141a] border-b border-slate-800">
                        <div className="flex-[3] px-4 py-3 font-black text-white text-lg uppercase truncate">{p1Name}</div>
                        {setsToWin > 1 && <div className="flex-1 py-3 text-center font-bold text-slate-300 bg-slate-900/30 text-lg border-l border-slate-800">{p1Sets}</div>}
                        <div className="flex-1 py-3 text-center font-bold text-slate-300 bg-slate-900/30 text-lg border-l border-slate-800">{p1Legs}</div>
                        <div className="flex-1 py-3 text-center font-black text-amber-400 bg-slate-900 text-2xl border-l border-slate-800">{p1Score}</div>
                    </div>

                    {/* Játékos 2 */}
                    <div className="flex items-center bg-[#12141a]">
                        <div className="flex-[3] px-4 py-3 font-black text-white text-lg uppercase truncate">{p2Name}</div>
                        {setsToWin > 1 && <div className="flex-1 py-3 text-center font-bold text-slate-300 bg-slate-900/30 text-lg border-l border-slate-800">{p2Sets}</div>}
                        <div className="flex-1 py-3 text-center font-bold text-slate-300 bg-slate-900/30 text-lg border-l border-slate-800">{p2Legs}</div>
                        <div className="flex-1 py-3 text-center font-black text-emerald-400 bg-slate-900 text-2xl border-l border-slate-800">{p2Score}</div>
                    </div>
                </div>

            </div>
        </div>
    );
}