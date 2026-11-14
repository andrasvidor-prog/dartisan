'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
    TrophyIcon, ArrowLeftIcon, ChartBarIcon, StarIcon, FireIcon,
    ArrowPathIcon, MagnifyingGlassIcon, PencilIcon, UserPlusIcon,
    UsersIcon, CheckCircleIcon, XMarkIcon, ShieldCheckIcon, BoltIcon,
    CalendarDaysIcon, ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { db, auth, googleProvider } from '../firebase';
import { EmailAuthProvider, reauthenticateWithPopup, reload, sendPasswordResetEmail, signOut, updatePassword } from 'firebase/auth';
import {
    doc, onSnapshot, collection, getDocs, query, limit, Timestamp,
    updateDoc, arrayUnion, orderBy, getDoc, setDoc
} from 'firebase/firestore';
import { matchHistoryCsv, matchTrend, recordedMatchScore, type MatchAnalyticsRow } from '../lib/matchAnalytics';
import { HeatmapBoard, HeatmapLegend, heatmapColor } from './HeatmapBoard';
import { mergeAimStats, mergeHeatmaps, normalizeAimStat, normalizeHeatmapData, sectorHits, sectorType, type AimStat, type HeatmapData, type HeatmapFilter, type HeatmapSource } from '../lib/heatmap';
import { AppFeedback, type AppFeedbackState } from './AppFeedback';
import type { Language } from '@/app/page';

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
type HeatmapSourceFilter = 'all' | 'match' | 'training' | 'legacy';

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

const MatchTrendChart = ({ rows, lang }: { rows: MatchAnalyticsRow[]; lang: Language }) => {
    const trend = matchTrend(rows);
    if (trend.count < 2) return null;
    const max = Math.max(60, ...trend.averages, ...trend.first9.filter((value): value is number => value !== null));
    return <section className="rounded-2xl border border-indigo-500/25 bg-[#12141a] p-4 sm:p-6" aria-label={lang === 'hu' ? 'Átlagok alakulása' : 'Average trend'}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div><h3 className="text-sm font-black uppercase text-white">{lang === 'hu' ? 'Átlagok alakulása' : 'Average trend'}</h3><p className="text-xs text-slate-400 mt-1">{lang === 'hu' ? `Az utolsó ${trend.count} mentett meccs, időrendben.` : `Last ${trend.count} saved matches, in date order.`}</p></div>
            <div className="flex gap-4 text-xs font-black"><span className="text-indigo-300">● {lang === 'hu' ? '3 nyilas átlag' : '3-dart average'}</span><span className="text-cyan-300">● {lang === 'hu' ? 'Első 9 nyíl' : 'First 9 darts'}</span></div>
        </div>
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label={lang === 'hu' ? 'Háromnyilas és első kilenc nyilas átlag trendje' : 'Three-dart and first-nine average trend'} className="w-full h-36 sm:h-44 rounded-xl bg-[#0b0d11]">
            {[48, 96, 144].map(y => <line key={y} x1="12" x2="588" y1={y} y2={y} stroke="#283241" strokeWidth="1" />)}
            <polyline points={trendPoints(trend.averages, max)} fill="none" stroke="#a5b4fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={trendPoints(trend.first9, max)} fill="none" stroke="#67e8f9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="grid grid-cols-2 gap-3 mt-4 text-xs"><div className="rounded-xl bg-[#0b0d11] p-3"><span className="text-slate-400 block">{lang === 'hu' ? 'Átlag változása' : 'Average change'}</span><strong className={trend.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{trend.change >= 0 ? '+' : ''}{trend.change.toFixed(1)}</strong></div><div className="rounded-xl bg-[#0b0d11] p-3"><span className="text-slate-400 block">{lang === 'hu' ? 'Ingadozás (szórás)' : 'Variation (SD)'}</span><strong className="text-white">{trend.deviation.toFixed(1)}</strong></div></div>
    </section>;
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProfileScreen({ onBack, lang }: { onBack: () => void; lang: Language }) {
    const tr = (hu: string, en: string) => lang === 'hu' ? hu : en;
    const [feedback, setFeedback] = useState<AppFeedbackState | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const [myStats, setMyStats]         = useState<ProfileStats | null>(null);
    const [viewedStats, setViewedStats] = useState<ProfileStats | null>(null);
    const [profileError, setProfileError] = useState(false);
    const [isViewingOther, setIsViewingOther] = useState(false);

    const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
    const [legacyHeatmaps, setLegacyHeatmaps] = useState<{ setupId: string; data: HeatmapData }[]>([]);
    const [landingHeatmaps, setLandingHeatmaps] = useState<{ setupId: string; source: HeatmapSource; data: HeatmapData }[]>([]);
    const [aimStats, setAimStats] = useState<AimStat[]>([]);
    const [hmSource, setHmSource] = useState<HeatmapSourceFilter>('all');
    const [hmSetup, setHmSetup] = useState('all');
    const [hmMetric, setHmMetric] = useState<'hits' | 'accuracy'>('hits');
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

    useEffect(() => {
        if (!selectedMatch && !isEditingAvatar) return;
        const dialog = modalRef.current;
        if (!dialog) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const siblings = Array.from(dialog.parentElement?.children || []).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialog)
            .map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
        siblings.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
        const controls = () => Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
        controls()[0]?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); setSelectedMatch(null); setIsEditingAvatar(false); return; }
            if (event.key !== 'Tab') return;
            const first = controls()[0];
            const last = controls().at(-1);
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        dialog.addEventListener('keydown', onKeyDown);
        return () => {
            dialog.removeEventListener('keydown', onKeyDown);
            siblings.forEach(({ element, inert, ariaHidden }) => {
                element.inert = inert;
                if (ariaHidden === null) element.removeAttribute('aria-hidden');
                else element.setAttribute('aria-hidden', ariaHidden);
            });
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [selectedMatch, isEditingAvatar]);

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
            setFeedback({ kind: 'notice', message: tr('A kijelentkezés nem sikerült. Próbáld újra.', 'Could not sign out. Please try again.') });
        }
    };

    const handleSetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const user = auth.currentUser;
        setPasswordError('');
        setPasswordMessage('');
        if (!user?.email) return;
        if (newPassword.length < 6) return setPasswordError(tr('A jelszó legyen legalább 6 karakteres.', 'Use at least 6 characters for your password.'));
        if (newPassword !== confirmPassword) return setPasswordError(tr('A két jelszó nem egyezik.', 'The passwords do not match.'));
        setPasswordBusy(true);
        try {
            try {
                await updatePassword(user, newPassword);
            } catch (error) {
                const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
                if (code !== 'auth/requires-recent-login' || !user.providerData.some(provider => provider.providerId === 'google.com')) throw error;
                await reauthenticateWithPopup(user, googleProvider);
                await updatePassword(user, newPassword);
            }
            await reload(user);
            if (!user.providerData.some(provider => provider.providerId === EmailAuthProvider.PROVIDER_ID)) {
                throw new Error('A Firebase nem erősítette meg a jelszavas belépés bekapcsolását.');
            }
            setPasswordEnabled(true);
            setNewPassword('');
            setConfirmPassword('');
            setPasswordMessage(tr('A jelszavas belépés aktív. Mostantól ezzel az e-mail-címmel és az új jelszóval is beléphetsz.', 'Password sign-in is active. You can now sign in with this email and your new Dartisan password.'));
        } catch (error) {
            console.error('Password setup failed:', error);
            const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
            setPasswordError(code === 'auth/requires-recent-login'
                ? tr('Biztonsági okból lépj ki, majd jelentkezz be újra Google-lal, és próbáld újra.', 'For security, sign out and back in with Google, then try again.')
                : code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
                    ? tr('A Google megerősítés megszakadt. Próbáld újra a jelszó beállítását.', 'Google confirmation was canceled. Try setting the password again.')
                : code === 'auth/popup-blocked'
                    ? tr('A böngésző blokkolta a Google megerősítő ablakot. Engedélyezd az előugró ablakokat, majd próbáld újra.', 'Your browser blocked the Google confirmation popup. Allow popups and try again.')
                : code === 'auth/weak-password'
                    ? tr('A jelszó túl gyenge. Válassz hosszabb, nehezebben kitalálható jelszót.', 'The password is too weak. Choose a longer password that is harder to guess.')
                    : tr(`A jelszó beállítása nem sikerült (${code || 'ismeretlen hiba'}). Próbáld újra.`, `Could not set the password (${code || 'unknown error'}). Please try again.`));
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
            setPasswordMessage(tr('Elküldtük a jelszó-visszaállító levelet a fiókod e-mail-címére.', 'A password reset email was sent to your account address.'));
        } catch (error) {
            console.error('Password reset failed:', error);
            const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
            setPasswordError(code === 'auth/too-many-requests'
                ? tr('Túl sok kérés érkezett. Próbáld újra később.', 'Too many requests. Please try again later.')
                : code === 'auth/network-request-failed'
                    ? tr('Hálózati hiba történt. Ellenőrizd a kapcsolatot, majd próbáld újra.', 'Network error. Check your connection and try again.')
                    : tr(`Nem sikerült elküldeni a levelet (${code || 'ismeretlen hiba'}).`, `Could not send the email (${code || 'unknown error'}).`));
        } finally {
            setPasswordBusy(false);
        }
    };

    // ── Heatmap: legacy and new event totals stay separate to avoid double counting. ──
    useEffect(() => {
        if (activeTab !== 'analytics') return;
        const user = auth.currentUser;
        if (!user) return;
        const loaded = new Set<string>();
        const markLoaded = (name: string) => { loaded.add(name); if (loaded.size === 3) { setIsLoadingHM(false); setHeatmapError(false); } };
        const onError = (error: Error) => { console.error('Heatmap could not be loaded:', error); setHeatmapError(true); setIsLoadingHM(false); };
        const legacy = onSnapshot(collection(db, 'users', user.uid, 'stats', 'heatmaps', 'setups'), snapshot => {
            setLegacyHeatmaps(snapshot.docs.map(item => ({ setupId: item.id, data: normalizeHeatmapData(item.data() as HeatmapData) })));
            markLoaded('legacy');
        }, onError);
        const landings = onSnapshot(collection(db, 'users', user.uid, 'stats', 'landings', 'setups'), snapshot => {
            setLandingHeatmaps(snapshot.docs.flatMap(item => {
                const data = item.data();
                return (data.source === 'match' || data.source === 'training') && typeof data.setupId === 'string'
                    ? [{ setupId: data.setupId as string, source: data.source as HeatmapSource, data: normalizeHeatmapData(data.sectors || {}) }]
                    : [];
            }));
            markLoaded('landings');
        }, onError);
        const aims = onSnapshot(collection(db, 'users', user.uid, 'stats', 'aims', 'targets'), snapshot => {
            setAimStats(snapshot.docs.flatMap(item => { const value = normalizeAimStat(item.data()); return value ? [value] : []; }));
            markLoaded('aims');
        }, onError);
        return () => { legacy(); landings(); aims(); };
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
        { name: tr('Első győzelem', 'First win'), desc: tr('Nyertél egy meccset', 'Win one match'), unlocked: stats.matchesWon > 0, color: 'purple', icon: <TrophyIcon className="h-7 w-7" /> },
        { name: tr('Száznyolcvan!', 'One eighty!'), desc: tr('Dobtál egy 180-at', 'Throw a 180'), unlocked: stats.count180 > 0, color: 'rose', icon: <FireIcon className="h-7 w-7" /> },
        { name: tr('Mesterlövész', 'Sharpshooter'), desc: tr('100+ kiszálló', 'Checkout of 100+'), unlocked: stats.highestCheckout >= 100, color: 'cyan', icon: <StarIcon className="h-7 w-7" /> },
        { name: tr('Kiszállókirály', 'Checkout king'), desc: tr('170-es kiszálló', '170 checkout'), unlocked: stats.highestCheckout >= 170, color: 'purple', icon: <TrophyIcon className="h-7 w-7" /> },
        { name: tr('Gépágyú', 'Rapid fire'), desc: tr('10 db 180-at dobtál', 'Throw 10 scores of 180'), unlocked: stats.count180 >= 10, color: 'rose', icon: <FireIcon className="h-7 w-7" /> },
        { name: tr('180-as mágus', '180 wizard'), desc: tr('50 db 180-at dobtál', 'Throw 50 scores of 180'), unlocked: stats.count180 >= 50, color: 'rose', icon: <BoltIcon className="h-7 w-7" /> },
        { name: tr('Veterán', 'Veteran'), desc: tr('50 meccset játszottál', 'Play 50 matches'), unlocked: (stats.matchesPlayed || 0) >= 50, color: 'emerald', icon: <ChartBarIcon className="h-7 w-7" /> },
        { name: tr('Százas klub', 'Century club'), desc: tr('100 meccset játszottál', 'Play 100 matches'), unlocked: (stats.matchesPlayed || 0) >= 100, color: 'indigo', icon: <ChartBarIcon className="h-7 w-7" /> },
        { name: tr('Streakmester', 'Streak master'), desc: tr('7 napos bejelentkezési sorozat', 'Sign in 7 days in a row'), unlocked: (stats.streak || 0) >= 7, color: 'purple', icon: <CalendarDaysIcon className="h-7 w-7" /> },
        { name: tr('Profi', 'Pro'), desc: tr('60+ átlag', 'Average of 60+'), unlocked: stats.totalDarts > 0 && ((stats.totalPoints / stats.totalDarts) * 3) >= 60, color: 'purple', icon: <StarIcon className="h-7 w-7" /> },
        { name: tr('Kiszállószakértő', 'Checkout expert'), desc: tr('40%+ kiszálló arány (min. 20 kísérlet)', '40%+ checkout rate (at least 20 attempts)'), unlocked: stats.checkoutAttempts >= 20 && (stats.checkoutSuccess / stats.checkoutAttempts) >= 0.4, color: 'cyan', icon: <CheckCircleIcon className="h-7 w-7" /> },
        { name: tr('Egész éjjel', 'All night'), desc: tr('200+ 100-as dobás', 'Throw 200 scores of 100+'), unlocked: (stats.count100 || 0) >= 200, color: 'indigo', icon: <BoltIcon className="h-7 w-7" /> },
    ] : [];

    // ── Heatmap derived data ──────────────────────────────────────────────────
    const hmSetups = useMemo(() => Array.from(new Set([
        ...legacyHeatmaps.map(item => item.setupId), ...landingHeatmaps.map(item => item.setupId), ...aimStats.map(item => item.setupId),
    ])).sort(), [legacyHeatmaps, landingHeatmaps, aimStats]);
    const displayHeatmap = useMemo(() => mergeHeatmaps(
        ...(hmSource === 'all' || hmSource === 'legacy' ? legacyHeatmaps.filter(item => hmSetup === 'all' || item.setupId === hmSetup).map(item => item.data) : []),
        ...(hmSource === 'legacy' ? [] : landingHeatmaps.filter(item => (hmSetup === 'all' || item.setupId === hmSetup) && (hmSource === 'all' || item.source === hmSource)).map(item => item.data)),
    ), [legacyHeatmaps, landingHeatmaps, hmSource, hmSetup]);
    const displayAims = useMemo(() => mergeAimStats(aimStats.filter(item =>
        (hmSetup === 'all' || item.setupId === hmSetup) && (hmSource === 'all' || item.source === hmSource)
    )), [aimStats, hmSetup, hmSource]);
    const aimList = useMemo(() => Object.values(displayAims).filter(item => item.attempts > 0).sort((a, b) => b.attempts - a.attempts), [displayAims]);
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
    const filteredAimList = hmFilter === 'all' ? aimList : aimList.filter(item => sectorType(item.target) === hmFilter);
    const activeAimSector = filteredAimList.find(item => item.target === selectedSector) || filteredAimList[0] || null;

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
            <AppFeedback feedback={feedback} lang={lang} onClose={() => setFeedback(null)} />
            <div className="px-4 pb-4 pt-[calc(1rem+var(--app-safe-top))] sm:px-6 sm:pb-6 relative min-h-full w-full flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-3 shrink-0 bg-[#12141a] border border-slate-800 shadow-xl sticky top-0 z-20 mb-6 rounded-2xl">
                    <button onClick={onBack} aria-label={tr('Vissza', 'Back')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-all">
                        <ArrowLeftIcon className="h-5 w-5 text-white" />
                    </button>
                    <h1 className="text-xl font-black text-white uppercase italic tracking-widest">
                        {isViewingOther ? stats.name : tr('Profil', 'Profile')}
                    </h1>
                    {isViewingOther ? (
                        <button onClick={() => { setIsViewingOther(false); if (myStats) setViewedStats(myStats); }} aria-label={tr('Másik profil bezárása', 'Close other profile')}
                            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-all">
                            <XMarkIcon className="h-5 w-5 text-white" />
                        </button>
                    ) : <button onClick={handleSignOut} aria-label={tr('Kijelentkezés', 'Sign out')} title={tr('Kijelentkezés', 'Sign out')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-all"><ArrowRightOnRectangleIcon className="h-5 w-5 text-slate-300" /></button>}
                </div>

                <div className={`${activeTab === 'analytics' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto pb-20 w-full flex-1`}>
                    {profileError && <p role="status" className="mb-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm font-bold text-cyan-200">{tr('A felhőben tárolt profiladatok most nem érhetők el. Az alapadatok láthatók; próbáld újra később.', 'Cloud profile data is unavailable right now. Basic information is shown; try again later.')}</p>}

                    {/* Tab nav */}
                    <div className="flex gap-1.5 mb-8 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto max-w-3xl mx-auto w-full">
                        {(['profile', 'history', 'analytics', 'social'] as const).map(t => {
                            const active = activeTab === t;
                            const colorMap = { profile: 'bg-emerald-500 text-slate-950', history: 'bg-indigo-500 text-white', analytics: 'bg-[#b655ff] text-white', social: 'bg-cyan-500 text-slate-950' };
                            const labels = lang === 'hu' ? { profile: 'Profil', history: 'Napló', analytics: 'Hőtérkép', social: 'Közösség' } : { profile: 'Profile', history: 'History', analytics: 'Heatmap', social: 'Social' };
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
                                <button type="button" disabled={isViewingOther} aria-label={tr('Avatar módosítása', 'Change avatar')} className="relative group cursor-pointer mb-4 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-emerald-400 rounded-full"
                                    onClick={() => setIsEditingAvatar(true)}>
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
                                </button>
                                <h1 className="text-3xl font-black text-white uppercase italic">{stats.name}</h1>
                                <p className="text-emerald-400 font-black tracking-[0.3em] mb-1">#{stats.tag || '0000'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-emerald-500 text-slate-900 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest">{tr('Szint', 'Level')} {level}</span>
                                    {(stats.streak || 0) > 1 && (
                                        <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1">
                                            🔥 {stats.streak} {tr('nap', stats.streak === 1 ? 'day' : 'days')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {!isViewingOther && auth.currentUser?.email && (
                                <section className="rounded-[2rem] border border-emerald-500/25 bg-[#12141a] p-5 sm:p-6" aria-label={tr('Fiók és belépés', 'Account and sign-in')}>
                                    <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase text-white"><ShieldCheckIcon className="h-5 w-5 text-emerald-400" /> {tr('Fiók és belépés', 'Account and sign-in')}</h2>
                                    <p className="break-all text-sm text-slate-400">{auth.currentUser.email}</p>
                                    <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                                        <p className="text-xs font-black uppercase text-slate-300">{tr('Jelszavas belépés', 'Password sign-in')}</p>
                                        <p className={`mt-1 text-sm font-bold ${passwordEnabled ? 'text-emerald-400' : 'text-amber-300'}`}>
                                            {passwordEnabled === null ? tr('Ellenőrzés…', 'Checking…') : passwordEnabled ? tr('Aktív ennél a fióknál', 'Active for this account') : tr('Nincs beállítva ennél a fióknál', 'Not set up for this account')}
                                        </p>
                                        {passwordEnabled === false && (
                                            <form onSubmit={handleSetPassword} className="mt-4 flex flex-col gap-3">
                                                <p className="text-xs leading-relaxed text-slate-400">{tr('Ehhez a fiókhoz új Dartisan-jelszót állíthatsz be. A Google-jelszavadat ne írd ide.', 'Set a separate Dartisan password for this account. Do not enter your Google password here.')}</p>
                                                <input type="password" autoComplete="new-password" aria-label={tr('Új Dartisan-jelszó', 'New Dartisan password')} placeholder={tr('Új Dartisan-jelszó (legalább 6 karakter)', 'New Dartisan password (at least 6 characters)')} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-700 bg-[#12141a] px-4 text-white outline-none focus:border-emerald-500" />
                                                <input type="password" autoComplete="new-password" aria-label={tr('Új Dartisan-jelszó megerősítése', 'Confirm new Dartisan password')} placeholder={tr('Jelszó még egyszer', 'Repeat password')} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-700 bg-[#12141a] px-4 text-white outline-none focus:border-emerald-500" />
                                                <button type="submit" disabled={passwordBusy} className="min-h-12 rounded-xl bg-emerald-500 px-4 text-xs font-black uppercase text-slate-950 disabled:opacity-50">{passwordBusy ? tr('Folyamatban…', 'Working…') : tr('Jelszavas belépés beállítása', 'Set up password sign-in')}</button>
                                            </form>
                                        )}
                                        {passwordEnabled && <button type="button" onClick={handlePasswordReset} disabled={passwordBusy} className="mt-4 min-h-11 rounded-xl border border-emerald-500/40 px-4 text-xs font-black uppercase text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">{passwordBusy ? tr('Folyamatban…', 'Working…') : tr('Jelszó-visszaállító levél küldése', 'Send password reset email')}</button>}
                                        {passwordError && <p role="alert" className="mt-3 text-xs font-bold text-rose-300">{passwordError}</p>}
                                        {passwordMessage && <p role="status" className="mt-3 text-xs font-bold text-emerald-300">{passwordMessage}</p>}
                                    </div>
                                </section>
                            )}

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: tr('Meccsek', 'Matches'), value: stats.matchesPlayed || 0, color: 'text-white' },
                                    { label: tr('Győzelmek', 'Wins'), value: `${stats.matchesWon || 0}`, color: 'text-emerald-400' },
                                    { label: 'Win rate',   value: `${winRate}%`,                                    color: 'text-emerald-400' },
                                    { label: tr('Átlag', 'Average'), value: avg, color: 'text-cyan-400' },
                                    { label: tr('Első 9 átl.', 'First 9 avg'), value: f9avg, color: 'text-[#b655ff]' },
                                    { label: tr('Kiszálló%', 'Checkout %'), value: `${coPct}%`, color: 'text-cyan-400' },
                                    { label: tr('Max kiszálló', 'High checkout'), value: stats.highestCheckout || 0, color: 'text-cyan-400' },
                                    { label: tr('Leghosszabb sorozat', 'Best streak'), value: `${stats.streak || 1} ${tr('nap', (stats.streak || 1) === 1 ? 'day' : 'days')}`, color: 'text-cyan-400' },
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
                                    { label: '140+', value: stats.count140 || 0, color: 'text-cyan-400' },
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
                                    <TrophyIcon className="h-5 w-5 text-[#b655ff]" /> {tr('Trófeaterem', 'Trophy room')}
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
                                    <ShieldCheckIcon className="h-5 w-5 text-cyan-400" /> {tr('Játékbeállítások', 'Gameplay settings')}
                                </h2>

                                {/* Checkout mode */}
                                <div className="mb-5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{tr('Kiszálló szabály', 'Checkout rule')}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['single', 'double'] as const).map(c => (
                                            <button key={c} onClick={() => setPrefCheckout(c)}
                                                className={`py-3 rounded-xl font-black text-xs uppercase border transition-all ${prefCheckout === c ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                                {c === 'single' ? tr('Bármilyen', 'Any') : tr('Csak dupla', 'Double only')}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-600 mt-1.5 font-bold">
                                        {prefCheckout === 'double' ? tr('A kiszállóhoz dupla szegmens szükséges (standard)', 'A double is required to finish (standard)') : tr('Bármely szegmens kiszálló lehet', 'Any segment can finish the leg')}
                                    </p>
                                </div>

                                {/* Input mode */}
                                <div className="mb-5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{tr('Alapértelmezett bevitel', 'Default input mode')}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { key: 'fast',     label: tr('Gyors', 'Fast'), desc: tr('Numerikus billentyűzet', 'Number pad') },
                                            { key: 'detailed', label: 'Pro', desc: tr('Nyilankénti részletes', 'Per dart') },
                                            { key: 'board', label: tr('Tábla', 'Board'), desc: tr('Kattintható táblán', 'Tap the board') },
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
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{tr('Kedvenc kiszálló dupla', 'Favorite checkout double')}</p>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {['D20','D16','D10','D8','D12','D18','D6','D4','D2','BULL'].map(d => (
                                            <button key={d} onClick={() => setPrefFavDouble(d)}
                                                className={`min-h-11 rounded-lg font-black text-[10px] border transition-all ${prefFavDouble === d ? 'bg-cyan-500 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-600 mt-1.5 font-bold">{tr('A kiszállójavaslatokban ez jelenik meg első helyen', 'This double appears first in checkout suggestions')}</p>
                                </div>

                                {/* Save button */}
                                <button onClick={handleSaveSettings}
                                    className={`w-full h-12 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${settingsSaved ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                                    {settingsSaved ? tr('✓ Mentve!', '✓ Saved!') : tr('Beállítások mentése', 'Save settings')}
                                </button>
                            </div>
                            )}
                            {!isViewingOther && <button type="button" onClick={handleSignOut} className="w-full min-h-12 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-black uppercase text-rose-300 hover:bg-rose-500/20">{tr('Kijelentkezés', 'Sign out')}</button>}
                        </div>
                    )}

                    {/* ── NAPLÓ TAB ───────────────────────────────────────────────────────── */}
                    {activeTab === 'history' && (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-white uppercase italic flex items-center gap-2"><ChartBarIcon className="h-5 w-5 text-indigo-400" /> {tr('Meccsnapló', 'Match history')}</h2>{matchRows.length > 0 && <button type="button" onClick={exportMatchHistory} className="rounded-xl border border-indigo-500/40 px-4 py-2 text-xs font-black text-indigo-300 hover:bg-indigo-500/10">CSV export</button>}</div>
                            <MatchTrendChart rows={matchRows} lang={lang} />
                            {matchHistory.length === 0 ? (
                                <div className="text-center py-16 text-slate-500 font-bold uppercase border border-dashed border-slate-800 rounded-2xl text-xs tracking-widest">
                                    {tr('Még nincs rögzített meccs.', 'No matches recorded yet.')}
                                </div>
                            ) : matchHistory.map((m, i) => (
                                <div key={i} onClick={() => setSelectedMatch(m)}
                                    className="bg-[#12141a] border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
                                    <div className="min-w-0">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">
                                            {matchDate(m.date).toLocaleDateString(lang === 'hu' ? 'hu-HU' : 'en-GB')} • {m.mode?.toUpperCase()}
                                        </span>
                                        <span className="text-white font-black uppercase italic text-base block truncate">vs {m.opponent}</span>
                                        <span className="text-xs text-slate-400 font-bold">
                                            {tr('Eredmény', 'Score')}: <span className="text-white">{recordedMatchScore(m.score)}</span>
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
                                    <ChartBarIcon className="h-5 w-5 text-cyan-400" /> {tr('Találati térkép', 'Hit map')}
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">{tr('Nézd meg, hová érkeznek a nyilaid, és mely célpontokat találod el pontosan. A régi adatok csak találatszámot tartalmaznak.', 'See where your darts land and how accurately you hit your targets. Older records contain hit counts only.')}</p>
                            </div>

                            <div className="grid gap-3 rounded-2xl border border-slate-800 bg-[#12141a] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                <label className="min-w-0 text-xs font-bold text-slate-400">{tr('Forrás', 'Source')}
                                    <select value={hmSource} onChange={event => { setHmSource(event.target.value as HeatmapSourceFilter); setSelectedSector(null); }} className="mt-1 block h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-cyan-400">
                                        <option value="all">{tr('Összes adat', 'All data')}</option><option value="match">{tr('Meccs', 'Match')}</option><option value="training">{tr('Edzés', 'Training')}</option><option value="legacy">{tr('Korábbi adatok', 'Older data')}</option>
                                    </select>
                                </label>
                                <label className="min-w-0 text-xs font-bold text-slate-400">{tr('Dartskészlet', 'Dart setup')}
                                    <select value={hmSetup} onChange={event => { setHmSetup(event.target.value); setSelectedSector(null); }} className="mt-1 block h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-cyan-400">
                                        <option value="all">{tr('Minden készlet', 'All setups')}</option>{hmSetups.map(setup => <option key={setup} value={setup}>{setup === 'default' ? tr('Alapértelmezett', 'Default') : setup}</option>)}
                                    </select>
                                </label>
                                <div className="flex h-11 rounded-xl border border-slate-700 bg-slate-900 p-1" role="group" aria-label={tr('Hőtérkép mód', 'Heatmap mode')}>
                                    <button type="button" onClick={() => { setHmMetric('hits'); setSelectedSector(null); }} aria-pressed={hmMetric === 'hits'} className={`flex-1 rounded-lg px-3 text-xs font-black ${hmMetric === 'hits' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}>{tr('Találatok', 'Hits')}</button>
                                    <button type="button" onClick={() => { setHmMetric('accuracy'); setSelectedSector(null); }} aria-pressed={hmMetric === 'accuracy'} className={`flex-1 rounded-lg px-3 text-xs font-black ${hmMetric === 'accuracy' ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}>{tr('Pontosság', 'Accuracy')}</button>
                                </div>
                            </div>

                            {isLoadingHM ? (
                                <div className="text-center py-16 animate-pulse text-slate-500 text-xs font-black uppercase tracking-widest">{tr('Betöltés...', 'Loading...')}</div>
                            ) : heatmapError ? (
                                <div role="alert" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5 text-sm text-cyan-100">{tr('A találati térkép most nem tölthető be. Ellenőrizd a kapcsolatot, majd nyisd meg újra ezt a fület.', 'The hit map could not load. Check your connection, then reopen this tab.')}</div>
                            ) : (hmMetric === 'hits' ? heatList.length === 0 : aimList.length === 0) ? (
                                <div className="flex flex-col items-center py-16 bg-[#12141a] rounded-3xl border border-dashed border-slate-700 text-center px-8">
                                    <ChartBarIcon className="h-16 w-16 text-slate-600 mb-4" />
                                    <h3 className="text-lg font-black text-white uppercase italic mb-2">{hmMetric === 'accuracy' ? tr('Még nincs célzási adat', 'No aiming data yet') : tr('Még nincs szektoradat', 'No sector data yet')}</h3>
                                    <p className="text-slate-400 text-sm font-bold max-w-sm leading-relaxed">{hmMetric === 'accuracy' ? tr('Válassz célpontot a meccs PRO vagy TÁBLA bevitelénél, vagy végezz Célpont Vadász edzést. A korábbi találatok célpontja nem ismert.', 'Choose a target in Pro or Board input, or try Target Hunter. Older hits have no recorded target.') : tr('Játssz PRO vagy TÁBLA bevitelben, vagy végezz Célpont Vadász edzést. A FAST körösszegből nem derül ki, melyik szektort találtad el.', 'Use Pro or Board input, or try Target Hunter. Fast totals do not reveal which sectors were hit.')}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-1.5" role="group" aria-label={tr('Szektorszűrő', 'Sector filter')}>
                                        {(['all', 'single', 'double', 'treble'] as const).map(filter => {
                                            const labels = lang === 'hu' ? { all: 'Mind', single: 'Sima', double: 'Dupla', treble: 'Tripla' } : { all: 'All', single: 'Single', double: 'Double', treble: 'Triple' };
                                            return <button key={filter} type="button" onClick={() => setHmFilter(filter)} aria-pressed={hmFilter === filter}
                                                className={`min-w-0 flex-1 rounded-lg px-1 py-2.5 text-[10px] sm:text-xs font-black uppercase transition-colors ${hmFilter === filter ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{labels[filter]}</button>;
                                        })}
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
                                        <section className="min-w-0 rounded-3xl border border-slate-700/70 bg-[#12141a] p-3 sm:p-5" aria-label={tr('Találatok a darts táblán', 'Hits on the dartboard')}>
                                            <HeatmapBoard data={displayHeatmap} filter={hmFilter} metric={hmMetric} accuracy={displayAims} selectedSector={hmMetric === 'hits' ? activeHeatSector?.key : activeAimSector?.target} onSelectSector={setSelectedSector} lang={lang} />
                                            <div className="mt-4"><HeatmapLegend metric={hmMetric} lang={lang} /></div>
                                            <p className="mt-3 text-center text-xs text-slate-400">{tr('Koppints egy kiemelt szektorra, vagy válassz a listából.', 'Tap a highlighted sector or choose one from the list.')}</p>
                                            {hmMetric === 'hits' && activeHeatSector && <div className="mt-5 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3" role="status">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{tr('Kiválasztott szektor', 'Selected sector')}</p>
                                                <div className="mt-1 flex items-end justify-between gap-3"><strong className="font-mono text-2xl font-black text-white">{activeHeatSector.key}</strong><strong className="text-lg font-black text-cyan-200 tabular-nums">{activeHeatSector.hits} {tr('találat', 'hits')}</strong></div>
                                                <p className="mt-1 text-xs text-slate-300">{tr(`Az összes rögzített szektortalálat ${activeHeatSector.sharePct}%-a.`, `${activeHeatSector.sharePct}% of all recorded sector hits.`)}</p>
                                            </div>}
                                            {hmMetric === 'accuracy' && activeAimSector && <div className="mt-5 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3" role="status">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{tr('Célzott szektor', 'Aimed sector')}</p>
                                                <div className="mt-1 flex items-end justify-between gap-3"><strong className="font-mono text-2xl font-black text-white">{activeAimSector.target}</strong><strong className="text-lg font-black text-cyan-200 tabular-nums">{Math.round(activeAimSector.hits / activeAimSector.attempts * 100)}%</strong></div>
                                                <p className="mt-1 text-xs text-slate-300">{activeAimSector.hits} {tr('találat', 'hits')} / {activeAimSector.attempts} {tr('célzott nyíl', 'aimed darts')}.</p>
                                                {Object.entries(activeAimSector.landings).filter(([key]) => key !== activeAimSector.target).sort((a, b) => b[1] - a[1]).slice(0, 3).length > 0 && <p className="mt-2 text-xs text-slate-400">{tr('Más helyre érkezett', 'Landed elsewhere')}: {Object.entries(activeAimSector.landings).filter(([key]) => key !== activeAimSector.target).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, count]) => `${key} (${count})`).join(', ')}.</p>}
                                                {activeAimSector.unlocatedMisses > 0 && <p className="mt-1 text-xs text-slate-400">{tr(`${activeAimSector.unlocatedMisses} edzésnyílnál a mellédobás helye nem ismert.`, `The landing position is unknown for ${activeAimSector.unlocatedMisses} training misses.`)}</p>}
                                            </div>}
                                            {hmMetric === 'hits' && hmFilter === 'all' && sectorHits(displayHeatmap, 'BULL') > 0 && <p className="mt-3 text-center text-xs text-slate-400">{tr('Az általános Bull találatok külön szerepelnek a listában.', 'General Bull hits appear separately in the list.')}</p>}
                                        </section>

                                        <section className="min-w-0 rounded-3xl border border-slate-800 bg-[#12141a] p-4 sm:p-5" aria-label={tr('Leggyakoribb találati szektorok', 'Most common hit sectors')}>
                                            <div className="grid grid-cols-2 gap-2 mb-5">
                                                <div className="rounded-xl bg-slate-900 p-3"><span className="block text-[10px] font-bold uppercase text-slate-400">{hmMetric === 'accuracy' ? tr('Célzott nyíl', 'Aimed darts') : tr('Találat összesen', 'Total hits')}</span><strong className="text-xl font-black text-white tabular-nums">{hmMetric === 'accuracy' ? aimList.reduce((sum, item) => sum + item.attempts, 0) : totalHeatHits}</strong></div>
                                                <div className="rounded-xl bg-slate-900 p-3"><span className="block text-[10px] font-bold uppercase text-slate-400">{hmMetric === 'accuracy' ? tr('Mért célpont', 'Measured targets') : tr('Érintett szektor', 'Sectors hit')}</span><strong className="text-xl font-black text-white tabular-nums">{hmMetric === 'accuracy' ? aimList.length : heatList.length}</strong></div>
                                            </div>
                                            <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-300">{hmMetric === 'accuracy' ? tr('Célpontok', 'Targets') : tr('Leggyakoribb szektorok', 'Most common sectors')}</h3>
                                            {hmMetric === 'accuracy' ? (filteredAimList.length === 0 ? <p className="rounded-xl bg-slate-900 p-4 text-sm text-slate-400">{tr('Ebben a szűrőben még nincs célzási adat.', 'No aiming data for this filter yet.')}</p> : <div className="flex flex-col gap-2">{filteredAimList.map(item => <button key={item.target} type="button" onClick={() => setSelectedSector(item.target)} aria-pressed={activeAimSector?.target === item.target} className={`rounded-xl border p-3 text-left transition-colors ${activeAimSector?.target === item.target ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}><span className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-black text-white">{item.target}</span><span className="text-xs font-bold text-slate-300 tabular-nums">{item.hits}/{item.attempts} · {Math.round(item.hits / item.attempts * 100)}%</span></span></button>)}</div>) : filteredHeatList.length === 0 ? <p className="rounded-xl bg-slate-900 p-4 text-sm text-slate-400">{tr('Ebben a szűrőben még nincs találat.', 'No hits for this filter yet.')}</p> :
                                                <div className="flex flex-col gap-2">
                                                    {filteredHeatList.slice(0, 10).map(item => <button key={item.key} type="button" onClick={() => setSelectedSector(item.key)} aria-pressed={activeHeatSector?.key === item.key}
                                                        className={`rounded-xl border p-2.5 text-left transition-colors ${activeHeatSector?.key === item.key ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}>
                                                        <span className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-black text-white">{item.key}</span><span className="text-xs font-bold text-slate-300 tabular-nums">{item.hits} {tr('találat', 'hits')} · {item.sharePct}%</span></span>
                                                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full" style={{ width: `${Math.max(5, item.hits / (filteredHeatList[0]?.hits || 1) * 100)}%`, backgroundColor: heatmapColor(item.hits) }} /></span>
                                                    </button>)}
                                                </div>}
                                        </section>
                                    </div>
                                    <p className="text-xs leading-relaxed text-slate-500">{tr('A PRO és TÁBLA bevitel célpont kiválasztásakor pontos célzási arányt mér. A Célpont Vadász három nyíl találatszámát rögzíti, a mellédobás helyét nem. A korábbi adatokból célzási arány nem számolható; a FAST bevitel csak körösszeget tárol.', 'Pro and Board input measure accuracy when you choose a target. Target Hunter records how many darts hit the target, but not where misses landed. Older data cannot provide accuracy; Fast input stores visit totals only.')}</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── SOCIAL TAB ──────────────────────────────────────────────────────── */}
                    {activeTab === 'social' && (
                        <div className="flex flex-col gap-6">
                            <h2 className="text-lg font-black text-white uppercase italic flex items-center gap-2">
                                <UsersIcon className="h-5 w-5 text-cyan-400" /> {tr('Játékoskeresés', 'Find players')}
                            </h2>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={tr('Keresés névvel vagy #tag-gel', 'Search by name or #tag')}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    className="flex-1 h-12 bg-[#12141a] border border-slate-700 rounded-xl px-4 text-white font-bold outline-none focus:border-cyan-500 transition-colors"
                                />
                                <button onClick={handleSearch} aria-label={tr('Játékos keresése', 'Search for player')}
                                    className="w-12 h-12 bg-cyan-500 rounded-xl text-slate-950 flex items-center justify-center hover:bg-cyan-400 active:scale-95 transition-all">
                                    <MagnifyingGlassIcon className="h-5 w-5" />
                                </button>
                            </div>

                            {isSearching ? (
                                <p className="text-slate-500 font-bold uppercase text-center animate-pulse text-xs">{tr('Keresés...', 'Searching...')}</p>
                            ) : searchResults.map((u, i) => (
                                <div key={i} className="bg-[#12141a] border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => loadOtherUser(u)}>
                                        <img src={getAvatar(u)}
                                            onError={e => { e.currentTarget.src = getAvatar(null); }}
                                            className="w-10 h-10 rounded-full bg-slate-800 object-cover" alt="" />
                                        <div>
                                            <p className="text-white font-black uppercase text-sm hover:text-cyan-400 transition-colors">{u.name}</p>
                                            <p className="text-cyan-400 text-[10px] font-black tracking-widest">#{u.tag || '0000'} · {tr('Szint', 'Level')} {Math.floor(Math.sqrt(Math.max(u.xp || 0, 0) / 100)) + 1}</p>
                                        </div>
                                    </div>
                                    {myStats?.friends?.includes(u.id) || u.id === myStats?.id ? (
                                        <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                                    ) : (
                                        <button onClick={() => handleAddFriend(u.id)} aria-label={tr(`${u.name} hozzáadása`, `Add ${u.name} as friend`)}
                                            className="p-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors">
                                            <UserPlusIcon className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            ))}

                            {searchResults.length === 0 && !isSearching && searchQuery && (
                                <p className="text-center text-slate-500 text-xs font-bold uppercase py-4">{tr('Nincs találat.', 'No results.')}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Match detail modal ─────────────────────────────────────────────────── */}
            {selectedMatch && (
                <div ref={modalRef} role="dialog" aria-modal="true" aria-label={tr('Meccs részletei', 'Match details')} className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                    onClick={() => setSelectedMatch(null)}>
                    <div className="bg-[#12141a] border border-indigo-500/40 p-6 rounded-[2rem] w-full max-w-lg shadow-2xl relative max-h-[85vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedMatch(null)} aria-label={tr('Meccsadatok bezárása', 'Close match details')} className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors">
                            <XMarkIcon className="h-7 w-7" />
                        </button>
                        <div className="text-center mb-6 border-b border-slate-800 pb-5">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">
                                {matchDate(selectedMatch.date).toLocaleString(lang === 'hu' ? 'hu-HU' : 'en-GB')}
                            </span>
                            <h2 className="text-2xl font-black text-white uppercase italic">vs {selectedMatch.opponent}</h2>
                            <div className="mt-3 inline-block bg-slate-900 border border-slate-700 px-6 py-2 rounded-xl">
                                <span className="text-xl font-mono font-black text-white">{recordedMatchScore(selectedMatch.score)}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {[
                                { label: tr('Meccsátlag', 'Match average'), value: selectedMatch.stats?.average?.toFixed(1) || '—', color: 'text-white' },
                                { label: tr('Első 9 átlag', 'First 9 average'), value: selectedMatch.stats?.first9Average?.toFixed(1) || '—', color: 'text-[#b655ff]' },
                                { label: tr('Kiszálló %', 'Checkout %'), value: `${Math.round((selectedMatch.stats?.checkoutPct || 0) * 100)}%`, color: 'text-emerald-400' },
                                { label: tr('Legjobb leg', 'Best leg'), value: selectedMatch.stats?.bestLegDarts ? `${selectedMatch.stats.bestLegDarts} ${tr('nyíl', selectedMatch.stats.bestLegDarts === 1 ? 'dart' : 'darts')}` : '—', color: 'text-cyan-400' },
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
                                { label: '140+', value: selectedMatch.stats?.count140 || 0, color: 'text-cyan-400' },
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
                <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="avatar-dialog-title" className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={() => setIsEditingAvatar(false)}>
                    <div className="bg-[#12141a] border border-slate-700 p-8 rounded-[2rem] w-full max-w-sm shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <h2 id="avatar-dialog-title" className="text-xl font-black text-white uppercase italic mb-6 text-center">{tr('Válassz avatart', 'Choose an avatar')}</h2>
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            {PREDEFINED_AVATARS.map((url, i) => (
                                <button key={i} onClick={() => handleAvatarSelect(url)} aria-label={tr(`Avatar ${i + 1}`, `Avatar ${i + 1}`)}
                                    className="p-2 bg-slate-900 border border-slate-700 rounded-2xl hover:border-emerald-500 hover:scale-110 transition-all">
                                    <img src={url} className="w-full h-auto rounded-full" alt="" />
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setIsEditingAvatar(false)}
                            className="w-full h-12 bg-slate-800 text-white rounded-xl font-black uppercase text-sm hover:bg-slate-700 transition-colors">
                            {tr('Mégsem', 'Cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
