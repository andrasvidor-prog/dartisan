import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, deleteUser } from 'firebase/auth';
import {
  getFirestore, doc, getDocFromServer, runTransaction, serverTimestamp,
  updateDoc, deleteDoc, disableNetwork, enableNetwork,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDLIn8ZcAn_hgScQ2TnTCkD3KZTje88ySE',
  authDomain: 'dartisan-ca6e4.firebaseapp.com',
  projectId: 'dartisan-ca6e4',
  appId: '1:162641538605:web:cf1e5636f7308b7857d2a4',
};

async function client(name) {
  const app = initializeApp(firebaseConfig, `dartisan-online-${name}-${crypto.randomUUID()}`);
  const auth = getAuth(app);
  const user = (await signInAnonymously(auth)).user;
  return { app, auth, user, db: getFirestore(app) };
}

const clients = [];
let roomPath;
let roomOwner;
let winningGuest;

try {
  const host = await client('host'); clients.push(host);
  const guestA = await client('guest-a'); clients.push(guestA);
  const guestB = await client('guest-b'); clients.push(guestB);
  roomOwner = host;
  roomPath = `matches/DART-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const roomRef = doc(host.db, roomPath);
  await runTransaction(host.db, async transaction => {
    if ((await transaction.get(roomRef)).exists()) throw new Error('Room code collision');
    transaction.set(roomRef, {
      status: 'waiting', hostName: 'Online smoke host', hostUid: host.user.uid,
      guestName: null, guestUid: null, createdAt: serverTimestamp(),
      config: { startingScore: 301, setsToWin: 1, legsToWin: 1, checkIn: 'single', checkout: 'double' },
      state: { currentLeg: 1, currentSet: 1, hostDarts: null, guestDarts: null,
        hostSetsWon: 0, guestSetsWon: 0, hostLegsWon: 0, guestLegsWon: 0, winner: null },
    });
  });
  console.log('Room created by host');

  const join = guest => runTransaction(guest.db, async transaction => {
    const ref = doc(guest.db, roomPath);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists() || snapshot.data().status !== 'waiting') throw new Error('Room already taken');
    transaction.update(ref, { status: 'playing', guestName: guest === guestA ? 'Guest A' : 'Guest B', guestUid: guest.user.uid });
  });
  const attempts = await Promise.allSettled([join(guestA), join(guestB)]);
  assert.equal(attempts.filter(attempt => attempt.status === 'fulfilled').length, 1);
  const joinedRoom = (await getDocFromServer(roomRef)).data();
  winningGuest = joinedRoom.guestUid === guestA.user.uid ? guestA : guestB;
  assert.equal(joinedRoom.status, 'playing');
  console.log('Concurrent join: exactly one guest admitted');

  await disableNetwork(winningGuest.db);
  await enableNetwork(winningGuest.db);
  const reconnectedRoom = await getDocFromServer(doc(winningGuest.db, roomPath));
  assert.equal(reconnectedRoom.data().guestUid, winningGuest.user.uid);
  console.log('Guest connection restored and room reloaded');

  await updateDoc(doc(winningGuest.db, roomPath), { 'state.guestDarts': 27 });
  await updateDoc(roomRef, { 'state.hostDarts': 24 });
  await runTransaction(host.db, async transaction => {
    const current = (await transaction.get(roomRef)).data();
    assert.equal(current.state.hostDarts, 24);
    assert.equal(current.state.guestDarts, 27);
    transaction.update(roomRef, {
      'state.hostDarts': null, 'state.guestDarts': null,
      'state.hostLegsWon': 0, 'state.guestLegsWon': 0,
      'state.hostSetsWon': 1, 'state.guestSetsWon': 0,
      'state.currentLeg': 2, 'state.winner': 'host',
      'state.resolvedLeg': { number: 1, winner: 'host', setEnded: true, matchEnded: true },
    });
  });
  assert.equal((await getDocFromServer(doc(winningGuest.db, roomPath))).data().state.winner, 'host');
  console.log('Both clients completed the match');
  await deleteDoc(roomRef);
  roomPath = undefined;
  console.log('Completed room deleted');
} finally {
  if (roomPath && roomOwner) {
    try {
      const ref = doc(roomOwner.db, roomPath);
      const snapshot = await getDocFromServer(ref);
      if (snapshot.exists() && snapshot.data().status === 'playing' && winningGuest) {
        if (snapshot.data().state.guestDarts === null) await updateDoc(doc(winningGuest.db, roomPath), { 'state.guestDarts': 30 });
        if (snapshot.data().state.hostDarts === null) await updateDoc(ref, { 'state.hostDarts': 30 });
        const state = (await getDocFromServer(ref)).data().state;
        if (!state.winner) {
          const winner = state.hostDarts <= state.guestDarts ? 'host' : 'guest';
          await updateDoc(ref, {
            'state.hostDarts': null, 'state.guestDarts': null,
            'state.hostLegsWon': 0, 'state.guestLegsWon': 0,
            'state.hostSetsWon': winner === 'host' ? 1 : 0,
            'state.guestSetsWon': winner === 'guest' ? 1 : 0,
            'state.currentLeg': 2, 'state.winner': winner,
            'state.resolvedLeg': { number: 1, winner, setEnded: true, matchEnded: true },
          });
        }
      }
      if (snapshot.exists()) await deleteDoc(ref);
      console.log('Test room cleanup confirmed');
    } catch (error) { console.error(`Room cleanup failed for ${roomPath}:`, error); }
  }
  for (const item of clients) {
    try { await deleteUser(item.user); }
    catch (error) { console.error('Test identity cleanup failed:', error); }
    await deleteApp(item.app);
  }
}
