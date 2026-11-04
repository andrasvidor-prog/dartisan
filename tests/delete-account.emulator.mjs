import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp as initializeClient, deleteApp as deleteClient } from 'firebase/app';
import { getAuth as getClientAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore as getClientFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const requireAdmin = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireAdmin('firebase-admin/app');
const { getAuth: getAdminAuth } = requireAdmin('firebase-admin/auth');
const { getFirestore: getAdminFirestore } = requireAdmin('firebase-admin/firestore');

const projectId = 'dartisan-rules-test';
const adminApp = initializeAdmin({ projectId }, 'delete-account-test');
const adminDb = getAdminFirestore(adminApp);
const clientApp = initializeClient({ apiKey: 'test-api-key', authDomain: 'localhost', projectId, appId: 'test-app' }, 'delete-client-test');
const auth = getClientAuth(clientApp);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const clientDb = getClientFirestore(clientApp);
connectFirestoreEmulator(clientDb, '127.0.0.1', 8080);
const functions = getFunctions(clientApp, 'europe-west1');
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

try {
  const user = (await createUserWithEmailAndPassword(auth, `delete-${crypto.randomUUID()}@example.invalid`, 'Temporary-Test-Password-123')).user;
  const uid = user.uid;
  const friendUid = `friend-${crypto.randomUUID()}`;
  await adminDb.doc(`users/${uid}`).set({ name: 'Delete test', email: 'private@example.invalid' });
  await adminDb.doc(`publicProfiles/${uid}`).set({ name: 'Delete test' });
  await adminDb.doc(`users/${uid}/matchHistory/m1`).set({ score: '1-0' });
  await adminDb.doc(`users/${uid}/coach/plan`).set({ goal: 30 });
  await adminDb.doc(`users/${friendUid}`).set({ friends: [uid] });
  await adminDb.doc('clubs/delete-test').set({ ownerId: uid, members: [uid, friendUid], name: 'Test' });
  await adminDb.doc('matches/DART-000000000099').set({ hostUid: uid, guestUid: friendUid, status: 'playing' });

  const deletion = httpsCallable(functions, 'deleteMyAccount');
  await assert.rejects(() => deletion({ confirm: 'wrong' }), error => error.code === 'functions/invalid-argument');
  assert.deepEqual((await deletion({ confirm: 'DELETE MY ACCOUNT' })).data, { deleted: true });
  assert.equal((await adminDb.doc(`users/${uid}`).get()).exists, false);
  assert.equal((await adminDb.doc(`users/${uid}/matchHistory/m1`).get()).exists, false);
  assert.equal((await adminDb.doc(`users/${uid}/coach/plan`).get()).exists, false);
  assert.equal((await adminDb.doc(`publicProfiles/${uid}`).get()).exists, false);
  assert.equal((await adminDb.doc('matches/DART-000000000099').get()).exists, false);
  assert.deepEqual((await adminDb.doc(`users/${friendUid}`).get()).data().friends, []);
  assert.equal((await adminDb.doc('clubs/delete-test').get()).data().ownerId, friendUid);
  await assert.rejects(() => getAdminAuth(adminApp).getUser(uid), error => error.code === 'auth/user-not-found');
  console.log('Account, nested data, room and friend reference deleted; club ownership transferred.');
} finally {
  await deleteClient(clientApp);
  await deleteAdmin(adminApp);
}
