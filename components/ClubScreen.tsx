'use client';

import { useState, useEffect } from 'react';
import { 
    XMarkIcon, ShieldCheckIcon, UsersIcon, PlusIcon, 
    ArrowsPointingOutIcon, HandThumbUpIcon, GlobeEuropeAfricaIcon // <-- Hozzáadva a hiányzó import!
} from '@heroicons/react/24/outline';
import { 
    collection, query, orderBy, limit, onSnapshot, doc, getDoc 
} from 'firebase/firestore';
import { db } from '../firebase'; 

// <-- Kijavítva az interface, hogy opcionális legyen a lang
interface ClubScreenProps {
    onBack: () => void;
    currentUser: any; 
    onBackToSetup?: () => void; 
    lang?: 'hu' | 'en'; 
}

const t = {
    en: {
        title: "Dartisan Clubs", search: "Search for clubs or tags...", create: "Create Club",
        globalRank: "Global Club Leaderboard", contribution: "Match XP Added to Club!", noClubTitle: "You're not in a club!",
        noClubDesc: "Join a club or create your own to gain shared XP!", join: "Join", back: "Back",
        myClubTitle: "My Club Dashboard", members: "Members", contributionRank: "My Contribution Rank",
    },
    hu: {
        title: "Dartisan Klubok", search: "Keresés klubra vagy tagra...", create: "Létrehozás",
        globalRank: "Globális Klub Ranglista", contribution: "A meccs XP-je hozzáadva!", noClubTitle: "Még nem vagy klubban!",
        noClubDesc: "Csatlakozz egy klubhoz vagy hozz létre egyet, és gyűjtsetek közös XP-t!", join: "Csatlakozás", back: "Vissza",
        myClubTitle: "Klubom Irányítópultja", members: "Tagok", contributionRank: "Hozzájárulásom",
    }
};

export function ClubScreen({ onBack, currentUser, onBackToSetup, lang: propLang }: ClubScreenProps) {
    // Okos nyelv betöltés, ha esetleg nem kapná meg prop-ként
    const [lang, setLang] = useState<'hu' | 'en'>(propLang || 'hu');
    
    useEffect(() => {
        if (typeof window !== 'undefined' && !propLang) {
            const savedLang = localStorage.getItem('dartisan_lang') as 'hu' | 'en';
            if (savedLang) setLang(savedLang);
        }
    }, [propLang]);

    const txt = t[lang];
    const [club, setClub] = useState<any>(null); 
    const [allClubs, setAllClubs] = useState<any[]>([]); 
    const [isLoading, setIsLoading] = useState(true);

    // 1. BEJELENTKEZETT FELHASZNÁLÓ KLUBJÁNAK LEKÉRDEZÉSE (Real-time)
    useEffect(() => {
        if (!currentUser) { setIsLoading(false); return; }

        const unsub = onSnapshot(doc(db, "users", currentUser.uid), async (userSnap) => {
            if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.clubId) {
                    const clubSnap = await getDoc(doc(db, "clubs", userData.clubId));
                    if (clubSnap.exists()) {
                        const clubData = clubSnap.data();
                        setClub({ id: clubSnap.id, ...clubData });
                    } else {
                        setClub(null); 
                    }
                } else {
                    setClub(null); 
                }
            } else {
                setClub(null); 
            }
            setIsLoading(false);
        });

        return () => unsub();
    }, [currentUser]);

    // 2. GLOBÁLIS KLUB RANGLISTA LEKÉRDEZÉSE (Real-time)
    useEffect(() => {
        const q = query(collection(db, "clubs"), orderBy("totalXp", "desc"), limit(50));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const clubsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllClubs(clubsData);
        });

        return () => unsubscribe();
    }, []);

    // Ha a felhasználó nincs bejelentkezve
    if (!currentUser) {
        return (
            <div className="fixed inset-0 z-[150] bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
                <ShieldCheckIcon className="h-24 w-24 text-slate-500 mb-6 animate-pulse" />
                <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">{txt.noClubTitle}</h2>
                <p className="text-slate-400 font-bold mb-8">Az éles klub funkció megtekintéséhez jelentkezz be.</p>
                <button onClick={onBackToSetup || onBack} className="w-full max-w-sm h-14 rounded-xl bg-slate-800 text-white font-black uppercase shadow-xl hover:bg-slate-700">{txt.back}</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-[#0b0d11] text-slate-200 flex flex-col overflow-y-auto px-4 pb-24 pt-12 custom-scrollbar">
            
            {/* HÁTTÉR - Kijavítva egy egyszerű, de látványos ikonra a dartstábla helyett */}
            <div className="absolute inset-0 z-0 opacity-[0.03] scale-150 transform pointer-events-none flex items-center justify-center">
                <ShieldCheckIcon className="w-full h-full max-w-3xl max-h-3xl text-cyan-500" />
            </div>

            {/* FEJLÉC */}
            <div className="relative top-0 left-0 right-0 z-[999] flex justify-between items-center bg-[#12141a] p-3 rounded-2xl border border-slate-800 shadow-lg shrink-0 mb-8">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white transition-all"><XMarkIcon className="h-6 w-6" /></button>
                    <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{txt.title}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <input type="text" placeholder={txt.search} className="w-64 h-10 bg-[#0b0d11] border border-slate-700 rounded-xl px-4 text-xs font-bold outline-none focus:border-cyan-500 transition-colors hidden sm:block" />
                    {club && (
                        <div className="flex gap-2">
                            <button className="h-10 bg-[#ff9e00]/10 border border-[#ff9e00]/30 text-[#ff9e00] rounded-xl px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><ArrowsPointingOutIcon className="h-4 w-4"/> <span className="hidden sm:inline">{txt.myClubTitle}</span></button>
                            <button className="h-10 bg-cyan-500 text-slate-950 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-cyan-400 active:scale-95 transition-all"><HandThumbUpIcon className="h-4 w-4"/> <span className="hidden sm:inline">{txt.contribution}</span></button>
                        </div>
                    )}
                </div>
            </div>

            {/* FŐ TARTALOM */}
            <div className="flex-1 flex flex-col gap-8 z-10 w-full max-w-7xl mx-auto">
                
                {isLoading ? (
                    <div className="text-center py-24 text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Betöltés...</div>
                ) : !club ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 bg-[#12141a]/90 backdrop-blur-lg rounded-[2.5rem] border border-slate-800 shadow-2xl shrink-0">
                        <ShieldCheckIcon className="h-24 w-24 text-slate-500 mb-6 grayscale opacity-60" />
                        <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">{txt.noClubTitle}</h2>
                        <p className="text-slate-400 font-bold mb-8 max-w-sm">{txt.noClubDesc}</p>
                        <div className="w-full max-w-sm flex gap-4">
                            <button onClick={onBack} className="flex-1 h-14 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs">{txt.back}</button>
                            <button className="flex-1 h-14 bg-[#ff9e00] text-slate-950 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"><PlusIcon className="h-5 w-5"/> {txt.create}</button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[#12141a]/90 backdrop-blur-lg rounded-[2.5rem] border border-slate-800 p-8 shrink-0 flex flex-col gap-8">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{txt.myClubTitle}</span>
                                <div className="flex items-center gap-3">
                                    <ShieldCheckIcon className="h-10 w-10 text-cyan-400"/>
                                    <h2 className="text-4xl sm:text-5xl font-black text-white uppercase italic tracking-tighter leading-none">{club.name}</h2>
                                </div>
                                <span className="text-sm font-black text-cyan-400 uppercase tracking-widest mt-1">Éles rendszer – Nincs Minta Adat</span>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1 block">Klub Rangja</span>
                                <span className="text-4xl font-mono font-black text-white leading-none">#{allClubs.findIndex(c => c.id === club.id) + 1}</span>
                            </div>
                        </div>

                        <p className="text-slate-400 mb-4 font-bold text-center leading-relaxed">
                            A Klub éles, valós XP-vel rendelkezik. A meccsek végén automatikusan hozzáadódik az XP, ami befolyásolja a globális rangot. Jelenleg nem lehet még klubot létrehozni, az a következő frissítésben jön!
                        </p>

                        <div className="w-full flex flex-col items-center justify-center border border-slate-800 rounded-3xl p-6 bg-slate-950/50">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full">
                                <div className="p-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-4">
                                    <ShieldCheckIcon className="h-10 w-10 text-cyan-400 shrink-0"/>
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-black text-cyan-300 uppercase tracking-[0.2em] mb-1">Klub XP</p>
                                        <p className="text-5xl font-black font-mono text-cyan-400 leading-none">{club.totalXp || 0}</p>
                                    </div>
                                </div>
                                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-4">
                                    <UsersIcon className="h-10 w-10 text-amber-400 shrink-0"/>
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-black text-amber-300 uppercase tracking-[0.2em] mb-1">{txt.members}</p>
                                        <p className="text-5xl font-black font-mono text-amber-400 leading-none">{(club.members || []).length} fő</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- GLOBÁLIS KLUB RANGLISTA --- */}
                <div className="w-full bg-[#12141a] rounded-[2rem] p-6 border border-slate-800 shadow-2xl flex flex-col shrink-0">
                    <div className="flex items-center gap-3 mb-6">
                        <GlobeEuropeAfricaIcon className="h-10 w-10 text-[#ff2b5e]" />
                        <h3 className="text-2xl font-black text-white italic uppercase text-left leading-none">{txt.globalRank}</h3>
                    </div>
                    
                    {allClubs.length === 0 ? (
                        <div className="text-center py-24 text-slate-500 font-bold animate-pulse text-xs uppercase tracking-widest">Ranglista betöltése...</div>
                    ) : (
                        <div className="flex flex-col gap-2 w-full pr-1 custom-scrollbar">
                            {allClubs.map((c, idx) => (
                                <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl border ${club && club.id === c.id ? 'bg-[#ff2b5e]/10 border-[#ff2b5e]/50 shadow-[0_0_15px_rgba(255,43,94,0.15)]' : 'bg-[#0b0d11] border-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-black text-xs w-5 text-left ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-600'}`}>{idx + 1}.</span>
                                        <ShieldCheckIcon className="h-8 w-8 text-cyan-400 grayscale"/>
                                        <div className="flex flex-col text-left">
                                            <span className={`font-bold text-sm leading-none ${club && club.id === c.id ? 'text-white' : 'text-slate-300'}`}>{c.name}</span>
                                            <span className="text-[9px] text-slate-500 uppercase font-black">{txt.members}: {(c.members || []).length} fő</span>
                                        </div>
                                    </div>
                                    <span className="text-[#ff2b5e] font-black font-mono text-sm">{c.totalXp || 0} XP</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}