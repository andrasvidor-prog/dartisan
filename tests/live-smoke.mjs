import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, signInAnonymously, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, deleteUser,
} from 'firebase/auth';
import {
  getFirestore, collection, doc, getDocsFromServer,
  runTransaction, serverTimestamp,
} from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDLIn8ZcAn_hgScQ2TnTCkD3KZTje88ySE',
  authDomain: 'dartisan-ca6e4.firebaseapp.com',
  projectId: 'dartisan-ca6e4',
  appId: '1:162641538605:web:cf1e5636f7308b7857d2a4',
}, 'dartisan-live-smoke');
const db = getFirestore(app);
const auth = getAuth(app);
let user = null;
let room = null;

async function expectDenied(label, fn) {
  try {
    await fn();
    throw new Error(`${label} unexpectedly allowed`);
  } catch (error) {
    if (error.code !== 'permission-denied') throw error;
    console.log(`${label}: denied as expected`);
  }
}

async function deleteRoomIfPresent() {
  if (!room || !user) return;
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(room);
    if (snapshot.exists()) transaction.delete(room);
  });
  room = null;
}

try {
  await expectDenied('Private user list', () => getDocsFromServer(collection(db, 'users')));
  await expectDenied('Room list', () => getDocsFromServer(collection(db, 'matches')));
  user = (await signInAnonymously(auth)).user;
  console.log('Anonymous sign-in: success');
  room = doc(db, 'matches', `DART-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`);
  await runTransaction(db, async transaction => {
    if ((await transaction.get(room)).exists()) throw new Error('Room code collision');
    transaction.set(room, {
      status: 'waiting',
      config: { startingScore: 301, setsToWin: 1, legsToWin: 1, checkIn: 'single', checkout: 'double' },
      state: {
        currentLeg: 1, currentSet: 1, hostDarts: null, guestDarts: null,
        hostSetsWon: 0, guestSetsWon: 0, hostLegsWon: 0, guestLegsWon: 0, winner: null,
      },
      hostName: 'Dartisan Smoke Test', hostUid: user.uid,
      guestName: null, guestUid: null, createdAt: serverTimestamp(),
    });
  });
  console.log('Host room create: success');
  await deleteRoomIfPresent();
  console.log('Host room cleanup: success');
  await deleteUser(user);
  user = null;
  console.log('Anonymous test identity cleanup: success');

  const email = `dartisan-smoke-${crypto.randomUUID()}@example.invalid`;
  const password = crypto.randomUUID() + 'A1!';
  user = (await createUserWithEmailAndPassword(auth, email, password)).user;
  console.log('Email registration: success');
  await signOut(auth);
  user = (await signInWithEmailAndPassword(auth, email, password)).user;
  console.log('Email/password sign-in: success');
  await deleteUser(user);
  user = null;
  console.log('Email test identity cleanup: success');
} finally {
  if (room) {
    try { await deleteRoomIfPresent(); }
    catch (error) { console.error('Room cleanup failed:', error.message); }
  }
  if (user) {
    try { await deleteUser(user); console.log('Anonymous test identity cleanup: success'); }
    catch (error) { console.error('Identity cleanup failed:', error.message); }
  }
  await deleteApp(app);
}
