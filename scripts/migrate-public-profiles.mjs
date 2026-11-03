// One-time migration while the old Firestore rules still permit reading users.
// Run without --apply to count candidates; --apply copies only allowlisted fields.
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocsFromServer, getFirestore, terminate, writeBatch } from 'firebase/firestore';

const app = initializeApp({ projectId: 'dartisan-ca6e4' });
const db = getFirestore(app);
const fields = [
  'name', 'displayName', 'photoURL', 'selectedAvatar', 'tag', 'xp', 'weeklyXp',
  'matchesWon', 'matchesPlayed', 'totalDarts', 'totalPoints', 'count100',
  'count140', 'count180', 'checkoutAttempts', 'checkoutSuccess', 'first9Points',
  'first9Darts', 'highestCheckout', 'clubId',
];

try {
  const users = await getDocsFromServer(collection(db, 'users'));
  const profiles = users.docs.flatMap(user => {
    const source = user.data();
    const data = Object.fromEntries(fields
      .filter(field => source[field] !== undefined)
      .map(field => [field, source[field]]));
    return data.name || data.displayName ? [{ uid: user.id, data }] : [];
  });
  console.log(`Private user documents: ${users.size}; public profile candidates: ${profiles.length}`);

  if (process.argv.includes('--apply')) {
    for (let offset = 0; offset < profiles.length; offset += 400) {
      const batch = writeBatch(db);
      for (const profile of profiles.slice(offset, offset + 400)) {
        batch.set(doc(db, 'publicProfiles', profile.uid), profile.data, { merge: true });
      }
      await batch.commit();
    }
    const migrated = await getDocsFromServer(collection(db, 'publicProfiles'));
    console.log(`Public profiles after migration: ${migrated.size}`);
  }
} finally {
  await terminate(db);
}
