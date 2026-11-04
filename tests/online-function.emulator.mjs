import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const projectId = 'dartisan-rules-test';
const clients = [];

async function client(name, registered = false) {
  const app = initializeApp({ apiKey: 'test-api-key', authDomain: 'localhost', projectId, appId: 'test-app' }, `${name}-${crypto.randomUUID()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, 'europe-west1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const user = (registered
    ? await createUserWithEmailAndPassword(auth, `${name}-${crypto.randomUUID()}@example.invalid`, 'Temporary-Test-Password-123')
    : await signInAnonymously(auth)).user;
  const result = { app, db, functions, user };
  clients.push(result);
  return result;
}

try {
  const host = await client('host', true);
  const guest = await client('guest', true);
  const intruder = await client('intruder');
  await httpsCallable(host.functions, 'syncLoginStreak')({});
  await httpsCallable(guest.functions, 'syncLoginStreak')({});
  const roomId = 'DART-000000000088';
  const hostRef = doc(host.db, 'matches', roomId);
  await setDoc(hostRef, {
    status: 'waiting', hostName: 'Host', hostUid: host.user.uid,
    guestName: null, guestUid: null, createdAt: serverTimestamp(),
    config: { startingScore: 301, setsToWin: 1, legsToWin: 1, checkIn: 'single', checkout: 'double' },
    state: { currentLeg: 1, currentSet: 1, hostDarts: null, guestDarts: null,
      hostSetsWon: 0, guestSetsWon: 0, hostLegsWon: 0, guestLegsWon: 0, winner: null },
  });
  await updateDoc(doc(guest.db, 'matches', roomId), { status: 'playing', guestName: 'Guest', guestUid: guest.user.uid });
  const hostSubmit = httpsCallable(host.functions, 'submitOnlineLeg');
  const guestSubmit = httpsCallable(guest.functions, 'submitOnlineLeg');
  const intruderSubmit = httpsCallable(intruder.functions, 'submitOnlineLeg');
  await assert.rejects(() => intruderSubmit({ roomId, darts: 20, expectedLeg: 1 }), error => error.code === 'functions/permission-denied');
  await assert.rejects(() => hostSubmit({ roomId, darts: 0, expectedLeg: 1 }), error => error.code === 'functions/invalid-argument');
  assert.equal((await hostSubmit({ roomId, darts: 24, expectedLeg: 1 })).data.status, 'waiting');
  assert.equal((await hostSubmit({ roomId, darts: 24, expectedLeg: 1 })).data.status, 'waiting');
  const result = (await guestSubmit({ roomId, darts: 27, expectedLeg: 1 })).data;
  assert.deepEqual(result, { status: 'resolved', winner: 'host', setEnded: true, matchEnded: true });
  assert.equal((await getDoc(hostRef)).data().state.winner, 'host');
  assert.equal((await getDoc(doc(host.db, 'users', host.user.uid))).data().xp, 50);
  assert.equal((await getDoc(doc(guest.db, 'users', guest.user.uid))).data().xp, 10);
  assert.equal((await getDoc(doc(host.db, 'publicProfiles', host.user.uid))).data().weeklyXp, 50);
  const localAward = httpsCallable(host.functions, 'awardLocalMatch');
  const matchId = crypto.randomUUID();
  const summary = { matchId, mode: 'x01', won: true, metrics: {
    totalDarts: 9, totalPoints: 301, count100: 1, count140: 0, count180: 0,
    checkoutAttempts: 1, checkoutSuccess: 1, first9Points: 301, first9Darts: 9, highestCheckout: 40,
  } };
  await assert.rejects(() => localAward({ ...summary, metrics: { ...summary.metrics, totalPoints: 900 } }),
    error => error.code === 'functions/invalid-argument');
  assert.deepEqual((await localAward(summary)).data, { xp: 20, duplicate: false });
  assert.deepEqual((await localAward(summary)).data, { xp: 20, duplicate: true });
  const localProfile = (await getDoc(doc(host.db, 'users', host.user.uid))).data();
  assert.equal(localProfile.xp, 70);
  assert.equal(localProfile.weeklyXp, 50);
  assert.equal((await httpsCallable(host.functions, 'syncLoginStreak')({})).data.streak, 1);
  assert.equal((await hostSubmit({ roomId, darts: 24, expectedLeg: 1 })).data.status, 'resolved');
  await deleteDoc(hostRef);
  console.log('Server validated participants and darts, resolved the leg once, and allowed room cleanup.');
} finally {
  for (const item of clients) {
    try { await deleteUser(item.user); } catch { /* emulator cleanup */ }
    await deleteApp(item.app);
  }
}
