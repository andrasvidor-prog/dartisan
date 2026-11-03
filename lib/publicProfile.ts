import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Only these fields may be copied from a private user document into the
// searchable leaderboard/profile collection. In particular, email, friends,
// settings, coach plans and match history stay private.
export const PUBLIC_PROFILE_FIELDS = [
  'name', 'displayName', 'photoURL', 'selectedAvatar', 'tag', 'xp', 'weeklyXp',
  'matchesWon', 'matchesPlayed', 'totalDarts', 'totalPoints', 'count100',
  'count140', 'count180', 'checkoutAttempts', 'checkoutSuccess', 'first9Points',
  'first9Darts', 'highestCheckout', 'clubId',
] as const;

export function publicProfileData(source: Record<string, unknown>) {
  const publicData: Record<string, unknown> = {};
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (source[field] !== undefined) publicData[field] = source[field];
  }
  return publicData;
}

export async function syncPublicProfile(uid: string, source: Record<string, unknown>) {
  const data = publicProfileData(source);
  if (!data.name && !data.displayName) return;
  await setDoc(doc(db, 'publicProfiles', uid), data, { merge: true });
}
