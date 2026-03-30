import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

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

// Bejelentkezési Providerek (Google és Apple)
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');