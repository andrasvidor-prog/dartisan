import test, { after, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let environment;
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'dartisan-secure-rules-test',
    firestore: { rules: readFileSync(new URL('../firestore.secure.rules', import.meta.url), 'utf8') },
  });
  await environment.withSecurityRulesDisabled(async context => {
    const database = context.firestore();
    await setDoc(doc(database, 'users/owner'), { name: 'Owner', xp: 20, streak: 2, email: 'private@example.invalid' });
    await setDoc(doc(database, 'publicProfiles/owner'), { name: 'Owner', xp: 20, weeklyXp: 5 });
    await setDoc(doc(database, 'clubs/club'), { name: 'Club', ownerId: 'owner', members: ['owner'], totalXp: 20, maxMembers: 25 });
    await setDoc(doc(database, 'users/owner/awards/award'), { xp: 20, verified: true });
  });
});
after(async () => environment?.cleanup());

test('private rewards stay server controlled while personal settings and history remain usable', async () => {
  const owner = environment.authenticatedContext('owner').firestore();
  const stranger = environment.authenticatedContext('stranger').firestore();
  await assertSucceeds(updateDoc(doc(owner, 'users/owner'), { name: 'New name', settings: { sound: false } }));
  await assertSucceeds(setDoc(doc(owner, 'users/owner/matchHistory/match'), { result: '1-0' }));
  await assertSucceeds(getDoc(doc(owner, 'users/owner/awards/award')));
  await assertFails(updateDoc(doc(owner, 'users/owner'), { xp: 100000 }));
  await assertFails(updateDoc(doc(owner, 'users/owner'), { streak: 999 }));
  await assertFails(setDoc(doc(owner, 'users/owner/awards/forged'), { xp: 100000 }));
  await assertFails(setDoc(doc(owner, 'users/brand-new'), { name: 'Forged' }));
  await assertFails(getDoc(doc(stranger, 'users/owner')));
  await assertFails(getDoc(doc(stranger, 'users/owner/matchHistory/match')));
});

test('leaderboard and club XP cannot be changed by clients', async () => {
  const owner = environment.authenticatedContext('owner').firestore();
  const guest = environment.authenticatedContext('guest').firestore();
  await assertSucceeds(updateDoc(doc(owner, 'publicProfiles/owner'), { name: 'New name' }));
  await assertFails(updateDoc(doc(owner, 'publicProfiles/owner'), { xp: 100000 }));
  await assertFails(updateDoc(doc(owner, 'publicProfiles/owner'), { weeklyXp: 100000 }));
  await assertFails(updateDoc(doc(guest, 'publicProfiles/owner'), { name: 'Intruder' }));
  await assertSucceeds(updateDoc(doc(guest, 'clubs/club'), { members: arrayUnion('guest') }));
  await assertFails(updateDoc(doc(guest, 'clubs/club'), { totalXp: 100000 }));
  await assertFails(deleteDoc(doc(owner, 'clubs/club')));
  await assertSucceeds(updateDoc(doc(owner, 'clubs/club'), { ownerId: 'guest', members: ['guest'] }));
  await assertSucceeds(deleteDoc(doc(guest, 'clubs/club')));
});

test('rooms allow creation, one guest join and host deletion, with match state reserved for server', async () => {
  const host = environment.authenticatedContext('host').firestore();
  const guest = environment.authenticatedContext('guest').firestore();
  const room = 'matches/DART-ABCDEF012345';
  await assertSucceeds(setDoc(doc(host, room), {
    status: 'waiting', hostName: 'Host', hostUid: 'host', guestName: null, guestUid: null,
    createdAt: serverTimestamp(),
    config: { startingScore: 501, setsToWin: 1, legsToWin: 1, checkIn: 'single', checkout: 'double' },
    state: { currentLeg: 1, currentSet: 1, hostDarts: null, guestDarts: null,
      hostSetsWon: 0, guestSetsWon: 0, hostLegsWon: 0, guestLegsWon: 0, winner: null },
  }));
  await assertSucceeds(updateDoc(doc(guest, room), { status: 'playing', guestUid: 'guest', guestName: 'Guest' }));
  await assertFails(updateDoc(doc(guest, room), { 'state.guestDarts': 15 }));
  await assertFails(updateDoc(doc(host, room), { 'state.hostDarts': 12 }));
  await assertFails(deleteDoc(doc(guest, room)));
  await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), room), { 'state.winner': 'host' }));
  await assertSucceeds(deleteDoc(doc(host, room)));
});
