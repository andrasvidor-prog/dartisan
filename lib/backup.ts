export function parseLocalBackup(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid backup');
  const source = 'local' in value ? value.local : value;
  if (typeof source !== 'object' || source === null || Array.isArray(source)) throw new Error('Invalid backup');
  const entries = Object.entries(source);
  if (entries.length > 500) throw new Error('Backup is too large');
  let totalLength = 0;
  const result: Record<string, string> = {};
  for (const [key, item] of entries) {
    if (!/^dartisan_[a-zA-Z0-9_]+$/.test(key) || typeof item !== 'string') throw new Error('Invalid backup entry');
    totalLength += key.length + item.length;
    if (totalLength > 2_000_000) throw new Error('Backup is too large');
    result[key] = item;
  }
  return result;
}
