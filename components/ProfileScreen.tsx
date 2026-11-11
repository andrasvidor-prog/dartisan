'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    TrophyIcon, ArrowLeftIcon, ChartBarIcon, StarIcon, FireIcon,
    ArrowPathIcon, MagnifyingGlassIcon, PencilIcon, UserPlusIcon,
    UsersIcon, CheckCircleIcon, XMarkIcon, ShieldCheckIcon, BoltIcon,
    CalendarDaysIcon, ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { db, auth } from '../firebase';
import { EmailAuthProvider, linkWithCredential, reload, sendPasswordResetEmail, signOut } from 'firebase/auth';
import {
    doc, onSnapshot, collection, getDocs, query, limit, Timestamp,
    updateDoc, arrayUnion, orderBy, getDoc, setDoc
} from 'firebase/firestore';
import { matchHistoryCsv, matchTrend, recordedMatchScore, type MatchAnalyticsRow } from '../lib/matchAnalytics';
import { HeatmapBoard, HeatmapLegend, heatmapColor } from './HeatmapBoard';
import { normalizeHeatmapData, sectorHits, sectorType, type HeatmapData, type HeatmapFilter } from '../lib/heatmap';

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Heatmap SVG ──────────────────────────────────────────────────────────────
type HM = HeatmapData;

type ProfileStats = {
    id: string; name: string; tag: number; xp: number; friends: string[];
    selectedAvatar?: string; photoURL?: string;
    totalDarts: number; totalPoints: number; first9Darts: number; first9Points: number;
    checkoutAttempts: number; checkoutSuccess: number; matchesPlayed: number;
    matchesWon: number; highestCheckout: number; count100: number; count140: number;
    count180: number; streak: number;
};

type MatchHistory = {
    id: string; date?: Timestamp | string | number; mode?: string; opponent?: string;
    score?: string; won?: boolean; stats?: {
        average?: number; first9Average?: number; checkoutPct?: number;
        bestLegDarts?: number; count100?: number; count140?: number; count180?: number;
    };
};

const normalizeProfile = (id: string, data: Record<string, unknown>): ProfileStats => {
    const number = (key: string) => typeof data[key] === 'number' ? data[key] as number : 0;
    return {
        id,
        name: typeof data.name === 'string' ? data.name : 'Játékos',
        tag: number('tag'), xp: number('xp'),
        friends: Array.isArray(data.friends) ? data.friends.filter((friend): friend is string => typeof friend === 'string') : [],
        selectedAvatar: typeof data.selectedAvatar === 'string' ? data.selectedAvatar : undefined,
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : undefined,
        totalDarts: number('totalDarts'), totalPoints: number('totalPoints'),
        first9Darts: number('first9Darts'), first9Points: number('first9Points'),
        checkoutAttempts: number('checkoutAttempts'), checkoutSuccess: number('checkoutSuccess'),
        matchesPlayed: number('matchesPlayed'), matchesWon: number('matchesWon'),
        highestCheckout: number('highestCheckout'), count100: number('count100'),
        count140: number('count140'), count180: number('count180'), streak: number('streak'),
    };
};

const matchDate = (value: MatchHistory['date']) => {
    const date = value instanceof Timestamp ? value.toDate() : new Date(value ?? 0);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const trendPoints = (values: (number | null)[], max: number) => values
    .map((value, index) => value === null ? null : `${12 + index * 576 / Math.max(1, values.length - 1)},${144 - Math.max(0, value) * 128 / max}`)
    .filter((point): point is string => point !== null).join(' ');

const MatchTrendChart = ({ rows }: { rows: MatchAnalyticsRow[] }) => {
    const trend = matchTrend(rows);
    if (trend.count < 2) return null;
    const max = Math.max(60, ...trend.averages, ...trend.first9.filter((value): value is number => value !== null));
    return <section className="rounded-2xl border border-indigo-500/25 bg-[#12141a] p-4 sm:p-6" aria-label="Átlagok alakulása">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div><h3 className="text-sm font-black uppercase text-white">Átlagok alakulása</h3><p className="text-xs text-slate-400 mt-1">Az utolsó {trend.count} mentett meccs, időrendben.</p></div>
            <div className="flex gap-4 text-xs font-black"><span className="text-indigo-300">● 3 nyilas átlag</span><span className="text-cyan-300">● Első 9 nyíl</span></div>
        </div>
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label="Háromnyilas és első kilenc nyilas átlag trendje" className="w-full h-36 sm:h-44 rounded-xl bg-[#0b0d11]">
            {[48, 96, 144].map(y => <line key={y} x1="12" x2="588" y1={y} y2={y} stroke="#283241" strokeWidth="1" />)}
            <polyline points={trendPoints(trend.averages, max)} fill="none" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={trendPoints(trend.first9, max)} fill="none" stroke="#67e8f9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="grid grid-cols-2 gap-3 mt-4 text-xs"><div className="rounded-xl bg-[#0b0d11] p-3"><span className="text-slate-400 block">Átlag változása</span><strong className={trend.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{trend.change >= 0 ? '+' : ''}{trend.change.toFixed(1)}</strong></div><div className="rounded-xl bg-[#0b0d11] p-3"><span className="text-slate-400 block">Ingadozás (szórás)</span><strong className="text-white">{trend.deviation.toFixed(1)}</strong></div></div>
    </section>;
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProfileScreen({ onBack }: { onBack: () => void }) {
    const [myStats, setMyStats]         = useState<ProfileStats | null>(null);
    const [viewedStats, setViewedStats] = useState<ProfileStats | null>(null);
    const [profileError, setProfileError] = useState(false);
    const [isViewingOther, setIsViewingOther] = useState(false);

    const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
    const [userHeatmap, setUserHeatmap]   = useState<HM | null>(null);
    const [hmFilter, setHmFilter]         = useState<HeatmapFilter>('all');
    const [selectedSector, setSelectedSector] = useState<string | null>(null);
    const [isLoadingHM, setIsLoadingHM]   = useState(true);
    const [heatmapError, setHeatmapError] = useState(false);

    const [activeTab, setActiveTab]     = useState<'profile' | 'history' | 'analytics' | 'social'>('profile');
    const [selectedMatch, setSelectedMatch] = useState<MatchHistory | null>(null);
    const matchRows = useMemo<MatchAnalyticsRow[]>(() => matchHistory.map(m => ({
        date: matchDate(m.date).toISOString(), mode: m.mode || '', opponent: m.opponent || '',
        won: !!m.won, score: recordedMatchScore(m.score), average: typeof m.stats?.average === 'number' ? m.stats.average : null,
        first9Average: typeof m.stats?.first9Average === 'number' ? m.stats.first9Average : null,
        checkoutPct: typeof m.stats?.checkoutPct === 'number' ? Math.round(m.stats.checkoutPct * 1000) / 10 : null,
        bestLegDarts: typeof m.stats?.bestLegDarts === 'number' ? m.stats.bestLegDarts : null,
        count100: m.stats?.count100 || 0, count140: m.stats?.count140 || 0, count180: m.stats?.count180 || 0,
    })), [matchHistory]);
    const [isEditingAvatar, setIsEditingAvatar] = useState(false);

    const [searchQuery,   setSearchQuery]   = useState('');
    const [searchResults, setSearchResults] = useState<ProfileStats[]>([]);
    const [isSearching,   setIsSearching]   = useState(false);

    // ── Checkout / preference settings ───────────────────────────────────────
    const [prefCheckout,   setPrefCheckout]   = useState<'single' | 'double'>('double');
    const [prefInputMode,  setPrefInputMode]  = useState<'fast' | 'detailed' | 'board'>('fast');
    const [prefFavDouble,  setPrefFavDouble]  = useState('D16');
    const [settingsSaved,  setSettingsSaved]  = useState(false);
    const [passwordEnabled, setPasswordEnabled] = useState<boolean | null>(() =>
        auth.currentUser?.providerData.some(provider => provider.providerId === EmailAuthProvider.PROVIDER_ID) ?? null
    );
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        reload(user).then(() => {
            setPasswordEnabled(user.providerData.some(provider => provider.providerId === EmailAuthProvider.PROVIDER_ID));
        }).catch(error => console.error('Account providers could not be refreshed:', error));
    }, []);

    // ── Real-time user stats ──────────────────────────────────────────────────
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        const fallback = normalizeProfile(user.uid, { name: user.displayName || user.email?.split('@')[0] || 'Player', photoURL: user.photoURL });
        const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            const s = snap.exists() ? normalizeProfile(user.uid, snap.data()) : fallback;
            setProfileError(false);
            setMyStats(s);
            setViewedStats(previous => previous?.id && previous.id !== user.uid ? previous : s);
        }, (error) => {
            console.error('Profile could not be loaded:', error);
            setProfileError(true);
            setMyStats(fallback);
            setViewedStats(previous => previous?.id && previous.id !== user.uid ? previous : fallback);
        });
        return () => unsub();
    }, []);

    // ── Match history ─────────────────────────────────────────────────────────
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, 'users', user.uid, 'matchHistory'), orderBy('date', 'desc'), limit(20));
        getDocs(q).then(snap => setMatchHistory(snap.docs.map(d => ({ ...d.data(), id: d.id }) as MatchHistory))).catch(error => console.error('Match history could not be loaded:', error));
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
        }).catch(error => console.error('Profile preferences could not be loaded:', error));
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

    const exportMatchHistory = () => {
        const url = URL.createObjectURL(new Blob([matchHistoryCsv(matchRows)], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'dartisan-meccsnaplo.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            onBack();
        } catch (error) {
            console.error('Sign-out failed:', error);
            alert('A kijelentkezés nem sikerült. Próbáld újra.');
        }
    };

    const handleSetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const user = auth.currentUser;
        setPasswordError('');
        setPasswordMessage('');
        if (!user?.email) return;
        if (newPassword.length < 6) return setPasswordError('A jelszó legyen legalább 6 karakteres.');
        if (newPassword !== confirmPassword) return setPasswordError('A két jelszó nem egyezik.');
        setPasswordBusy(true);
        try {
            await linkWithCredential(user, EmailAuthProvider.credential(user.email, newPassword));
            setPasswordEnabled(true);
            setNewPassword('');
            setConfirmPassword('');
            setPasswordMessage('A jelszavas belépés aktív. Mostantól ezzel az e-mail-címmel és az új jelszóval is beléphetsz.');
        } catch (error) {
            console.error('Password setup failed:', error);
            const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
            if (code === 'auth/provider-already-linked') {
                setPasswordEnabled(true);
                setPasswordMessage('A jelszavas belépés már aktív ennél a fióknál. Ha nem tudsz belépni, kérj jelszó-visszaállító levelet.');
                return;
            }
            setPasswordError(code === 'auth/requires-recent-login'
                ? 'Biztonsági okból lépj ki, majd jelentkezz be újra Google-lal, és próbáld újra.'
                : code === 'auth/weak-password'
                    ? 'A jelszó túl gyenge. Válassz hosszabb, nehezebben kitalálható jelszót.'
                : code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use'
                    ? 'Ehhez az e-mail-címhez már tartozik külön jelszavas fiók. Az összekapcsoláshoz kérj segítséget.'
                    : `A jelszó beállítása nem sikerült (${code || 'ismeretlen hiba'}). Próbáld újra.`);
        } finally {
            setPasswordBusy(false);
        }
    };

    const handlePasswordReset = async () => {
        const email = auth.currentUser?.email;
        if (!email) return;
        setPasswordBusy(true);
        setPasswordError('');
        setPasswordMessage('');
        try {
            await sendPasswordResetEmail(auth, email);
            setPasswordMessage('Elküldtük a jelszó-visszaállító levelet a fiókod e-mail-címére.');
        } catch (error) {
            console.error('Password reset failed:', error);
            const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
            setPasswordError(code === 'auth/too-many-requests'
                ? 'Túl sok kérés érkezett. Próbáld újra később.'
                : code === 'auth/network-request-failed'
                    ? 'Hálózati hiba történt. Ellenőrizd a kapcsolatot, majd próbáld újra.'
                    : `Nem sikerült elküldeni a levelet (${code || 'ismeretlen hiba'}).`);
        } finally {
            setPasswordBusy(false);
        }
    };

    // ── Heatmap (real-time, load when tab is active) ──────────────────────────
    useEffect(() => {
        if (activeTab !== 'analytics') return;
        const user = auth.currentUser;
        if (!user) return;
        const unsub = onSnapshot(
            doc(db, 'users', user.uid, 'stats', 'heatmaps', 'setups', 'default'),
            (snap) => {
                setIsLoadingHM(false);
                setHeatmapError(false);
                if (snap.exists() && Object.keys(snap.data()).length > 0) {
                    setUserHeatmap(snap.data() as HM);
                } else {
                    setUserHeatmap(null);
                }
            },
            (error) => {
                console.error('Heatmap could not be loaded:', error);
                setIsLoadingHM(false);
                setHeatmapError(true);
            }
        );
        return () => unsub();
    }, [activeTab]);

    // ── Derived stats ─────────────────────────────────────────────────────────
    const stats = viewedStats;
    const level = stats ? Math.floor(Math.sqrt(Math.max(stats.xp || 0, 0) / 100)) + 1 : 1;
    const avg   = stats && stats.totalDarts > 0 ? ((stats.totalPoints / stats.totalDarts) * 3).toFixed(1) : '—';
    const f9avg = stats && stats.first9Darts > 0 ? ((stats.first9Points / stats.first9Darts) * 3).toFixed(1) : '—';
    const coPct = stats && stats.checkoutAttempts > 0
        ? Math.min(100, Math.max(0, Math.round((stats.checkoutSuccess / stats.checkoutAttempts) * 100)))
        : 0;
    const winRate = stats && stats.matchesPlayed > 0
        ? Math.min(100, Math.max(0, Math.round((stats.matchesWon / stats.matchesPlayed) * 100)))
        : 0;

    const getAvatar = (d: ProfileStats | null) =>
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
    const displayHeatmap = useMemo(() => normalizeHeatmapData(userHeatmap || {}), [userHeatmap]);
    const heatList = useMemo(() => {
        const totalHits = Object.keys(displayHeatmap).reduce((sum, key) => sum + sectorHits(displayHeatmap, key), 0) || 1;
        return Object.keys(displayHeatmap)
            .map(key => ({ key, hits: sectorHits(displayHeatmap, key), type: sectorType(key) }))
            .filter(item => item.hits > 0)
            .map(item => ({ ...item, sharePct: Math.round(item.hits / totalHits * 1000) / 10 }))
            .sort((a, b) => b.hits - a.hits);
    }, [displayHeatmap]);

    const filteredHeatList = useMemo(() => hmFilter === 'all' ? heatList : heatList.filter(item => item.type === hmFilter), [heatList, hmFilter]);
    const totalHeatHits = heatList.reduce((sum, item) => sum + item.hits, 0);
    const activeHeatSector = filteredHeatList.find(item => item.key === selectedSector) || filteredHeatList[0] || null;

    // ── Social search ─────────────────────────────────────────────────────────
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const snap = await getDocs(query(collection(db, 'publicProfiles'), limit(30)));
            setSearchResults(
                snap.docs
                    .map(d => normalizeProfile(d.id, d.data()))
                    .filter(u =>
                        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        `#${u.tag}` === searchQuery
                    )
            );
        } catch (e) { console.error(e); }
        setIsSearching(false);
    };

    const loadOtherUser = (u: ProfileStats) => {
        setIsViewingOther(true);
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
            <div className="px-4 pb-4 pt-[calc(1rem+var(--app-safe-top))] sm:px-6 sm:pb-6 relative min-h-full w-full flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-3 shrink-0 bg-[#12141a] border border-slate-800 shadow-xl sticky top-0 z-20 mb-6 rounded-2xl">
                    <button onClick={onBack} aria-label="Vissza" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-all">
                        <ArrowLeftIcon className="h-5 w-5 text-white" />
                    </button>
                    <h1 className="text-xl font-black text-white uppercase italic tracking-widest">
                        {isViewingOther ? stats.name : 'Profil'}
                    </h1>
                    {isViewingOther ? (
                        <button onClick={() => { setIsViewingOther(false); if (myStats) setViewedStats(myStats); }} aria-label="Másik profil bezárása"
                            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-all">
                            <XMarkIcon className="h-5 w-5 text-white" />
                        </button>
                    ) : <button onClick={handleSignOut} aria-label="Kijelentkezés" title="Kijelentkezés" className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-all"><ArrowRightOnRectangleIcon className="h-5 w-5 text-slate-300" /></button>}
                </div>

                <div className={`${activeTab === 'analytics' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto pb-20 w-full flex-1`}>
                    {profileError && <p role="status" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-bold text-amber-200">A felhőben tárolt profiladatok most nem érhetők el. Az alapadatok láthatók; próbáld újra később.</p>}

                    {/* Tab nav */}
                    <div className="flex gap-1.5 mb-8 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto max-w-3xl mx-auto w-full">
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
                                    onClick={() => !isViewingOther && setIsEditingAvatar(true)}>
                                    <img
                                        src={getAvatar(stats)}
                                        onError={e => { e.currentTarget.src = getAvatar(null); }}
                                        className="w-28 h-28 rounded-full border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)] bg-slate-800 object-cover"
                                        alt="avatar"
                                    />
                                    {!isViewingOther && (
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

                            {!isViewingOther && auth.currentUser?.email && (
                                <section className="rounded-[2rem] border border-emerald-500/25 bg-[#12141a] p-5 sm:p-6" aria-label="Fiók és belépés">
                                    <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase text-white"><ShieldCheckIcon className="h-5 w-5 text-emerald-400" /> Fiók és belépés</h2>
                                    <p className="break-all text-sm text-slate-400">{auth.currentUser.email}</p>
                                    <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                                        <p className="text-xs font-black uppercase text-slate-300">Jelszavas belépés</p>
                                        <p className={`mt-1 text-sm font-bold ${passwordEnabled ? 'text-emerald-400' : 'text-amber-300'}`}>
                                            {passwordEnabled === null ? 'Ellenőrzés…' : passwordEnabled ? 'Aktív ennél a fióknál' : 'Nincs beállítva ennél a fióknál'}
                                        </p>
                                        {passwordEnabled === false && (
                                            <form onSubmit={handleSetPassword} className="mt-4 flex flex-col gap-3">
                                                <p className="text-xs leading-relaxed text-slate-400">Ehhez a fiókhoz új Dartisan-jelszót állíthatsz be. A Google-jelszavadat ne írd ide.</p>
                                                <input type="password" autoComplete="new-password" aria-label="Új Dartisan-jelszó" placeholder="Új Dartisan-jelszó (legalább 6 karakter)" value={newPassword} onChange={event => setNewPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-700 bg-[#12141a] px-4 text-white outline-none focus:border-emerald-500" />
                                                <input type="password" autoComplete="new-password" aria-label="Új Dartisan-jelszó megerősítése" placeholder="Jelszó még egyszer" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-700 bg-[#12141a] px-4 text-white outline-none focus:border-emerald-500" />
                                                <button type="submit" disabled={passwordBusy} className="min-h-12 rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase text-slate-950 disabled:opacity-50">{passwordBusy ? 'Folyamatban…' : 'Jelszavas belépés beállítása'}</button>
                                            </form>
                                        )}
                                        {passwordEnabled && <button type="button" onClick={handlePasswordReset} disabled={passwordBusy} className="mt-4 min-h-11 rounded-xl border border-emerald-500/40 px-4 text-xs font-black uppercase text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">{passwordBusy ? 'Folyamatban…' : 'Jelszó-visszaállító levél küldése'}</button>}
                                        {passwordError && <p role="alert" className="mt-3 text-xs font-bold text-rose-300">{passwordError}</p>}
                                        {passwordMessage && <p role="status" className="mt-3 text-xs font-bold text-emerald-300">{passwordMessage}</p>}
                                    </div>
                                </section>
                            )}

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
                            {!isViewingOther && (
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
                            {!isViewingOther && <button type="button" onClick={handleSignOut} className="w-full min-h-12 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-black uppercase text-rose-300 hover:bg-rose-500/20">Kijelentkezés</button>}
                        </div>
                    )}

                    {/* ── NAPLÓ TAB ───────────────────────────────────────────────────────── */}
                    {activeTab === 'history' && (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-white uppercase italic flex items-center gap-2"><ChartBarIcon className="h-5 w-5 text-indigo-400" /> Meccsnapló</h2>{matchRows.length > 0 && <button type="button" onClick={exportMatchHistory} className="rounded-xl border border-indigo-500/40 px-4 py-2 text-xs font-black text-indigo-300 hover:bg-indigo-500/10">CSV export</button>}</div>
                            <MatchTrendChart rows={matchRows} />
                            {matchHistory.length === 0 ? (
                                <div className="text-center py-16 text-slate-500 font-bold uppercase border border-dashed border-slate-800 rounded-2xl text-xs tracking-widest">
                                    Még nincs rögzített meccs.
                                </div>
                            ) : matchHistory.map((m, i) => (
                                <div key={i} onClick={() => setSelectedMatch(m)}
                                    className="bg-[#12141a] border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
                                    <div className="min-w-0">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">
                                            {matchDate(m.date).toLocaleDateString('hu-HU')} • {m.mode?.toUpperCase()}
                                        </span>
                                        <span className="text-white font-black uppercase italic text-base block truncate">vs {m.opponent}</span>
                                        <span className="text-xs text-slate-400 font-bold">
                                            Eredmény: <span className="text-white">{recordedMatchScore(m.score)}</span>
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
                        <div className="flex flex-col gap-5">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase italic flex items-center gap-2">
                                    <ChartBarIcon className="h-5 w-5 text-cyan-400" /> Találati térkép
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">Hol landoltak a rögzített nyilaid? A színek találatszámot mutatnak, nem célzási pontosságot.</p>
                            </div>

                            {isLoadingHM ? (
                                <div className="text-center py-16 animate-pulse text-slate-500 text-xs font-black uppercase tracking-widest">Betöltés...</div>
                            ) : heatmapError ? (
                                <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">A találati térkép most nem tölthető be. Ellenőrizd a kapcsolatot, majd nyisd meg újra ezt a fület.</div>
                            ) : heatList.length === 0 ? (
                                <div className="flex flex-col items-center py-16 bg-[#12141a] rounded-3xl border border-dashed border-slate-700 text-center px-8">
                                    <ChartBarIcon className="h-16 w-16 text-slate-600 mb-4" />
                                    <h3 className="text-lg font-black text-white uppercase italic mb-2">Még nincs szektoradat</h3>
                                    <p className="text-slate-400 text-sm font-bold max-w-sm leading-relaxed">Játssz PRO vagy TÁBLA bevitelben, vagy végezz Célpont Vadász edzést. A FAST körösszegből nem derül ki, melyik szektort találtad el.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-1.5" role="group" aria-label="Szektorszűrő">
                                        {(['all', 'single', 'double', 'treble'] as const).map(filter => {
                                            const labels = { all: 'Mind', single: 'Sima', double: 'Dupla', treble: 'Tripla' };
                                            return <button key={filter} type="button" onClick={() => setHmFilter(filter)} aria-pressed={hmFilter === filter}
                                                className={`min-w-0 flex-1 rounded-lg px-1 py-2.5 text-[10px] sm:text-xs font-black uppercase transition-colors ${hmFilter === filter ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{labels[filter]}</button>;
                                        })}
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
                                        <section className="min-w-0 rounded-3xl border border-slate-700/70 bg-[#12141a] p-3 sm:p-5" aria-label="Találatok a darts táblán">
                                            <HeatmapBoard data={displayHeatmap} filter={hmFilter} selectedSector={activeHeatSector?.key} onSelectSector={setSelectedSector} />
                                            <div className="mt-4"><HeatmapLegend /></div>
                                            <p className="mt-3 text-center text-xs text-slate-400">Koppints egy színes szektorra, vagy válassz a listából.</p>
                                            {activeHeatSector && <div className="mt-5 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3" role="status">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Kiválasztott szektor</p>
                                                <div className="mt-1 flex items-end justify-between gap-3"><strong className="font-mono text-2xl font-black text-white">{activeHeatSector.key}</strong><strong className="text-lg font-black text-cyan-200 tabular-nums">{activeHeatSector.hits} találat</strong></div>
                                                <p className="mt-1 text-xs text-slate-300">Az összes rögzített szektortalálat {activeHeatSector.sharePct}%-a.</p>
                                            </div>}
                                            {hmFilter === 'all' && sectorHits(displayHeatmap, 'BULL') > 0 && <p className="mt-3 text-center text-xs text-slate-400">A Célpont Vadász által rögzített általános Bull találatok külön szerepelnek a listában.</p>}
                                        </section>

                                        <section className="min-w-0 rounded-3xl border border-slate-800 bg-[#12141a] p-4 sm:p-5" aria-label="Leggyakoribb találati szektorok">
                                            <div className="grid grid-cols-2 gap-2 mb-5">
                                                <div className="rounded-xl bg-slate-900 p-3"><span className="block text-[10px] font-bold uppercase text-slate-400">Találat összesen</span><strong className="text-xl font-black text-white tabular-nums">{totalHeatHits}</strong></div>
                                                <div className="rounded-xl bg-slate-900 p-3"><span className="block text-[10px] font-bold uppercase text-slate-400">Érintett szektor</span><strong className="text-xl font-black text-white tabular-nums">{heatList.length}</strong></div>
                                            </div>
                                            <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-300">Leggyakoribb szektorok</h3>
                                            {filteredHeatList.length === 0 ? <p className="rounded-xl bg-slate-900 p-4 text-sm text-slate-400">Ebben a szűrőben még nincs találat.</p> :
                                                <div className="flex flex-col gap-2">
                                                    {filteredHeatList.slice(0, 10).map(item => <button key={item.key} type="button" onClick={() => setSelectedSector(item.key)} aria-pressed={activeHeatSector?.key === item.key}
                                                        className={`rounded-xl border p-2.5 text-left transition-colors ${activeHeatSector?.key === item.key ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}>
                                                        <span className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-black text-white">{item.key}</span><span className="text-xs font-bold text-slate-300 tabular-nums">{item.hits} találat · {item.sharePct}%</span></span>
                                                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full" style={{ width: `${Math.max(5, item.hits / (filteredHeatList[0]?.hits || 1) * 100)}%`, backgroundColor: heatmapColor(item.hits) }} /></span>
                                                    </button>)}
                                                </div>}
                                        </section>
                                    </div>
                                    <p className="text-xs leading-relaxed text-slate-500">A PRO és TÁBLA bevitel eltalált szektorokat rögzít; a Célpont Vadász külön célponttal dolgozik. A meglévő adatokból pontos célzási arány nem számolható. A FAST bevitel csak körösszeget tárol.</p>
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
                                <button onClick={handleSearch} aria-label="Játékos keresése"
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
                        <button onClick={() => setSelectedMatch(null)} aria-label="Meccsadatok bezárása" className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors">
                            <XMarkIcon className="h-7 w-7" />
                        </button>
                        <div className="text-center mb-6 border-b border-slate-800 pb-5">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">
                                {matchDate(selectedMatch.date).toLocaleString('hu-HU')}
                            </span>
                            <h2 className="text-2xl font-black text-white uppercase italic">vs {selectedMatch.opponent}</h2>
                            <div className="mt-3 inline-block bg-slate-900 border border-slate-700 px-6 py-2 rounded-xl">
                                <span className="text-xl font-mono font-black text-white">{recordedMatchScore(selectedMatch.score)}</span>
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
