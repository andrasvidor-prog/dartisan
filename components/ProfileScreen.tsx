'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
    XMarkIcon, BoltIcon, ChartBarIcon, ArrowPathIcon, 
    CheckCircleIcon, TrophyIcon, StarIcon, ClockIcon
} from '@heroicons/react/24/outline';
import { auth, db } from '@/firebase'; 
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
    const lang = 'hu'; 
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((u) => { setUser(u); if(!u) setLoading(false); });
        return () => unsub();
    }, []);

    const fetchData = useCallback(async (uid: string) => {
        const unsub = onSnapshot(doc(db, "users", uid), (s) => {
            if (s.exists()) setStats(s.data());
        });
        const q = query(collection(db, 'users', uid, 'matchHistory'), orderBy('date', 'desc'), limit(10));
        const qs = await getDocs(q);
        setHistory(qs.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
        return unsub;
    }, []);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        let unsub: any;
        fetchData(user.uid).then(fn => unsub = fn);
        return () => unsub && unsub();
    }, [user, fetchData]);

    if (loading) return <div className="h-screen bg-[#0b0d11] flex items-center justify-center"><ArrowPathIcon className="h-10 w-10 text-emerald-500 animate-spin" /></div>;

    const avg = stats?.totalDarts ? ((stats.totalPoints / stats.totalDarts) * 3).toFixed(1) : "0.0";
    const co = stats?.checkoutAttempts ? Math.round((stats.checkoutSuccess / stats.checkoutAttempts) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[100] bg-[#0b0d11] flex flex-col overflow-hidden">
            <header className="p-4 flex justify-end">
                <button onClick={onBack} className="p-3 bg-slate-900 rounded-full border border-slate-800 text-slate-400 hover:text-rose-500 active:scale-90 transition-all">
                    <XMarkIcon className="h-6 w-6" />
                </button>
            </header>

            <main className="flex-1 overflow-y-auto px-4 pb-10 flex flex-col items-center">
                <div className="flex flex-col items-center gap-4 mb-10">
                    <div className="h-28 w-28 rounded-full border-4 border-slate-800 bg-purple-600 flex items-center justify-center text-4xl font-black text-white shadow-xl">
                        {user?.displayName?.[0] || 'U'}
                    </div>
                    <h1 className="text-3xl font-black uppercase italic text-white">{user?.displayName}</h1>
                </div>

                <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-[#12141a] p-5 rounded-2xl border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase block mb-1">Átlag</span>
                        <span className="text-3xl font-mono font-black text-emerald-400">{avg}</span>
                    </div>
                    <div className="bg-[#12141a] p-5 rounded-2xl border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase block mb-1">Kiszálló</span>
                        <span className="text-3xl font-mono font-black text-cyan-400">{co}%</span>
                    </div>
                    <div className="bg-[#12141a] p-5 rounded-2xl border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase block mb-1">180s</span>
                        <span className="text-3xl font-mono font-black text-white">{stats?.count180 || 0}</span>
                    </div>
                    <div className="bg-[#12141a] p-5 rounded-2xl border border-slate-800 text-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase block mb-1">XP</span>
                        <span className="text-3xl font-mono font-black text-purple-400">{stats?.xp || 0}</span>
                    </div>
                </div>

                <section className="w-full max-w-4xl bg-[#12141a] rounded-3xl border border-slate-800 p-6 shadow-2xl">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Előzmények</h3>
                    <table className="w-full text-left text-sm whitespace-nowrap text-white">
                        <tbody className="divide-y divide-slate-800/50">
                            {history.map(m => (
                                <tr key={m.id} className="h-14">
                                    <td className="font-bold uppercase text-xs">{m.mode}</td>
                                    <td className={m.won ? 'text-emerald-400' : 'text-rose-400'}>{m.won ? 'NYERT' : 'VESZTETT'}</td>
                                    <td className="text-right font-mono font-bold text-white text-base">{m.stats?.average?.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </main>
        </div>
    );
}