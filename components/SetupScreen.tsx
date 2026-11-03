'use client';

import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signInAnonymously } from 'firebase/auth';
import { 
    XMarkIcon, PlusIcon, ComputerDesktopIcon, UserIcon, UserCircleIcon, 
    SpeakerWaveIcon, SpeakerXMarkIcon, PaperAirplaneIcon, 
    ArrowRightEndOnRectangleIcon, TrophyIcon, FireIcon, GlobeEuropeAfricaIcon, 
    ChevronRightIcon, ListBulletIcon, CheckCircleIcon, KeyIcon, EyeIcon, 
    EyeSlashIcon, ChartBarIcon, UsersIcon, Cog6ToothIcon, ShieldCheckIcon
} from '@heroicons/react/24/outline';
import type { Language } from '@/app/page';

import { db, auth, googleProvider, appleProvider } from '../firebase'; 
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';

export type PlayerColor = 'emerald' | 'rose' | 'cyan' | 'amber' | 'purple';
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
    practiceType?: 'around' | 'bobs27' | '121' | 'hunter' | 'math'; 
    players: PlayerConfig[]; 
    startingScore: number; 
    setsToWin: number; 
    legsToWin: number; 
    checkIn: 'single' | 'double'; 
    checkout: 'single' | 'double'; 
    muteCaller: boolean; 
    resumeState?: any; 
    challengeCode?: string; 
    careerStage?: number; 
    localRole?: 'host' | 'guest'; 
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
  en: { setup: "Match Setup", local: "Local", challenge: "Versus", practice: "Practice", career: "Career", leagues: "Leagues", player: "Player", players: "Players", add: "Add Player", sets: "Sets (First To)", legs: "Legs (First To)", score: "Score", out: "Out", start: "Start Match", mute: "Mute Caller", sendCh: "Create & Host Match", recvCh: "Join Match", enterCode: "Enter DART-XXX code", coming: "Cloud Feature", careerStart: "Fight Next Opponent", lvl: "LVL", match: "Match", easyBot: "Easy", medBot: "Med", proBot: "Pro", champTitle: "World Championship", champWonTitle: "You're the Champion!", champWonDesc: "You defeated all 15 opponents.", leaguesTitle: "Global XP Leagues", leaguesDesc: "Play ranked matches to earn XP. Top 5 players promote to the next tier, bottom 5 demote. Prove yourself in the Gold League!", joinLeague: "Join League", targetHunter: "Target Hunter", c121Desc: "9 darts to checkout", dartsMath: "Darts Math", atcDesc: "1 to 20 sequentially", bobsDesc: "Hardcore Doubles", skip: "Skip", next: "Next", quests: "Missions", daily: "Daily", weekly: "Weekly", resetDaily: "Resets at Midnight", resetWeekly: "Resets on Monday", q1: "Hit 3x 140+", q2: "Checkout under 15 darts", q3: "Play 5 legs", login: "Sign In", loginDesc: "Save your stats and join the global leagues.", magicLink: "Send Magic Link", or: "OR", single: "Single", double: "Double", password: "Password", forgotPass: "Forgot Password?", 
    tut1Title: "3 Input Modes", tut1Desc: "Dartisan adapts to you. Choose the mode that fits your style during the match!", 
    tut2Title: "Fast vs Pro", tut2Desc: "FAST: Quick round sums (e.g. 100). PRO or BOARD: Dart-by-dart input for perfect stats and heatmap.", 
    tut3Title: "Smart Checkout", tut3Desc: "Bad at math? The built-in checkout guide leads you to the double. You can hide it anytime.", 
    resumeTitle: "Saved Match", resumeDesc: "Click to resume", resumeMatch: "Resume", abandon: "Abandon", waitingFriend: "Waiting for Opponent...", shareCode: "Share this code with your friend!", cancel: "Cancel", roomFull: "Room is full or already started!", team: "Team", individual: "Individual", handicap: "Custom Score", noHandicap: "Default", quickMatch: "🚀 Quick Match (501 vs AI)", tourBuilder: "Tournament Builder", tourDesc: "Create your own championship!" },
  hu: { setup: "Mérkőzés", local: "Helyi", challenge: "Kihívás", practice: "Edzés", career: "Karrier", leagues: "Ligák", player: "Játékos", players: "Játékosok", add: "Hozzáadás", sets: "Szettek (Nyerig)", legs: "Legek (Nyerig)", score: "Pont", out: "Kiszálló", start: "Mérkőzés Indítása", mute: "Némítás", sendCh: "Szoba Létrehozása (Host)", recvCh: "Csatlakozás", enterCode: "Kód (DART-...)", coming: "Cloud Feature", careerStart: "Mérkőzés Indítása", lvl: "SZINT", match: "Mérkőzés", easyBot: "Easy", medBot: "Med", proBot: "Pro", champTitle: "Világbajnokság", champWonTitle: "Világbajnok Vagy!", champWonDesc: "Legyőzted az összes (15) ellenfelet az ágrajzon.", leaguesTitle: "Globális XP Ligák", leaguesDesc: "Játssz tétmeccseket és gyűjts XP-t! Heti 30 fős csoportok: a Top 5 feljut, az utolsó 5 kiesik. Juss fel az Arany Ligába!", joinLeague: "Csatlakozás a Ligához", targetHunter: "Célpont Vadász", c121Desc: "9 nyíl a kiszállóra", dartsMath: "Darts Math", atcDesc: "1-től 20-ig sorban", bobsDesc: "Dupla Edzés", skip: "Kihagyás", next: "Tovább", quests: "Küldetések", daily: "Napi Feladatok", weekly: "Heti Feladatok", resetDaily: "Frissül: Éjfélkor", resetWeekly: "Frissül: Hétfőn", q1: "Dobj 3db 140+-t", q2: "Kiszálló 15 nyíl alatt", q3: "Játssz le 5 leget", login: "Bejelentkezés", loginDesc: "Mentsd el a statisztikáidat és csatlakozz a ligákhoz.", magicLink: "Belépés Mágikus Linkkel", or: "VAGY", single: "Sima", double: "Dupla", password: "Jelszó", forgotPass: "Elfelejtetted a jelszavad?", 
    tut1Title: "3 Beviteli Mód", tut1Desc: "A Dartisan alkalmazkodik hozzád. Válaszd ki a számodra legkényelmesebb módot a meccs közben!", 
    tut2Title: "Fast vs Pro", tut2Desc: "FAST: Gyors körösszeg (pl. beírod: 100). PRO vagy TÁBLA: Nyilonkénti bevitel a tökéletes statisztikákhoz és hőtérképhez.", 
    tut3Title: "Kiszálló Segéd", tut3Desc: "Nem megy fejben a matek? A beépített okos kiszálló ajánló végigvezet a duplákig. Bármikor elrejtheted a meccs alatt egy gombnyomással.", 
    resumeTitle: "Félbehagyott meccs", resumeDesc: "Kattints a folytatáshoz", resumeMatch: "Folytatás", abandon: "Törlés", waitingFriend: "Várakozás az ellenfélre...", shareCode: "Küldd el ezt a kódot a barátodnak!", cancel: "Mégsem", roomFull: "Ez a szoba már elindult vagy tele van!", team: "Csapat", individual: "Egyéni", handicap: "Egyedi Kezdőpont", noHandicap: "Alap (Pl. 501)", quickMatch: "🚀 Gyors meccs (501 vs AI)", tourBuilder: "Tornaszervező", tourDesc: "Hozd létre a saját bajnokságod!" }
};

const COLORS: PlayerColor[] = ['emerald', 'rose', 'cyan', 'amber', 'purple'];

interface SetupScreenProps {
  lang: Language;
  onStart: (config: MatchConfig) => void;
  onOpenProfile: () => void;
  onOpenCoach?: () => void;
  onStartTournament: () => void;
  onOpenSettings: () => void; 
  onOpenClub: () => void;
  userLevel?: number; // <- ÚJ: Külső state a page.tsx-ből
  userStreak?: number; // <- ÚJ: Külső state a page.tsx-ből
  currentUser?: any;
}

export function SetupScreen({ lang, onStart, onOpenProfile, onOpenCoach, onStartTournament, onOpenSettings, onOpenClub, userLevel = 1, userStreak = 1 }: SetupScreenProps) {
  const [tab, setTab] = useState<'x01' | 'challenge' | 'practice' | 'career' | 'leagues'>('x01');
  const [players, setPlayers] = useState<PlayerConfig[]>([{ name: 'Player 1', isBot: false, difficulty: 5, color: 'emerald' }]);
  const [score, setScore] = useState(501);
  const [sets, setSets] = useState(1);
  const [legs, setLegs] = useState(3);
  const [checkIn, setCheckIn] = useState<'single' | 'double'>('single');
  const [checkout, setCheckout] = useState<'single' | 'double'>('double');
  const [muteCaller, setMuteCaller] = useState(false);
  const [challengeCode, setChallengeCode] = useState('');
  const [practiceType, setPracticeType] = useState<'around' | 'bobs27' | '121' | 'hunter' | 'math'>('121');
  
  const [careerStage, setCareerStage] = useState(0);
  const [showQuests, setShowQuests] = useState(false);
  
  // --- NAPI ÉS HETI KÜLDETÉSEK LOGIKÁJA ---
  const [dailyQuests, setDailyQuests] = useState<any[]>([]);
  const [weeklyQuests, setWeeklyQuests] = useState<any[]>([]);

  useEffect(() => {
      if (typeof window !== 'undefined') {
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          
          // Számoljuk ki a hétfőt a heti küldetésekhez
          const dayOfWeek = now.getDay();
          const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          const mondayDate = new Date(now.setDate(diffToMonday)).toISOString().split('T')[0];

          const savedDailyDate = localStorage.getItem('dartisan_quests_daily_date');
          const savedWeeklyDate = localStorage.getItem('dartisan_quests_weekly_date');
          
          // NAPI RESET
          if (savedDailyDate !== today) {
              const newDailies = [
                  { id: 1, title: lang === 'hu' ? "Dobj 3db 140+-t" : "Hit 3x 140+", reward: 50, completed: false, current: 0, target: 3 },
                  { id: 2, title: lang === 'hu' ? "Kiszálló 15 nyíl alatt" : "Checkout < 15 darts", reward: 100, completed: false, current: 0, target: 1 },
                  { id: 3, title: lang === 'hu' ? "Játssz le 5 leget" : "Play 5 legs", reward: 20, completed: false, current: 0, target: 5 },
              ];
              localStorage.setItem('dartisan_quests_daily_date', today);
              localStorage.setItem('dartisan_quests_daily_data', JSON.stringify(newDailies));
              setDailyQuests(newDailies);
          } else {
              setDailyQuests(JSON.parse(localStorage.getItem('dartisan_quests_daily_data') || '[]'));
          }

          // HETI RESET
          if (savedWeeklyDate !== mondayDate) {
              const newWeeklies = [
                  { id: 101, title: lang === 'hu' ? "Nyerj meg 20 leget" : "Win 20 legs", reward: 500, completed: false, current: 0, target: 20 },
                  { id: 102, title: lang === 'hu' ? "Teljesíts 10 meccset AI ellen" : "Play 10 matches vs AI", reward: 800, completed: false, current: 0, target: 10 }
              ];
              localStorage.setItem('dartisan_quests_weekly_date', mondayDate);
              localStorage.setItem('dartisan_quests_weekly_data', JSON.stringify(newWeeklies));
              setWeeklyQuests(newWeeklies);
          } else {
              setWeeklyQuests(JSON.parse(localStorage.getItem('dartisan_quests_weekly_data') || '[]'));
          }
      }
  }, [showQuests, lang]);

  const [showAuth, setShowAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutStep, setTutStep] = useState(1);

  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [isJoiningMatch, setIsJoiningMatch] = useState(false);
  const [hostedCode, setHostedCode] = useState<string | null>(null); 
  const [savedMatch, setSavedMatch] = useState<any>(null); 

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
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

  const getAvatar = (user: any) => user?.selectedAvatar || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.displayName || user?.email?.split('@')[0] || 'Player'}&backgroundColor=0b0d11`;

  useEffect(() => {
    if (!localStorage.getItem('dartisan_tutorial_done')) {
        setShowTutorial(true);
    }
    const stage = localStorage.getItem('dartisan_career_stage');
    if (stage) setCareerStage(parseInt(stage));
    
    const sMatch = localStorage.getItem('dartisan_save');
    if (sMatch) setSavedMatch(JSON.parse(sMatch));

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            const userData = docSnap.exists() ? docSnap.data() : null;

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
                if (data.lastWeek !== currentWeek) {
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

  const handleEmailLogin = async () => {
      if (!emailInput || !passwordInput) return alert("Kérlek töltsd ki az e-mailt és a jelszót!");
      setIsLoggingIn(true);
      try {
          await signInWithEmailAndPassword(auth, emailInput, passwordInput);
          setShowAuth(false);
          setEmailInput('');
          setPasswordInput('');
      } catch (error: any) {
          if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
              try {
                  await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
                  setShowAuth(false);
                  setEmailInput('');
                  setPasswordInput('');
              } catch (regError: any) {
                  alert("Hiba a regisztráció során: " + regError.message);
              }
          } else {
              alert("Hiba: " + error.message);
          }
      }
      setIsLoggingIn(false);
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
              hostName: players[0].name, 
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
              transaction.update(roomRef, { status: 'playing', guestName: players[0].name, guestUid: user.uid });
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
    <div className={`w-full min-h-[100dvh] bg-[#0b0d11] text-slate-200 flex flex-col items-center pb-24 px-4 relative ${savedMatch && !hostedCode && !showTutorial && !showAuth && !showQuests ? 'pt-24' : 'pt-8'}`}>
      
      {savedMatch && !hostedCode && !showTutorial && !showAuth && !showQuests && (
       <div className="w-full max-w-sm mx-auto mb-4 bg-emerald-500 border border-emerald-400 p-4 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-col">
              <span className="text-slate-900 font-black uppercase text-sm">{txt.resumeTitle}</span>
              <span className="text-emerald-900 font-bold text-xs">{txt.resumeDesc}</span>
          </div>
          <div className="flex gap-2">
              <button onClick={() => { onStart({ ...savedMatch.config, resumeState: savedMatch }); setSavedMatch(null); }} className="bg-slate-900 text-emerald-400 px-4 py-2 rounded-xl font-black uppercase text-xs shadow-xl active:scale-95">{txt.resumeMatch}</button>
              <button onClick={() => { localStorage.removeItem('dartisan_save'); setSavedMatch(null); }} className="bg-emerald-600 text-emerald-900 px-3 py-2 rounded-xl font-black uppercase text-xs shadow-xl active:scale-95"><XMarkIcon className="h-5 w-5"/></button>
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
          <div className="fixed inset-0 z-[200] bg-[#0b0d11]/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
              <button onClick={() => setShowAuth(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"><XMarkIcon className="h-8 w-8" /></button>
              <KeyIcon className="h-16 w-16 text-emerald-400 mb-6" />
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">{currentUser ? 'Fiókod' : txt.login}</h2>
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
                        <button onClick={handleEmailLogin} disabled={isLoggingIn} className="w-full h-14 bg-emerald-500 text-slate-900 rounded-xl font-black uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-400 active:scale-95 transition-all">
                            {isLoggingIn ? 'Betöltés...' : 'Bejelentkezés / Reg.'}
                        </button>
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
          <div className="fixed inset-0 z-[150] bg-[#0b0d11]/95 flex flex-col items-center justify-start pt-16 pb-8 px-6 backdrop-blur-md overflow-y-auto custom-scrollbar">
              <button onClick={() => setShowQuests(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"><XMarkIcon className="h-8 w-8" /></button>
              <ListBulletIcon className="h-12 w-12 text-cyan-400 mb-2" />
              <h2 className="text-3xl font-black text-white uppercase italic mb-8 tracking-tighter">{txt.quests}</h2>
              
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
                                      <span className="text-amber-400 font-black text-xs">+{q.reward} XP</span>
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
                                      <span className="text-amber-400 font-black text-xs">+{q.reward} XP</span>
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
        <div className="flex items-center gap-3">
            <button onClick={() => currentUser ? onOpenProfile() : setShowAuth(true)} className={`p-1.5 rounded-xl border transition-all ${currentUser ? 'border-emerald-500/50 bg-slate-800 hover:border-emerald-400' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                <img src={getAvatar(currentUser)} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fallback&backgroundColor=0b0d11' }} className="h-6 w-6 rounded-full bg-slate-800" alt="avatar" />
            </button>
            <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{txt.lvl} {userLevel}</span>
                <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5"><div className="h-full bg-emerald-500 w-[45%]"></div></div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setShowQuests(true)} className="p-1.5 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20"><ListBulletIcon className="h-5 w-5" /></button>
            <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 relative">
                <FireIcon className="h-4 w-4 fill-amber-500" /> <span className="text-xs font-black">{userStreak}</span>
            </div>
            <button onClick={onOpenSettings} className="p-1.5 bg-slate-800 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white transition-all"><Cog6ToothIcon className="h-5 w-5" /></button>
            <button onClick={onOpenClub} className="p-1.5 bg-slate-800 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-white transition-all"><ShieldCheckIcon className="h-5 w-5" /></button>
        </div>
      </div>

      <header className="mb-6 text-center shrink-0 mt-28">
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1 block">DARTISAN</span>
        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">{tab === 'x01' || tab === 'challenge' ? txt.setup : (tab === 'practice' ? txt.practice : (tab === 'career' ? txt.career : txt.leagues))}</h1>
      </header>

      {/* --- QUICK START GOMB --- */}
      {tab === 'x01' && (
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
            className="w-full max-w-sm h-14 mb-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 text-sm font-black uppercase tracking-widest active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 transition-transform"
        >
            {txt.quickMatch}
        </button>
      )}

      <div className="w-full max-w-sm flex flex-col gap-2 mb-6">
          <div className="flex bg-[#12141a] rounded-xl p-1 border border-slate-800 shadow-lg">
            <button onClick={() => setTab('x01')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${tab === 'x01' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{txt.local}</button>
            <button onClick={() => setTab('challenge')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${tab === 'challenge' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{txt.challenge}</button>
            <button onClick={() => setTab('practice')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${tab === 'practice' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>{txt.practice}</button>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setTab('career')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${tab === 'career' ? 'bg-[#b655ff] text-white border-[#b655ff] shadow-[0_0_15px_rgba(182,85,255,0.3)]' : 'bg-[#12141a] text-slate-500 border-slate-800 hover:bg-slate-800'}`}>{txt.career}</button>
            <button onClick={() => setTab('cricket' as any)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${(tab as string) === 'cricket' ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-[#12141a] text-slate-500 border-slate-800 hover:bg-slate-800'}`}>Cricket</button>
            <button onClick={() => setTab('leagues')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${tab === 'leagues' ? 'bg-[#ff2b5e] text-white border-[#ff2b5e] shadow-[0_0_15px_rgba(255,43,94,0.3)]' : 'bg-[#12141a] text-slate-500 border-slate-800 hover:bg-slate-800'}`}>{txt.leagues}</button>
            {onOpenCoach && (
                <button onClick={onOpenCoach} className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border bg-[#12141a] text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.15)] flex items-center justify-center">
                    AI Edző
                </button>
            )}
          </div>
      </div>

      <button onClick={onStartTournament} className="w-full max-w-sm mb-6 h-16 rounded-2xl bg-[#b655ff]/10 border border-[#b655ff]/30 text-[#b655ff] flex items-center justify-between px-6 hover:bg-[#b655ff]/20 hover:shadow-[0_0_20px_rgba(182,85,255,0.2)] transition-all group active:scale-95 shrink-0">
          <div className="flex items-center gap-4">
              <TrophyIcon className="h-7 w-7 group-hover:scale-110 transition-transform" />
              <div className="flex flex-col items-start">
                  <span className="font-black uppercase tracking-widest text-sm">{txt.tourBuilder}</span>
                  <span className="text-[10px] font-bold text-[#b655ff]/70 uppercase tracking-wider">{txt.tourDesc}</span>
              </div>
          </div>
          <ChevronRightIcon className="h-5 w-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </button>

      <div className="w-full max-w-sm bg-[#12141a] rounded-[2rem] p-6 border border-slate-800 shadow-2xl flex flex-col shrink-0 mb-8">
        
        {(tab === 'x01' || tab === 'challenge') && (
          <div className="flex flex-col gap-6">
            <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">{tab === 'challenge' ? 'A Te Neved' : txt.players}</label>
                <div className="flex flex-col gap-3">
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
            </div>

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
                        {[301, 501].map(s => <button key={s} onClick={() => setScore(s)} className={`h-12 rounded-xl font-black text-sm transition-all ${score === s ? 'bg-[#10b981] text-slate-950 shadow-md' : 'bg-[#0b0d11] text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>{s}</button>)}
                    </div>
                </div>
                <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 block">{txt.out}</label>
                    <div className="grid grid-cols-2 gap-1">
                        <button onClick={() => setCheckout('single')} className={`h-12 rounded-xl font-black text-[10px] uppercase transition-all ${checkout === 'single' ? 'bg-[#10b981] text-slate-950 shadow-md' : 'bg-[#0b0d11] text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>{txt.single}</button>
                        <button onClick={() => setCheckout('double')} className={`h-12 rounded-xl font-black text-[10px] uppercase transition-all ${checkout === 'double' ? 'bg-[#10b981] text-slate-950 shadow-md' : 'bg-[#0b0d11] text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>{txt.double}</button>
                    </div>
                </div>
            </div>

            {tab === 'x01' ? (
                <>
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
        )}

        {tab === 'practice' && (
            <div className="flex flex-col gap-3 text-center">
                <TrophyIcon className="h-12 w-12 text-cyan-500 mx-auto mb-1" />
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPracticeType('around')} className={`h-16 rounded-xl font-black uppercase text-[10px] border transition-all ${practiceType === 'around' ? 'bg-cyan-500 text-slate-900 border-cyan-400 shadow-lg' : 'bg-[#0b0d11] text-slate-400 border-slate-800 hover:bg-slate-800'}`}>
                        Around Clock<br/><span className="text-[8px] font-bold opacity-70">{txt.atcDesc}</span>
                    </button>
                    <button onClick={() => setPracticeType('bobs27')} className={`h-16 rounded-xl font-black uppercase text-[10px] border transition-all ${practiceType === 'bobs27' ? 'bg-cyan-500 text-slate-900 border-cyan-400 shadow-lg' : 'bg-[#0b0d11] text-slate-400 border-slate-800 hover:bg-slate-800'}`}>
                        Bob's 27<br/><span className="text-[8px] font-bold opacity-70">{txt.bobsDesc}</span>
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
                            <li className="flex gap-3 items-start"><CheckCircleIcon className="h-5 w-5 text-[#b655ff] shrink-0 opacity-80"/> <span>{lang === 'hu' ? 'Egyenes kieséses ágrajz.' : 'Single elimination bracket.'}</span></li>
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

        {(tab as string) === 'cricket' && (
            <div className="flex flex-col gap-4 text-center">
                <div className="bg-[#0b0d11] border border-emerald-500/30 p-6 rounded-3xl text-left shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                    <h3 className="text-2xl font-black text-white italic uppercase mb-2">Cricket</h3>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">A legelterjedtebb pub darts játékmód</p>
                    <ul className="text-xs text-slate-300 font-bold flex flex-col gap-2">
                        <li className="flex gap-2 items-start"><span className="text-emerald-400 shrink-0">✓</span> Célpontok: 15-20 és Bull</li>
                        <li className="flex gap-2 items-start"><span className="text-emerald-400 shrink-0">✓</span> 3 találat = szektorzárás</li>
                        <li className="flex gap-2 items-start"><span className="text-emerald-400 shrink-0">✓</span> Zárt szektorra dobva pontot kapsz (ha az ellenfél még nem zárta)</li>
                        <li className="flex gap-2 items-start"><span className="text-emerald-400 shrink-0">✓</span> Győz, aki elsőként zárja az összes szektort ÉS vezet pontban</li>
                    </ul>
                </div>
                <button
                    onClick={() => onStart({ gameMode: 'cricket', players: players.slice(0, 2).map(p => ({ ...p, isBot: false })), startingScore: 0, setsToWin: 1, legsToWin: 1, checkIn: 'single', checkout: 'single', muteCaller })}
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
  );
}
