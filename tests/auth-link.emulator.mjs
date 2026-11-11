import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp as initializeClient, deleteApp as deleteClient } from 'firebase/app';
import { getAuth as getClientAuth, connectAuthEmulator, EmailAuthProvider, linkWithCredential, reload, signInWithCustomToken, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';

const requireAdmin = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireAdmin('firebase-admin/app');
const { getAuth: getAdminAuth } = requireAdmin('firebase-admin/auth');

const projectId = 'dartisan-rules-test';
const adminApp = initializeAdmin({ projectId }, 'password-link-test');
const clientApp = initializeClient({ apiKey: 'test-api-key', authDomain: 'localhost', projectId, appId: 'test-app' }, 'password-link-client');
const adminAuth = getAdminAuth(adminApp);
const auth = getClientAuth(clientApp);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

try {
  for (const method of ['link', 'update']) {
    const email = `${method}-${crypto.randomUUID()}@example.invalid`;
    const password = 'Temporary-Test-Password-123';
    const account = await adminAuth.createUser({ email, emailVerified: true });
    const token = await adminAuth.createCustomToken(account.uid);
    const user = (await signInWithCustomToken(auth, token)).user;
    assert.equal(user.email, email);
    assert.equal(user.providerData.some(provider => provider.providerId === 'password'), false);
    if (method === 'link') {
      await assert.rejects(() => linkWithCredential(user, EmailAuthProvider.credential(email, password)),
        error => error.code === 'auth/email-already-in-use');
    }
    await updatePassword(user, password);
    await reload(user);
    assert.equal(user.providerData.some(provider => provider.providerId === 'password'), true);
    await signOut(auth);
    assert.equal((await signInWithEmailAndPassword(auth, email, password)).user.uid, account.uid);
    await signOut(auth);
  }
  console.log('updatePassword preserves the original UID and allows email sign-in even when linking rejects an existing email.');
} finally {
  await deleteClient(clientApp);
  await deleteAdmin(adminApp);
}
