'use client';

import { useState, useEffect } from 'react';
import { TrophyIcon, ArrowLeftIcon, PlayIcon, LockClosedIcon } from '@heroicons/react/24/outline';

interface CareerBracketProps {
    userPlayer: any;
    matchResult: any;
    onBack: () => void;
    onPlayMatch: (opponent: any) => void;
}

export function CareerBracket({ userPlayer, matchResult, onBack, onPlayMatch }: CareerBracketProps) {
    const [currentStage, setCurrentStage] = useState(1);
    
    // AI Ellenfelek a Karrier módban
    const opponents = [
        { id: 'ai_1', name: 'Kezdő Karesz', isBot: true, difficulty: 2, color: 'slate', customStartingScore: 301 },
        { id: 'ai_2', name: 'Haladó Halász', isBot: true, difficulty: 4, color: 'cyan', customStartingScore: 501 },
        { id: 'ai_3', name: 'Profi Peti', isBot: true, difficulty: 7, color: 'amber', customStartingScore: 501 },
        { id: 'ai_4', name: 'Darts Isten', isBot: true, difficulty: 10, color: 'rose', customStartingScore: 501 }
    ];

    useEffect(() => {
        if (matchResult && matchResult.id === userPlayer.id) {
            setCurrentStage(prev => Math.min(prev + 1, opponents.length + 1));
        }
    }, [matchResult, userPlayer.id, opponents.length]);

    return (
        <div className="fixed inset-0 z-50 bg-[#0b0d11] text-slate-200 flex flex-col items-center pt-8 overflow-y-auto">
            <div className="w-full max-w-md px-6 flex items-center justify-between mb-8">
                <button onClick={onBack} className="p-3 bg-slate-800 rounded-full"><ArrowLeftIcon className="h-5 w-5" /></button>
                <h1 className="text-xl font-black uppercase tracking-widest text-[#b655ff]">Világbajnokság</h1>
                <div className="w-11"></div>
            </div>

            <div className="flex flex-col gap-4 w-full max-w-md px-4 pb-20">
                {opponents.map((opp, index) => {
                    const stageNum = index + 1;
                    const isUnlocked = currentStage >= stageNum;
                    const isCompleted = currentStage > stageNum;
                    const isCurrent = currentStage === stageNum;

                    return (
                        <div key={opp.id} className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${isCurrent ? 'bg-[#b655ff]/10 border-[#b655ff] shadow-[0_0_20px_rgba(182,85,255,0.2)]' : isCompleted ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${isCompleted ? 'bg-emerald-500 text-slate-900' : isCurrent ? 'bg-[#b655ff] text-white' : 'bg-slate-800 text-slate-500'}`}>
                                    {stageNum}
                                </div>
                                <div>
                                    <h3 className={`font-black uppercase ${isCurrent ? 'text-white' : 'text-slate-400'}`}>{opp.name}</h3>
                                    <p className="text-[10px] uppercase text-slate-500 font-bold">Nehézség: Lvl {opp.difficulty}</p>
                                </div>
                            </div>
                            
                            {isCompleted ? (
                                <span className="text-emerald-500 font-black uppercase text-xs">Legyőzve</span>
                            ) : isCurrent ? (
                                <button onClick={() => onPlayMatch(opp)} className="bg-[#b655ff] p-3 rounded-xl text-white hover:scale-105 active:scale-95 transition-all"><PlayIcon className="h-5 w-5" /></button>
                            ) : (
                                <LockClosedIcon className="h-6 w-6 text-slate-700" />
                            )}
                        </div>
                    );
                })}
                
                {currentStage > opponents.length && (
                    <div className="mt-8 text-center animate-in fade-in zoom-in">
                        <TrophyIcon className="h-32 w-32 mx-auto text-amber-400 mb-4 drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]" />
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-widest">Világbajnok!</h2>
                    </div>
                )}
            </div>
        </div>
    );
}