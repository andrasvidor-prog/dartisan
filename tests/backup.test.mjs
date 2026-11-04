import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalBackup } from '../lib/backup.ts';

test('current and older local backups can be restored', () => {
  assert.deepEqual(parseLocalBackup({ version: 1, local: { dartisan_lang: 'hu' } }), { dartisan_lang: 'hu' });
  assert.deepEqual(parseLocalBackup({ dartisan_lang: 'en' }), { dartisan_lang: 'en' });
});

test('foreign keys and non-string entries are rejected before any write', () => {
  assert.throws(() => parseLocalBackup({ firebase: 'secret' }));
  assert.throws(() => parseLocalBackup({ dartisan_lang: 1 }));
  assert.throws(() => parseLocalBackup({ local: { dartisan_lang: null } }));
  assert.throws(() => parseLocalBackup([]));
  assert.throws(() => parseLocalBackup({ dartisan_data: 'x'.repeat(2_000_001) }));
});
