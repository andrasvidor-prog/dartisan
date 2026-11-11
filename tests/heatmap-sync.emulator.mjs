import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import { matchHeatmapEvent, hunterHeatmapEvent, reverseHeatmapEvent, persistHeatmapEvent, enqueueHeatmapEvent, flushHeatmapQueue, readHeatmapQueue } from '../lib/heatmapSync.ts';

const projectId = 'dartisan-rules-test';
const createClient = async (name) => {
  const app = initializeApp({ apiKey: 'test-api-key', authDomain: 'localhost', projectId, appId: 'test-app' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const database = getFirestore(app);
  connectFirestoreEmulator(database, '127.0.0.1', 8080);
  const user = (await signInAnonymously(auth)).user;
  return { app, database, user };
};

const storage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
};

const client = await createClient('heatmap-sync-test');
try {
  const uid = client.user.uid;
  const setup = 'test-setup';
  const t20 = matchHeatmapEvent(uid, setup, 20, 3, 'T20');
  const s20 = matchHeatmapEvent(uid, setup, 20, 1, 'T20');
  const miss = matchHeatmapEvent(uid, setup, 0, 1, 'T20');
  assert.ok(t20 && s20 && miss);
  await Promise.all([persistHeatmapEvent(client.database, t20), persistHeatmapEvent(client.database, s20)]);
  await persistHeatmapEvent(client.database, t20);
  await persistHeatmapEvent(client.database, miss);
  const hunter = hunterHeatmapEvent(uid, setup, 'D16', 2);
  await persistHeatmapEvent(client.database, hunter);
  await persistHeatmapEvent(client.database, reverseHeatmapEvent(s20));

  const landing = (await getDoc(doc(client.database, 'users', uid, 'stats', 'landings', 'setups', `${setup}_match`))).data();
  assert.equal(landing.sectors.T20.hits, 1);
  assert.equal(landing.sectors.S20.hits, 0);
  const aim = (await getDoc(doc(client.database, 'users', uid, 'stats', 'aims', 'targets', `${setup}_match_T20`))).data();
  assert.equal(aim.attempts, 2);
  assert.equal(aim.hits, 1);
  assert.equal(aim.landings.T20, 1);
  assert.equal(aim.landings.S20, 0);
  assert.equal(aim.landings.MISS, 1);
  const training = (await getDoc(doc(client.database, 'users', uid, 'stats', 'aims', 'targets', `${setup}_training_D16`))).data();
  assert.equal(training.attempts, 3);
  assert.equal(training.hits, 2);
  assert.equal(training.unlocatedMisses, 1);
  assert.equal(training.landings.D16, 2);

  const queued = matchHeatmapEvent(uid, setup, 19, 3, 'T19');
  const memory = storage();
  enqueueHeatmapEvent(memory, queued);
  assert.equal(readHeatmapQueue(memory, uid).length, 1);
  assert.deepEqual(await flushHeatmapQueue(client.database, memory, uid), { pending: 0, error: null });
  assert.equal(readHeatmapQueue(memory, uid).length, 0);
  assert.equal((await getDoc(doc(client.database, 'users', uid, 'stats', 'aims', 'targets', `${setup}_match_T19`))).data().hits, 1);
  console.log('Concurrent darts, duplicate events, undo, Hunter accuracy and queued sync passed.');
} finally {
  await deleteApp(client.app);
}
