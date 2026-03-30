'use client';

import { useState, useEffect } from 'react';
import { SetupScreen } from '../components/SetupScreen';
import { MatchScreen } from '../components/MatchScreen';
import ProfileScreen from '../components/ProfileScreen';

// FONTOS: Ez javítja ki a piros hibaüzeneteket a SetupScreen-ben!
export type Language = 'hu' | 'en';

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<'setup' | 'match' | 'profile'>('setup');
  const [lang, setLang] = useState<Language>('hu');
  const [matchConfig, setMatchConfig] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;

  return (
    <main className="h-screen w-full bg-[#0b0d11] text-slate-200 overflow-hidden relative">
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { display: none !important; }
        * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
      `}} />
      
      {currentScreen === 'setup' && (
        <SetupScreen 
          lang={lang} 
          onStart={(config) => { setMatchConfig(config); setCurrentScreen('match'); }} 
          onOpenProfile={() => setCurrentScreen('profile')} 
          onToggleLang={() => setLang(lang === 'hu' ? 'en' : 'hu')} 
        />
      )}

      {currentScreen === 'match' && matchConfig && (
        <MatchScreen 
          config={matchConfig} 
          lang={lang} 
          onBackToSetup={() => setCurrentScreen('setup')} 
        />
      )}

      {currentScreen === 'profile' && (
        <ProfileScreen onBack={() => setCurrentScreen('setup')} />
      )}
    </main>
  );
}