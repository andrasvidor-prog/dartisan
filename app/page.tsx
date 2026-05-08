'use client';

import { useState, useEffect } from 'react';
import { SetupScreen } from '../components/SetupScreen';
import { MatchScreen } from '../components/MatchScreen';
import ProfileScreen from '../components/ProfileScreen';
import { TournamentBracket } from '../components/TournamentBracket';
import { CareerBracket } from '../components/CareerBracket';
import { AiCoach } from '../components/AiCoach';
import { TournamentScreen } from '../components/TournamentScreen';
import { SettingsScreen } from '../components/SettingsScreen';
import { ClubScreen } from '../components/ClubScreen'; 
import { auth, db } from '../firebase'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export type Language = 'hu' | 'en';

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<'setup' | 'match' | 'profile' | 'career' | 'coach' | 'custom_tournament' | 'settings' | 'club'>('setup');
  const [lang, setLang] = useState<Language>('hu');
  const [matchConfig, setMatchConfig] = useState<any>(null);
  const [matchResult, setMatchResult] = useState<any>(null); 
  const [isMounted, setIsMounted] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<any>(null); 
  const [userLevel, setUserLevel] = useState(1);
  const [userStreak, setUserStreak] = useState(1);

  const [tournamentConfig, setTournamentConfig] = useState<any>(null);
  const [showTournament, setShowTournament] = useState(false);

  useEffect(() => { 
      setIsMounted(true); 
      const savedLang = localStorage.getItem('dartisan_lang') as Language;
      if (savedLang) setLang(savedLang);

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
              const docRef = doc(db, 'users', user.uid);
              const docSnap = await getDoc(docRef);
              const todayStr = new Date().toISOString().split('T')[0];

              if (docSnap.exists()) {
                  const data = docSnap.data();
                  setCurrentUser({ ...user, ...data });
                  setUserLevel(Math.floor(Math.sqrt(Math.max(data.xp || 0, 0) / 100)) + 1);

                  // --- NAPI STREAK LOGIKA ---
                  let currentStreak = data.streak || 1;
                  const lastLogin = data.lastLogin;

                  if (lastLogin && lastLogin !== todayStr) {
                      const lastDate = new Date(lastLogin);
                      const todayDate = new Date(todayStr);
                      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

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
                  await setDoc(docRef, { 
                      name: displayName, email: user.email, photoURL: user.photoURL, 
                      tag: randomTag, xp: 0, weeklyXp: 0, matchesWon: 0, 
                      createdAt: new Date(), lastLogin: todayStr, streak: 1 
                  });
                  setCurrentUser({ ...user, displayName, tag: randomTag });
                  setUserLevel(1);
                  setUserStreak(1);
              }
          } else {
              setCurrentUser(null);
          }
      });
      return () => unsubscribe();
  }, [currentScreen]);

  if (!isMounted) return null;

  return (
    <main className="relative h-[100dvh] w-full bg-[#0b0d11] text-slate-200 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar">
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { display: none !important; }
        * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
      `}} />
      
      {currentScreen === 'settings' && (
        <SettingsScreen onBack={() => setCurrentScreen('setup')} />
      )}

      {currentScreen === 'club' && (
        <ClubScreen 
            onBack={() => setCurrentScreen('setup')} 
            currentUser={currentUser} 
        />
      )}
      
      {currentScreen === 'setup' && (
        <SetupScreen 
          lang={lang} 
          userLevel={userLevel}
          userStreak={userStreak}
          onStart={(config) => { 
            setMatchConfig(config);
            if (config.gameMode === 'career') {
                setCurrentScreen('career');
            } else {
                setMatchResult(null); 
                setCurrentScreen('match'); 
            }
          }} 
          onOpenProfile={() => setCurrentScreen('profile')} 
          onOpenCoach={() => setCurrentScreen('coach')}
          onStartTournament={() => setShowTournament(true)} 
          onOpenSettings={() => setCurrentScreen('settings')}
          onOpenClub={() => setCurrentScreen('club')} 
        />
      )}

      {showTournament && (
        <TournamentScreen 
          onBack={() => setShowTournament(false)}
          onStartTournament={(config: any) => {
              setShowTournament(false);
              setTournamentConfig(config);
              setCurrentScreen('custom_tournament');
          }}
        />
      )}

      {currentScreen === 'match' && matchConfig && (
        <MatchScreen 
          config={matchConfig} 
          lang={lang} 
          onBackToSetup={() => {
              if (matchConfig.isCustomTournamentMatch) {
                  setCurrentScreen('custom_tournament');
              } else if (matchConfig.gameMode === 'career') {
                  setCurrentScreen('career'); 
              } else {
                  setCurrentScreen('setup'); 
              }
          }}
          onMatchComplete={(playersData) => {
              const winner = playersData.reduce((prev: any, current: any) => (prev.setsWon > current.setsWon || prev.legsWon > current.legsWon) ? prev : current);
              setMatchResult({
                  winnerId: winner.id,
                  score1: playersData[0].setsWon > 0 ? playersData[0].setsWon : playersData[0].legsWon,
                  score2: playersData[1].setsWon > 0 ? playersData[1].setsWon : playersData[1].legsWon,
                  tournamentMatchId: matchConfig.tournamentMatchId,
                  isGroupMatch: matchConfig.isGroupMatch
              });
              if (matchConfig.gameMode === 'career') setCurrentScreen('career'); 
              else if (matchConfig.isCustomTournamentMatch) setCurrentScreen('custom_tournament');
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

      {currentScreen === 'career' && matchConfig && (
        <CareerBracket
          userPlayer={matchConfig.players[0]} 
          matchResult={matchResult} 
          onBack={() => setCurrentScreen('setup')}
          onPlayMatch={(opponent) => {
              setMatchConfig({
                  ...matchConfig,
                  players: [matchConfig.players[0], opponent]
              });
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