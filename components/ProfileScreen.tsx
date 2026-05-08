'use client';

import { useState, useEffect } from 'react';
import { TrophyIcon, ArrowLeftIcon, ChartBarIcon, StarIcon, FireIcon, ArrowPathIcon, MagnifyingGlassIcon, PencilIcon, UserPlusIcon, UsersIcon, CheckCircleIcon, XMarkIcon, Cog6ToothIcon, MapIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, getDocs, query, limit, updateDoc, arrayUnion, orderBy } from 'firebase/firestore';
import { UserIcon } from '@heroicons/react/24/solid';

const PREDEFINED_AVATARS = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=0b0d11",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Leo&backgroundColor=0b0d11",
    "https://api.dicebear.com/7.x/identicon/svg?seed=Max&backgroundColor=0b0d11",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=0b0d11"
];

// --- PROFI HŐTÉRKÉP RAJZOLÓ (Dark Mode + Neon Glow) ---
const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const polarToCartesian = (cX: number, cY: number, r: number, angle: number) => { const a = (angle - 90) * Math.PI / 180.0; return { x: cX + (r * Math.cos(a)), y: cY + (r * Math.sin(a)) }; };
const describeArc = (x: number, y: number, inR: number, outR: number, start: number, end: number) => {
  const sOut = polarToCartesian(x, y, outR, end); const eOut = polarToCartesian(x, y, outR, start);
  const sIn = polarToCartesian(x, y, inR, end); const eIn = polarToCartesian(x, y, inR, start);
  const f = end - start <= 180 ? "0" : "1";
  return [ "M", sOut.x, sOut.y, "A", outR, outR, 0, f, 0, eOut.x, eOut.y, "L", eIn.x, eIn.y, "A", inR, inR, 0, f, 1, sIn.x, sIn.y, "Z" ].join(" ");
};

const ProfileHeatmap = ({ heatmapData }: { heatmapData: any }) => {
    const size = 300; 
    const center = size / 2; 
    const sliceAngle = 360 / 20;
    
    let maxHits = 0; 
    Object.values(heatmapData || {}).forEach((d: any) => { if (d.hits > maxHits) maxHits = d.hits; });

    // Színszámoló: Tompa alapszínek, amik a találatoktól felizzanak
    const getSectorStyle = (sectorName: string, isEvenSector: boolean, isMultiplier: boolean) => {
        const hits = heatmapData?.[sectorName]?.hits || 0;
        
        // 1. Alap (Deszaturált) Tábla Színek
        const baseBlack = '#12141a'; // Sötét szektor
        const baseWhite = '#1e232b'; // Világosabb szektor
        const baseRed = '#3d1c24';   // Tompa piros (D/T)
        const baseGreen = '#1b3628'; // Tompa zöld (D/T)
        
        let baseColor = isEvenSector ? baseBlack : baseWhite;
        if (isMultiplier) baseColor = isEvenSector ? baseRed : baseGreen;
        if (sectorName === '25') baseColor = baseGreen;
        if (sectorName === '50') baseColor = baseRed;

        if (hits === 0 || maxHits === 0) return { fill: baseColor, hasGlow: false };

        // 2. Heat (Izzás) Kiszámítása (0.0-tól 1.0-ig)
        const heatRatio = hits / maxHits;
        
        // Hideg (Kevés találat): Sötétlila -> Közepes: Élénk narancs -> Forró: Vakító citromsárga
        const hue = 280 - (heatRatio * 220); 
        const lightness = 40 + (heatRatio * 50); 
        
        return { fill: `hsl(${hue}, 100%, ${lightness}%)`, hasGlow: heatRatio > 0.3 };
    };

    if(!heatmapData || Object.keys(heatmapData).length === 0) return <div className="w-full h-full flex items-center justify-center text-slate-500 font-black uppercase text-xs border border-dashed border-slate-700 rounded-full aspect-square bg-[#0b0d11]">Nincs adat</div>;

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="drop-shadow-[0_0_40px_rgba(182,85,255,0.15)] mx-auto overflow-visible">
            <defs>
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            
            <circle cx={center} cy={center} r={140} fill="#06070a" stroke="#1e293b" strokeWidth="2" />
            
            {DARTBOARD_ORDER.map((num, i) => {
                const s = i * sliceAngle - (sliceAngle / 2); 
                const e = s + sliceAngle; 
                const isEven = i % 2 === 0;
                
                const sData = getSectorStyle(`S${num}`, isEven, false);
                const tData = getSectorStyle(`T${num}`, isEven, true);
                const dData = getSectorStyle(`D${num}`, isEven, true);

                return (
                    <g key={num}>
                        <path d={describeArc(center, center, 15, 75, s, e)} fill={sData.fill} stroke="#0b0d11" strokeWidth="1" filter={sData.hasGlow ? "url(#neonGlow)" : ""} />
                        <path d={describeArc(center, center, 75, 87, s, e)} fill={tData.fill} stroke="#0b0d11" strokeWidth="1" filter={tData.hasGlow ? "url(#neonGlow)" : ""} />
                        <path d={describeArc(center, center, 87, 125, s, e)} fill={sData.fill} stroke="#0b0d11" strokeWidth="1" filter={sData.hasGlow ? "url(#neonGlow)" : ""} />
                        <path d={describeArc(center, center, 125, 137, s, e)} fill={dData.fill} stroke="#0b0d11" strokeWidth="1" filter={dData.hasGlow ? "url(#neonGlow)" : ""} />
                        
                        <text x={polarToCartesian(center, center, 152, s + sliceAngle/2).x} y={polarToCartesian(center, center, 152, s + sliceAngle/2).y} fill="#475569" fontSize="12" fontWeight="900" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${s + sliceAngle/2 + 90}, ${polarToCartesian(center, center, 152, s + sliceAngle/2).x}, ${polarToCartesian(center, center, 152, s + sliceAngle/2).y})`}>
                            {num}
                        </text>
                    </g>
                );
            })}
            
            <circle cx={center} cy={center} r={15} fill={getSectorStyle('25', true, false).fill} stroke="#0b0d11" strokeWidth="1" filter={getSectorStyle('25', true, false).hasGlow ? "url(#neonGlow)" : ""} />
            <circle cx={center} cy={center} r={6.5} fill={getSectorStyle('50', false, true).fill} stroke="#0b0d11" strokeWidth="1" filter={getSectorStyle('50', false, true).hasGlow ? "url(#neonGlow)" : ""} />
        </svg>
    );
};

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
    // Alap state-ek
    const [myStats, setMyStats] = useState<any>(null);
    const [viewedStats, setViewedStats] = useState<any>(null);
    const [monthlyStats, setMonthlyStats] = useState<any>(null);
    const [viewedMonthlyStats, setViewedMonthlyStats] = useState<any>(null);
    const [matchHistory, setMatchHistory] = useState<any[]>([]);
    
    // Alapértelmezett, de később adatbázisból felülírt heatmap adatok
    const [userHeatmap, setUserHeatmap] = useState<any>({
        'T20': { throws: 500, hits: 380 },
        'T19': { throws: 300, hits: 220 },
        'S20': { throws: 1000, hits: 800 },
        'D16': { throws: 150, hits: 110 },
        'D20': { throws: 200, hits: 80 },
        'T18': { throws: 100, hits: 60 }
    });
    
    // UI state-ek
    const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'analytics' | 'social'>('profile');
    const [timeframe, setTimeframe] = useState<'all' | 'month'>('all');
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);

    // Keresés és Social state-ek
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            const user = auth.currentUser;
            if (user) {
                const docSnap = await getDoc(doc(db, 'users', user.uid));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMyStats({ id: user.uid, ...data });
                    setViewedStats({ id: user.uid, ...data });
                }

                // Napló lekérése
                const historyQ = query(collection(db, 'users', user.uid, 'matchHistory'), orderBy('date', 'desc'), limit(15));
                const historySnap = await getDocs(historyQ);
                const hData = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setMatchHistory(hData);
                calculateMonthlyStats(hData, true);

                // Hőtérkép lekérése
                const heatmapSnap = await getDoc(doc(db, 'users', user.uid, 'stats', 'heatmaps', 'setups', 'default'));
                if (heatmapSnap.exists() && Object.keys(heatmapSnap.data() || {}).length > 0) {
                     setUserHeatmap(heatmapSnap.data());
                }
            }
        };
        fetchStats();
    }, []);

    const calculateMonthlyStats = (historyData: any[], isMyStats: boolean) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        let mWon = 0, m180 = 0, mHighOut = 0, mTotalAvg = 0, mMatchCount = 0;

        historyData.forEach((data: any) => {
            const itemDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
            if (itemDate >= thirtyDaysAgo) {
                if (data.won) mWon++;
                m180 += (data.stats?.count180 || 0);
                if ((data.stats?.highestCheckout || 0) > mHighOut) mHighOut = data.stats.highestCheckout;
                if (data.stats?.average) { mTotalAvg += data.stats.average; mMatchCount++; }
            }
        });

        const calcStats = {
            matchesWon: mWon, count180: m180, highestCheckout: mHighOut, 
            average: mMatchCount > 0 ? (mTotalAvg / mMatchCount).toFixed(1) : 0
        };

        if (isMyStats) setMonthlyStats(calcStats);
        setViewedMonthlyStats(calcStats);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const q = query(collection(db, 'users'), limit(20));
            const querySnapshot = await getDocs(q);
            const results: any[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.name?.toLowerCase().includes(searchQuery.toLowerCase()) || `#${data.tag}` === searchQuery) results.push({ id: doc.id, ...data });
            });
            setSearchResults(results);
        } catch (e) { console.error(e); }
        setIsSearching(false);
    };

    const loadUserStats = async (userObj: any) => {
        setViewedStats(userObj);
        setTimeframe('all');
        setActiveTab('profile');
        try {
            const historySnap = await getDocs(collection(db, 'users', userObj.id, 'matchHistory'));
            const hData = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));
            calculateMonthlyStats(hData, false);
        } catch (e) { console.error(e); }
    };

    const handleAddFriend = async (friendId: string) => {
        const user = auth.currentUser;
        if (user && myStats) {
            await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(friendId) });
            setMyStats({ ...myStats, friends: [...(myStats.friends || []), friendId] });
            alert("Barát sikeresen hozzáadva!");
        }
    };

    const handleAvatarSelect = async (url: string) => {
        if (!myStats?.id) return;
        await updateDoc(doc(db, 'users', myStats.id), { selectedAvatar: url });
        setMyStats({ ...myStats, selectedAvatar: url });
        if (viewedStats.id === myStats.id) setViewedStats({ ...viewedStats, selectedAvatar: url });
        setIsEditingAvatar(false);
    };

    if (!myStats || !viewedStats) return <div className="fixed inset-0 z-[200] bg-[#0b0d11] flex items-center justify-center"><ArrowPathIcon className="h-8 w-8 text-emerald-500 animate-spin" /></div>;

    const currentBaseStats = viewedStats;
    const currentMonthlyStats = viewedStats.id === myStats.id ? monthlyStats : viewedMonthlyStats;
    
    // JAVÍTVA: A "highestCheckout" az "all" nézetben egyenesen a felhasználói alapdokumentumból jön!
    const displayStats = timeframe === 'month' && currentMonthlyStats ? currentMonthlyStats : {
        ...currentBaseStats,
        highestCheckout: currentBaseStats.highestCheckout || 0, 
        average: currentBaseStats.totalDarts > 0 ? ((currentBaseStats.totalPoints / currentBaseStats.totalDarts) * 3).toFixed(1) : 0
    };

    const level = Math.floor(Math.sqrt(Math.max(currentBaseStats.xp || 0, 0) / 100)) + 1;
    const getAvatar = (data: any) => data?.selectedAvatar || data?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data?.name || 'Player'}&backgroundColor=0b0d11`;

    const trophies = [
        { name: 'Első Győzelem', desc: 'Nyertél egy meccset', unlocked: currentBaseStats.matchesWon > 0, icon: <TrophyIcon className="h-8 w-8" />, color: 'amber' },
        { name: 'Száznyolcvan!', desc: 'Dobtál egy 180-at', unlocked: currentBaseStats.count180 > 0, icon: <FireIcon className="h-8 w-8" />, color: 'rose' },
        { name: 'Mesterlövész', desc: '100 feletti kiszálló', unlocked: currentBaseStats.highestCheckout >= 100, icon: <StarIcon className="h-8 w-8" />, color: 'cyan' },
        { name: 'Gépágyú', desc: 'Dobtál 10 db 180-at', unlocked: currentBaseStats.count180 >= 10, icon: <FireIcon className="h-8 w-8" />, color: 'purple' },
        { name: 'Veterán', desc: 'Lejátszottál 50 meccset', unlocked: currentBaseStats.matchesPlayed >= 50, icon: <ChartBarIcon className="h-8 w-8" />, color: 'emerald' },
    ];

    const heatDataList = [
        { target: 'T20', rate: 38, color: 'bg-rose-500', text: 'text-rose-500' },
        { target: 'T19', rate: 22, color: 'bg-amber-500', text: 'text-amber-500' },
        { target: 'T18', rate: 12, color: 'bg-emerald-500', text: 'text-emerald-500' },
        { target: 'D16', rate: 15, color: 'bg-cyan-500', text: 'text-cyan-500' },
        { target: 'D20', rate: 8, color: 'bg-indigo-500', text: 'text-indigo-500' },
        { target: 'BULL', rate: 5, color: 'bg-[#b655ff]', text: 'text-[#b655ff]' },
    ];

    return (
        <div className="fixed inset-0 z-[200] bg-[#0b0d11] text-slate-200 overflow-y-auto custom-scrollbar h-[100dvh]">
            <div className="p-4 sm:p-8 relative min-h-full w-full flex flex-col">
                <div className="flex items-center justify-between p-4 shrink-0 bg-[#12141a] border-b border-slate-800 shadow-xl sticky top-0 z-20 mb-6 rounded-2xl">
                    <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-all"><ArrowLeftIcon className="h-5 w-5 text-white" /></button>
                    <div className="flex flex-col items-center">
                        <h1 className="text-xl font-black text-white uppercase italic tracking-widest mt-1">Profil</h1>
                    </div>
                    <div className="w-9"></div>
                </div>
                
                <div className="max-w-4xl mx-auto pb-40 w-full flex-1">
                    
                    {/* NAVIGÁCIÓ */}
                    <div className="flex gap-2 mb-10 bg-slate-900 p-2 rounded-2xl mx-auto border border-slate-800 overflow-x-auto custom-scrollbar shadow-xl">
                        <button onClick={() => { setActiveTab('profile'); setViewedStats(myStats); setTimeframe('all'); }} className={`flex-1 py-2 px-4 rounded-xl font-black uppercase text-[10px] sm:text-xs whitespace-nowrap transition-all ${activeTab === 'profile' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}>Profil</button>
                        <button onClick={() => setActiveTab('history')} className={`flex-1 py-2 px-4 rounded-xl font-black uppercase text-[10px] sm:text-xs whitespace-nowrap transition-all ${activeTab === 'history' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white'}`}>Napló</button>
                        <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-2 px-4 rounded-xl font-black uppercase text-[10px] sm:text-xs whitespace-nowrap transition-all ${activeTab === 'analytics' ? 'bg-[#b655ff] text-white' : 'text-slate-500 hover:text-white'}`}>Hőtérkép</button>
                        <button onClick={() => setActiveTab('social')} className={`flex-1 py-2 px-4 rounded-xl font-black uppercase text-[10px] sm:text-xs whitespace-nowrap transition-all ${activeTab === 'social' ? 'bg-cyan-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}>Social / Klub</button>
                    </div>

                    {/* --- 1. PROFIL FÜL --- */}
                    {activeTab === 'profile' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            {viewedStats.id !== myStats.id && (
                                <button onClick={() => setViewedStats(myStats)} className="mb-6 mx-auto text-emerald-400 font-bold text-sm flex items-center justify-center gap-2 hover:text-emerald-300"><ArrowLeftIcon className="h-4 w-4"/> Vissza a saját profilomra</button>
                            )}

                            <div className="flex flex-col items-center mb-8 relative">
                                <div className="relative group cursor-pointer" onClick={() => viewedStats.id === myStats.id && setIsEditingAvatar(true)}>
                                    <img src={getAvatar(currentBaseStats)} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fallback&backgroundColor=0b0d11' }} className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] mb-4 bg-slate-800" alt="avatar"/>
                                    {viewedStats.id === myStats.id && (
                                        <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity mb-4"><PencilIcon className="h-8 w-8 text-white" /></div>
                                    )}
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-black text-white uppercase italic">{currentBaseStats.name}</h1>
                                <p className="text-emerald-400 font-black tracking-[0.3em] mb-2">#{currentBaseStats.tag || '0000'}</p>
                                <span className="bg-emerald-500 text-slate-900 px-3 py-1 rounded-lg text-sm font-black uppercase tracking-widest mt-2">Szint {level}</span>
                            </div>

                            <div className="flex justify-center mb-8">
                                <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 shadow-inner">
                                    <button onClick={() => setTimeframe('all')} className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${timeframe === 'all' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Összesített</button>
                                    <button onClick={() => setTimeframe('month')} className={`px-4 py-2 rounded-lg font-black uppercase text-[10px] transition-all ${timeframe === 'month' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>Elmúlt 30 nap</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 text-center">
                                <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-lg">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Nyert Meccsek</span>
                                    <span className="text-3xl font-mono font-black text-white">{displayStats?.matchesWon || 0}</span>
                                </div>
                                <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-lg">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">180-ak Száma</span>
                                    <span className="text-3xl font-mono font-black text-rose-500">{displayStats?.count180 || 0}</span>
                                </div>
                                <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-lg">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Max Kiszálló</span>
                                    <span className="text-3xl font-mono font-black text-amber-500">{displayStats?.highestCheckout || 0}</span>
                                </div>
                                <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-lg">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">{timeframe === 'month' ? 'Havi Átlag' : 'Összesített Átlag'}</span>
                                    <span className="text-3xl font-mono font-black text-cyan-400">{displayStats?.average || 0}</span>
                                </div>
                            </div>

                            <h2 className="text-2xl font-black text-white uppercase italic mb-6">Trófeaterem</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {trophies.map((tr, i) => (
                                    <div key={i} className={`p-6 rounded-3xl border flex gap-4 items-center transition-all ${tr.unlocked ? `bg-${tr.color}-500/10 border-${tr.color}-500/30 shadow-[0_0_20px_rgba(var(--${tr.color}-500),0.1)]` : 'bg-slate-900/50 border-slate-800 opacity-50 grayscale'}`}>
                                        <div className={`p-3 rounded-2xl ${tr.unlocked ? `bg-${tr.color}-500 text-slate-900` : 'bg-slate-800 text-slate-500'}`}>
                                            {tr.icon}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-black uppercase text-sm ${tr.unlocked ? `text-${tr.color}-400` : 'text-slate-500'}`}>{tr.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 mt-1">{tr.desc}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- 2. MECCSNAPLÓ FÜL --- */}
                    {activeTab === 'history' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 max-w-2xl mx-auto">
                            <h2 className="text-2xl font-black text-white uppercase italic mb-6 flex items-center gap-2"><ChartBarIcon className="h-6 w-6 text-indigo-500" /> Meccsek & Analytics</h2>
                            {matchHistory.length === 0 ? <p className="text-slate-500 font-bold uppercase text-center border border-dashed border-slate-800 p-8 rounded-2xl">Még nincs rögzített meccs.</p> : (
                                <div className="flex flex-col gap-4">
                                    {matchHistory.map((m, i) => (
                                        <div key={i} onClick={() => setSelectedMatch(m)} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:border-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{(m.date?.toDate ? m.date.toDate() : new Date(m.date)).toLocaleDateString()} • {m.mode}</span>
                                                <span className="text-white font-black uppercase italic text-lg">vs {m.opponent}</span>
                                                <span className="text-xs font-black text-slate-400 mt-1">Eredmény: <span className="text-white">{m.score || '? - ?'}</span></span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col text-right hidden sm:flex">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Átlag</span>
                                                    <span className="text-xl font-mono font-black text-indigo-400">{m.stats?.average?.toFixed(1) || 0}</span>
                                                </div>
                                                <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-black text-xl ${m.won ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/50' : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'}`}>
                                                    {m.won ? 'W' : 'L'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- 3. ADVANCED ANALYTICS (Heatmap) --- */}
                    {activeTab === 'analytics' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 max-w-2xl mx-auto flex flex-col gap-6">
                            <h2 className="text-2xl font-black text-white uppercase italic flex items-center gap-2"><ChartBarIcon className="h-6 w-6 text-[#b655ff]" /> Globális Hőtérkép</h2>
                            
                            <div className="bg-[#12141a] border border-[#b655ff]/30 p-6 rounded-3xl shadow-[0_0_30px_rgba(182,85,255,0.1)] flex flex-col items-center">
                                <p className="text-slate-400 text-xs font-bold mb-8 text-center max-w-md">Az összes rögzített dobásod vizuális lenyomata. A lila/rózsaszín területek mutatják, hová dobsz a leggyakrabban.</p>
                                <div className="w-full max-w-xs aspect-square mb-6">
                                    <ProfileHeatmap heatmapData={userHeatmap} />
                                </div>
                            </div>

                            <div className="bg-[#12141a] p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5"><MapIcon className="h-32 w-32" /></div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-6"><FireIcon className="h-5 w-5 text-rose-500" /> Találati Arányok</h3>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 relative z-10">
                                    {heatDataList.map((data, i) => (
                                        <div key={i} className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group hover:border-slate-600 transition-colors">
                                            <div className={`absolute bottom-0 left-0 right-0 opacity-20 transition-all duration-500 group-hover:opacity-40 ${data.color}`} style={{ height: `${data.rate}%` }}></div>
                                            <span className={`text-3xl font-black italic mb-1 drop-shadow-md ${data.text}`}>{data.target}</span>
                                            <span className="text-xl font-bold text-white">{data.rate}%</span>
                                            <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Arány</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- 4. SOCIAL / KLUB --- */}
                    {activeTab === 'social' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 max-w-xl mx-auto">
                            <h2 className="text-2xl font-black text-white uppercase italic mb-6 flex items-center gap-2"><UsersIcon className="h-6 w-6 text-cyan-400" /> Közösség & Keresés</h2>
                            
                            <div className="flex gap-2 mb-8">
                                <input type="text" placeholder="Keresés (pl. #3753 vagy Név)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 text-white font-bold focus:outline-none focus:border-cyan-500" />
                                <button onClick={handleSearch} className="bg-cyan-500 px-4 rounded-xl text-slate-950 hover:bg-cyan-400"><MagnifyingGlassIcon className="h-6 w-6 font-black" /></button>
                            </div>

                            <div className="flex flex-col gap-3 mb-10">
                                {isSearching ? <p className="text-slate-500 font-bold uppercase text-center animate-pulse">Keresés...</p> : searchResults.map((u, i) => (
                                    <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => loadUserStats(u)}>
                                            <img src={getAvatar(u)} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fallback&backgroundColor=0b0d11' }} className="w-10 h-10 rounded-full bg-slate-800" alt="avatar"/>
                                            <div>
                                                <h3 className="text-white font-black uppercase text-sm leading-tight hover:text-cyan-400 transition-colors">{u.name}</h3>
                                                <p className="text-cyan-400 text-[10px] font-bold tracking-widest">#{u.tag || '0000'} • Lvl {Math.floor(Math.sqrt(Math.max(u.xp || 0, 0) / 100)) + 1}</p>
                                            </div>
                                        </div>
                                        {myStats.friends?.includes(u.id) || u.id === myStats.id ? (
                                            <CheckCircleIcon className="h-6 w-6 text-emerald-500" />
                                        ) : (
                                            <button onClick={() => handleAddFriend(u.id)} className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20"><UserPlusIcon className="h-5 w-5" /></button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <ShieldCheckIcon className="h-16 w-16 text-cyan-500 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]" />
                            <h2 className="text-3xl font-black text-white uppercase italic mb-2 text-center">Dartisan Club</h2>
                            <p className="text-slate-400 font-bold mb-8 text-sm text-center">Hamarosan létrehozhatsz saját csapatot, ahol közös XP-t gyűjthettek, és kihívhattok más klubokat!</p>
                            
                            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl opacity-50 grayscale pointer-events-none">
                                <h3 className="text-xl font-black text-white uppercase italic mb-6">Klub Ranglista (Minta)</h3>
                                <div className="flex flex-col gap-3">
                                    <div className="bg-[#12141a] p-4 rounded-xl flex items-center justify-between border border-cyan-500/50">
                                        <div className="flex items-center gap-3"><span className="text-cyan-400 font-black">1.</span><span className="text-white font-black uppercase">Steel Pointers Bp</span></div>
                                        <span className="text-cyan-400 font-mono font-black">12,500 XP</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedMatch && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#12141a] border border-indigo-500/50 p-6 sm:p-8 rounded-[2rem] w-full max-w-lg shadow-[0_0_50px_rgba(99,102,241,0.2)] relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button onClick={() => setSelectedMatch(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><XMarkIcon className="h-8 w-8" /></button>
                        
                        <div className="text-center mb-8 border-b border-slate-800 pb-6">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] block mb-2">{(selectedMatch.date?.toDate ? selectedMatch.date.toDate() : new Date(selectedMatch.date)).toLocaleString()}</span>
                            <h2 className="text-3xl font-black text-white uppercase italic">vs {selectedMatch.opponent}</h2>
                            <div className="mt-4 inline-block bg-slate-900 border border-slate-700 px-6 py-2 rounded-2xl">
                                <span className="text-2xl font-mono font-black text-white">{selectedMatch.score || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Meccs Átlag</span>
                                <span className="text-2xl font-mono font-black text-white">{selectedMatch.stats?.average?.toFixed(1) || 0}</span>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Első 9 Átlag</span>
                                <span className="text-2xl font-mono font-black text-[#b655ff]">{selectedMatch.stats?.first9Average?.toFixed(1) || 0}</span>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Kiszálló Arány</span>
                                <span className="text-2xl font-mono font-black text-emerald-400">{Math.round((selectedMatch.stats?.checkoutPct || 0)*100)}%</span>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Legjobb Leg</span>
                                <span className="text-2xl font-mono font-black text-cyan-400">{(selectedMatch.stats?.bestLegDarts || 0) > 0 ? `${selectedMatch.stats.bestLegDarts} nyíl` : '-'}</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
                            <div className="text-center"><span className="text-[10px] text-slate-500 uppercase font-black block">100+</span><span className="text-lg font-mono font-black text-white">{selectedMatch.stats?.count100 || 0}</span></div>
                            <div className="w-px h-8 bg-slate-700"></div>
                            <div className="text-center"><span className="text-[10px] text-slate-500 uppercase font-black block">140+</span><span className="text-lg font-mono font-black text-white">{selectedMatch.stats?.count140 || 0}</span></div>
                            <div className="w-px h-8 bg-slate-700"></div>
                            <div className="text-center"><span className="text-[10px] text-slate-500 uppercase font-black block">180</span><span className="text-lg font-mono font-black text-rose-500">{selectedMatch.stats?.count180 || 0}</span></div>
                        </div>
                    </div>
                </div>
            )}

            {isEditingAvatar && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#12141a] border border-slate-800 p-8 rounded-[2rem] w-full max-w-lg shadow-2xl relative">
                        <h2 className="text-2xl font-black text-white uppercase italic mb-6 text-center">Válassz egy Avatart</h2>
                        <div className="grid grid-cols-4 gap-4">
                            {PREDEFINED_AVATARS.map((url, i) => (
                                <button key={i} onClick={() => handleAvatarSelect(url)} className="p-2 bg-slate-900 border border-slate-700 rounded-2xl hover:border-emerald-500 hover:scale-110 transition-all"><img src={url} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fallback&backgroundColor=0b0d11' }} className="w-full h-auto rounded-full" alt={`avatar-${i}`}/></button>
                            ))}
                        </div>
                        <button onClick={() => setIsEditingAvatar(false)} className="w-full mt-8 h-12 bg-slate-800 text-white rounded-xl font-black uppercase text-sm hover:bg-slate-700">Mégsem</button>
                    </div>
                </div>
            )}
        </div>
    );
}