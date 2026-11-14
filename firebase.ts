import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, OAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// IDE MÁSOLD BE A SAJÁT FIREBASE KULCSAIDAT!
const firebaseConfig = {
  apiKey: "AIzaSyDLIn8ZcAn_hgScQ2TnTCkD3KZTje88ySE",
  authDomain: "dartisan-ca6e4.firebaseapp.com",
  projectId: "dartisan-ca6e4",
  storageBucket: "dartisan-ca6e4.firebasestorage.app",
  messagingSenderId: "162641538605",
  appId: "1:162641538605:web:cf1e5636f7308b7857d2a4"
};

// App inicializálása (biztosítjuk, hogy Next.js alatt ne fusson le többször)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Szolgáltatások exportálása
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'europe-west1');

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === 'true'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  const testWindow = window as Window & { __dartisanEmulatorsConnected?: boolean };
  if (!testWindow.__dartisanEmulatorsConnected) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    testWindow.__dartisanEmulatorsConnected = true;
  }
}

// Bejelentkezési Providerek (Google és Apple)
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
