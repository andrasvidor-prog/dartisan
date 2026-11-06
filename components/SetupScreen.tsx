'use client';

import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signInAnonymously } from 'firebase/auth';
import { 
    XMarkIcon, PlusIcon, ComputerDesktopIcon, UserIcon, UserCircleIcon, 
    SpeakerWaveIcon, SpeakerXMarkIcon, PaperAirplaneIcon, 
    ArrowRightEndOnRectangleIcon, TrophyIcon, FireIcon, GlobeEuropeAfricaIcon, 
    ChevronRightIcon, ListBulletIcon, CheckCircleIcon, KeyIcon, EyeIcon, 
    EyeSlashIcon, ChartBarIcon, UsersIcon, Cog6ToothIcon, ShieldCheckIcon, SparklesIcon
} from '@heroicons/react/24/outline';
import type { Language } from '@/app/page';
import type { User } from 'firebase/auth';
import type { Dart, PlayerData } from './MatchScreen';

import { db, auth, googleProvider, appleProvider } from '../firebase'; 
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { questsFor, readQuestProgress, type QuestProgress } from '../lib/quests';
import { TRAINING_MODES } from '../lib/training';
import { bullOffWinner, isMatchPreset, readMatchPresets, writeMatchPresets, type BullOffHit, type MatchPreset } from '../lib/matchPresets';

export type PlayerColor = 'emerald' | 'rose' | 'cyan' | 'amber' | 'purple';
type DisplayUser = User & { selectedAvatar?: string };
type LeaderboardPlayer = { id: string; name?: string; xp?: number; weeklyXp?: number; photoURL?: string; selectedAvatar?: string; displayName?: string; email?: string };
export type SavedMatch = {
    config: MatchConfig;
    players: PlayerData[];
    activePlayer: number;
    isLegWinner: boolean;
    isSetWinner: boolean;
    isMatchWinner: boolean;
    currentDarts: Dart[];
    inputMode?: 'detailed' | 'fast' | 'board';
    checkoutStrategy?: 'safe' | 'pro';
    asyncState?: 'playing' | 'waiting_leg' | 'waiting_match';
    matchId?: string;
    authUid?: string;
    onlineLeg?: number;
    resolvedLegNumber?: number;
};
export type PlayerConfig = { 
    name: string; 
    isBot: boolean; 
    difficulty: number; 
    color: PlayerColor; 
    customStartingScore?: number; 
    teamId?: number; 
};
export type MatchConfig = { 
    gameMode: 'x01' | 'challenge' | 'practice' | 'career' | 'cricket';
    cricketVariant?: 'standard' | 'cutthroat';
    practiceType?: 'around' | 'bobs27' | '121' | 'hunter' | 'math' | 'ai_drill';
    drillTarget?: number;
    players: PlayerConfig[]; 
    startingScore: number; 
    setsToWin: number; 
    legsToWin: number; 
    checkIn: 'single' | 'double' | 'master';
    checkout: 'single' | 'double' | 'master';
    muteCaller: boolean; 
    resumeState?: SavedMatch;
    challengeCode?: string; 
    careerStage?: number; 
    localRole?: 'host' | 'guest'; 
    tournamentId?: string;
    tournamentMatchId?: string;
    tournamentPlayerIds?: [string, string];
    isCustomTournamentMatch?: boolean;
    isGroupMatch?: boolean;
    dartSetupId?: string;
};

const CAREER_BOTS = [
  { nameEn: 'Rookie Ryan', nameHu: 'Kezdő Karesz', difficulty: 1, color: 'rose', avg: '30-40' },
  { nameEn: 'Pub Pete', nameHu: 'Kocsmai Laci', difficulty: 1, color: 'amber', avg: '35-45' },
  { nameEn: 'Shaky Sean', nameHu: 'Remegő Ricsi', difficulty: 1, color: 'emerald', avg: '40-45' },
  { nameEn: 'Steady Steve', nameHu: 'Stabil Sanyi', difficulty: 2, color: 'cyan', avg: '45-50' },
  { nameEn: 'Double Dan', nameHu: 'Dupla Dénes', difficulty: 2, color: 'purple', avg: '50-55' },
  { nameEn: 'Treble Tim', nameHu: 'Hármas Henrik', difficulty: 3, color: 'emerald', avg: '55-60' },
  { nameEn: 'Veteran Vince', nameHu: 'Rutinos Robi', difficulty: 4, color: 'amber', avg: '60-65' },
  { nameEn: 'Precise Paul', nameHu: 'Pontos Peti', difficulty: 5, color: 'rose', avg: '65-70' },
  { nameEn: 'Pro Parker', nameHu: 'Profi Pál', difficulty: 6, color: 'purple', avg: '70-75' },
  { nameEn: 'Master Matt', nameHu: 'Mester Máté', difficulty: 7, color: 'cyan', avg: '75-80' },
  { nameEn: 'Lethal Luke', nameHu: 'Halálos Hugó', difficulty: 8, color: 'rose', avg: '80-85' },
  { nameEn: 'Machine Mark', nameHu: 'Gépies Gábor', difficulty: 9, color: 'emerald', avg: '85-90' },
  { nameEn: 'Champ Charlie', nameHu: 'Világbajnok Vili', difficulty: 10, color: 'amber', avg: '90-95' },
  { nameEn: 'Dart Demon', nameHu: 'Darts Démon', difficulty: 10, color: 'purple', avg: '95-100' },
  { nameEn: 'The Final Boss', nameHu: 'A Főboss', difficulty: 10, color: 'rose', avg: '100+' }
];

const t = {
  en: { setup: "Match Setup", local: "Local", challenge: "Versus", practice: "Practice", career: "Career", leagues: "Leaderboard", player: "Player", players: "Players", add: "Add Player", sets: "Sets (First To)", legs: "Legs (First To)", score: "Score", out: "Out", start: "Start Match", mute: "Mute Caller", sendCh: "Create & Host Match", recvCh: "Join Match", enterCode: "Enter DART-XXX code", coming: "Cloud Feature", careerStart: "Fight Next Opponent", lvl: "LVL", match: "Match", easyBot: "Easy", medBot: "Med", proBot: "Pro", champTitle: "World Championship", champWonTitle: "You're the Champion!", champWonDesc: "You defeated all 15 opponents.", leaguesTitle: "Weekly XP leaderboard", leaguesDesc: "Follow this week's XP totals.", joinLeague: "View leaderboard", targetHunter: "Target Hunter", c121Desc: "9 darts to checkout", dartsMath: "Darts Math", atcDesc: "1 to 20 sequentially", bobsDesc: "Hardcore Doubles", skip: "Skip", next: "Next", quests: "Missions", daily: "Daily", weekly: "Weekly", resetDaily: "Resets at Midnight", resetWeekly: "Resets on Monday", q1: "Hit 3x 140+", q2: "Checkout under 15 darts", q3: "Play 5 matches", login: "Sign In", loginDesc: "Save your stats and join the weekly leaderboard.", magicLink: "Send Magic Link", or: "OR", single: "Single", double: "Double", password: "Password", forgotPass: "Forgot Password?",
    tut1Title: "3 Input Modes", tut1Desc: "Dartisan adapts to you. Choose the mode that fits your style during the match!", 
    tut2Title: "Fast vs Pro", tut2Desc: "FAST: Quick round sums (e.g. 100). PRO or BOARD: Dart-by-dart input for perfect stats and heatmap.", 
    tut3Title: "Smart Checkout", tut3Desc: "Bad at math? The built-in checkout guide leads you to the double. You can hide it anytime.", 
    resumeTitle: "Saved Match", resumeDesc: "Click to resume", resumeMatch: "Resume", abandon: "Abandon", waitingFriend: "Waiting for Opponent...", shareCode: "Share this code with your friend!", cancel: "Cancel", roomFull: "Room is full or already started!", team: "Team", individual: "Individual", handicap: "Custom Score", noHandicap: "Default", quickMatch: "🚀 Quick Match (501 vs AI)", tourBuilder: "Tournament Builder", tourDesc: "Create your own championship!" },
  hu: { setup: "Mérkőzés", local: "Helyi", challenge: "Kihívás", practice: "Edzés", career: "Karrier", leagues: "Ranglista", player: "Játékos", players: "Játékosok", add: "Hozzáadás", sets: "Szettek (Nyerig)", legs: "Legek (Nyerig)", score: "Pont", out: "Kiszálló", start: "Mérkőzés Indítása", mute: "Némítás", sendCh: "Szoba Létrehozása (Host)", recvCh: "Csatlakozás", enterCode: "Kód (DART-...)", coming: "Cloud Feature", careerStart: "Mérkőzés Indítása", lvl: "SZINT", match: "Mérkőzés", easyBot: "Easy", medBot: "Med", proBot: "Pro", champTitle: "Világbajnokság", champWonTitle: "Világbajnok Vagy!", champWonDesc: "Legyőzted az összes (15) ellenfelet az ágrajzon.", leaguesTitle: "Heti XP ranglista", leaguesDesc: "Kövesd az aktuális hét XP eredményeit.", joinLeague: "Ranglista megtekintése", targetHunter: "Célpont Vadász", c121Desc: "9 nyíl a kiszállóra", dartsMath: "Darts Math", atcDesc: "1-től 20-ig sorban", bobsDesc: "Dupla Edzés", skip: "Kihagyás", next: "Tovább", quests: "Küldetések", daily: "Napi Feladatok", weekly: "Heti Feladatok", resetDaily: "Frissül: Éjfélkor", resetWeekly: "Frissül: Hétfőn", q1: "Dobj 3db 140+-t", q2: "Kiszálló 15 nyíl alatt", q3: "Játssz le 5 meccset", login: "Bejelentkezés", loginDesc: "Mentsd el a statisztikáidat és kerülj fel a heti ranglistára.", magicLink: "Belépés Mágikus Linkkel", or: "VAGY", single: "Sima", double: "Dupla", password: "Jelszó", forgotPass: "Elfelejtetted a jelszavad?",
    tut1Title: "3 Beviteli Mód", tut1Desc: "A Dartisan alkalmazkodik hozzád. Válaszd ki a számodra legkényelmesebb módot a meccs közben!", 
    tut2Title: "Fast vs Pro", tut2Desc: "FAST: Gyors körösszeg (pl. beírod: 100). PRO vagy TÁBLA: Nyilonkénti bevitel a tökéletes statisztikákhoz és hőtérképhez.", 
    tut3Title: "Kiszálló Segéd", tut3Desc: "Nem megy fejben a matek? A beépített okos kiszálló ajánló végigvezet a duplákig. Bármikor elrejtheted a meccs alatt egy gombnyomással.", 
    resumeTitle: "Félbehagyott meccs", resumeDesc: "Kattints a folytatáshoz", resumeMatch: "Folytatás", abandon: "Törlés", waitingFriend: "Várakozás az ellenfélre...", shareCode: "Küldd el ezt a kódot a barátodnak!", cancel: "Mégsem", roomFull: "Ez a szoba már elindult vagy tele van!", team: "Csapat", individual: "Egyéni", handicap: "Egyedi Kezdőpont", noHandicap: "Alap (Pl. 501)", quickMatch: "🚀 Gyors meccs (501 vs AI)", tourBuilder: "Tornaszervező", tourDesc: "Hozd létre a saját bajnokságod!" }
};

const COLORS: PlayerColor[] = ['emerald', 'rose', 'cyan', 'amber', 'purple'];
const SERVER_MATCH_ENABLED = process.env.NEXT_PUBLIC_SERVER_MATCH_ENABLED === 'true';

interface SetupScreenProps {
  lang: Language;
  onStart: (config: MatchConfig) => void;
  onOpenProfile: () => void;
  onOpenCoach?: () => void;
  onOpenTrainingLab: () => void;
  onStartTournament: () => void;
  onOpenSettings: () => void; 
  onOpenClub: () => void;
  userLevel?: number; // <- ÚJ: Külső state a page.tsx-ből
  userStreak?: number; // <- ÚJ: Külső state a page.tsx-ből
}

export function SetupScreen({ lang, onStart, onOpenProfile, onOpenCoach, onOpenTrainingLab, onStartTournament, onOpenSettings, onOpenClub, userLevel = 1, userStreak = 1 }: SetupScreenProps) {
  const [tab, setTab] = useState<'x01' | 'challenge' | 'practice' | 'career' | 'cricket' | 'leagues'>('x01');
  const [players, setPlayers] = useState<PlayerConfig[]>([{ name: 'Player 1', isBot: false, difficulty: 5, color: 'emerald' }]);
  const [cricketGuestName, setCricketGuestName] = useState('Játékos 2');
  const [cricketVariant, setCricketVariant] = useState<'standard' | 'cutthroat'>('standard');
  const [score, setScore] = useState(501);
  const [sets, setSets] = useState(1);
  const [legs, setLegs] = useState(3);
  const [checkIn, setCheckIn] = useState<'single' | 'double' | 'master'>('single');
  const [checkout, setCheckout] = useState<'single' | 'double' | 'master'>(() =>
    typeof window !== 'undefined' && localStorage.getItem('dartisan_checkout') === 'single' ? 'single' : 'double'
  );
  const [muteCaller, setMuteCaller] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [matchPresets, setMatchPresets] = useState<MatchPreset[]>(() => typeof window !== 'undefined' ? readMatchPresets(localStorage) : []);
  const [bullOffOpen, setBullOffOpen] = useState(false);
  const [bullOffHits, setBullOffHits] = useState<BullOffHit[]>([]);
  const [challengeCode, setChallengeCode] = useState('');
  const [practiceType, setPracticeType] = useState<'around' | 'bobs27' | '121' | 'hunter' | 'math'>('121');
  
  const [careerStage] = useState(() => {
      const saved = typeof window !== 'undefined' ? Number(localStorage.getItem('dartisan_career_stage')) : 0;
      return Number.isInteger(saved) ? Math.max(0, Math.min(15, saved)) : 0;
  });
  const [showQuests, setShowQuests] = useState(false);
  
  // --- NAPI ÉS HETI KÜLDETÉSEK LOGIKÁJA ---
  const [questProgress, setQuestProgress] = useState<QuestProgress>(() =>
      typeof window !== 'undefined' ? readQuestProgress(localStorage) : { day: '', week: '', daily: {}, weekly: {}, seen: [] }
  );
  const { daily: dailyQuests, weekly: weeklyQuests } = questsFor(questProgress, lang);

  const [showAuth, setShowAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => typeof window !== 'undefined' && !localStorage.getItem('dartisan_tutorial_done'));
  const [tutStep, setTutStep] = useState(1);

  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [isJoiningMatch, setIsJoiningMatch] = useState(false);
  const [hostedCode, setHostedCode] = useState<string | null>(null); 
  const [savedMatch, setSavedMatch] = useState<SavedMatch | null>(() => {
      if (typeof window === 'undefined') return null;
      try {
          const saved = JSON.parse(localStorage.getItem('dartisan_save') || 'null');
          return saved && saved.config && Array.isArray(saved.players) && Number.isInteger(saved.activePlayer)
              ? saved as SavedMatch : null;
      } catch { return null; }
  });

  const [currentUser, setCurrentUser] = useState<DisplayUser | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const email = localStorage.getItem('dartisan_email_link') || window.prompt(lang === 'hu' ? 'Melyik e-mail címre kaptad a belépési linket?' : 'Which email address received the sign-in link?');
    if (!email) return;
    signInWithEmailLink(auth, email, window.location.href)
      .then(() => {
        localStorage.removeItem('dartisan_email_link');
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch((error) => { console.error('Email link sign-in:', error); alert(lang === 'hu' ? 'A belépési link érvénytelen vagy lejárt.' : 'The sign-in link is invalid or expired.'); });
  }, [lang]);

  const getAvatar = (user: DisplayUser | LeaderboardPlayer | null) => user?.selectedAvatar || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || user?.email?.split('@')[0] || 'Player'}&backgroundColor=0b0d11`;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            const userData = docSnap.exists() ? docSnap.data() : null;
            const savedSettings = userData?.settings;
            if (savedSettings?.checkout === 'single' || savedSettings?.checkout === 'double') {
                setCheckout(savedSettings.checkout);
                localStorage.setItem('dartisan_checkout', savedSettings.checkout);
            }
            if (savedSettings?.inputMode === 'fast' || savedSettings?.inputMode === 'detailed' || savedSettings?.inputMode === 'board') {
                localStorage.setItem('dartisan_pref_input', savedSettings.inputMode);
            }
            if (savedSettings?.strategy === 'safe' || savedSettings?.strategy === 'pro') {
                localStorage.setItem('dartisan_strategy', savedSettings.strategy);
            }
            if (Array.isArray(savedSettings?.fastBtns) && savedSettings.fastBtns.length === 3 && savedSettings.fastBtns.every((n: number) => Number.isInteger(n) && n >= 0 && n <= 180)) {
                localStorage.setItem('dartisan_quick_buttons', JSON.stringify(savedSettings.fastBtns));
            }

            const displayName = user.displayName || user.email?.split('@')[0] || 'Player';
            
            const fullUser = { 
                ...user, 
                selectedAvatar: userData?.selectedAvatar,
                displayName: userData?.name || displayName 
            };
            
            setCurrentUser(fullUser);
            setPlayers(prev => [{ ...prev[0], name: fullUser.displayName }, ...prev.slice(1)]);
            
            const d = new Date();
            const currentWeek = Math.ceil((((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7);

            if (!docSnap.exists()) {
                const randomTag = Math.floor(1000 + Math.random() * 9000);
                await setDoc(docRef, { 
                    name: displayName, 
                    email: user.email, 
                    photoURL: user.photoURL, 
                    tag: randomTag,
                    xp: 0, weeklyXp: 0, lastWeek: currentWeek, matchesWon: 0, createdAt: new Date() 
                });
            } else { 
                const data = docSnap.data(); 
                if (!SERVER_MATCH_ENABLED && data.lastWeek !== currentWeek) {
                    await updateDoc(docRef, { weeklyXp: 0, lastWeek: currentWeek });
                }
            }
        } else { 
            setCurrentUser(null); 
        }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
      if (tab !== 'leagues' || !currentUser) return;
      const q = query(collection(db, 'publicProfiles'), orderBy('weeklyXp', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snap) => {
          setLeaderboard(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => { console.error("Ranglista hiba:", err); });
      return () => unsub();
  }, [tab, currentUser]);

  useEffect(() => {
    if (!hostedCode) return;
    const unsub = onSnapshot(doc(db, 'matches', hostedCode), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.status === 'playing') {
                onStart({ 
                    gameMode: 'challenge', 
                    challengeCode: hostedCode, 
                    localRole: 'host', 
                    players: [players[0], { name: data.guestName || 'Opponent', isBot: false, difficulty: 5, color: 'rose' }], 
                    startingScore: score, 
                    setsToWin: sets, 
                    legsToWin: legs, 
                    checkIn, 
                    checkout, 
                    muteCaller 
                });
                setHostedCode(null);
            }
        }
    });
    return () => unsub();
  }, [hostedCode, players, score, sets, legs, checkIn, checkout, muteCaller, onStart]);

  const closeTutorial = () => { localStorage.setItem('dartisan_tutorial_done', 'true'); setShowTutorial(false); };
  const updatePlayer = (idx: number, updates: Partial<PlayerConfig>) => { const n = [...players]; n[idx] = { ...n[idx], ...updates }; setPlayers(n); };
  const txt = t[lang];

  const saveMatchPreset = () => {
      const preset: MatchPreset = {
          id: crypto.randomUUID(), name: presetName.trim(), startingScore: score, setsToWin: sets,
          legsToWin: legs, checkIn, checkout, muteCaller, players: players.map(player => ({ ...player, name: player.name.trim() })),
      };
      if (!isMatchPreset(preset)) return alert(lang === 'hu' ? 'Adj meg egy nevet, és ellenőrizd a játékosokat és szabályokat.' : 'Enter a name and check the players and rules.');
      const next = [preset, ...matchPresets].slice(0, 10);
      writeMatchPresets(localStorage, next);
      setMatchPresets(next);
      setPresetName('');
  };

  const loadMatchPreset = (preset: MatchPreset) => {
      setScore(preset.startingScore);
      setSets(preset.setsToWin);
      setLegs(preset.legsToWin);
      setCheckIn(preset.checkIn);
      setCheckout(preset.checkout);
      setMuteCaller(preset.muteCaller);
      setPlayers(preset.players.map(player => ({ ...player })));
  };

  const deleteMatchPreset = (id: string) => {
      const next = matchPresets.filter(preset => preset.id !== id);
      writeMatchPresets(localStorage, next);
      setMatchPresets(next);
  };

  const applyBullOff = () => {
      const winner = bullOffWinner(bullOffHits);
      if (winner === null) return;
      setPlayers(current => [current[winner], ...current.filter((_, index) => index !== winner)]);
      setBullOffOpen(false);
  };

  const handleEmailLogin = async () => {
      if (!emailInput.trim() || !passwordInput) return alert(lang === 'hu' ? 'Add meg az e-mail címet és a jelszót.' : 'Enter your email and password.');
      setIsLoggingIn(true);
      try {
          await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
          setShowAuth(false);
          setEmailInput('');
          setPasswordInput('');
      } catch (error) {
          console.error('Email sign-in:', error);
          alert(lang === 'hu' ? 'A belépés nem sikerült. Ellenőrizd az e-mail címet és a jelszót.' : 'Sign-in failed. Check your email and password.');
      }
      setIsLoggingIn(false);
  };

  const handleEmailRegister = async () => {
      if (!emailInput.trim() || passwordInput.length < 6) {
          alert(lang === 'hu' ? 'Adj meg egy e-mail címet és legalább 6 karakteres jelszót.' : 'Enter an email and a password of at least 6 characters.');
          return;
      }
      setIsLoggingIn(true);
      try {
          await createUserWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
          setShowAuth(false);
          setEmailInput('');
          setPasswordInput('');
      } catch (error) {
          console.error('Email registration:', error);
          alert(lang === 'hu' ? 'A regisztráció nem sikerült. Ellenőrizd az adatokat, vagy próbálj belépni.' : 'Registration failed. Check your details or try signing in.');
      } finally { setIsLoggingIn(false); }
  };

  const handleGoogleLogin = async () => { 
      setIsLoggingIn(true); 
      try { 
          await signInWithPopup(auth, googleProvider); 
          setShowAuth(false); 
      } catch (error) { 
          console.error("Login error:", error); 
          alert("Sikertelen bejelentkezés. Próbáld újra!"); 
      } 
      setIsLoggingIn(false); 
  };
  
  const handleAppleLogin = async () => { 
      setIsLoggingIn(true); 
      try { 
          await signInWithPopup(auth, appleProvider); 
          setShowAuth(false); 
      } catch (error) { 
          console.error("Apple Login error:", error); 
          alert("Sikertelen Apple bejelentkezés."); 
      } 
      setIsLoggingIn(false); 
  };
  
  const handleLogout = () => { signOut(auth); setShowAuth(false); };

  const handleMagicLink = async () => {
      if (!emailInput.trim()) return alert(lang === 'hu' ? 'Add meg az e-mail címedet.' : 'Enter your email address.');
      setIsLoggingIn(true);
      try {
          await sendSignInLinkToEmail(auth, emailInput.trim(), { url: window.location.origin, handleCodeInApp: true });
          localStorage.setItem('dartisan_email_link', emailInput.trim());
          alert(lang === 'hu' ? 'Elküldtük a belépési linket az e-mail címedre.' : 'We sent a sign-in link to your email.');
      } catch (error) {
          console.error('Magic link:', error);
          alert(lang === 'hu' ? 'Nem sikerült elküldeni a linket. Ellenőrizd, hogy az e-mail link engedélyezve van-e a Firebase-ben.' : 'Could not send the link. Check that email-link sign-in is enabled in Firebase.');
      } finally { setIsLoggingIn(false); }
  };

  const handlePasswordReset = async () => {
      if (!emailInput.trim()) return alert(lang === 'hu' ? 'Add meg az e-mail címedet.' : 'Enter your email address.');
      setIsLoggingIn(true);
      try {
          await sendPasswordResetEmail(auth, emailInput.trim());
          alert(lang === 'hu' ? 'Ha van ilyen fiók, a jelszó-visszaállító levelet elküldtük.' : 'If this account exists, a password reset email has been sent.');
      } catch (error) {
          console.error('Password reset:', error);
          alert(lang === 'hu' ? 'Nem sikerült elküldeni a jelszó-visszaállító levelet.' : 'Could not send the password reset email.');
      } finally { setIsLoggingIn(false); }
  };

  // Online rooms need a Firebase identity even when the player has no profile.
  // Anonymous identities are not shown as registered Dartisan accounts.
  const ensureOnlineIdentity = async () => {
      await auth.authStateReady();
      return auth.currentUser || (await signInAnonymously(auth)).user;
  };

  const handleResumeMatch = async () => {
      if (!savedMatch) return;
      if (savedMatch.config?.gameMode === 'challenge' && savedMatch.config.challengeCode) {
          try {
              await auth.authStateReady();
              const user = auth.currentUser;
              if (!user || user.uid !== savedMatch.authUid) throw new Error('identity-mismatch');
              const room = await getDoc(doc(db, 'matches', savedMatch.config.challengeCode));
              if (!room.exists() || room.data().status !== 'playing' ||
                  (room.data().hostUid !== user.uid && room.data().guestUid !== user.uid)) throw new Error('room-unavailable');
          } catch (error) {
              console.error('Online resume failed', error);
              alert(lang === 'hu' ? 'A meccs folytatásához ugyanazzal a fiókkal jelentkezz be, és ellenőrizd, hogy a szoba még elérhető-e.' : 'Sign in with the same account and make sure the room is still available.');
              return;
          }
      }
      onStart({ ...savedMatch.config, resumeState: savedMatch });
      setSavedMatch(null);
  };

  const handleHostMatch = async () => {
      setIsCreatingMatch(true); 
      try { 
          const user = await ensureOnlineIdentity();
          const code = `DART-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
          const roomRef = doc(db, 'matches', code);
          await runTransaction(db, async transaction => {
            if ((await transaction.get(roomRef)).exists()) throw new Error('Room code collision');
            transaction.set(roomRef, {
              status: 'waiting', 
              config: { startingScore: score, setsToWin: sets, legsToWin: legs, checkIn, checkout }, 
              state: { currentLeg: 1, currentSet: 1, hostDarts: null, guestDarts: null, hostSetsWon: 0, guestSetsWon: 0, hostLegsWon: 0, guestLegsWon: 0, winner: null }, 
              hostName: players[0].name.trim().slice(0, 40) || 'Host',
              hostUid: user.uid,
              guestName: null, 
              guestUid: null,
              createdAt: serverTimestamp()
            });
          });
          setHostedCode(code); 
      } catch (error) { 
          console.error("Error creating match:", error); 
          alert("Hiba a szoba létrehozásakor."); 
      }
      setIsCreatingMatch(false);
  };

  const handleCancelHost = async () => {
      if (!hostedCode) return;
      try {
          const user = await ensureOnlineIdentity();
          const roomRef = doc(db, 'matches', hostedCode);
          await runTransaction(db, async transaction => {
              const snapshot = await transaction.get(roomRef);
              if (snapshot.exists() && snapshot.data().status === 'waiting' && snapshot.data().hostUid === user.uid) transaction.delete(roomRef);
          });
          setHostedCode(null);
      } catch (error) {
          console.error('Cancel hosted match:', error);
          alert(lang === 'hu' ? 'A szoba törlése nem sikerült. Próbáld újra.' : 'Could not delete the room. Please try again.');
      }
  };

  const handleJoinMatch = async () => {
      if (challengeCode.length < 5) return; 
      setIsJoiningMatch(true);
      try {
          const user = await ensureOnlineIdentity();
          const roomRef = doc(db, 'matches', challengeCode);
          const data = await runTransaction(db, async transaction => {
              const matchSnap = await transaction.get(roomRef);
              if (!matchSnap.exists()) throw new Error('room-not-found');
              const room = matchSnap.data();
              if (room.status !== 'waiting') throw new Error('room-unavailable');
              if (room.hostUid === user.uid) throw new Error('room-unavailable');
              transaction.update(roomRef, { status: 'playing', guestName: players[0].name.trim().slice(0, 40) || 'Guest', guestUid: user.uid });
              return room;
          });
          onStart({
              gameMode: 'challenge',
              challengeCode,
              localRole: 'guest',
              players: [players[0], { name: data.hostName || 'Host', isBot: false, difficulty: 5, color: 'emerald' }],
              startingScore: data.config.startingScore,
              setsToWin: data.config.setsToWin,
              legsToWin: data.config.legsToWin,
              checkIn: data.config.checkIn,
              checkout: data.config.checkout,
              muteCaller
          });
      } catch (error) { 
          console.error("Error joining:", error); 
          alert(error instanceof Error && error.message === 'room-unavailable' ? txt.roomFull : lang === 'hu' ? 'A szoba nem található vagy nem lehet csatlakozni.' : 'Room not found or could not be joined.');
      }
      setIsJoiningMatch(false);
  };

  return (
    <div className="w-full min-h-[100dvh] bg-[#0b0d11] text-slate-200 flex flex-col items-center px-4 sm:px-6 lg:px-10 pt-24 lg:pt-28 pb-12 lg:pb-20 relative">
      
      {savedMatch && !hostedCode && !showTutorial && !showAuth && !showQuests && (
       <div className="w-full max-w-6xl mx-auto mb-5 bg-emerald-500 border border-emerald-400 p-4 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-col">
              <span className="text-slate-900 font-black uppercase text-sm">{txt.resumeTitle}</span>
              <span className="text-emerald-900 font-bold text-xs">{txt.resumeDesc}</span>
          </div>
          <div className="flex gap-2">
              <button onClick={handleResumeMatch} className="bg-slate-900 text-emerald-400 px-4 py-2 rounded-xl font-black uppercase text-xs shadow-xl active:scale-95">{txt.resumeMatch}</button>
              <button onClick={() => { localStorage.removeItem('dartisan_save'); setSavedMatch(null); }} aria-label={lang === 'hu' ? 'Félbehagyott meccs törlése' : 'Delete saved match'} className="bg-emerald-600 text-emerald-900 px-3 py-2 rounded-xl font-black uppercase text-xs shadow-xl active:scale-95"><XMarkIcon className="h-5 w-5"/></button>
          </div>
       </div>
      )}

      {hostedCode && (
       <div className="fixed inset-0 z-[150] bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
           <UsersIcon className="h-24 w-24 text-amber-500 mb-6 animate-pulse" />
           <h2 className="text-4xl font-black text-white mb-2 uppercase italic tracking-tighter">{txt.waitingFriend}</h2>
           <p className="text-slate-400 font-bold mb-8">{txt.shareCode}</p>
           <div className="bg-[#12141a] border border-amber-500/30 p-5 sm:p-8 rounded-3xl mb-8 shadow-[0_0_30px_rgba(245,158,11,0.1)] w-full max-w-sm"><span className="text-[clamp(1.15rem,5vw,2.5rem)] font-mono font-black text-amber-400 tracking-wider select-all block break-all">{hostedCode}</span></div>
           <button onClick={handleCancelHost} className="w-full max-w-sm h-14 rounded-xl bg-slate-800 text-white font-black uppercase shadow-xl hover:bg-slate-700">{txt.cancel}</button>
       </div>
      )}

      {bullOffOpen && (
        <div className="fixed inset-0 z-[180] bg-[#0b0d11]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="bull-off-title" className="w-full max-w-lg rounded-3xl border border-amber-500/40 bg-[#12141a] p-5 sm:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">BULL-OFF</p><h2 id="bull-off-title" className="text-2xl font-black text-white uppercase italic">{lang === 'hu' ? 'Ki kezd?' : 'Who starts?'}</h2></div><button type="button" onClick={() => setBullOffOpen(false)} aria-label={lang === 'hu' ? 'Bezárás' : 'Close'} className="p-2 rounded-lg bg-slate-800 text-slate-300"><XMarkIcon className="h-5 w-5" /></button></div>
            <p className="text-xs text-slate-400 mt-3 mb-5">{lang === 'hu' ? 'Minden játékos dob egy nyilat. A belső bull a legjobb, majd a külső bull, a tábla és a mellé dobás. Döntetlen esetén dobjatok újra.' : 'Each player throws one dart. Inner bull wins over outer bull, board hit and miss. Re-throw on a tie.'}</p>
            <div className="space-y-3">
              {players.map((player, index) => <div key={`${index}-${player.name}`} className="rounded-xl bg-[#0b0d11] border border-slate-800 p-3"><p className="text-sm font-black text-white mb-2">{player.name}</p><div className="grid grid-cols-4 gap-1.5">{([0, 1, 2, 3] as const).map(hit => <button type="button" key={hit} aria-pressed={bullOffHits[index] === hit} onClick={() => setBullOffHits(previous => previous.map((value, i) => i === index ? hit : value))} className={`min-h-10 rounded-lg text-[10px] sm:text-xs font-black border ${bullOffHits[index] === hit ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700'}`}>{hit === 0 ? (lang === 'hu' ? 'Belső' : 'Inner') : hit === 1 ? (lang === 'hu' ? 'Külső' : 'Outer') : hit === 2 ? (lang === 'hu' ? 'Tábla' : 'Board') : (lang === 'hu' ? 'Mellé' : 'Miss')}</button>)}</div></div>)}
            </div>
            {bullOffHits.every(hit => hit !== null) && bullOffWinner(bullOffHits) === null && <p className="text-amber-300 text-xs font-bold mt-4">{lang === 'hu' ? 'Döntetlen az élen: dobjatok újra.' : 'Tie for first: throw again.'}</p>}
            <div className="grid grid-cols-2 gap-2 mt-5"><button type="button" onClick={() => setBullOffHits(players.map(() => null))} className="h-12 rounded-xl bg-slate-800 text-white font-black text-xs uppercase">{lang === 'hu' ? 'Új dobás' : 'Re-throw'}</button><button type="button" disabled={bullOffWinner(bullOffHits) === null} onClick={applyBullOff} className="h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase disabled:opacity-40">{lang === 'hu' ? 'Kezdő kiválasztása' : 'Set starter'}</button></div>
          </div>
        </div>
      )}

      {showTutorial && (
          <div className="fixed inset-0 z-[250] bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
              <div className="flex gap-2 mb-8">{[1,2,3].map(i => <div key={i} className={`h-2 w-12 rounded-full transition-all ${tutStep === i ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>)}</div>
              <div className="w-full max-w-sm h-64 bg-[#12141a] border border-emerald-500/30 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                 {tutStep === 1 && <TrophyIcon className="h-20 w-20 text-emerald-400 mb-4 animate-bounce" />}
                 {tutStep === 2 && <ChartBarIcon className="h-20 w-20 text-cyan-400 mb-4" />}
                 {tutStep === 3 && <GlobeEuropeAfricaIcon className="h-20 w-20 text-purple-400 mb-4 animate-pulse" />}
                 <h2 className="text-2xl font-black text-white uppercase italic">{tutStep === 1 ? txt.tut1Title : tutStep === 2 ? txt.tut2Title : txt.tut3Title}</h2>
                 <p className="text-slate-400 text-sm mt-2 font-bold">{tutStep === 1 ? txt.tut1Desc : tutStep === 2 ? txt.tut2Desc : txt.tut3Desc}</p>
              </div>
              <div className="w-full max-w-sm flex gap-4 mt-8">
                  <button onClick={closeTutorial} className="flex-1 h-14 rounded-xl text-slate-500 text-xs font-black uppercase tracking-widest">{txt.skip}</button>
                  <button onClick={() => { if(tutStep < 3) setTutStep(tutStep + 1); else closeTutorial(); }} className="flex-1 h-14 rounded-xl bg-emerald-500 text-slate-950 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2">{tutStep < 3 ? txt.next : 'Start'} <ChevronRightIcon className="h-4 w-4" /></button>
              </div>
          </div>
      )}

      {showAuth && (
          <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="fixed inset-0 z-[200] bg-[#0b0d11]/95 flex flex-col items-center justify-start sm:justify-center px-6 pt-20 pb-6 sm:py-6 text-center backdrop-blur-md overflow-y-auto custom-scrollbar">
              <button onClick={() => setShowAuth(false)} aria-label={lang === 'hu' ? 'Bezárás' : 'Close'} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white"><XMarkIcon className="h-7 w-7" /></button>
              <KeyIcon className="h-16 w-16 shrink-0 text-emerald-400 mb-6" />
              <h2 id="auth-title" className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2 shrink-0">{currentUser ? 'Fiókod' : txt.login}</h2>
              <p className="text-slate-400 text-sm font-bold mb-8 max-w-xs">{currentUser ? 'Sikeresen bejelentkeztél!' : txt.loginDesc}</p>
              
              <div className="w-full max-w-sm flex flex-col gap-3">
                  {currentUser ? (
                      <>
                        <div className="bg-slate-900/80 p-6 rounded-2xl border border-emerald-500/30 flex flex-col items-center mb-4">
                            <img src={getAvatar(currentUser)} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fallback&backgroundColor=0b0d11' }} className="w-20 h-20 rounded-full border-4 border-[#0b0d11] mb-4 bg-slate-800" alt="avatar" />
                            <span className="text-xl font-black text-white">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                            <span className="text-xs font-bold text-slate-500">{currentUser.email}</span>
                        </div>
                        <button onClick={handleLogout} className="w-full h-14 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-xl font-black uppercase tracking-widest mb-4">Kijelentkezés</button>
                      </>
                  ) : (
                      <>
                        <input type="email" placeholder="Email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full h-14 bg-[#12141a] border border-slate-700 rounded-xl px-4 text-white font-bold outline-none focus:border-emerald-500 transition-colors" />
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} placeholder={txt.password} value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEmailLogin()} className="w-full h-14 bg-[#12141a] border border-slate-700 rounded-xl px-4 text-white font-bold outline-none focus:border-emerald-500 transition-colors pr-12" />
                            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-500 hover:text-white">
                                {showPassword ? <EyeSlashIcon className="h-6 w-6" /> : <EyeIcon className="h-6 w-6" />}
                            </button>
                        </div>
                        <div className="flex justify-between items-center px-1 mb-2">
                            <button onClick={handleMagicLink} disabled={isLoggingIn} className="text-[10px] font-black text-emerald-500 uppercase hover:underline disabled:opacity-50">{txt.magicLink}</button>
                            <button onClick={handlePasswordReset} disabled={isLoggingIn} className="text-[10px] font-black text-slate-500 uppercase hover:text-slate-300 disabled:opacity-50">{txt.forgotPass}</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleEmailLogin} disabled={isLoggingIn} className="h-14 bg-emerald-500 text-slate-900 rounded-xl font-black uppercase tracking-wider text-xs disabled:opacity-50 hover:bg-emerald-400 active:scale-95 transition-all">
                                {isLoggingIn ? '…' : lang === 'hu' ? 'Belépés' : 'Sign in'}
                            </button>
                            <button onClick={handleEmailRegister} disabled={isLoggingIn} className="h-14 bg-slate-800 text-white border border-slate-600 rounded-xl font-black uppercase tracking-wider text-xs disabled:opacity-50 hover:bg-slate-700 active:scale-95 transition-all">
                                {isLoggingIn ? '…' : lang === 'hu' ? 'Regisztráció' : 'Register'}
                            </button>
                        </div>
                        <div className="flex items-center gap-4 my-2 opacity-50"><div className="flex-1 h-px bg-slate-700"></div><span className="text-[10px] font-black uppercase">{txt.or}</span><div className="flex-1 h-px bg-slate-700"></div></div>
                        <button onClick={handleGoogleLogin} disabled={isLoggingIn} className="w-full h-14 bg-white text-slate-900 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-slate-200 transition-colors disabled:opacity-50 active:scale-95">
                            <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> 
                            {isLoggingIn ? 'Bejelentkezés...' : 'Google Bejelentkezés'}
                        </button>
                        <button onClick={handleAppleLogin} disabled={isLoggingIn} className="w-full h-14 bg-black border border-slate-700 text-white rounded-xl font-black flex items-center justify-center gap-3 hover:bg-slate-900 transition-colors disabled:opacity-50 active:scale-95">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05 1.8-3.12 1.81s-1.63-.5-3.05-.5c-1.4 0-2.1.53-3.01.53s-2.04-.84-3.11-1.89C2.5 17.8 1.14 13.9 1.48 11.23c.18-1.5.95-2.85 2.15-3.75 1.15-.84 2.6-.96 3.84-.96 1.43 0 2.5.6 3.24.6.72 0 1.95-.7 3.52-.7 1.25 0 2.6.22 3.65 1.08 1.05.85 1.7 2.06 1.84 3.45-2.3.93-3.12 3.25-1.87 4.97.74 1.03 1.82 1.6 2.92 1.84-.36 1.15-1 2.38-1.72 3.53zm-3.3-15.01c.7-.84 1.16-2.04 1.05-3.23-1.07.05-2.38.74-3.12 1.6-.6.67-1.15 1.88-1.01 3.08 1.2.09 2.38-.6 3.08-1.45z"/></svg> 
                            {isLoggingIn ? 'Bejelentkezés...' : 'Apple Bejelentkezés'}
                        </button>
                      </>
                  )}
              </div>
          </div>
      )}

      {/* --- KÜLDETÉSEK PANEL - FRISSÍTETT DIZÁJN --- */}
      {showQuests && (
          <div role="dialog" aria-modal="true" aria-labelledby="quests-title" className="fixed inset-0 z-[150] bg-[#0b0d11]/95 flex flex-col items-center justify-start pt-16 pb-8 px-6 backdrop-blur-md overflow-y-auto custom-scrollbar">
              <button onClick={() => setShowQuests(false)} aria-label={lang === 'hu' ? 'Bezárás' : 'Close'} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white"><XMarkIcon className="h-7 w-7" /></button>
              <ListBulletIcon className="h-12 w-12 text-cyan-400 mb-2" />
              <h2 id="quests-title" className="text-3xl font-black text-white uppercase italic mb-2 tracking-tighter">{txt.quests}</h2>
              <p className="text-xs text-slate-400 text-center mb-8 max-w-sm">{lang === 'hu' ? 'A célok ezen a készüléken követhetők. A teljesítés jelenleg nem ad XP-t.' : 'Progress is tracked on this device. Completing a goal does not award XP yet.'}</p>
              
              <div className="w-full max-w-sm flex flex-col gap-8">
                  {/* Napi szekció */}
                  <section>
                      <div className="flex justify-between items-end mb-4 px-1">
                          <h3 className="text-lg font-black text-emerald-400 uppercase italic leading-none">{txt.daily}</h3>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{txt.resetDaily}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                          {dailyQuests.map((q) => (
                              <div key={q.id} className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                      <span className="text-white font-bold text-sm">{q.title}</span>
                                      {q.completed && <span className="font-black text-emerald-400 text-xs">✓</span>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(q.current/q.target)*100}%` }}></div>
                                      </div>
                                      <span className="text-[10px] font-mono text-slate-500 font-bold">{q.current}/{q.target}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </section>

                  {/* Heti szekció */}
                  <section>
                      <div className="flex justify-between items-end mb-4 px-1">
                          <h3 className="text-lg font-black text-purple-400 uppercase italic leading-none">{txt.weekly}</h3>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{txt.resetWeekly}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                          {weeklyQuests.map((q) => (
                              <div key={q.id} className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-2xl flex flex-col gap-2 shadow-lg shadow-purple-500/5">
                                  <div className="flex items-center justify-between">
                                      <span className="text-white font-bold text-sm">{q.title}</span>
                                      {q.completed && <span className="font-black text-emerald-400 text-xs">✓</span>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                          <div className="h-full bg-purple-500 transition-all" style={{ width: `${(q.current/q.target)*100}%` }}></div>
                                      </div>
                                      <span className="text-[10px] font-mono text-slate-500 font-bold">{q.current}/{q.target}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </section>
              </div>
          </div>
      )}

      {/* FEJLÉC GOMBOK ÉS STATISZTIKÁK */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center bg-[#12141a] p-2 rounded-2xl border border-slate-800 shadow-lg z-10">
        <div className="flex items-center gap-3 min-w-0">
            <button aria-label={lang === 'hu' ? 'Profil vagy bejelentkezés' : 'Profile or sign in'} onClick={() => currentUser ? onOpenProfile() : setShowAuth(true)} className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border transition-colors ${currentUser ? 'border-emerald-500/50 bg-slate-800 hover:border-emerald-400' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                <img src={getAvatar(currentUser)} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fallback&backgroundColor=0b0d11' }} className="h-6 w-6 rounded-full bg-slate-800" alt="avatar" />
            </button>
            <div className="hidden min-[375px]:flex flex-col">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{txt.lvl} {userLevel}</span>
                <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5"><div className="h-full bg-emerald-500 w-[45%]"></div></div>
            </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button aria-label={lang === 'hu' ? 'Küldetések' : 'Quests'} onClick={() => { setQuestProgress(readQuestProgress(localStorage)); setShowQuests(true); }} className="h-10 w-10 flex items-center justify-center bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20"><ListBulletIcon className="h-5 w-5" /></button>
            <div className="h-10 flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 rounded-lg border border-amber-500/20 relative">
                <FireIcon className="h-4 w-4 fill-amber-500" /> <span className="text-xs font-black">{userStreak}</span>
            </div>
            <button aria-label={lang === 'hu' ? 'Beállítások' : 'Settings'} onClick={onOpenSettings} className="h-10 w-10 flex items-center justify-center bg-slate-800 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"><Cog6ToothIcon className="h-5 w-5" /></button>
            <button aria-label={lang === 'hu' ? 'Klub' : 'Club'} onClick={onOpenClub} className="h-10 w-10 flex items-center justify-center bg-slate-800 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"><ShieldCheckIcon className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 gap-6 lg:gap-8 items-start">
      <section className="w-full flex flex-col items-center lg:grid lg:grid-cols-2 lg:gap-x-6 lg:items-start">
      <header className="mb-6 text-center lg:text-left shrink-0 lg:col-span-2">
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1 block">DARTISAN</span>
        <h1 className="text-4xl lg:text-6xl font-black text-white uppercase italic tracking-tighter">{tab === 'x01' || tab === 'challenge' ? txt.setup : tab === 'practice' ? txt.practice : tab === 'career' ? txt.career : tab === 'cricket' ? 'Cricket' : txt.leagues}</h1>
        <p className="hidden sm:block text-sm text-slate-400 font-medium mt-3 max-w-2xl">{lang === 'hu' ? 'Válassz játékmódot, állítsd be a játékosokat, és indulhat a meccs.' : 'Choose a mode, set up the players, and start your match.'}</p>
      </header>

      <button type="button" onClick={onOpenTrainingLab} className="w-full min-h-20 mb-6 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 via-[#182330] to-[#12141a] px-5 py-4 text-left flex items-center justify-between gap-4 hover:border-cyan-400 hover:bg-cyan-500/20 transition-all lg:col-span-2 lg:row-start-2">
        <span className="flex items-center gap-4 min-w-0"><span className="h-12 w-12 shrink-0 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center"><SparklesIcon className="h-7 w-7" /></span><span className="min-w-0"><span className="text-[10px] font-black text-cyan-300 uppercase tracking-[0.2em] block">{lang === 'hu' ? `Új • ${TRAINING_MODES.length} játszható mód` : `New • ${TRAINING_MODES.length} playable drills`}</span><span className="text-lg sm:text-xl font-black text-white uppercase block">{lang === 'hu' ? 'Edzéslabor' : 'Training lab'}</span><span className="text-xs text-slate-300 block">{lang === 'hu' ? 'Duplák, T20, Bull, Shanghai, Count-Up és további edzések' : 'Doubles, T20, Bull, Shanghai, Count-Up and more'}</span></span></span>
        <ChevronRightIcon className="h-6 w-6 text-cyan-300 shrink-0" />
      </button>

      {/* --- QUICK START GOMB --- */}
        <button 
            onClick={() => onStart({ 
                gameMode: 'x01', 
                players: [
                    players[0], 
                    { name: 'AI Haladó', isBot: true, difficulty: 5, color: 'purple' } 
                ], 
                startingScore: 501, 
                setsToWin: 1, 
                legsToWin: 1, 
                checkIn: 'single', 
                checkout: 'double', 
                muteCaller: muteCaller 
            })} 
            className="w-full h-16 mb-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 text-sm font-black uppercase tracking-widest active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 transition-transform lg:col-start-1 lg:row-start-3"
        >
            {txt.quickMatch}
        </button>

      <div className="w-full flex flex-col gap-2 mb-6 lg:col-start-2 lg:row-start-3 lg:row-span-2">
          <div className="flex bg-[#12141a] rounded-xl p-1 border border-slate-800 shadow-lg">
            <button onClick={() => setTab('x01')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${tab === 'x01' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{txt.local}</button>
            <button onClick={() => setTab('challenge')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${tab === 'challenge' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{txt.challenge}</button>
            <button onClick={() => setTab('practice')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${tab === 'practice' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{txt.practice}</button>
          </div>
          
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
            <button onClick={() => setTab('career')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${tab === 'career' ? 'bg-[#b655ff] text-white border-[#b655ff] shadow-[0_0_15px_rgba(182,85,255,0.3)]' : 'bg-[#12141a] text-slate-500 border-slate-800 hover:bg-slate-800'}`}>{txt.career}</button>
            <button onClick={() => setTab('cricket')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${tab === 'cricket' ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-[#12141a] text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Cricket</button>
            <button onClick={() => setTab('leagues')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${tab === 'leagues' ? 'bg-[#ff2b5e] text-white border-[#ff2b5e] shadow-[0_0_15px_rgba(255,43,94,0.3)]' : 'bg-[#12141a] text-slate-500 border-slate-800 hover:bg-slate-800'}`}>{txt.leagues}</button>
            {onOpenCoach && (
                <button onClick={onOpenCoach} className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border bg-[#12141a] text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.15)] flex items-center justify-center">
                    AI Edző
                </button>
            )}
          </div>
      </div>

      <button onClick={onStartTournament} className="w-full mb-6 h-16 rounded-2xl bg-[#b655ff]/10 border border-[#b655ff]/30 text-[#b655ff] flex items-center justify-between px-6 hover:bg-[#b655ff]/20 hover:shadow-[0_0_20px_rgba(182,85,255,0.2)] transition-all group active:scale-95 shrink-0 lg:col-start-1 lg:row-start-4">
          <div className="flex items-center gap-4">
              <TrophyIcon className="h-7 w-7 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col items-start">
                  <span className="font-black uppercase tracking-widest text-sm">{txt.tourBuilder}</span>
                  <span className="text-[10px] font-bold text-[#b655ff]/70 uppercase tracking-wider">{txt.tourDesc}</span>
              </div>
          </div>
          <ChevronRightIcon className="h-5 w-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </button>
      </section>

      <div className={`w-full min-w-0 bg-[#12141a] rounded-[2rem] p-5 sm:p-6 lg:p-8 border border-slate-800 shadow-2xl flex flex-col mb-8 ${tab === 'x01' || tab === 'challenge' ? '' : 'lg:max-w-4xl lg:mx-auto'}`}>
        
        {(tab === 'x01' || tab === 'challenge') && (
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10">
            <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">{tab === 'challenge' ? 'A Te Neved' : txt.players}</label>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {players.slice(0, tab === 'challenge' ? 1 : 4).map((p, idx) => (
                    <div key={idx} className="flex flex-col bg-[#0b0d11] p-3 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-3">
                            <button onClick={() => updatePlayer(idx, { color: COLORS[((COLORS.indexOf(p.color) === -1 ? 0 : COLORS.indexOf(p.color)) + 1) % COLORS.length] })} className={`h-4 w-4 shrink-0 rounded-full border-2 border-[#12141a] bg-${p.color}-500 shadow-[0_0_10px_currentColor]`}></button>
                            <input type="text" value={p.name} onChange={(e) => updatePlayer(idx, { name: e.target.value })} className="flex-1 h-8 bg-transparent text-white font-bold outline-none uppercase text-sm" />
                            {tab === 'x01' && <button onClick={() => updatePlayer(idx, { isBot: !p.isBot })} className={`p-2 rounded-lg border transition-all ${p.isBot ? 'bg-[#b655ff]/20 border-[#b655ff]/50 text-[#b655ff]' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{p.isBot ? <ComputerDesktopIcon className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}</button>}
                            {tab === 'x01' && players.length > 1 && (<button onClick={() => setPlayers(players.filter((_, i) => i !== idx))} className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500"><XMarkIcon className="h-5 w-5" /></button>)}
                        </div>
                        
                        {tab === 'x01' && (
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/50 gap-3">
                                <div className="flex-1 flex flex-col">
                                    <span className="text-[8px] uppercase font-black text-slate-500 mb-1 tracking-widest">{txt.team}</span>
                                    <select 
                                        value={p.teamId === undefined ? 'none' : String(p.teamId)} 
                                        onChange={(e) => updatePlayer(idx, { teamId: e.target.value === 'none' ? undefined : parseInt(e.target.value) })} 
                                        className="bg-slate-900 text-xs font-bold text-white rounded-md p-1.5 border border-slate-700 outline-none"
                                    >
                                        <option value="none">{txt.individual}</option>
                                        <option value="0">{txt.team} 1</option>
                                        <option value="1">{txt.team} 2</option>
                                        <option value="2">{txt.team} 3</option>
                                    </select>
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <span className="text-[8px] uppercase font-black text-slate-500 mb-1 tracking-widest">{txt.handicap}</span>
                                    <input 
                                        type="number" 
                                        min="0"
                                        placeholder={txt.noHandicap} 
                                        value={p.customStartingScore || ''} 
                                        onChange={(e) => {
                                            let val = parseInt(e.target.value);
                                            if (val < 0) val = Math.abs(val);
                                            updatePlayer(idx, { customStartingScore: e.target.value ? Math.max(0, val) : undefined })
                                        }} 
                                        className="bg-slate-900 text-xs font-bold text-white rounded-md p-1.5 border border-slate-700 outline-none w-full placeholder:text-slate-600" 
                                    />
                                </div>
                            </div>
                        )}

                        {tab === 'x01' && p.isBot && (
                            <div className="grid grid-cols-5 gap-1.5 mt-3 pt-3 border-t border-slate-800/50">
                                {[
                                    { lvl: 1, name: 'Kezdő' },
                                    { lvl: 3, name: 'Amatőr' },
                                    { lvl: 5, name: 'Haladó' },
                                    { lvl: 8, name: 'Profi' },
                                    { lvl: 10, name: 'Mester' }
                                ].map((diff) => (
                                    <button
                                        key={diff.lvl}
                                        onClick={() => updatePlayer(idx, { difficulty: diff.lvl })}
                                        className={`h-8 rounded-md text-[8px] sm:text-[9px] font-black uppercase transition-all border ${
                                            p.difficulty === diff.lvl
                                                ? 'bg-[#b655ff] text-white border-[#b655ff] shadow-[0_0_10px_rgba(182,85,255,0.4)]'
                                                : 'bg-[#12141a] text-slate-500 border-slate-800 hover:border-slate-600'
                                        }`}
                                    >
                                        {diff.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    ))}
                    {tab === 'x01' && players.length < 4 && (<button onClick={() => setPlayers([...players, { name: `${txt.player} ${players.length + 1}`, isBot: false, difficulty: 5, color: COLORS[players.length % COLORS.length] }])} className="h-12 border border-dashed border-slate-700 rounded-xl text-slate-500 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-800/50 transition-all"><PlusIcon className="h-5 w-5" /> {txt.add}</button>)}
                </div>
                {tab === 'x01' && players.length >= 2 && <button type="button" onClick={() => { setBullOffHits(players.map(() => null)); setBullOffOpen(true); }} className="w-full mt-3 min-h-11 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-black uppercase hover:bg-amber-500/20">{lang === 'hu' ? 'Bull-off: döntsétek el, ki kezd' : 'Bull-off: decide who starts'}</button>}
            </div>

            <div className="flex flex-col gap-6">
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{txt.sets}</label>
                    <div className="grid grid-cols-3 gap-1">
                        {[1, 3, 5].map(s => <button key={s} onClick={() => setSets(s)} className={`h-12 rounded-xl font-black text-sm transition-all ${sets === s ? 'bg-[#ff9e00] text-slate-950 shadow-md' : 'bg-[#0b0d11] text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>{s}</button>)}
                    </div>
                </div>
                <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{txt.legs}</label>
                    <div className="grid grid-cols-3 gap-1">
                        {[1, 3, 5].map(l => <button key={l} onClick={() => setLegs(l)} className={`h-12 rounded-xl font-black text-sm transition-all ${legs === l ? 'bg-[#f1f5f9] text-slate-950 shadow-md' : 'bg-[#0b0d11] text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>{l}</button>)}
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{txt.score}</label>
                    <div className="grid grid-cols-2 gap-1">
                        {[301, 501, 701, 1001].map(s => <button key={s} onClick={() => setScore(s)} aria-pressed={score === s} className={`h-12 rounded-xl font-black text-sm transition-all ${score === s ? 'bg-[#10b981] text-slate-950 shadow-md' : 'bg-[#0b0d11] text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>{s}</button>)}
                    </div>
                </div>
                <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{txt.out}</label>
                    <div className="grid grid-cols-3 gap-1">
                        {(['single', 'double', 'master'] as const).map(rule => <button key={rule} onClick={() => setCheckout(rule)} aria-pressed={checkout === rule} className={`h-12 rounded-xl font-black text-[10px] uppercase transition-all ${checkout === rule ? 'bg-[#10b981] text-slate-950 shadow-md' : 'bg-[#0b0d11] text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>{rule === 'single' ? txt.single : rule === 'double' ? txt.double : 'Master'}</button>)}
                    </div>
                </div>
            </div>

            <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{lang === 'hu' ? 'Beszálló szabály' : 'Entry rule'}</label>
                <div className="grid grid-cols-3 gap-1">
                    {(['single', 'double', 'master'] as const).map(rule => <button key={rule} onClick={() => setCheckIn(rule)} aria-pressed={checkIn === rule} className={`h-12 rounded-xl font-black text-[10px] uppercase transition-all ${checkIn === rule ? 'bg-[#10b981] text-slate-950 shadow-md' : 'bg-[#0b0d11] text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>{rule === 'single' ? txt.single : rule === 'double' ? txt.double : 'Master'}</button>)}
                </div>
            </div>

            {tab === 'x01' ? (
                <>
                    <div className="rounded-2xl border border-slate-700 bg-[#0b0d11] p-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{lang === 'hu' ? 'Egyedi szabályok' : 'Custom rules'}</p>
                        <div className="grid grid-cols-3 gap-2">
                            <label className="text-[10px] font-bold text-slate-400">{lang === 'hu' ? 'Kezdőpont' : 'Start score'}<input type="number" min="2" max="1001" step="1" value={score} onChange={event => setScore(Math.max(2, Math.min(1001, Math.trunc(Number(event.target.value) || 2))))} className="mt-1 w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-2 text-white font-mono font-black" /></label>
                            <label className="text-[10px] font-bold text-slate-400">{lang === 'hu' ? 'Szettek' : 'Sets'}<input type="number" min="1" max="9" step="1" value={sets} onChange={event => setSets(Math.max(1, Math.min(9, Math.trunc(Number(event.target.value) || 1))))} className="mt-1 w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-2 text-white font-mono font-black" /></label>
                            <label className="text-[10px] font-bold text-slate-400">{lang === 'hu' ? 'Legek' : 'Legs'}<input type="number" min="1" max="9" step="1" value={legs} onChange={event => setLegs(Math.max(1, Math.min(9, Math.trunc(Number(event.target.value) || 1))))} className="mt-1 w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-2 text-white font-mono font-black" /></label>
                        </div>
                        <div className="flex gap-2 mt-4"><input type="text" maxLength={30} placeholder={lang === 'hu' ? 'Szabálykészlet neve' : 'Preset name'} value={presetName} onChange={event => setPresetName(event.target.value)} className="min-w-0 flex-1 h-11 rounded-lg bg-slate-900 border border-slate-700 px-3 text-white text-xs font-bold" /><button type="button" onClick={saveMatchPreset} className="h-11 px-4 rounded-lg bg-cyan-500 text-slate-950 font-black text-xs uppercase">{lang === 'hu' ? 'Mentés' : 'Save'}</button></div>
                        <p className="text-[10px] text-slate-500 mt-2">{lang === 'hu' ? 'A játékosok, pontok és beszálló/kiszálló szabályok ezen az eszközön mentődnek. Legfeljebb 10 készlet.' : 'Players, scores and in/out rules are saved on this device. Up to 10 presets.'}</p>
                        {matchPresets.length > 0 && <div className="mt-4 space-y-2">{matchPresets.map(preset => <div key={preset.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 p-2"><button type="button" onClick={() => loadMatchPreset(preset)} className="min-w-0 flex-1 text-left px-2 py-1"><span className="block text-white text-xs font-black truncate">{preset.name}</span><span className="block text-[10px] text-slate-500">{preset.startingScore} • {preset.setsToWin}S / {preset.legsToWin}L • {preset.checkIn}/{preset.checkout}</span></button><button type="button" aria-label={`${lang === 'hu' ? 'Törlés' : 'Delete'}: ${preset.name}`} onClick={() => deleteMatchPreset(preset.id)} className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10"><XMarkIcon className="h-4 w-4" /></button></div>)}</div>}
                    </div>
                    <button onClick={() => setMuteCaller(!muteCaller)} className={`w-full h-12 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 ${muteCaller ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500' : 'bg-[#0b0d11] border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
                        {muteCaller ? <SpeakerXMarkIcon className="h-5 w-5"/> : <SpeakerWaveIcon className="h-5 w-5"/>} {txt.mute}
                    </button>
                    <button onClick={() => onStart({ gameMode: 'x01', players, startingScore: score, setsToWin: sets, legsToWin: legs, checkIn, checkout, muteCaller })} className="w-full h-16 rounded-2xl bg-[#10b981] text-slate-950 text-xl font-black uppercase tracking-widest active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.3)] mt-2">
                        {txt.start}
                    </button>
                </>
            ) : (
                <div className="flex flex-col gap-4 text-center mt-2 border-t border-slate-800 pt-6">
                    <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black mb-2">{lang === 'hu' ? 'Aszinkron Online Mód' : 'Async Online Mode'}</p>
                    <button onClick={handleHostMatch} disabled={isCreatingMatch} className="w-full h-14 rounded-xl bg-amber-500 text-slate-950 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:bg-amber-400 disabled:opacity-50">
                        <PaperAirplaneIcon className="h-5 w-5"/> {isCreatingMatch ? '...' : txt.sendCh}
                    </button>
                    <div className="flex items-center gap-4 py-2">
                        <div className="flex-1 h-px bg-slate-800"></div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{txt.or}</span>
                        <div className="flex-1 h-px bg-slate-800"></div>
                    </div>
                    <div className="bg-[#0b0d11] p-4 rounded-2xl border border-indigo-500/30 flex flex-col gap-3 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                        <input type="text" placeholder={txt.enterCode} value={challengeCode} onChange={(e)=>setChallengeCode(e.target.value.toUpperCase())} className="h-12 w-full bg-[#12141a] border border-slate-700 rounded-xl text-center text-indigo-400 font-mono font-bold tracking-[0.2em] outline-none uppercase placeholder:text-slate-600 focus:border-indigo-500" />
                        <button onClick={handleJoinMatch} disabled={isJoiningMatch || challengeCode.length < 5} className="w-full h-14 rounded-xl bg-indigo-500 text-white text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-400 disabled:opacity-50">
                            <ArrowRightEndOnRectangleIcon className="h-5 w-5"/> {isJoiningMatch ? '...' : txt.recvCh}
                        </button>
                    </div>
                </div>
            )}
            </div>
          </div>
        )}

        {tab === 'practice' && (
            <div className="flex flex-col gap-3 text-center">
                <TrophyIcon className="h-12 w-12 text-cyan-500 mx-auto mb-1" />
                <button type="button" onClick={onOpenTrainingLab} className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-left hover:bg-cyan-500/20">
                    <span className="text-sm font-black text-cyan-300 uppercase block">{lang === 'hu' ? 'Új: Edzéslabor' : 'New: Training lab'}</span>
                    <span className="text-xs text-slate-300">{lang === 'hu' ? `${TRAINING_MODES.length} játszható mód és helyi edzéstörténet` : `${TRAINING_MODES.length} playable drills and local training history`}</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPracticeType('around')} className={`h-16 rounded-xl font-black uppercase text-[10px] border transition-all ${practiceType === 'around' ? 'bg-cyan-500 text-slate-900 border-cyan-400 shadow-lg' : 'bg-[#0b0d11] text-slate-400 border-slate-800 hover:bg-slate-800'}`}>
                        Around Clock<br/><span className="text-[8px] font-bold opacity-70">{txt.atcDesc}</span>
                    </button>
                    <button onClick={() => setPracticeType('bobs27')} className={`h-16 rounded-xl font-black uppercase text-[10px] border transition-all ${practiceType === 'bobs27' ? 'bg-cyan-500 text-slate-900 border-cyan-400 shadow-lg' : 'bg-[#0b0d11] text-slate-400 border-slate-800 hover:bg-slate-800'}`}>
                        Bob&apos;s 27<br/><span className="text-[8px] font-bold opacity-70">{txt.bobsDesc}</span>
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-1">
                    <button onClick={() => setPracticeType('121')} className={`h-16 rounded-xl font-black uppercase text-[10px] border transition-all ${practiceType === '121' ? 'bg-cyan-500 text-slate-900 border-cyan-400 shadow-lg' : 'bg-[#0b0d11] text-slate-400 border-slate-800 hover:bg-slate-800'}`}>
                        121 Challenge<br/><span className="text-[8px] font-bold opacity-70">{txt.c121Desc}</span>
                    </button>
                    
                    <button onClick={() => setPracticeType('hunter')} className={`h-16 rounded-xl font-black uppercase text-[10px] border transition-all ${practiceType === 'hunter' ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-[#12141a] text-slate-400 border-slate-800 hover:bg-slate-800'}`}>
                        {txt.targetHunter}<br/><span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest">{lang === 'hu' ? 'Hőtérkép' : 'Heatmap'}</span>
                    </button>

                    <button onClick={() => setPracticeType('math')} className={`h-16 col-span-2 rounded-xl font-black uppercase text-[10px] border transition-all ${practiceType === 'math' ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-[#12141a] text-slate-400 border-slate-800 hover:bg-slate-800'}`}>
                        {txt.dartsMath}<br/><span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">{lang === 'hu' ? 'Agytréning' : 'Brain Training'}</span>
                    </button>
                </div>
                
                <button 
                    onClick={() => onStart({ 
                        gameMode: 'practice', 
                        practiceType, 
                        players: [players[0]], 
                        startingScore: practiceType === '121' ? 121 : 0, 
                        setsToWin: 1, 
                        legsToWin: 1, 
                        checkIn: 'single', 
                        checkout: practiceType === '121' ? 'double' : 'single', 
                        muteCaller 
                    })} 
                    className="w-full h-16 rounded-2xl bg-cyan-500 text-slate-950 text-xl font-black uppercase tracking-widest active:scale-95 shadow-[0_10px_30px_rgba(6,182,212,0.3)] mt-2"
                >
                    {txt.start}
                </button>
            </div>
        )}

        {tab === 'career' && (
            <div className="flex flex-col gap-4 text-center">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{txt.champTitle}</span>
                    <span className="text-[10px] font-black text-[#b655ff] bg-[#b655ff]/10 px-3 py-1.5 rounded-lg">{txt.match} {careerStage + 1} / 15</span>
                </div>
                {careerStage < 15 ? (
                    <div className="bg-[#0b0d11] border border-[#b655ff]/30 p-6 rounded-3xl relative overflow-hidden text-left shadow-[0_0_20px_rgba(182,85,255,0.05)]">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03]"><ComputerDesktopIcon className="h-32 w-32 text-white" /></div>
                        <h3 className="text-3xl font-black text-white italic uppercase relative z-10">{lang === 'en' ? CAREER_BOTS[careerStage].nameEn : CAREER_BOTS[careerStage].nameHu}</h3>
                        <p className="text-[10px] font-bold text-[#b655ff] uppercase tracking-widest mt-1 mb-6 relative z-10">Szint: {CAREER_BOTS[careerStage].difficulty} (Átlag: {CAREER_BOTS[careerStage].avg})</p>
                        <ul className="text-xs text-slate-300 font-bold relative z-10 flex flex-col gap-3">
                            <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-[#b655ff] shrink-0 opacity-80"/> <span>{lang === 'hu' ? '15 egymást követő ellenfél.' : 'Fifteen opponents in sequence.'}</span></li>
                            <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-[#b655ff] shrink-0 opacity-80"/> <span>{lang === 'hu' ? 'Játssz le egy 501-es mérkőzést a gép ellen. Ha nyersz, továbbjutsz.' : 'Play a 501 match against the bot. Win to advance.'}</span></li>
                            <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-[#b655ff] shrink-0 opacity-80"/> <span>{lang === 'hu' ? 'A gép a fenti nehézségnek megfelelő átlagot dobja.' : 'The bot throws at its designated average.'}</span></li>
                        </ul>
                    </div>
                ) : (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl">
                        <TrophyIcon className="h-16 w-16 text-amber-400 mx-auto mb-2" />
                        <h3 className="text-xl font-black text-white uppercase italic">{txt.champWonTitle}</h3>
                        <p className="text-xs text-slate-400 mt-2">{txt.champWonDesc}</p>
                    </div>
                )}
                {careerStage < 15 && (
                    <button 
                        onClick={() => { 
                            const bot = CAREER_BOTS[careerStage]; 
                            onStart({ 
                                gameMode: 'career', 
                                careerStage, 
                                players: [players[0], { name: lang === 'en' ? bot.nameEn : bot.nameHu, isBot: true, difficulty: bot.difficulty, color: bot.color as PlayerColor }], 
                                startingScore: 501, 
                                setsToWin: 1, 
                                legsToWin: 3, 
                                checkIn: 'single', 
                                checkout: 'double', 
                                muteCaller 
                            }) 
                        }} 
                        className="w-full h-16 rounded-2xl bg-[#b655ff] text-white text-lg font-black uppercase tracking-widest active:scale-95 shadow-[0_10px_30px_rgba(182,85,255,0.3)] mt-2 hover:bg-[#a040e0]"
                    >
                        {txt.careerStart}
                    </button>
                )}
            </div>
        )}

        {tab === 'cricket' && (
            <div className="flex flex-col gap-4 text-center">
                <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setCricketVariant('standard')} aria-pressed={cricketVariant === 'standard'} className={`h-12 rounded-xl border font-black text-xs uppercase ${cricketVariant === 'standard' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-[#0b0d11] text-slate-400 border-slate-800'}`}>Cricket</button><button type="button" onClick={() => setCricketVariant('cutthroat')} aria-pressed={cricketVariant === 'cutthroat'} className={`h-12 rounded-xl border font-black text-xs uppercase ${cricketVariant === 'cutthroat' ? 'bg-rose-500 text-white border-rose-400' : 'bg-[#0b0d11] text-slate-400 border-slate-800'}`}>Cut-throat</button></div>
                <div className="bg-[#0b0d11] border border-emerald-500/30 p-6 rounded-3xl text-left shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                    <h3 className="text-2xl font-black text-white italic uppercase mb-2">{cricketVariant === 'cutthroat' ? 'Cut-throat Cricket' : 'Cricket'}</h3>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">{cricketVariant === 'cutthroat' ? (lang === 'hu' ? 'Az ellenfelek gyűjtik a pontot; a legalacsonyabb nyer.' : 'Opponents receive points; the lowest score wins.') : (lang === 'hu' ? 'A legelterjedtebb pub darts játékmód' : 'The classic pub darts game')}</p>
                    <ul className="text-xs text-slate-300 font-bold flex flex-col gap-2">
                        <li className="flex gap-2 items-start"><span className="text-emerald-400 shrink-0">✓</span> Célpontok: 15-20 és Bull</li>
                        <li className="flex gap-2 items-start"><span className="text-emerald-400 shrink-0">✓</span> 3 találat = szektorzárás</li>
                            <li className="flex gap-2 items-start"><span className="text-emerald-400 shrink-0">✓</span> {cricketVariant === 'cutthroat' ? (lang === 'hu' ? 'A zárt szektor többletpontját a még nyitott ellenfelek kapják.' : 'Opponents who have not closed the target receive overflow points.') : (lang === 'hu' ? 'Zárt szektorra dobva pontot kapsz (ha az ellenfél még nem zárta).' : 'Score on a closed target until your opponent closes it.')}</li>
                        <li className="flex gap-2 items-start"><span className="text-emerald-400 shrink-0">✓</span> {cricketVariant === 'cutthroat' ? (lang === 'hu' ? 'Győz, aki minden szektort lezárt, és a legkevesebb pontja van.' : 'Close all targets and have the lowest score to win.') : (lang === 'hu' ? 'Győz, aki minden szektort lezárt, és vezet pontban.' : 'Close all targets and have the highest score to win.')}</li>
                    </ul>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {lang === 'hu' ? 'Első játékos' : 'First player'}
                        <input value={players[0].name} onChange={e => updatePlayer(0, { name: e.target.value })} className="mt-2 w-full h-12 rounded-xl bg-slate-950 border border-slate-700 px-4 text-sm text-white outline-none focus:border-emerald-500" />
                    </label>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {lang === 'hu' ? 'Második játékos' : 'Second player'}
                        <input value={players[1]?.name ?? cricketGuestName} onChange={e => players[1] ? updatePlayer(1, { name: e.target.value }) : setCricketGuestName(e.target.value)} className="mt-2 w-full h-12 rounded-xl bg-slate-950 border border-slate-700 px-4 text-sm text-white outline-none focus:border-emerald-500" />
                    </label>
                </div>
                <button
                    onClick={() => onStart({ gameMode: 'cricket', cricketVariant, players: [
                        { ...players[0], name: players[0].name.trim() || 'Player 1', isBot: false },
                        players[1] ? { ...players[1], name: players[1].name.trim() || 'Játékos 2', isBot: false } : { name: cricketGuestName.trim() || 'Játékos 2', color: 'rose', isBot: false, difficulty: 5 }
                    ], startingScore: 0, setsToWin: 1, legsToWin: 1, checkIn: 'single', checkout: 'single', muteCaller })}
                    className="w-full h-16 rounded-2xl bg-emerald-500 text-slate-950 text-xl font-black uppercase tracking-widest active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.3)] mt-2"
                >
                    Cricket Indítása
                </button>
            </div>
        )}

        {tab === 'leagues' && (
            <div className="flex flex-col text-center items-center py-2 w-full">
                <div className="flex items-center gap-3 mb-6">
                    <GlobeEuropeAfricaIcon className="h-10 w-10 text-[#ff2b5e]" />
                    <h3 className="text-2xl font-black text-white italic uppercase text-left leading-none">{txt.leaguesTitle}</h3>
                </div>
                
                {!currentUser ? (
                    <div className="flex flex-col items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 w-full">
                        <KeyIcon className="h-12 w-12 text-slate-500 mb-4" />
                        <p className="text-sm text-slate-400 font-bold mb-4">{lang === 'hu' ? 'A ranglista megtekintéséhez jelentkezz be!' : 'Sign in to view the leaderboard!'}</p>
                        <button onClick={() => setShowAuth(true)} className="w-full h-12 bg-[#ff2b5e] text-white rounded-xl font-black uppercase tracking-widest text-xs">Bejelentkezés</button>
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 font-bold animate-pulse text-xs uppercase tracking-widest">Ranglista betöltése...</div>
                ) : (
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto w-full pr-1 custom-scrollbar">
                        {leaderboard.map((user, idx) => (
                            <div key={user.id} className={`flex items-center justify-between p-3 rounded-xl border ${currentUser.uid === user.id ? 'bg-[#ff2b5e]/10 border-[#ff2b5e]/50 shadow-[0_0_15px_rgba(255,43,94,0.15)]' : 'bg-[#0b0d11] border-slate-800'}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`font-black text-xs w-5 text-left ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-600'}`}>{idx + 1}.</span>
                                    <img src={getAvatar(user)} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fallback&backgroundColor=0b0d11' }} className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800" alt="avatar" />
                                    <div className="flex flex-col text-left">
                                        <span className={`font-bold text-sm leading-none ${currentUser.uid === user.id ? 'text-white' : 'text-slate-300'}`}>{user.name}</span>
                                        <span className="text-[9px] text-slate-500 uppercase font-black">{txt.lvl} {Math.floor(Math.sqrt(Math.max(user.xp || 0, 0) / 100)) + 1}</span>
                                    </div>
                                </div>
                                <span className="text-[#ff2b5e] font-black font-mono text-sm">{user.weeklyXp || 0} XP</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>
      </div>
    </div>
  );
}
