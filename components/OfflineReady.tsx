'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';

const subscribeConnection = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};

export function OfflineReady() {
  const offline = useSyncExternalStore(subscribeConnection, () => !navigator.onLine, () => false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => console.error('Offline setup failed', error));
    }
  }, []);

  if (!offline) return null;
  return <div role="status" className="fixed inset-x-0 top-0 z-[200] bg-amber-500 px-4 py-2 text-center text-xs font-bold text-slate-950 shadow-lg">
    Offline mód: a helyi meccsek működnek, az online funkciókhoz internet kell. / Offline: local matches are available; online features need a connection.
  </div>;
}
