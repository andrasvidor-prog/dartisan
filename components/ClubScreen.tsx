'use client';

import { useState, useEffect } from 'react';
import {
    XMarkIcon, ShieldCheckIcon, UsersIcon, PlusIcon,
    GlobeEuropeAfricaIcon, MagnifyingGlassIcon, ArrowRightEndOnRectangleIcon,
    TrophyIcon, CheckCircleIcon, ArrowLeftIcon
} from '@heroicons/react/24/outline';
import {
    collection, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc,
    updateDoc, arrayUnion, arrayRemove, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

interface ClubScreenProps {
    onBack: () => void;
    currentUser: { uid: string } | null;
    lang: 'hu' | 'en';
}

type ClubMember = { uid: string; name: string; xp: number; photoURL?: string };
type Club = { id: string; name: string; ownerId: string; members: string[]; totalXp: number; maxMembers: number };

const txt = {
    en: {
        title: "Dartisan Clubs",
        search: "Search clubs...",
        create: "Create Club",
        globalRank: "Global Club Leaderboard",
        noClubTitle: "You're not in a club!",
        noClubDesc: "Join a club from the leaderboard or create your own — earn shared XP with every match!",
        join: "Join",
        back: "Back",
        myClubTitle: "My Club",
        membersLabel: "Members",
        totalXpLabel: "Club XP",
        rankLabel: "Rank",
        leave: "Leave Club",
        leaveConfirm: "Are you sure you want to leave the club?",
        createTitle: "Create New Club",
        clubNameLabel: "Club Name",
        clubNamePlaceholder: "e.g. Arrow Kings",
        createBtn: "Create",
        cancel: "Cancel",
        loading: "Loading...",
        membersTitle: "Club Members",
        joinConfirm: (name: string) => `Join "${name}"?`,
        notLoggedIn: "Sign in to view and join clubs.",
        owner: "Founder",
        xp: "XP",
        you: "you",
    },
    hu: {
        title: "Dartisan Klubok",
        search: "Keresés...",
        create: "Létrehozás",
        globalRank: "Globális Klub Ranglista",
        noClubTitle: "Még nem vagy klubban!",
        noClubDesc: "Csatlakozz egy klubhoz a ranglistáról, vagy hozz létre egyet — közös XP-t gyűjtötök minden mérkőzéssel!",
        join: "Csatlakozás",
        back: "Vissza",
        myClubTitle: "Klubom",
        membersLabel: "Tagok",
        totalXpLabel: "Klub XP",
        rankLabel: "Rangsor",
        leave: "Kilépés a Klubból",
        leaveConfirm: "Biztosan ki akarsz lépni a klubból?",
        createTitle: "Új Klub Létrehozása",
        clubNameLabel: "Klub Neve",
        clubNamePlaceholder: "pl. Nyíl Királyok",
        createBtn: "Létrehozás",
        cancel: "Mégsem",
        loading: "Betöltés...",
        membersTitle: "Tagok",
        joinConfirm: (name: string) => `Csatlakozás: "${name}"?`,
        notLoggedIn: "Jelentkezz be a klubok megtekintéséhez.",
        owner: "Alapító",
        xp: "XP",
        you: "te",
    },
};

export function ClubScreen({ onBack, currentUser, lang }: ClubScreenProps) {
    const t = txt[lang];

    // ─── State ───────────────────────────────────────────────────────────────
    const [myClub, setMyClub] = useState<Club | null>(null);
    const [allClubs, setAllClubs] = useState<Club[]>([]);
    const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
    const [isLoading, setIsLoading] = useState(!!currentUser);
    const [searchQuery, setSearchQuery] = useState('');

    // Profilkép betöltési hibák nyilvántartása (uid set)
    const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
    const markImgError = (uid: string) =>
        setImgErrors(prev => new Set([...prev, uid]));

    // Modals / loading flags
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newClubName, setNewClubName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [joiningClubId, setJoiningClubId] = useState<string | null>(null);
    const [isLeaving, setIsLeaving] = useState(false);

    // ─── Load user's club (realtime) ─────────────────────────────────────────
    useEffect(() => {
        if (!currentUser) return;

        const unsub = onSnapshot(doc(db, 'users', currentUser.uid), async (snap) => {
            if (snap.exists() && snap.data().clubId) {
                const clubId: string = snap.data().clubId;
                const clubSnap = await getDoc(doc(db, 'clubs', clubId));
                if (clubSnap.exists()) {
                    setMyClub({ id: clubSnap.id, ...clubSnap.data() } as Club);
                } else {
                    // Klub törölték — takarítás
                    await updateDoc(doc(db, 'users', currentUser.uid), { clubId: null });
                    await setDoc(doc(db, 'publicProfiles', currentUser.uid), { clubId: null }, { merge: true });
                    setMyClub(null);
                }
            } else {
                setMyClub(null);
            }
            setIsLoading(false);
        });

        return () => unsub();
    }, [currentUser]);

    // ─── Load global leaderboard (realtime) ──────────────────────────────────
    useEffect(() => {
        const q = query(collection(db, 'clubs'), orderBy('totalXp', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            setAllClubs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Club)));
        });
        return () => unsub();
    }, []);

    // ─── Load club members whenever myClub changes ────────────────────────────
    useEffect(() => {
        if (!myClub?.members?.length) return;

        const fetchMembers = async () => {
            const docs = await Promise.all(
                (myClub.members as string[]).map((uid: string) =>
                    getDoc(doc(db, 'publicProfiles', uid))
                )
            );
            setClubMembers(
                docs
                    .filter(d => d.exists())
                    .map(d => ({
                        uid: d.id,
                        name: d.data()!.name || d.data()!.displayName || 'Player',
                        xp: d.data()!.xp || 0,
                        photoURL: d.data()!.photoURL || undefined,
                    }))
                    .sort((a, b) => b.xp - a.xp)
            );
        };

        fetchMembers();
    }, [myClub]);

    // ─── Weekly challenge generator ───────────────────────────────────────────
    const weeklyChallenge = (() => {
        const now = new Date();
        const week = Math.ceil(now.getDate() / 7);
        const challenges = [
            { title: 'Összesen 500 XP',       desc: '500 XP-t gyűjtsetek együtt ezen a héten!',      target: 500, unit: 'XP'     },
            { title: '50 győztes meccs',       desc: 'Nyerjetek meg összesen 50 meccset a héten.',    target: 50,  unit: 'meccs'  },
            { title: '20 db 180-as dobás',     desc: 'Dobjatok összesen 20 db 180-at a héten!',      target: 20,  unit: '180'    },
            { title: '100 meccs lejátszva',    desc: '100 meccset játsszatok le összesen a héten.',  target: 100, unit: 'meccs'  },
        ];
        return challenges[week % challenges.length];
    })();

    // ─── Actions ─────────────────────────────────────────────────────────────
    const handleCreateClub = async () => {
        if (!currentUser || !newClubName.trim() || isCreating) return;
        setIsCreating(true);
        try {
            const clubRef = doc(collection(db, 'clubs'));
            const batch = writeBatch(db);
            batch.set(clubRef, {
                name: newClubName.trim(),
                ownerId: currentUser.uid,
                members: [currentUser.uid],
                totalXp: 0,
                maxMembers: 25,
                createdAt: serverTimestamp(),
            });
            batch.update(doc(db, 'users', currentUser.uid), { clubId: clubRef.id });
            batch.set(doc(db, 'publicProfiles', currentUser.uid), { clubId: clubRef.id }, { merge: true });
            await batch.commit();
            setShowCreateModal(false);
            setNewClubName('');
        } catch (e) {
            console.error('Club létrehozási hiba:', e);
        }
        setIsCreating(false);
    };

    const handleJoinClub = async (clubId: string, clubName: string, memberCount: number, maxMembers: number) => {
        if (!currentUser || joiningClubId || myClub) return;
        if (memberCount >= maxMembers) { alert('Ez a klub már teli van!'); return; }
        if (!window.confirm(t.joinConfirm(clubName))) return;
        setJoiningClubId(clubId);
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'clubs', clubId), { members: arrayUnion(currentUser.uid) });
            batch.update(doc(db, 'users', currentUser.uid), { clubId });
            batch.set(doc(db, 'publicProfiles', currentUser.uid), { clubId }, { merge: true });
            await batch.commit();
        } catch (e) {
            console.error('Csatlakozási hiba:', e);
        }
        setJoiningClubId(null);
    };

    const handleLeaveClub = async () => {
        if (!currentUser || !myClub || isLeaving) return;
        if (!window.confirm(t.leaveConfirm)) return;
        setIsLeaving(true);
        try {
            const batch = writeBatch(db);
            const remainingMembers = (myClub.members as string[]).filter(uid => uid !== currentUser.uid);
            if (myClub.ownerId === currentUser.uid) {
                if (remainingMembers.length === 0) batch.delete(doc(db, 'clubs', myClub.id));
                else batch.update(doc(db, 'clubs', myClub.id), {
                    ownerId: remainingMembers[0], members: remainingMembers,
                });
            } else {
                batch.update(doc(db, 'clubs', myClub.id), { members: arrayRemove(currentUser.uid) });
            }
            batch.update(doc(db, 'users', currentUser.uid), { clubId: null });
            batch.set(doc(db, 'publicProfiles', currentUser.uid), { clubId: null }, { merge: true });
            await batch.commit();
        } catch (e) {
            console.error('Kilépési hiba:', e);
        }
        setIsLeaving(false);
    };

    // ─── Derived ─────────────────────────────────────────────────────────────
    const filteredClubs = searchQuery
        ? allClubs.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : allClubs;

    const myRank = myClub ? allClubs.findIndex(c => c.id === myClub.id) + 1 : null;

    // ─── Not logged in guard ──────────────────────────────────────────────────
    if (!currentUser) {
        return (
            <div className="min-h-full w-full bg-[#0b0d11] text-slate-200 px-4 sm:px-7 lg:px-10 py-6 sm:py-9">
                <div className="max-w-6xl mx-auto">
                    <header className="flex items-center gap-4 mb-7 sm:mb-9">
                        <button onClick={onBack} aria-label={t.back} className="h-11 w-11 shrink-0 rounded-xl border border-slate-700 bg-[#171b23] flex items-center justify-center hover:bg-slate-800"><ArrowLeftIcon className="h-5 w-5" /></button>
                        <div><span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">DARTISAN / {lang === 'hu' ? 'KÖZÖSSÉG' : 'COMMUNITY'}</span><h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase italic tracking-tight text-white">{t.title}</h1></div>
                    </header>
                    <div className="max-w-2xl rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/15 via-[#151a23] to-[#101216] p-6 sm:p-8">
                        <ShieldCheckIcon className="h-12 w-12 text-cyan-300 mb-5" />
                        <h2 className="text-xl sm:text-2xl font-black text-white uppercase mb-2">{t.noClubTitle}</h2>
                        <p className="text-sm text-slate-300 mb-6">{t.notLoggedIn}</p>
                        <button onClick={onBack} className="h-11 px-5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black uppercase hover:bg-cyan-400 transition-colors">{t.back}</button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[100] bg-[#0b0d11] text-slate-200 flex flex-col overflow-y-auto px-4 pb-24 pt-[calc(1rem+var(--app-safe-top))]">

            {/* Háttér díszítés */}
            <div className="absolute inset-0 z-0 opacity-[0.03] scale-150 pointer-events-none flex items-center justify-center">
                <ShieldCheckIcon className="w-full h-full max-w-3xl text-cyan-500" />
            </div>

            {/* ── Fejléc ── */}
            <div className="relative z-[999] flex justify-between items-center bg-[#12141a] p-3 rounded-2xl border border-slate-800 shadow-lg shrink-0 mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                    <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{t.title}</h1>
                </div>

                <div className="flex items-center gap-2">
                    {/* Desktop keresőmező */}
                    <div className="relative hidden sm:block">
                        <MagnifyingGlassIcon className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t.search}
                            className="w-52 h-10 bg-[#0b0d11] border border-slate-700 rounded-xl pl-9 pr-4 text-xs font-bold text-white outline-none focus:border-cyan-500 transition-colors"
                        />
                    </div>
                    {/* Létrehozás gomb, ha nincs klubja */}
                    {!myClub && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="h-10 bg-[#ff9e00] text-slate-950 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">{t.create}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Fő tartalom ── */}
            <div className="flex-1 flex flex-col gap-6 z-10 w-full max-w-4xl mx-auto">

                {isLoading ? (
                    <div className="text-center py-24 text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">
                        {t.loading}
                    </div>
                ) : myClub ? (

                    /* ── SAJÁT KLUB DASHBOARD ── */
                    <div className="bg-[#12141a] rounded-[2rem] border border-slate-800 p-6 flex flex-col gap-6">

                        {/* Klub fejléc */}
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.myClubTitle}</span>
                                <div className="flex items-center gap-3 mt-1">
                                    <ShieldCheckIcon className="h-8 w-8 text-cyan-400 shrink-0" />
                                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">{myClub.name}</h2>
                                </div>
                                {myClub.ownerId === currentUser.uid && (
                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-1 inline-block">
                                        👑 {t.owner}
                                    </span>
                                )}
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">{t.rankLabel}</span>
                                <span className="text-3xl font-mono font-black text-white leading-none">
                                    {myRank ? `#${myRank}` : '—'}
                                </span>
                            </div>
                        </div>

                        {/* Statisztika kártyák */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3">
                                <TrophyIcon className="h-8 w-8 text-cyan-400 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">{t.totalXpLabel}</p>
                                    <p className="text-4xl font-black font-mono text-cyan-400 leading-none">{myClub.totalXp || 0}</p>
                                </div>
                            </div>
                            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                                <UsersIcon className="h-8 w-8 text-amber-400 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest">{t.membersLabel}</p>
                                    <p className="text-4xl font-black font-mono text-amber-400 leading-none">{(myClub.members || []).length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tagok listája */}
                        {clubMembers.length > 0 && (
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t.membersTitle}</h3>
                                <div className="flex flex-col gap-2">
                                    {clubMembers.map((m, i) => (
                                        <div
                                            key={m.uid}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                                                m.uid === currentUser.uid
                                                    ? 'bg-cyan-500/10 border-cyan-500/30'
                                                    : 'bg-[#0b0d11] border-slate-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`font-black text-xs w-5 text-left ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-slate-600'}`}>
                                                    {i + 1}.
                                                </span>
                                                {m.photoURL && !imgErrors.has(m.uid) ? (
                                                    <img
                                                        src={m.photoURL}
                                                        alt=""
                                                        className="w-8 h-8 rounded-full object-cover shrink-0"
                                                        onError={() => markImgError(m.uid)}
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-black text-white shrink-0">
                                                        {m.name[0]?.toUpperCase() || '?'}
                                                    </div>
                                                )}
                                                <div className="flex flex-col text-left min-w-0">
                                                    <span className="font-bold text-sm text-white leading-none truncate">
                                                        {m.name}
                                                        {myClub.ownerId === m.uid && <span className="ml-1 text-amber-400">👑</span>}
                                                        {m.uid === currentUser.uid && (
                                                            <span className="ml-2 text-[9px] text-cyan-400 font-black uppercase">({t.you})</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-emerald-400 font-mono font-black text-sm shrink-0 ml-2">
                                                {m.xp.toLocaleString()} {t.xp}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Heti kihívás */}
                        <div className="border border-amber-500/30 bg-amber-500/10 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">🏆 Heti Kihívás</span>
                                <span className="text-[9px] text-slate-500 font-bold">Frissül: hétfőn</span>
                            </div>
                            <p className="text-white font-black text-base mb-1">{weeklyChallenge.title}</p>
                            <p className="text-slate-400 text-xs font-bold mb-3">{weeklyChallenge.desc}</p>
                            {/* Progress bar — based on totalXp vs target for XP challenges */}
                            {weeklyChallenge.unit === 'XP' && (
                                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, Math.round(((myClub.totalXp || 0) / weeklyChallenge.target) * 100))}%` }}
                                    />
                                </div>
                            )}
                            {weeklyChallenge.unit === 'XP' && (
                                <p className="text-[9px] text-amber-400 font-black mt-1 text-right">
                                    {myClub.totalXp || 0} / {weeklyChallenge.target} XP
                                </p>
                            )}
                        </div>

                        {/* Top tagok e héten */}
                        {clubMembers.length > 1 && (
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                                    🔥 Legtöbb XP ezen a héten
                                </h3>
                                <div className="flex flex-col gap-2">
                                    {clubMembers.slice(0, 3).map((m, i) => (
                                        <div key={m.uid} className="flex items-center justify-between bg-[#0b0d11] p-3 rounded-xl border border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-black w-4 ${i === 0 ? 'text-amber-400' : 'text-slate-600'}`}>{i + 1}.</span>
                                                <span className="text-sm font-bold text-white">{m.name}</span>
                                                {myClub.ownerId === m.uid && <span className="text-amber-400 text-xs">👑</span>}
                                            </div>
                                            <span className="text-emerald-400 font-mono font-black text-sm">{m.xp.toLocaleString()} XP</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Kilépés gomb */}
                        <button
                            onClick={handleLeaveClub}
                            disabled={isLeaving}
                            className="w-full h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                        >
                            <ArrowRightEndOnRectangleIcon className="h-4 w-4" />
                            {isLeaving ? t.loading : t.leave}
                        </button>
                    </div>

                ) : (

                    /* ── NINCS KLUB ── */
                    <div className="flex flex-col items-center text-center p-8 bg-[#12141a] rounded-[2rem] border border-slate-800">
                        <ShieldCheckIcon className="h-20 w-20 text-slate-500 mb-4 opacity-50" />
                        <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-tighter">{t.noClubTitle}</h2>
                        <p className="text-slate-400 font-bold mb-6 max-w-sm leading-relaxed">{t.noClubDesc}</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="h-14 px-8 bg-[#ff9e00] text-slate-950 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                        >
                            <PlusIcon className="h-5 w-5" /> {t.create}
                        </button>
                    </div>
                )}

                {/* ── GLOBÁLIS RANGLISTA ── */}
                <div className="w-full bg-[#12141a] rounded-[2rem] p-6 border border-slate-800">
                    <div className="flex items-center gap-3 mb-5">
                        <GlobeEuropeAfricaIcon className="h-8 w-8 text-[#ff2b5e]" />
                        <h3 className="text-xl font-black text-white italic uppercase leading-none">{t.globalRank}</h3>
                    </div>

                    {/* Mobil keresőmező */}
                    <div className="sm:hidden mb-4 relative">
                        <MagnifyingGlassIcon className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t.search}
                            className="w-full h-10 bg-[#0b0d11] border border-slate-700 rounded-xl pl-9 pr-4 text-xs font-bold text-white outline-none focus:border-cyan-500 transition-colors"
                        />
                    </div>

                    {filteredClubs.length === 0 ? (
                        <div className="text-center py-16 text-slate-500 font-bold text-xs uppercase tracking-widest animate-pulse">
                            {t.loading}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredClubs.map((c, idx) => {
                                const isMyClub = myClub && myClub.id === c.id;
                                return (
                                    <div
                                        key={c.id}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                                            isMyClub
                                                ? 'bg-[#ff2b5e]/10 border-[#ff2b5e]/40'
                                                : 'bg-[#0b0d11] border-slate-800 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`font-black text-xs w-5 shrink-0 text-left ${
                                                idx === 0 ? 'text-amber-400' :
                                                idx === 1 ? 'text-slate-300' :
                                                idx === 2 ? 'text-amber-700' : 'text-slate-600'
                                            }`}>
                                                {idx + 1}.
                                            </span>
                                            <ShieldCheckIcon className={`h-7 w-7 shrink-0 ${isMyClub ? 'text-[#ff2b5e]' : 'text-slate-500'}`} />
                                            <div className="min-w-0">
                                                <span className={`font-bold text-sm block truncate ${isMyClub ? 'text-white' : 'text-slate-300'}`}>
                                                    {c.name}
                                                </span>
                                                <span className="text-[9px] text-slate-500 font-black uppercase">
                                                    {(c.members || []).length} {t.membersLabel}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 ml-3">
                                            <span className="text-[#ff2b5e] font-black font-mono text-sm whitespace-nowrap">
                                                {(c.totalXp || 0).toLocaleString()} {t.xp}
                                            </span>
                                            {isMyClub ? (
                                                <CheckCircleIcon className="h-5 w-5 text-[#ff2b5e]" />
                                            ) : !myClub ? (
                                                <button
                                                    onClick={() => handleJoinClub(c.id, c.name, (c.members || []).length, c.maxMembers || 25)}
                                                    disabled={joiningClubId === c.id || (c.members || []).length >= (c.maxMembers || 25)}
                                                    className="h-8 px-3 bg-cyan-500 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    {joiningClubId === c.id ? '...' : (c.members || []).length >= (c.maxMembers || 25) ? 'Teli' : t.join}
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── KLUB LÉTREHOZÁS MODAL ── */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={() => { setShowCreateModal(false); setNewClubName(''); }}
                >
                    <div
                        className="bg-[#12141a] border border-slate-700 rounded-[2rem] p-8 w-full max-w-md shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{t.createTitle}</h2>
                            <button
                                onClick={() => { setShowCreateModal(false); setNewClubName(''); }}
                                className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                            {t.clubNameLabel}
                        </label>
                        <input
                            type="text"
                            value={newClubName}
                            onChange={e => setNewClubName(e.target.value)}
                            placeholder={t.clubNamePlaceholder}
                            maxLength={30}
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleCreateClub()}
                            className="w-full h-14 bg-[#0b0d11] border border-slate-700 rounded-xl px-4 text-base font-bold text-white outline-none focus:border-cyan-500 transition-colors mb-2"
                        />
                        <p className="text-[10px] text-slate-600 font-bold text-right mb-6">{newClubName.length}/30</p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCreateModal(false); setNewClubName(''); }}
                                className="flex-1 h-12 bg-slate-800 text-white rounded-xl font-black uppercase text-xs hover:bg-slate-700 transition-colors"
                            >
                                {t.cancel}
                            </button>
                            <button
                                onClick={handleCreateClub}
                                disabled={!newClubName.trim() || isCreating}
                                className="flex-1 h-12 bg-[#ff9e00] text-slate-950 rounded-xl font-black uppercase text-xs disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
                            >
                                {isCreating ? '...' : t.createBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
