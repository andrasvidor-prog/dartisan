'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
    TrophyIcon, ArrowLeftIcon, ChartBarIcon, StarIcon, FireIcon,
    ArrowPathIcon, MagnifyingGlassIcon, PencilIcon, UserPlusIcon,
    UsersIcon, CheckCircleIcon, XMarkIcon, ShieldCheckIcon, BoltIcon,
    CalendarDaysIcon, InformationCircleIcon
} from '@heroicons/react/24/outline';
import { db, auth } from '../firebase';
import {
    doc, onSnapshot, collection, getDocs, query, limit,
    updateDoc, arrayUnion, orderBy, getDoc, setDoc
} from 'firebase/firestore';

// ─── Constants ────────────────────────────────────────────────────────────────
const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const PREDEFINED_AVATARS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=0b0d11',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Leo&backgroundColor=0b0d11',
    'https://api.dicebear.com/7.x/identicon/svg?seed=Max&backgroundColor=0b0d11',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=0b0d11',
];

// Achievement color map — static Tailwind classes only
const ACH_COLORS: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   iconBg: 'bg-amber-500'   },
    rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    iconBg: 'bg-rose-500'    },
    cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    iconBg: 'bg-cyan-500'    },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', iconBg: 'bg-emerald-500' },
    purple:  { bg: 'bg-[#b655ff]/10',   border: 'border-[#b655ff]/30',   text: 'text-[#b655ff]',   iconBg: 'bg-[#b655ff]'  },
    indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  iconBg: 'bg-indigo-500'  },
};

// ─── SVG helpers ──────────────────────────────────────────────────────────────
const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const a = (angle - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};
const describeArc = (x: number, y: number, r1: number, r2: number, s: number, e: number) => {
    const so = polarToCartesian(x, y, r2, e), eo = polarToCartesian(x, y, r2, s);
    const si = polarToCartesian(x, y, r1, e), ei = polarToCartesian(x, y, r1, s);
    const f = e - s <= 180 ? '0' : '1';
    return ['M', so.x, so.y, 'A', r2, r2, 0, f, 0, eo.x, eo.y, 'L', ei.x, ei.y, 'A', r1, r1, 0, f, 1, si.x, si.y, 'Z'].join(' ');
};

// Heat gradient: dark B&W board → increasingly RED for frequent throws
const heatColor = (ratio: number) => {
    if (ratio <= 0) return null;
    if (ratio < 0.12) return '#450a0a';   // barely dark crimson
    if (ratio < 0.28) return '#7f1d1d';   // dark red
    if (ratio < 0.48) return '#b91c1c';   // medium red
    if (ratio < 0.68) return '#dc2626';   // vivid red
    if (ratio < 0.85) return '#ef4444';   // bright red
    return '#f87171';                      // hot pink-red (max)
};

// ─── Heatmap SVG ──────────────────────────────────────────────────────────────
type HM = Record<string, { hits: number; throws: number }>;

const ProfileHeatmap = ({ data, filter }: { data: HM; filter: 'all' | 'single' | 'double' | 'treble' }) => {
    const SIZE = 320; const C = SIZE / 2; const SA = 360 / 20;

    const maxThrows = useMemo(() => {
        let m = 1;
        Object.entries(data).forEach(([k, v]) => {
            const type = k.startsWith('T') ? 'treble' : k.startsWith('D') || k === '50' ? 'double' : 'single';
            if (filter === 'all' || filter === type) m = Math.max(m, v.throws);
        });
        return m;
    }, [data, filter]);

    const getRatio = (key: string) => {
        const v = data[key];
        if (!v) return 0;
        const type = key.startsWith('T') ? 'treble' : key.startsWith('D') || key === '50' ? 'double' : 'single';
        if (filter !== 'all' && filter !== type) return 0;
        return v.throws / maxThrows;
    };

    // True black-and-white dartboard base (red/green on multi rings = classic board look)
    const baseColor = (isEven: boolean, isMulti: boolean) => {
        if (isMulti) return isEven ? '#e11d48' : '#10b981'; // red / green for double+treble rings
        return isEven ? '#1a1a1a' : '#d4d4d4';               // near-black / near-white alternating
    };

    const fill = (key: string, isEven: boolean, isMulti: boolean) => {
        const r = getRatio(key);
        return heatColor(r) ?? baseColor(isEven, isMulti);
    };

    return (
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-xs mx-auto drop-shadow-[0_0_30px_rgba(182,85,255,0.15)]">
            <circle cx={C} cy={C} r={145} fill="#08090c" stroke="#1e293b" strokeWidth="1.5" />
            {DARTBOARD_ORDER.map((num, i) => {
                const s = i * SA - SA / 2; const e = s + SA;
                const isEven = i % 2 === 0;
                const tp = polarToCartesian(C, C, 150, s + SA / 2);
                return (
                    <g key={num}>
                        <path d={describeArc(C, C, 15, 75, s, e)}  fill={fill(`S${num}`, isEven, false)} stroke="#0b0d11" strokeWidth="0.8" />
                        <path d={describeArc(C, C, 75, 87, s, e)}  fill={fill(`T${num}`, isEven, true)}  stroke="#0b0d11" strokeWidth="0.8" />
                        <path d={describeArc(C, C, 87, 125, s, e)} fill={fill(`S${num}`, isEven, false)} stroke="#0b0d11" strokeWidth="0.8" />
                        <path d={describeArc(C, C, 125, 138, s, e)} fill={fill(`D${num}`, isEven, true)} stroke="#0b0d11" strokeWidth="0.8" />
                        <text x={tp.x} y={tp.y} fill="#475569" fontSize="11" fontWeight="900" fontFamily="monospace"
                            textAnchor="middle" dominantBaseline="middle"
                            transform={`rotate(${s + SA / 2 + 90} ${tp.x} ${tp.y})`}>{num}</text>
                    </g>
                );
            })}
            <circle cx={C} cy={C} r={15}  fill={fill('25', true,  false)} stroke="#0b0d11" strokeWidth="0.8" />
            <circle cx={C} cy={C} r={6.5} fill={fill('50', false, true)}  stroke="#0b0d11" strokeWidth="0.8" />
        </svg>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProfileScreen({ onBack }: { onBack: () => void }) {
    const [myStats, setMyStats]         = useState<any>(null);
    const [viewedStats, setViewedStats] = useState<any>(null);
    const isViewingOther                = useRef(false);

    const [matchHistory, setMatchHistory] = useState<any[]>([]);
    const [userHeatmap, setUserHeatmap]   = useState<HM | null>(null);
    const [hmFilter, setHmFilter]         = useState<'all' | 'single' | 'double' | 'treble'>('all');
    const [isLoadingHM, setIsLoadingHM]   = useState(false);

    const [activeTab, setActiveTab]     = useState<'profile' | 'history' | 'analytics' | 'social'>('profile');
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);

    const [searchQuery,   setSearchQuery]   = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching,   setIsSearching]   = useState(false);

    // ── Checkout / preference settings ───────────────────────────────────────
    const [prefCheckout,   setPrefCheckout]   = useState<'single' | 'double'>('double');
    const [prefInputMode,  setPrefInputMode]  = useState<'fast' | 'detailed' | 'board'>('fast');
    const [prefFavDouble,  setPrefFavDouble]  = useState('D16');
    const [settingsSaved,  setSettingsSaved]  = useState(false);

    // ── Real-time user stats ──────────────────────────────────────────────────
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (!snap.exists()) return;
            const s = { id: user.uid, ...snap.data() };
            setMyStats(s);
            if (!isViewingOther.current) setViewedStats(s);
        });
        return () => unsub();
    }, []);

    // ── Match history ─────────────────────────────────────────────────────────
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, 'users', user.uid, 'matchHistory'), orderBy('date', 'desc'), limit(20));
        getDocs(q).then(snap => setMatchHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    // ── Load preference settings ──────────────────────────────────────────────
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        getDoc(doc(db, 'users', user.uid)).then(snap => {
            if (!snap.exists()) return;
            const s = snap.data().settings || {};
            if (s.checkout)   setPrefCheckout(s.checkout);
            if (s.inputMode)  setPrefInputMode(s.inputMode);
            if (s.favDouble)  setPrefFavDouble(s.favDouble);
        });
    }, []);

    const handleSaveSettings = async () => {
        const user = auth.currentUser;
        if (!user) return;
        await updateDoc(doc(db, 'users', user.uid), {
            'settings.checkout':   prefCheckout,
            'settings.inputMode':  prefInputMode,
            'settings.favDouble':  prefFavDouble,
        });
        if (typeof window !== 'undefined') {
            localStorage.setItem('dartisan_fav_double', prefFavDouble);
            localStorage.setItem('dartisan_pref_input', prefInputMode);
        }
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
    };

    // ── Heatmap (real-time, load when tab is active) ──────────────────────────
    useEffect(() => {
        if (activeTab !== 'analytics') return;
        const user = auth.currentUser;
        if (!user) return;
        setIsLoadingHM(true);
        const unsub = onSnapshot(
            doc(db, 'users', user.uid, 'stats', 'heatmaps', 'setups', 'default'),
            (snap) => {
                setIsLoadingHM(false);
                if (snap.exists() && Object.keys(snap.data()).length > 0) {
                    setUserHeatmap(snap.data() as HM);
                } else {
                    setUserHeatmap(null);
                }
            }
        );
        return () => unsub();
    }, [activeTab]);

    // ── Derived stats ─────────────────────────────────────────────────────────
    const stats = viewedStats;
    const level = stats ? Math.floor(Math.sqrt(Math.max(stats.xp || 0, 0) / 100)) + 1 : 1;
    const avg   = stats?.totalDarts > 0 ? ((stats.totalPoints / stats.totalDarts) * 3).toFixed(1) : '—';
    const f9avg = stats?.first9Darts > 0 ? ((stats.first9Points / stats.first9Darts) * 3).toFixed(1) : '—';
    const coPct = stats?.checkoutAttempts > 0
        ? Math.round((stats.checkoutSuccess / stats.checkoutAttempts) * 100)
        : 0;
    const winRate = stats?.matchesPlayed > 0
        ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100)
        : 0;

    const getAvatar = (d: any) =>
        d?.selectedAvatar || d?.photoURL ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${d?.name || 'Player'}&backgroundColor=0b0d11`;

    // ── Achievements ──────────────────────────────────────────────────────────
    const achievements = stats ? [
        { name: 'Első Győzelem',   desc: 'Nyertél egy meccset',                unlocked: stats.matchesWon > 0,             color: 'amber',   icon: <TrophyIcon className="h-7 w-7" /> },
        { name: 'Száznyolcvan!',   desc: 'Dobtál egy 180-at',                  unlocked: stats.count180 > 0,               color: 'rose',    icon: <FireIcon   className="h-7 w-7" /> },
        { name: 'Mesterlövész',    desc: '100+ kiszálló',                      unlocked: stats.highestCheckout >= 100,     color: 'cyan',    icon: <StarIcon   className="h-7 w-7" /> },
        { name: 'Kiszálló Király', desc: '170-es kiszálló',                    unlocked: stats.highestCheckout >= 170,     color: 'amber',   icon: <TrophyIcon className="h-7 w-7" /> },
        { name: 'Gépágyú',        desc: '10 db 180-at dobtál',                unlocked: stats.count180 >= 10,             color: 'rose',    icon: <FireIcon   className="h-7 w-7" /> },
        { name: '180-as Mágus',   desc: '50 db 180-at dobtál',                unlocked: stats.count180 >= 50,             color: 'rose',    icon: <BoltIcon   className="h-7 w-7" /> },
        { name: 'Veterán',        desc: '50 meccset játszottál',               unlocked: (stats.matchesPlayed || 0) >= 50, color: 'emerald', icon: <ChartBarIcon className="h-7 w-7" /> },
        { name: 'Százas Klub',    desc: '100 meccset játszottál',              unlocked: (stats.matchesPlayed || 0) >= 100, color: 'indigo',  icon: <ChartBarIcon className="h-7 w-7" /> },
        { name: 'Streakmester',   desc: '7 napos bejelentkezési sorozat',      unlocked: (stats.streak || 0) >= 7,         color: 'amber',   icon: <CalendarDaysIcon className="h-7 w-7" /> },
        { name: 'Profi',          desc: '60+ átlag',                           unlocked: stats.totalDarts > 0 && ((stats.totalPoints / stats.totalDarts) * 3) >= 60, color: 'purple', icon: <StarIcon className="h-7 w-7" /> },
        { name: 'Kiszálló Szakértő', desc: '40%+ kiszálló arány (min. 20 kísérlet)', unlocked: stats.checkoutAttempts >= 20 && (stats.checkoutSuccess / stats.checkoutAttempts) >= 0.4, color: 'cyan', icon: <CheckCircleIcon className="h-7 w-7" /> },
        { name: 'Egész Éjjel',    desc: '200+ 100-as dobás',                  unlocked: (stats.count100 || 0) >= 200,     color: 'indigo',  icon: <BoltIcon   className="h-7 w-7" /> },
    ] : [];

    // ── Heatmap derived data ──────────────────────────────────────────────────
    const heatList = useMemo(() => {
        if (!userHeatmap) return [];
        const totalThrows = Object.values(userHeatmap).reduce((s, v) => s + v.throws, 0) || 1;
        return Object.entries(userHeatmap)
            .filter(([_, v]) => v.throws > 0)
            .map(([key, v]) => {
                const type = key.startsWith('T') ? 'treble' : (key.startsWith('D') || key === '50') ? 'double' : 'single';
                const accuracy = Math.round((v.hits / v.throws) * 100);
                const sharePct = Math.round((v.throws / totalThrows) * 100);
                return { key, throws: v.throws, hits: v.hits, accuracy, sharePct, type };
            })
            .sort((a, b) => b.throws - a.throws);
    }, [userHeatmap]);

    const filteredHeatList = useMemo(() =>
        hmFilter === 'all' ? heatList : heatList.filter(h => h.type === hmFilter),
        [heatList, hmFilter]
    );

    const heatInsight = useMemo(() => {
        if (heatList.length === 0) return null;
        const topTarget  = heatList[0];
        const worstDouble = heatList.filter(h => h.type === 'double' && h.throws >= 5).sort((a, b) => a.accuracy - b.accuracy)[0];
        const bestDouble  = heatList.filter(h => h.type === 'double' && h.throws >= 5).sort((a, b) => b.accuracy - a.accuracy)[0];
        return { topTarget, worstDouble, bestDouble };
    }, [heatList]);

    // ── Social search ─────────────────────────────────────────────────────────
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const snap = await getDocs(query(collection(db, 'publicProfiles'), limit(30)));
            setSearchResults(
                snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter((u: any) =>
                        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        `#${u.tag}` === searchQuery
                    )
            );
        } catch (e) { console.error(e); }
        setIsSearching(false);
    };

    const loadOtherUser = async (u: any) => {
        isViewingOther.current = true;
        setViewedStats(u);
        setActiveTab('profile');
    };

    const handleAddFriend = async (friendId: string) => {
        const user = auth.currentUser;
        if (!user || !myStats) return;
        await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(friendId) });
    };

    const handleAvatarSelect = async (url: string) => {
        const user = auth.currentUser;
        if (!user) return;
        await updateDoc(doc(db, 'users', user.uid), { selectedAvatar: url });
        await setDoc(doc(db, 'publicProfiles', user.uid), { selectedAvatar: url }, { merge: true });
        setIsEditingAvatar(false);
    };

    // ── Loading guard ─────────────────────────────────────────────────────────
    if (!stats) return (
        <div className="fixed inset-0 z-[200] bg-[#0b0d11] flex items-center justify-center">
            <ArrowPathIcon className="h-8 w-8 text-emerald-500 animate-spin" />
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[200] bg-[#0b0d11] text-slate-200 overflow-y-auto h-[100dvh]">
            <div className="p-4 sm:p-6 relative min-h-full w-full flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-3 shrink-0 bg-[#12141a] border border-slate-800 shadow-xl sticky top-0 z-20 mb-6 rounded-2xl">
                    <button onClick={onBack} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-all">
                        <ArrowLeftIcon className="h-5 w-5 text-white" />
                    </button>
                    <h1 className="text-xl font-black text-white uppercase italic tracking-widest">
                        {isViewingOther.current ? stats.name : 'Profil'}
                    </h1>
                    {isViewingOther.current ? (
                        <button onClick={() => { isViewingOther.current = false; if (myStats) setViewedStats(myStats); }}
                            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-all">
                            <XMarkIcon className="h-5 w-5 text-white" />
                        </button>
                    ) : <div className="w-9" />}
                </div>

                <div className="max-w-3xl mx-auto pb-20 w-full flex-1">

                    {/* Tab nav */}
                    <div className="flex gap-1.5 mb-8 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto">
                        {(['profile', 'history', 'analytics', 'social'] as const).map(t => {
                            const active = activeTab === t;
                            const colorMap = { profile: 'bg-emerald-500 text-slate-950', history: 'bg-indigo-500 text-white', analytics: 'bg-[#b655ff] text-white', social: 'bg-cyan-500 text-slate-950' };
                            const labels = { profile: 'Profil', history: 'Napló', analytics: 'Hőtérkép', social: 'Social' };
                            return (
                                <button key={t} onClick={() => setActiveTab(t)}
                                    className={`flex-1 py-2 px-3 rounded-xl font-black uppercase text-[10px] whitespace-nowrap transition-all ${active ? colorMap[t] : 'text-slate-500 hover:text-white'}`}>
                                    {labels[t]}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── PROFIL TAB ─────────────────────────────────────────────────────── */}
                    {activeTab === 'profile' && (
                        <div className="flex flex-col gap-8">
                            {/* Avatar */}
                            <div className="flex flex-col items-center">
                                <div className="relative group cursor-pointer mb-4"
                                    onClick={() => !isViewingOther.current && setIsEditingAvatar(true)}>
                                    <img
                                        src={getAvatar(stats)}
                                        onError={e => { e.currentTarget.src = getAvatar(null); }}
                                        className="w-28 h-28 rounded-full border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] bg-slate-800 object-cover"
                                        alt="avatar"
                                    />
                                    {!isViewingOther.current && (
                                        <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <PencilIcon className="h-7 w-7 text-white" />
                                        </div>
                                    )}
                                </div>
                                <h1 className="text-3xl font-black text-white uppercase italic">{stats.name}</h1>
                                <p className="text-emerald-400 font-black tracking-[0.3em] mb-1">#{stats.tag || '0000'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-emerald-500 text-slate-900 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">Szint {level}</span>
                                    {(stats.streak || 0) > 1 && (
                                        <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1">
                                            🔥 {stats.streak} nap
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Meccsek',    value: stats.matchesPlayed || 0,                         color: 'text-white'   },
                                    { label: 'Győzelmek',  value: `${stats.matchesWon || 0}`,                       color: 'text-emerald-400' },
                                    { label: 'Win rate',   value: `${winRate}%`,                                    color: 'text-emerald-400' },
                                    { label: 'Átlag',      value: avg,                                              color: 'text-cyan-400'    },
                                    { label: 'Első 9 átl.',value: f9avg,                                            color: 'text-[#b655ff]'   },
                                    { label: 'Kiszálló%',  value: `${coPct}%`,                                      color: 'text-amber-400'   },
                                    { label: 'Max kiszálló',value: stats.highestCheckout || 0,                      color: 'text-amber-400'   },
                                    { label: 'Max streak', value: `${stats.streak || 1} nap`,                      color: 'text-amber-400'   },
                                ].map(s => (
                                    <div key={s.label} className="bg-[#12141a] p-4 rounded-2xl border border-slate-800 flex flex-col gap-1 text-center">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</span>
                                        <span className={`text-2xl font-mono font-black ${s.color}`}>{s.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* 100/140/180 row */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: '100+', value: stats.count100 || 0, color: 'text-white' },
                                    { label: '140+', value: stats.count140 || 0, color: 'text-amber-400' },
                                    { label: '180',  value: stats.count180 || 0, color: 'text-rose-500'  },
                                ].map(s => (
                                    <div key={s.label} className="bg-[#12141a] p-4 rounded-2xl border border-slate-800 flex flex-col items-center gap-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</span>
                                        <span className={`text-3xl font-mono font-black ${s.color}`}>{s.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Achievements */}
                            <div>
                                <h2 className="text-lg font-black text-white uppercase italic mb-4 flex items-center gap-2">
                                    <TrophyIcon className="h-5 w-5 text-amber-400" /> Trófeaterem
                                    <span className="text-xs text-slate-500 font-bold normal-case italic ml-auto">
                                        {achievements.filter(a => a.unlocked).length}/{achievements.length}
                                    </span>
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {achievements.map((a, i) => {
                                        const c = ACH_COLORS[a.color] || ACH_COLORS.amber;
                                        return (
                                            <div key={i} className={`p-4 rounded-2xl border flex gap-3 items-center ${a.unlocked ? `${c.bg} ${c.border}` : 'bg-slate-900/50 border-slate-800 opacity-40 grayscale'}`}>
                                                <div className={`p-2.5 rounded-xl shrink-0 ${a.unlocked ? `${c.iconBg} text-slate-900` : 'bg-slate-800 text-slate-500'}`}>
                                                    {a.icon}
                                                </div>
                                                <div>
                                                    <span className={`font-black uppercase text-sm block ${a.unlocked ? c.text : 'text-slate-500'}`}>{a.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{a.desc}</span>
                                                </div>
                                                {a.unlocked && <CheckCircleIcon className={`h-5 w-5 ml-auto shrink-0 ${c.text}`} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── Preferences / checkout settings ── */}
                            {!isViewingOther.current && (
                            <div className="bg-[#12141a] rounded-[2rem] border border-slate-800 p-6">
                                <h2 className="text-sm font-black text-white uppercase italic mb-5 flex items-center gap-2">
                                    <ShieldCheckIcon className="h-5 w-5 text-cyan-400" /> Játék Beállítások
                                </h2>

                                {/* Checkout mode */}
                                <div className="mb-5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kiszálló szabály</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['single', 'double'] as const).map(c => (
                                            <button key={c} onClick={() => setPrefCheckout(c)}
                                                className={`py-3 rounded-xl font-black text-xs uppercase border transition-all ${prefCheckout === c ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                                {c === 'single' ? 'Bármilyen' : 'Csak Dupla'}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-600 mt-1.5 font-bold">
                                        {prefCheckout === 'double' ? 'A kiszállóhoz Dupla szegmens szükséges (standard)' : 'Bármely szegmens kiszálló lehet'}
                                    </p>
                                </div>

                                {/* Input mode */}
                                <div className="mb-5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Alapértelmezett bevitel</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { key: 'fast',     label: 'Gyors',  desc: 'Numerikus billentyűzet' },
                                            { key: 'detailed', label: 'Pro',    desc: 'Nyilankénti részletes' },
                                            { key: 'board',    label: 'Tábla',  desc: 'Kattintható táblán' },
                                        ] as const).map(m => (
                                            <button key={m.key} onClick={() => setPrefInputMode(m.key)}
                                                className={`py-2.5 rounded-xl font-black text-[10px] uppercase border transition-all flex flex-col items-center gap-1 ${prefInputMode === m.key ? 'bg-cyan-500 text-slate-900 border-cyan-400' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                                <span>{m.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Favorite double */}
                                <div className="mb-5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kedvenc kiszálló Dupla</p>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {['D20','D16','D10','D8','D12','D18','D6','D4','D2','BULL'].map(d => (
                                            <button key={d} onClick={() => setPrefFavDouble(d)}
                                                className={`h-9 rounded-lg font-black text-[10px] border transition-all ${prefFavDouble === d ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-600 mt-1.5 font-bold">A kiszálló javaslatokban ez jelenik meg első helyen</p>
                                </div>

                                {/* Save button */}
                                <button onClick={handleSaveSettings}
                                    className={`w-full h-12 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${settingsSaved ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                                    {settingsSaved ? '✓ Mentve!' : 'Beállítások Mentése'}
                                </button>
                            </div>
                            )}
                        </div>
                    )}

                    {/* ── NAPLÓ TAB ───────────────────────────────────────────────────────── */}
                    {activeTab === 'history' && (
                        <div className="flex flex-col gap-4">
                            <h2 className="text-lg font-black text-white uppercase italic flex items-center gap-2">
                                <ChartBarIcon className="h-5 w-5 text-indigo-400" /> Meccsnapló
                            </h2>
                            {matchHistory.length === 0 ? (
                                <div className="text-center py-16 text-slate-500 font-bold uppercase border border-dashed border-slate-800 rounded-2xl text-xs tracking-widest">
                                    Még nincs rögzített meccs.
                                </div>
                            ) : matchHistory.map((m, i) => (
                                <div key={i} onClick={() => setSelectedMatch(m)}
                                    className="bg-[#12141a] border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
                                    <div className="min-w-0">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">
                                            {(m.date?.toDate ? m.date.toDate() : new Date(m.date)).toLocaleDateString('hu-HU')} • {m.mode?.toUpperCase()}
                                        </span>
                                        <span className="text-white font-black uppercase italic text-base block truncate">vs {m.opponent}</span>
                                        <span className="text-xs text-slate-400 font-bold">
                                            Eredmény: <span className="text-white">{m.score || '?'}</span>
                                            {' • '}AVG: <span className="text-indigo-400">{m.stats?.average?.toFixed(1) || '?'}</span>
                                        </span>
                                    </div>
                                    <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-black text-xl border ${m.won ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                                        {m.won ? 'W' : 'L'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── HŐTÉRKÉP TAB ───────────────────────────────────────────────────── */}
                    {activeTab === 'analytics' && (
                        <div className="flex flex-col gap-6">
                            <h2 className="text-lg font-black text-white uppercase italic flex items-center gap-2">
                                <ChartBarIcon className="h-5 w-5 text-[#b655ff]" /> Személyes Hőtérkép
                            </h2>

                            {isLoadingHM ? (
                                <div className="text-center py-16 animate-pulse text-slate-500 text-xs font-black uppercase tracking-widest">Betöltés...</div>
                            ) : !userHeatmap ? (
                                <div className="flex flex-col items-center py-16 bg-[#12141a] rounded-[2rem] border border-dashed border-slate-700 text-center px-8">
                                    <ChartBarIcon className="h-16 w-16 text-slate-600 mb-4" />
                                    <h3 className="text-lg font-black text-white uppercase italic mb-2">Még nincs hőtérkép adat</h3>
                                    <p className="text-slate-400 text-sm font-bold max-w-xs leading-relaxed">
                                        Játssz meccseket <span className="text-[#b655ff]">PRO</span> vagy <span className="text-[#b655ff]">TÁBLA</span> módban, vagy futtass le egy <span className="text-rose-400">Célpont Vadász</span> edzést — a nyilaid automatikusan rögzülnek.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Filter */}
                                    <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                                        {(['all', 'single', 'double', 'treble'] as const).map(f => {
                                            const labels = { all: 'Mind', single: 'Single', double: 'Double', treble: 'Triple' };
                                            const colors = { all: 'bg-slate-600', single: 'bg-slate-500', double: 'bg-emerald-500', treble: 'bg-rose-500' };
                                            return (
                                                <button key={f} onClick={() => setHmFilter(f)}
                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${hmFilter === f ? `${colors[f]} text-white` : 'text-slate-500 hover:text-white'}`}>
                                                    {labels[f]}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Dartboard */}
                                    <div className="bg-[#12141a] rounded-[2rem] border border-[#b655ff]/20 p-6">
                                        <ProfileHeatmap data={userHeatmap} filter={hmFilter} />

                                        {/* Legend */}
                                        <div className="flex items-center gap-3 mt-5 px-4">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase shrink-0">Kevés dobás</span>
                                            <div className="flex-1 h-3 rounded-full" style={{ background: 'linear-gradient(to right, #450a0a, #7f1d1d, #b91c1c, #dc2626, #ef4444, #f87171)' }} />
                                            <span className="text-[9px] text-rose-400 font-bold uppercase shrink-0">🔥 Legtöbb</span>
                                        </div>
                                        <p className="text-center text-[9px] text-slate-600 font-bold mt-2 uppercase tracking-widest">
                                            Minél pirosabb → annál többet dobtál arra a szektorra
                                        </p>
                                    </div>

                                    {/* Top targets list */}
                                    <div className="bg-[#12141a] rounded-[2rem] border border-slate-800 p-6">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <FireIcon className="h-4 w-4 text-rose-500" />
                                            {hmFilter === 'all' ? 'Top 10 célpont' : `Top ${hmFilter === 'double' ? 'Dupla' : hmFilter === 'treble' ? 'Tripla' : 'Single'} szektorok`}
                                        </h3>

                                        {filteredHeatList.length === 0 ? (
                                            <p className="text-slate-500 text-xs font-bold text-center py-4">Nincs adat ebben a szűrőben.</p>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {filteredHeatList.slice(0, 10).map((h, i) => {
                                                    const maxThrows = filteredHeatList[0]?.throws || 1;
                                                    const barPct = Math.round((h.throws / maxThrows) * 100);
                                                    const typeColor = h.type === 'treble' ? 'bg-rose-500' : h.type === 'double' ? 'bg-emerald-500' : 'bg-slate-500';
                                                    const typeText  = h.type === 'treble' ? 'text-rose-400' : h.type === 'double' ? 'text-emerald-400' : 'text-slate-400';
                                                    return (
                                                        <div key={h.key} className="flex items-center gap-3">
                                                            <span className={`text-xs font-black w-4 text-right ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>{i + 1}.</span>
                                                            <span className={`text-sm font-black font-mono w-10 shrink-0 ${typeText}`}>{h.key}</span>
                                                            <div className="flex-1 h-5 bg-slate-900 rounded-full overflow-hidden relative">
                                                                <div className={`h-full rounded-full ${typeColor} opacity-70 transition-all`} style={{ width: `${barPct}%` }} />
                                                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[9px] font-black text-white">
                                                                    {h.throws} db
                                                                </span>
                                                            </div>
                                                            <div className="text-right w-16 shrink-0">
                                                                <span className="text-xs font-black text-white">{h.accuracy}%</span>
                                                                <span className="text-[9px] text-slate-500 font-bold block">pontosság</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* AI insight */}
                                    {heatInsight && (
                                        <div className="bg-[#b655ff]/10 border border-[#b655ff]/30 rounded-[2rem] p-6">
                                            <h3 className="text-xs font-black text-[#b655ff] uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <InformationCircleIcon className="h-4 w-4" /> Személyre szabott javaslat
                                            </h3>
                                            <ul className="flex flex-col gap-2 text-sm text-slate-300 font-bold">
                                                <li>🎯 Legtöbbet dobott szektored: <span className="text-white">{heatInsight.topTarget.key}</span> ({heatInsight.topTarget.throws} dobás, {heatInsight.topTarget.accuracy}% pontosság)</li>
                                                {heatInsight.worstDouble && (
                                                    <li>⚠️ Leggyengébb duplád: <span className="text-rose-400">{heatInsight.worstDouble.key}</span> ({heatInsight.worstDouble.accuracy}%) — erre érdemes edzeni!</li>
                                                )}
                                                {heatInsight.bestDouble && (
                                                    <li>✅ Legjobb kiszálló duplád: <span className="text-emerald-400">{heatInsight.bestDouble.key}</span> ({heatInsight.bestDouble.accuracy}%) — használd ezt kiszállóban!</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* ── SOCIAL TAB ──────────────────────────────────────────────────────── */}
                    {activeTab === 'social' && (
                        <div className="flex flex-col gap-6">
                            <h2 className="text-lg font-black text-white uppercase italic flex items-center gap-2">
                                <UsersIcon className="h-5 w-5 text-cyan-400" /> Játékos Keresés
                            </h2>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Keresés névvel vagy #tag-gel"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    className="flex-1 h-12 bg-[#12141a] border border-slate-700 rounded-xl px-4 text-white font-bold outline-none focus:border-cyan-500 transition-colors"
                                />
                                <button onClick={handleSearch}
                                    className="w-12 h-12 bg-cyan-500 rounded-xl text-slate-950 flex items-center justify-center hover:bg-cyan-400 active:scale-95 transition-all">
                                    <MagnifyingGlassIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {isSearching ? (
                                <p className="text-slate-500 font-bold uppercase text-center animate-pulse text-xs">Keresés...</p>
                            ) : searchResults.map((u, i) => (
                                <div key={i} className="bg-[#12141a] border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => loadOtherUser(u)}>
                                        <img src={getAvatar(u)}
                                            onError={e => { e.currentTarget.src = getAvatar(null); }}
                                            className="w-10 h-10 rounded-full bg-slate-800 object-cover" alt="" />
                                        <div>
                                            <p className="text-white font-black uppercase text-sm hover:text-cyan-400 transition-colors">{u.name}</p>
                                            <p className="text-cyan-400 text-[10px] font-black tracking-widest">#{u.tag || '0000'} · Szint {Math.floor(Math.sqrt(Math.max(u.xp || 0, 0) / 100)) + 1}</p>
                                        </div>
                                    </div>
                                    {myStats?.friends?.includes(u.id) || u.id === myStats?.id ? (
                                        <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                                    ) : (
                                        <button onClick={() => handleAddFriend(u.id)}
                                            className="p-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors">
                                            <UserPlusIcon className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {searchResults.length === 0 && !isSearching && searchQuery && (
                                <p className="text-center text-slate-500 text-xs font-bold uppercase py-4">Nincs találat.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Match detail modal ─────────────────────────────────────────────────── */}
            {selectedMatch && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                    onClick={() => setSelectedMatch(null)}>
                    <div className="bg-[#12141a] border border-indigo-500/40 p-6 rounded-[2rem] w-full max-w-lg shadow-2xl relative max-h-[85vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedMatch(null)} className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors">
                            <XMarkIcon className="h-7 w-7" />
                        </button>
                        <div className="text-center mb-6 border-b border-slate-800 pb-5">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">
                                {(selectedMatch.date?.toDate ? selectedMatch.date.toDate() : new Date(selectedMatch.date)).toLocaleString('hu-HU')}
                            </span>
                            <h2 className="text-2xl font-black text-white uppercase italic">vs {selectedMatch.opponent}</h2>
                            <div className="mt-3 inline-block bg-slate-900 border border-slate-700 px-6 py-2 rounded-xl">
                                <span className="text-xl font-mono font-black text-white">{selectedMatch.score || '?'}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {[
                                { label: 'Meccs Átlag',   value: selectedMatch.stats?.average?.toFixed(1)      || '—', color: 'text-white'    },
                                { label: 'Első 9 Átlag',  value: selectedMatch.stats?.first9Average?.toFixed(1)|| '—', color: 'text-[#b655ff]'},
                                { label: 'Kiszálló %',    value: `${Math.round((selectedMatch.stats?.checkoutPct || 0) * 100)}%`, color: 'text-emerald-400' },
                                { label: 'Legjobb Leg',   value: selectedMatch.stats?.bestLegDarts ? `${selectedMatch.stats.bestLegDarts} nyíl` : '—', color: 'text-cyan-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1">{s.label}</span>
                                    <span className={`text-2xl font-mono font-black ${s.color}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-around bg-slate-900 p-4 rounded-xl border border-slate-800">
                            {[
                                { label: '100+', value: selectedMatch.stats?.count100 || 0, color: 'text-white' },
                                { label: '140+', value: selectedMatch.stats?.count140 || 0, color: 'text-amber-400' },
                                { label: '180',  value: selectedMatch.stats?.count180 || 0, color: 'text-rose-500' },
                            ].map(s => (
                                <div key={s.label} className="text-center">
                                    <span className="text-[10px] text-slate-500 uppercase font-black block">{s.label}</span>
                                    <span className={`text-2xl font-mono font-black ${s.color}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Avatar modal ───────────────────────────────────────────────────────── */}
            {isEditingAvatar && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={() => setIsEditingAvatar(false)}>
                    <div className="bg-[#12141a] border border-slate-700 p-8 rounded-[2rem] w-full max-w-sm shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black text-white uppercase italic mb-6 text-center">Válassz Avatart</h2>
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            {PREDEFINED_AVATARS.map((url, i) => (
                                <button key={i} onClick={() => handleAvatarSelect(url)}
                                    className="p-2 bg-slate-900 border border-slate-700 rounded-2xl hover:border-emerald-500 hover:scale-110 transition-all">
                                    <img src={url} className="w-full h-auto rounded-full" alt="" />
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setIsEditingAvatar(false)}
                            className="w-full h-12 bg-slate-800 text-white rounded-xl font-black uppercase text-sm hover:bg-slate-700 transition-colors">
                            Mégsem
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
