'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { SetupScreen } from '../components/SetupScreen';
import type { MatchConfig } from '../components/SetupScreen';
import { MatchScreen } from '../components/MatchScreen';
import type { TournamentConfig } from '../components/TournamentScreen';
import type { User } from 'firebase/auth';
import ProfileScreen from '../components/ProfileScreen';
import { TournamentBracket } from '../components/TournamentBracket';
import { AiCoach } from '../components/AiCoach';
import { TournamentScreen } from '../components/TournamentScreen';
import { SettingsScreen } from '../components/SettingsScreen';
import { ClubScreen } from '../components/ClubScreen';
import { CricketScreen } from '../components/CricketScreen';
import { TrainingLab } from '../components/TrainingLab';
import { auth, db, functions } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, getDocFromServer, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { syncPublicProfile } from '../lib/publicProfile';
import { nextCareerStage } from '../lib/career';

export type Language = 'hu' | 'en';
const SERVER_MATCH_ENABLED = process.env.NEXT_PUBLIC_SERVER_MATCH_ENABLED === 'true';
const subscribeMounted = () => () => {};

export default function Home() {
  const scrollContainerRef = useRef<HTMLElement>(null);
  const [currentScreen, setCurrentScreen] = useState<'setup' | 'match' | 'profile' | 'coach' | 'custom_tournament' | 'settings' | 'club' | 'cricket' | 'training_lab'>('setup');
  const [lang, setLang] = useState<Language>(() => typeof window !== 'undefined' && localStorage.getItem('dartisan_lang') === 'en' ? 'en' : 'hu');
  const [matchConfig, setMatchConfig] = useState<MatchConfig | null>(null);
  const [matchInstance, setMatchInstance] = useState(0);
  const [matchResult, setMatchResult] = useState<{ winnerId: string; score1: number; score2: number; tournamentMatchId?: string; isGroupMatch?: boolean } | null>(null);
  const isMounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  
  const [currentUser, setCurrentUser] = useState<(User & { xp?: number; streak?: number; tag?: number }) | null>(null);
  const [userLevel, setUserLevel] = useState(1);
  const [userStreak, setUserStreak] = useState(1);

  const [tournamentConfig, setTournamentConfig] = useState<TournamentConfig | null>(null);
  const [showTournament, setShowTournament] = useState(false);

  useEffect(() => {
      // Apply saved theme
      const savedTheme = localStorage.getItem('dartisan_theme') || 'dark';
      document.body.classList.remove('theme-dark', 'theme-amoled', 'theme-contrast', 'theme-dim');
      if (savedTheme !== 'dark') document.body.classList.add(`theme-${savedTheme}`);

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user && !user.isAnonymous) {
              const docRef = doc(db, 'users', user.uid);
              if (SERVER_MATCH_ENABLED) {
                  try {
                      const syncLogin = httpsCallable<Record<string, never>, { streak: number }>(functions, 'syncLoginStreak');
                      const result = await syncLogin({});
                      const snapshot = await getDocFromServer(docRef);
                      const data = snapshot.data() || {};
                      setCurrentUser({ ...user, ...data });
                      setUserLevel(Math.floor(Math.sqrt(Math.max(data.xp || 0, 0) / 100)) + 1);
                      setUserStreak(result.data.streak);
                      syncPublicProfile(user.uid, {
                          name: data.name, displayName: data.displayName, photoURL: data.photoURL,
                          selectedAvatar: data.selectedAvatar, tag: data.tag, clubId: data.clubId,
                      }).catch(error => console.error('Public profile sync:', error));
                  } catch (error) {
                      console.error('Server profile sync failed:', error);
                      const snapshot = await getDocFromServer(docRef);
                      if (snapshot.exists()) {
                          const data = snapshot.data();
                          setCurrentUser({ ...user, ...data });
                          setUserLevel(Math.floor(Math.sqrt(Math.max(data.xp || 0, 0) / 100)) + 1);
                          setUserStreak(data.streak || 1);
                      }
                  }
                  return;
              }
              // A napváltást a Firestore által visszaigazolt szerveridőből számoljuk.
              await setDoc(docRef, { serverClockProbe: serverTimestamp() }, { merge: true });
              const docSnap = await getDocFromServer(docRef);
              const serverNow = docSnap.get('serverClockProbe')?.toDate();
              if (!serverNow) throw new Error('Firestore server time unavailable');
              const todayStr = serverNow.toISOString().split('T')[0];

              if (docSnap.exists() && docSnap.data().createdAt) {
                  const data = docSnap.data();
                  setCurrentUser({ ...user, ...data });
                  syncPublicProfile(user.uid, data).catch(error => console.error('Public profile sync:', error));
                  setUserLevel(Math.floor(Math.sqrt(Math.max(data.xp || 0, 0) / 100)) + 1);

                  // --- NAPI STREAK LOGIKA ---
                  let currentStreak = data.streak || 1;
                  const lastLogin = data.lastLogin;

                  if (lastLogin && lastLogin !== todayStr) {
                      const lastDate = new Date(lastLogin);
                      const todayDate = new Date(todayStr);
                      const diffTime = todayDate.getTime() - lastDate.getTime();
                      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                      if (diffDays === 1) {
                          currentStreak += 1; // Egymást követő nap
                      } else if (diffDays > 1) {
                          currentStreak = 1;  // Megszakadt a streak
                      }
                      await updateDoc(docRef, { lastLogin: todayStr, streak: currentStreak });
                  }
                  setUserStreak(currentStreak);
              } else {
                  // Új felhasználó inicializálása
                  const displayName = user.displayName || user.email?.split('@')[0] || 'Player';
                  const randomTag = Math.floor(1000 + Math.random() * 9000);
                  const initialProfile = {
                      name: displayName, email: user.email, photoURL: user.photoURL, 
                      tag: randomTag, xp: 0, weeklyXp: 0, matchesWon: 0, 
                      createdAt: serverTimestamp(), lastLogin: todayStr, streak: 1
                  };
                  await setDoc(docRef, initialProfile, { merge: true });
                  syncPublicProfile(user.uid, initialProfile).catch(error => console.error('Public profile sync:', error));
                  setCurrentUser({ ...user, displayName, tag: randomTag });
                  setUserLevel(1);
                  setUserStreak(1);
              }
          } else {
              setCurrentUser(null);
          }
      });
      return () => unsubscribe();

  }, []);

  useEffect(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [currentScreen, showTournament, matchInstance]);

  if (!isMounted) return null;

  return (
    <main ref={scrollContainerRef} className="relative h-[100dvh] w-full bg-[#0b0d11] text-slate-200 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar">
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { display: none !important; }
        * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
      `}} />
      
      {currentScreen === 'settings' && (
        <SettingsScreen onBack={() => setCurrentScreen('setup')} onLanguageChange={setLang} />
      )}

      {currentScreen === 'club' && (
        <ClubScreen 
            onBack={() => setCurrentScreen('setup')} 
            currentUser={currentUser}
            lang={lang}
        />
      )}

      {currentScreen === 'training_lab' && <TrainingLab lang={lang} onBack={() => setCurrentScreen('setup')} />}
      
      {currentScreen === 'setup' && (
        <SetupScreen 
          lang={lang} 
          userLevel={userLevel}
          userStreak={userStreak}
          onStart={(config) => {
            setMatchConfig(config);
            setMatchInstance(value => value + 1);
            if (config.gameMode === 'cricket') {
                setCurrentScreen('cricket');
            } else {
                setMatchResult(null);
                setCurrentScreen('match');
            }
          }}
          onOpenProfile={() => setCurrentScreen('profile')} 
          onOpenCoach={() => setCurrentScreen('coach')}
          onOpenTrainingLab={() => setCurrentScreen('training_lab')}
          onStartTournament={() => setShowTournament(true)} 
          onOpenSettings={() => setCurrentScreen('settings')}
          onOpenClub={() => setCurrentScreen('club')} 
        />
      )}

      {showTournament && (
        <TournamentScreen 
          onBack={() => setShowTournament(false)}
          onStartTournament={(config) => {
              setShowTournament(false);
              setTournamentConfig(config);
              setCurrentScreen('custom_tournament');
          }}
        />
      )}

      {currentScreen === 'cricket' && matchConfig && (
        <CricketScreen
          config={matchConfig}
          onBack={() => setCurrentScreen('setup')}
        />
      )}

      {currentScreen === 'match' && matchConfig && (
        <MatchScreen
          key={matchInstance}
          config={matchConfig}
          lang={lang}
          onRematch={() => {
              setMatchResult(null);
              setMatchInstance(value => value + 1);
              setCurrentScreen('match');
          }}
          onBackToSetup={() => {
              if (matchConfig.isCustomTournamentMatch) {
                  setCurrentScreen('custom_tournament');
              } else {
                  setCurrentScreen('setup'); 
              }
          }}
          onMatchComplete={(playersData) => {
              if (playersData.length < 2) { setCurrentScreen('setup'); return; }
              const winner = playersData.reduce((prev, current) => {
                  const prevScore = prev.setsWon * 1000 + prev.legsWon;
                  const currScore = current.setsWon * 1000 + current.legsWon;
                  return prevScore >= currScore ? prev : current;
              });
              setMatchResult({
                  winnerId: matchConfig.tournamentPlayerIds?.[winner.id] || String(winner.id),
                  score1: playersData[0].setsWon > 0 ? playersData[0].setsWon : playersData[0].legsWon,
                  score2: playersData[1].setsWon > 0 ? playersData[1].setsWon : playersData[1].legsWon,
                  tournamentMatchId: matchConfig.tournamentMatchId,
                  isGroupMatch: matchConfig.isGroupMatch
              });
              if (matchConfig.gameMode === 'career' && winner.id === 0) {
                  const previous = Number(localStorage.getItem('dartisan_career_stage') || 0);
                  localStorage.setItem('dartisan_career_stage', String(nextCareerStage(previous, matchConfig.careerStage || 0, winner.id)));
              }
              if (matchConfig.isCustomTournamentMatch) setCurrentScreen('custom_tournament');
              else setCurrentScreen('setup'); 
          }}
        />
      )}

      {currentScreen === 'custom_tournament' && tournamentConfig && (
        <TournamentBracket
          config={tournamentConfig}
          liveMatchResult={matchResult} 
          onBack={() => setCurrentScreen('setup')}
          onPlayMatch={(generatedMatchConfig) => {
              setMatchConfig({...generatedMatchConfig, isCustomTournamentMatch: true});
              setMatchResult(null);
              setCurrentScreen('match');
          }}
        />
      )}

      {currentScreen === 'coach' && (
        <AiCoach
          onBack={() => setCurrentScreen('setup')}
          onStartDrill={(drillConfig) => {
              setMatchConfig(drillConfig);
              setCurrentScreen('match');
          }}
        />
      )}

      {currentScreen === 'profile' && (
        <ProfileScreen onBack={() => setCurrentScreen('setup')} />
      )}
    </main>
  );
}
