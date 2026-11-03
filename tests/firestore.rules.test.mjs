import test, { after, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs,
  increment, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';

let env;
const projectId = 'dartisan-rules-test';

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

test('private user documents and nested history are owner-only', async () => {
  const owner = env.authenticatedContext('owner').firestore();
  const stranger = env.authenticatedContext('stranger').firestore();
  const signedOut = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(owner, 'users/owner'), { email: 'private@example.invalid', xp: 0 }));
  await assertSucceeds(getDoc(doc(owner, 'users/owner')));
  await assertFails(getDoc(doc(stranger, 'users/owner')));
  await assertFails(getDoc(doc(signedOut, 'users/owner')));
  await assertFails(updateDoc(doc(stranger, 'users/owner'), { xp: 999 }));
  await assertFails(getDocs(collection(stranger, 'users')));
  await assertSucceeds(setDoc(doc(owner, 'users/owner/matchHistory/m1'), { score: '1-0' }));
  await assertFails(getDoc(doc(stranger, 'users/owner/matchHistory/m1')));
});

test('public profile contains only allowlisted fields and only owner may write', async () => {
  const owner = env.authenticatedContext('owner').firestore();
  const stranger = env.authenticatedContext('stranger').firestore();
  const signedOut = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(owner, 'publicProfiles/owner'), { name: 'Player', xp: 0 }));
  await assertSucceeds(getDoc(doc(stranger, 'publicProfiles/owner')));
  await assertFails(getDoc(doc(signedOut, 'publicProfiles/owner')));
  await assertFails(setDoc(doc(owner, 'publicProfiles/owner'), { email: 'private@example.invalid' }, { merge: true }));
  await assertFails(updateDoc(doc(stranger, 'publicProfiles/owner'), { xp: 999 }));
});

test('room invite, participant updates and host cancellation', async () => {
  const host = env.authenticatedContext('host').firestore();
  const guest = env.authenticatedContext('guest').firestore();
  const intruder = env.authenticatedContext('intruder').firestore();
  const room = {
    status: 'waiting', hostName: 'Host', hostUid: 'host', guestName: null,
    guestUid: null, createdAt: serverTimestamp(),
    config: { startingScore: 501, setsToWin: 1, legsToWin: 3, checkIn: 'single', checkout: 'double' },
    state: { currentLeg: 1, currentSet: 1, hostDarts: null, guestDarts: null,
      hostSetsWon: 0, guestSetsWon: 0, hostLegsWon: 0, guestLegsWon: 0, winner: null },
  };
  const firstRoom = 'matches/DART-000000000001';
  const secondRoom = 'matches/DART-000000000002';
  await assertSucceeds(setDoc(doc(host, firstRoom), room));
  await assertSucceeds(getDoc(doc(guest, firstRoom)));
  await assertFails(getDoc(doc(guest, 'matches/DART-4410')));
  await assertFails(getDocs(collection(guest, 'matches')));
  await assertFails(updateDoc(doc(host, firstRoom), { status: 'playing', guestUid: 'host', guestName: 'Host' }));
  await assertSucceeds(updateDoc(doc(guest, firstRoom), { status: 'playing', guestUid: 'guest', guestName: 'Guest' }));
  await assertFails(updateDoc(doc(intruder, firstRoom), { 'state.guestDarts': 12 }));
  await assertFails(updateDoc(doc(guest, firstRoom), { 'state.hostDarts': 12 }));
  await assertSucceeds(updateDoc(doc(guest, firstRoom), { 'state.guestDarts': 21 }));
  await assertFails(updateDoc(doc(guest, firstRoom), { 'state.guestDarts': 22 }));
  await assertSucceeds(updateDoc(doc(host, firstRoom), { 'state.hostDarts': 18 }));
  await assertSucceeds(updateDoc(doc(host, firstRoom), {
    'state.hostDarts': null, 'state.guestDarts': null,
    'state.hostLegsWon': 0, 'state.hostSetsWon': 1,
    'state.currentLeg': 2, 'state.winner': 'host',
    'state.resolvedLeg': { number: 1, winner: 'host', setEnded: true, matchEnded: true },
  }));
  await assertFails(updateDoc(doc(guest, firstRoom), { 'state.guestDarts': 10 }));
  await assertFails(deleteDoc(doc(host, firstRoom)));
  await assertSucceeds(setDoc(doc(host, secondRoom), room));
  await assertFails(deleteDoc(doc(guest, secondRoom)));
  await assertSucceeds(deleteDoc(doc(host, secondRoom)));
});

test('club membership is self-service and XP awards are bounded', async () => {
  const owner = env.authenticatedContext('club-owner').firestore();
  const guest = env.authenticatedContext('club-guest').firestore();
  await assertSucceeds(setDoc(doc(owner, 'clubs/c1'), {
    name: 'Club', ownerId: 'club-owner', members: ['club-owner'], totalXp: 0,
  }));
  await assertSucceeds(updateDoc(doc(guest, 'clubs/c1'), { members: arrayUnion('club-guest') }));
  await assertFails(updateDoc(doc(guest, 'clubs/c1'), { members: arrayUnion('third-person') }));
  await assertSucceeds(updateDoc(doc(guest, 'clubs/c1'), { totalXp: increment(100) }));
  await assertFails(updateDoc(doc(guest, 'clubs/c1'), { totalXp: increment(1000) }));
  await assertSucceeds(updateDoc(doc(guest, 'clubs/c1'), { members: arrayRemove('club-guest') }));
});
