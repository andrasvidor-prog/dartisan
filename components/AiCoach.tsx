'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftIcon, SparklesIcon, CheckCircleIcon, PlayIcon, ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { MatchConfig } from './SetupScreen';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

type GoalType = 'scoring' | 'checkout' | 'first9';
type TaskMode = NonNullable<MatchConfig['practiceType']> | 'x01' | 'rest' | 'custom';
type TrainingTask = { day: number; title: string; mode: TaskMode; desc: string; id?: number };

const TRAINING_PLANS: Record<GoalType, TrainingTask[]> = {
    scoring: [
        { day: 1, title: 'Bemelegítő ATC', mode: 'around', desc: 'Dobj 1-től 20-ig.' },
        { day: 2, title: 'Darts Math', mode: 'math', desc: 'Agytréning kivonásokhoz.' },
        { day: 3, title: 'Célpont Vadász', mode: 'hunter', desc: 'T20 és T19 fókusz.' },
        { day: 4, title: 'Pihenőnap', mode: 'rest', desc: 'Elemzés.' },
        { day: 5, title: 'Tömegdobás AI ellen', mode: 'x01', desc: '501 meccs egy AI ellen.' },
        { day: 6, title: 'Darts Math', mode: 'math', desc: 'Még több agytréning.' },
        { day: 7, title: 'Célpont Vadász: Triplák', mode: 'hunter', desc: 'Kizárólag triplákat vadássz.' }
    ],
    checkout: [
        { day: 1, title: "Bob's 27", mode: 'bobs27', desc: 'Építsd a dupla-biztonságot.' },
        { day: 2, title: '121 Challenge', mode: '121', desc: '9 nyíl a kiszállóra.' },
        { day: 3, title: "Bob's 27", mode: 'bobs27', desc: 'Próbáld megdönteni a rekordod!' },
        { day: 4, title: 'Pihenőnap', mode: 'rest', desc: 'Elemzés.' },
        { day: 5, title: '121 Challenge', mode: '121', desc: 'Magas nyomás, dupla fókusz.' },
        { day: 6, title: 'Célpont Vadász', mode: 'hunter', desc: 'Kedvenc dupláid gyakorlása.' },
        { day: 7, title: "Bob's 27", mode: 'bobs27', desc: 'A végső dupla-teszt a héten.' }
    ],
    first9: [
        { day: 1, title: 'Célpont Vadász', mode: 'hunter', desc: 'Fókusz a T20-on.' },
        { day: 2, title: 'Gyors 501', mode: 'x01', desc: 'Figyeld az "Első 9" statisztikád.' },
        { day: 3, title: 'Bemelegítő ATC', mode: 'around', desc: 'Pontosság az egész táblán.' },
        { day: 4, title: 'Pihenőnap', mode: 'rest', desc: 'Nyújtás.' },
        { day: 5, title: 'Darts Math', mode: 'math', desc: 'Tudd fejből az első 3 köröd.' },
        { day: 6, title: 'Célpont Vadász', mode: 'hunter', desc: 'Váltás T20-ról T19-re.' },
        { day: 7, title: 'Profi AI Meccs', mode: 'x01', desc: 'Kezdés nyomás alatt.' }
    ]
};

export function AiCoach({ onBack, onStartDrill }: { onBack: () => void, onStartDrill: (config: MatchConfig) => void }) {
    const [goal, setGoal] = useState<GoalType | null>(null);
    const [completedDays, setCompletedDays] = useState<number[]>([]);
    const [customTasks, setCustomTasks] = useState<TrainingTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCustomTask, setNewCustomTask] = useState('');

    useEffect(() => {
        const fetchCoachData = async () => {
          try {
            const user = auth.currentUser;
            if (user && !user.isAnonymous) {
                const docSnap = await getDoc(doc(db, 'users', user.uid, 'coach', 'plan'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setGoal(data.goal);
                    setCompletedDays(data.completedDays || []);
                    setCustomTasks(data.customTasks || []);
                }
            } else {
                try {
                    const saved = JSON.parse(localStorage.getItem('dartisan_coach_plan') || 'null');
                    if (saved && ['scoring', 'checkout', 'first9'].includes(saved.goal)) {
                        setGoal(saved.goal);
                        setCompletedDays(Array.isArray(saved.completedDays) ? saved.completedDays.filter((day: unknown) => Number.isInteger(day) && Number(day) >= 0) : []);
                        setCustomTasks(Array.isArray(saved.customTasks) ? saved.customTasks.filter((task: TrainingTask) => task && typeof task.title === 'string' && task.mode === 'custom') : []);
                    }
                } catch { /* An invalid local plan starts fresh. */ }
            }
          } catch (error) {
            console.error('Coach plan load failed:', error);
          } finally {
            setLoading(false);
          }
        };
        fetchCoachData();
    }, []);

    const saveCoachData = async (newGoal: GoalType | null, newCompleted: number[], newCustom: TrainingTask[]) => {
        const user = auth.currentUser;
        if (user && !user.isAnonymous) {
            await setDoc(doc(db, 'users', user.uid, 'coach', 'plan'), { goal: newGoal, completedDays: newCompleted, customTasks: newCustom }, { merge: true });
        } else {
            localStorage.setItem('dartisan_coach_plan', JSON.stringify({ goal: newGoal, completedDays: newCompleted, customTasks: newCustom }));
        }
        setGoal(newGoal);
        setCompletedDays(newCompleted);
        setCustomTasks(newCustom);
    };

    const toggleDay = (dayIndex: number) => {
        const newCompleted = completedDays.includes(dayIndex) 
            ? completedDays.filter(d => d !== dayIndex) 
            : [...completedDays, dayIndex];
        saveCoachData(goal, newCompleted, customTasks);
    };

    const addCustomTask = () => {
        if (!newCustomTask.trim()) return;
        const newTask: TrainingTask = { day: customTasks.length + 8, title: newCustomTask, mode: 'custom', desc: 'Saját felvitt edzés', id: Date.now() };
        saveCoachData(goal, completedDays, [...customTasks, newTask]);
        setNewCustomTask('');
    };

    const handleStartTask = (task: TrainingTask) => {
        if (task.mode === 'rest' || task.mode === 'custom') {
            return;
        }
        const config: MatchConfig = {
            gameMode: task.mode === 'x01' ? 'x01' : 'practice',
            practiceType: task.mode !== 'x01' ? task.mode : undefined,
            startingScore: task.mode === 'x01' ? 501 : (task.mode === '121' ? 121 : 0),
            setsToWin: 1, legsToWin: task.mode === 'x01' ? 3 : 1,
            checkIn: 'single', checkout: task.mode === 'x01' ? 'double' : 'single', muteCaller: false,
            players: [{ name: auth.currentUser?.displayName || 'Játékos', isBot: false, difficulty: 5, color: 'cyan' }]
        };
        if (task.mode === 'x01') config.players.push({ name: 'AI Edzőpartner', isBot: true, difficulty: 6, color: 'purple' });
        
        onStartDrill(config);
    };

    if (loading) return <div className="min-h-full w-full bg-[#0b0d11] flex items-center justify-center"><ArrowPathIcon className="h-8 w-8 text-cyan-500 animate-spin" /></div>;

    const currentPlan = goal ? TRAINING_PLANS[goal] : [];
    const fullPlan = [...currentPlan, ...customTasks];
    const progressPct = fullPlan.length > 0 ? Math.round((completedDays.length / fullPlan.length) * 100) : 0;

    return (
        <div className="min-h-full w-full bg-[#0b0d11] text-slate-200 px-4 sm:px-7 lg:px-10 py-6 sm:py-9 pb-16">
            <header className="max-w-6xl mx-auto flex items-center gap-4 mb-7 sm:mb-9">
                <button onClick={onBack} aria-label="Vissza" className="h-11 w-11 shrink-0 rounded-xl border border-slate-700 bg-[#171b23] flex items-center justify-center hover:bg-slate-800"><ArrowLeftIcon className="h-5 w-5" /></button>
                <div className="min-w-0">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.25em] flex items-center gap-1"><SparklesIcon className="h-3 w-3" /> DARTISAN / AI EDZŐ</span>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase italic tracking-tight leading-tight">Heti naptár</h1>
                </div>
            </header>

            {!goal ? (
                <div className="max-w-6xl mx-auto w-full">
                    <div className="rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 via-[#151a23] to-[#101216] p-5 sm:p-7 mb-6">
                        <p className="text-cyan-300 text-xs font-black uppercase tracking-widest mb-2">7 nap · saját tempóban</p>
                        <p className="text-white text-lg sm:text-xl font-bold max-w-2xl">Válassz egy fókuszt a heti edzéstervedhez.</p>
                        <p className="text-slate-400 text-xs mt-3">A feladatokat az edzés után jelölheted késznek.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {(['scoring', 'checkout', 'first9'] as const).map((g, index) => (
                        <button key={g} onClick={() => saveCoachData(g, [], [])} className="min-h-44 p-5 sm:p-6 rounded-2xl bg-[#12141a] border border-cyan-500/30 text-left hover:border-cyan-400 hover:bg-[#17202a] transition-colors flex flex-col">
                            <span className="text-xs font-black text-cyan-400 tracking-widest">0{index + 1} / 03</span>
                            <h3 className="text-xl font-black text-white uppercase mt-3">{g === 'scoring' ? 'Tömegdobás' : g === 'checkout' ? 'Kiszállók' : 'Első 9 nyíl'}</h3>
                            <p className="text-xs text-slate-300 mt-2 leading-relaxed flex-1">{g === 'scoring' ? 'Ponttermelés, célzás és 501 az AI ellen.' : g === 'checkout' ? 'Duplák, 121-es kihívás és nyomáshelyzetek.' : 'Erősebb kezdés és pontosabb első három kör.'}</p>
                            <span className="text-xs uppercase font-black text-cyan-300 mt-4 flex items-center gap-2"><PlayIcon className="h-4 w-4" /> Terv indítása</span>
                        </button>
                    ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
                    {/* Progress Bar (3. Pont) */}
                    <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs uppercase font-black text-slate-400 tracking-widest">{completedDays.length} / {fullPlan.length} nap kész</span>
                            <span className="text-xl font-black text-cyan-400">{progressPct}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
                        </div>
                    </div>

                    {/* Naptár Lista */}
                    <div className="flex flex-col gap-3 mt-2 relative">
                        <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-800 z-0"></div>
                        {fullPlan.map((task, idx) => {
                            const isDone = completedDays.includes(idx);
                            return (
                                <div key={idx} className={`relative z-10 flex gap-4 p-4 rounded-2xl border transition-all ${isDone ? 'bg-emerald-500/10 border-emerald-500/30 opacity-70' : 'bg-[#12141a] border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)]'}`}>
                                    <button onClick={() => toggleDay(idx)} aria-label={`${task.title}: ${isDone ? 'kész jelölés visszavonása' : 'késznek jelölés'}`} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500 text-slate-900' : 'bg-slate-900 border-slate-600 text-slate-600 hover:border-cyan-500'}`}>
                                        {isDone ? <CheckCircleIcon className="h-5 w-5" /> : null}
                                    </button>
                                    <div className="flex-1">
                                        <h4 className={`text-sm font-black uppercase ${isDone ? 'text-emerald-400 line-through' : 'text-white'}`}>{task.title}</h4>
                                        <p className="text-xs text-slate-400 font-bold mt-1">{task.desc}</p>
                                        
                                        {!isDone && task.mode !== 'rest' && task.mode !== 'custom' && (
                                            <button onClick={() => handleStartTask(task)} className="mt-3 w-full h-10 bg-cyan-500 text-slate-900 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95">
                                                <PlayIcon className="h-4 w-4" /> Indítás
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Saját Edzés Felvitele (3. Pont) */}
                    <div className="mt-6 bg-[#12141a] border border-dashed border-slate-700 p-4 rounded-2xl flex flex-col gap-3">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Saját Edzés Felvitele</span>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Pl: 10 perc dupla gyakorlás" value={newCustomTask} onChange={(e) => setNewCustomTask(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 text-sm text-white focus:outline-none focus:border-cyan-500" />
                            <button onClick={addCustomTask} className="bg-slate-800 text-white p-3 rounded-xl hover:bg-slate-700"><PlusIcon className="h-5 w-5"/></button>
                        </div>
                    </div>

                    <button onClick={() => saveCoachData(null, [], [])} className="mt-8 w-full h-12 bg-slate-900 text-slate-500 border border-slate-800 rounded-xl font-black uppercase text-xs hover:text-white">Terv Visszaállítása</button>
                </div>
            )}
        </div>
    );
}
