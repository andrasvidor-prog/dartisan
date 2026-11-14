const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const options = { region: 'europe-west1', timeoutSeconds: 540, memory: '512MiB' };

const utcDay = date => date.toISOString().slice(0, 10);
const utcWeek = date => {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return utcDay(monday);
};

exports.syncLoginStreak = onCall({ region: 'europe-west1' }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to sync your profile.');
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const publicRef = db.doc(`publicProfiles/${uid}`);
  const now = new Date();
  const today = utcDay(now);
  const week = utcWeek(now);
  const identity = {
    name: request.auth.token.name || request.auth.token.email?.split('@')[0] || 'Player',
    photoURL: request.auth.token.picture || null,
  };
  return db.runTransaction(async transaction => {
    const [profile, publicProfile] = await Promise.all([transaction.get(userRef), transaction.get(publicRef)]);
    const data = profile.data() || {};
    const priorDay = typeof data.lastLogin === 'string' ? data.lastLogin : null;
    const elapsedDays = priorDay ? Math.round((Date.parse(today) - Date.parse(priorDay)) / 86400000) : null;
    const streak = elapsedDays === null ? 1 : elapsedDays === 1 ? Math.max(1, data.streak || 1) + 1
      : elapsedDays > 1 ? 1 : Math.max(1, data.streak || 1);
    const weekChanged = data.weekKey !== week;
    const update = {
      lastLogin: today, streak, weekKey: week,
      ...(weekChanged ? { weeklyXp: 0 } : {}),
    };
    if (!profile.exists || !data.createdAt) {
      transaction.set(userRef, {
        name: identity.name, email: request.auth.token.email || null,
        photoURL: identity.photoURL, tag: Math.floor(1000 + Math.random() * 9000),
        xp: 0, matchesWon: 0, matchesPlayed: 0,
        createdAt: FieldValue.serverTimestamp(), ...update,
      }, { merge: true });
    } else transaction.update(userRef, update);
    if (!publicProfile.exists) transaction.set(publicRef, {
      ...identity, xp: Number(data.xp || 0), weeklyXp: weekChanged ? 0 : Number(data.weeklyXp || 0),
      matchesWon: Number(data.matchesWon || 0), matchesPlayed: Number(data.matchesPlayed || 0),
      tag: data.tag || null,
    });
    else if (weekChanged) transaction.update(publicRef, { weeklyXp: 0 });
    return { streak, weeklyXp: weekChanged ? 0 : Number(data.weeklyXp || 0) };
  });
});

function validateSummary(data) {
  if (!data || typeof data !== 'object' || !/^[a-f0-9-]{36}$/i.test(data.matchId || '')
      || !['x01', 'career', 'cricket'].includes(data.mode) || typeof data.won !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Invalid match result.');
  }
  const metrics = data.metrics || {};
  const integers = [
    'totalDarts', 'totalPoints', 'count100', 'count140', 'count180',
    'checkoutAttempts', 'checkoutSuccess', 'first9Points', 'first9Darts', 'highestCheckout',
  ];
  if (integers.some(key => !Number.isInteger(metrics[key]) || metrics[key] < 0)
      || metrics.totalDarts < 1 || metrics.totalDarts > 3000
      || metrics.totalPoints > metrics.totalDarts * 60
      || metrics.first9Darts > metrics.totalDarts
      || metrics.first9Points > metrics.first9Darts * 60
      || metrics.count100 + metrics.count140 + metrics.count180 > Math.ceil(metrics.totalDarts / 3)
      || metrics.checkoutAttempts > metrics.totalDarts
      || metrics.checkoutSuccess > metrics.checkoutAttempts
      || metrics.highestCheckout > 180) {
    throw new HttpsError('invalid-argument', 'Impossible match statistics.');
  }
  return metrics;
}

exports.awardLocalMatch = onCall({ region: 'europe-west1' }, async request => {
  const uid = request.auth?.uid;
  if (!uid || request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('unauthenticated', 'Sign in to earn XP.');
  }
  const result = request.data;
  const metrics = validateSummary(result);
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const publicRef = db.doc(`publicProfiles/${uid}`);
  const awardRef = userRef.collection('awards').doc(result.matchId);
  const now = new Date();
  const today = utcDay(now);
  const week = utcWeek(now);
  return db.runTransaction(async transaction => {
    const [profile, priorAward, publicProfile] = await Promise.all([
      transaction.get(userRef), transaction.get(awardRef), transaction.get(publicRef),
    ]);
    if (priorAward.exists) return { xp: priorAward.data().xp, duplicate: true };
    if (!profile.exists) throw new HttpsError('failed-precondition', 'Profile is not ready.');
    const data = profile.data();
    const usedToday = data.localXpDay === today ? Number(data.localXpToday || 0) : 0;
    const sameWeek = data.weekKey === week;
    const nominalXp = result.won ? (result.mode === 'career' ? 40 : 20) : 5;
    const xp = Math.max(0, Math.min(nominalXp, 200 - usedToday));
    const additions = {
      xp: FieldValue.increment(xp),
      weeklyXp: sameWeek ? FieldValue.increment(xp) : xp,
      weekKey: week,
      matchesPlayed: FieldValue.increment(1),
      matchesWon: FieldValue.increment(result.won ? 1 : 0),
      totalDarts: FieldValue.increment(metrics.totalDarts),
      totalPoints: FieldValue.increment(metrics.totalPoints),
      count100: FieldValue.increment(metrics.count100),
      count140: FieldValue.increment(metrics.count140),
      count180: FieldValue.increment(metrics.count180),
      checkoutAttempts: FieldValue.increment(metrics.checkoutAttempts),
      checkoutSuccess: FieldValue.increment(metrics.checkoutSuccess),
      first9Points: FieldValue.increment(metrics.first9Points),
      first9Darts: FieldValue.increment(metrics.first9Darts),
      highestCheckout: Math.max(Number(data.highestCheckout || 0), metrics.highestCheckout),
    };
    transaction.update(userRef, { ...additions, localXpDay: today, localXpToday: usedToday + xp });
    if (publicProfile.exists) transaction.update(publicRef, additions);
    else transaction.set(publicRef, { name: data.name || 'Player', ...additions });
    transaction.create(awardRef, { mode: result.mode, won: result.won, xp, verified: false,
      createdAt: FieldValue.serverTimestamp() });
    return { xp, duplicate: false };
  });
});

exports.submitOnlineLeg = onCall({ region: 'europe-west1', timeoutSeconds: 30 }, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to play online.');
  const { roomId, darts, expectedLeg } = request.data || {};
  if (typeof roomId !== 'string' || !/^DART-[0-9A-F]{12}$/.test(roomId)
      || !Number.isInteger(darts) || darts < 1 || darts > 10000
      || !Number.isInteger(expectedLeg) || expectedLeg < 1) {
    throw new HttpsError('invalid-argument', 'Invalid online leg submission.');
  }

  const db = getFirestore();
  const roomRef = db.doc(`matches/${roomId}`);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists || snapshot.data().status !== 'playing') {
      throw new HttpsError('not-found', 'Online room is unavailable.');
    }
    const room = snapshot.data();
    const role = room.hostUid === uid ? 'host' : room.guestUid === uid ? 'guest' : null;
    if (!role) throw new HttpsError('permission-denied', 'You are not a participant in this room.');
    const before = room.state;
    if (before.currentLeg !== expectedLeg) {
      if (before.resolvedLeg?.number === expectedLeg) return { status: 'resolved', winner: before.resolvedLeg.winner };
      throw new HttpsError('failed-precondition', 'This leg is no longer active.');
    }
    if (before.winner) throw new HttpsError('failed-precondition', 'The match is over.');
    if (before[`${role}Darts`] !== null) return { status: 'waiting' };

    const hostDarts = role === 'host' ? darts : before.hostDarts;
    const guestDarts = role === 'guest' ? darts : before.guestDarts;
    if (hostDarts === null || guestDarts === null) {
      transaction.update(roomRef, { [`state.${role}Darts`]: darts });
      return { status: 'waiting' };
    }

    const winner = hostDarts <= guestDarts ? 'host' : 'guest';
    let hostLegsWon = before.hostLegsWon + (winner === 'host' ? 1 : 0);
    let guestLegsWon = before.guestLegsWon + (winner === 'guest' ? 1 : 0);
    let hostSetsWon = before.hostSetsWon;
    let guestSetsWon = before.guestSetsWon;
    const setEnded = (winner === 'host' ? hostLegsWon : guestLegsWon) >= room.config.legsToWin;
    if (setEnded) {
      if (winner === 'host') hostSetsWon += 1;
      else guestSetsWon += 1;
      hostLegsWon = 0;
      guestLegsWon = 0;
    }
    const matchEnded = (winner === 'host' ? hostSetsWon : guestSetsWon) >= room.config.setsToWin;
    if (matchEnded) {
      const week = utcWeek(new Date());
      const participants = [
        { uid: room.hostUid, won: winner === 'host' },
        { uid: room.guestUid, won: winner === 'guest' },
      ];
      const identities = await Promise.all(participants.map(player => getAuth().getUser(player.uid)));
      const profiles = await Promise.all(participants.map(player => transaction.get(db.doc(`users/${player.uid}`))));
      const clubIds = [...new Set(profiles.map(profile => profile.data()?.clubId).filter(Boolean))];
      const clubSnapshots = new Map(await Promise.all(clubIds.map(async id => [id, await transaction.get(db.doc(`clubs/${id}`))])));
      const clubsToCredit = new Map();
      for (let index = 0; index < participants.length; index++) {
        const player = participants[index];
        const identity = identities[index];
        const profile = profiles[index];
        if (!profile.exists || (!identity.email && identity.providerData.length === 0)) continue;
        const xp = player.won ? 50 : 10;
        const profileData = profile.data();
        const sameWeek = profileData.weekKey === week;
        const userRef = db.doc(`users/${player.uid}`);
        const publicRef = db.doc(`publicProfiles/${player.uid}`);
        const awardRef = userRef.collection('awards').doc(roomId);
        transaction.update(userRef, {
          xp: FieldValue.increment(xp),
          weeklyXp: sameWeek ? FieldValue.increment(xp) : xp,
          weekKey: week,
          matchesPlayed: FieldValue.increment(1),
          matchesWon: FieldValue.increment(player.won ? 1 : 0),
        });
        transaction.set(publicRef, {
          name: profileData.name || identity.displayName || 'Player',
          xp: FieldValue.increment(xp),
          weeklyXp: sameWeek ? FieldValue.increment(xp) : xp,
          matchesPlayed: FieldValue.increment(1),
          matchesWon: FieldValue.increment(player.won ? 1 : 0),
        }, { merge: true });
        transaction.create(awardRef, { xp, won: player.won, verified: true,
          roomId, createdAt: FieldValue.serverTimestamp() });
        if (profileData.clubId && clubSnapshots.get(profileData.clubId)?.data()?.members?.includes(player.uid)) {
          clubsToCredit.set(profileData.clubId, (clubsToCredit.get(profileData.clubId) || 0) + xp);
        }
      }
      for (const [clubId, xp] of clubsToCredit) {
        const clubRef = db.doc(`clubs/${clubId}`);
        transaction.update(clubRef, { totalXp: FieldValue.increment(xp) });
      }
    }
    transaction.update(roomRef, {
      'state.hostDarts': null, 'state.guestDarts': null,
      'state.hostLegsWon': hostLegsWon, 'state.guestLegsWon': guestLegsWon,
      'state.hostSetsWon': hostSetsWon, 'state.guestSetsWon': guestSetsWon,
      'state.currentLeg': before.currentLeg + 1,
      'state.resolvedLeg': { number: before.currentLeg, winner, setEnded, matchEnded },
      'state.winner': matchEnded ? winner : null,
    });
    return { status: 'resolved', winner, setEnded, matchEnded };
  });
});

exports.deleteMyAccount = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
  if (request.data?.confirm !== 'DELETE MY ACCOUNT') {
    throw new HttpsError('invalid-argument', 'Account deletion must be explicitly confirmed.');
  }
  const authTime = Number(request.auth.token.auth_time || 0) * 1000;
  if (!authTime || Date.now() - authTime > 5 * 60 * 1000) {
    throw new HttpsError('failed-precondition', 'Sign in again before deleting your account.');
  }

  const db = getFirestore();
  const profileRef = db.doc(`users/${uid}`);
  const publicRef = db.doc(`publicProfiles/${uid}`);

  // Remove club membership and transfer ownership when other members remain.
  const clubs = await db.collection('clubs').where('members', 'array-contains', uid).get();
  for (const club of clubs.docs) {
    await db.runTransaction(async transaction => {
      const latest = await transaction.get(club.ref);
      if (!latest.exists) return;
      const members = Array.isArray(latest.data().members) ? latest.data().members.filter(member => member !== uid) : [];
      if (members.length === 0) transaction.delete(club.ref);
      else transaction.update(club.ref, {
        members: FieldValue.arrayRemove(uid),
        ...(latest.data().ownerId === uid ? { ownerId: members[0] } : {}),
      });
    });
  }

  // Shared invitations and online rooms must no longer reference this account.
  const friends = await db.collection('users').where('friends', 'array-contains', uid).get();
  await Promise.all(friends.docs.map(friend => friend.ref.update({ friends: FieldValue.arrayRemove(uid) })));
  for (const field of ['hostUid', 'guestUid']) {
    const rooms = await db.collection('matches').where(field, '==', uid).get();
    for (const room of rooms.docs) await db.recursiveDelete(room.ref);
  }

  await db.recursiveDelete(profileRef);
  await publicRef.delete();
  await getAuth().deleteUser(uid);
  return { deleted: true };
});
