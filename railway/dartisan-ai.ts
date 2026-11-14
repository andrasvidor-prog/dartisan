import { createRemoteJWKSet, jwtVerify } from 'jose';

type AiMode = 'tactics' | 'broadcast' | 'rival';
type SafeSnapshot = {
  mode: AiMode;
  lang: 'hu' | 'en';
  dna: Record<string, number | string | null>;
  matches: Record<string, number | boolean | null>[];
};

const projectId = 'dartisan-ca6e4';
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const productionOrigin = 'https://dartisan-production.up.railway.app';
const allowedOrigins = new Set([productionOrigin, 'capacitor://localhost', 'http://localhost:3000',
  ...(process.env.DARTISAN_AI_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)]);
const dailyLimit = 8;
const globalDailyLimit = 80;
const daily = new Map<string, { day: string; count: number }>();
const cached = new Map<string, { until: number; text: string }>();
const inFlight = new Set<string>();
let globalDaily = { day: '', count: 0 };

const json = (body: unknown, status = 200, origin?: string) => Response.json(body, {
  status,
  headers: origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : undefined,
});

function safeNumber(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

function parseSnapshot(value: unknown): SafeSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (!['tactics', 'broadcast', 'rival'].includes(String(input.mode)) || !['hu', 'en'].includes(String(input.lang))) return null;
  if (!input.dna || typeof input.dna !== 'object' || !Array.isArray(input.matches) || input.matches.length > 10) return null;
  const raw = input.dna as Record<string, unknown>;
  const focus = ['doubles', 'opening', 'scoring', 'consistency'].includes(String(raw.focus)) ? String(raw.focus) : 'scoring';
  const profile = ['quickstarter', 'finisher', 'scorer', 'builder'].includes(String(raw.profile)) ? String(raw.profile) : 'builder';
  return {
    mode: input.mode as AiMode,
    lang: input.lang as 'hu' | 'en',
    dna: {
      matches: safeNumber(raw.matches, 20), average: safeNumber(raw.average, 180),
      first9Average: safeNumber(raw.first9Average, 180), checkoutRate: safeNumber(raw.checkoutRate, 100),
      winRate: safeNumber(raw.winRate, 100), momentum: typeof raw.momentum === 'number' && Math.abs(raw.momentum) <= 180 ? raw.momentum : null,
      consistency: safeNumber(raw.consistency, 180), highVisits: safeNumber(raw.highVisits, 600),
      focus, profile,
    },
    matches: input.matches.map(item => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        won: row.won === true,
        average: safeNumber(row.average, 180), first9Average: safeNumber(row.first9Average, 180),
        checkoutRate: safeNumber(row.checkoutRate, 1),
        count100: safeNumber(row.count100, 100), count140: safeNumber(row.count140, 100), count180: safeNumber(row.count180, 100),
      };
    }),
  };
}

async function verifyUser(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, keys, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || payload.sub.length > 128 || typeof payload.iat !== 'number' || payload.iat > now ||
    typeof payload.auth_time !== 'number' || payload.auth_time > now ||
    (payload.firebase as Record<string, unknown> | undefined)?.sign_in_provider === 'anonymous') {
    throw new Error('Invalid Firebase account');
  }
  return payload.sub;
}

const instructions: Record<AiMode, string> = {
  tactics: 'Write a vivid but useful darts tactical dossier: playing identity, 2-3 evidence-backed strengths, 2-3 weaknesses, and a specific next-session plan. Use exact supplied numbers and mention small sample size. Do not invent throws, sectors, opponents, results, or injuries. Keep it under 220 words.',
  broadcast: 'Write an exciting sports-broadcast recap based strictly on the supplied match summary numbers, especially momentum and scoring. Do not invent individual darts, leg-by-leg turning points, audience reactions, opponents, or trophies. Keep it under 180 words.',
  rival: 'Write a playful, motivating rival challenge for the next darts match. Use one measurable target from the supplied stats. Be witty but respectful, never abusive. Do not invent facts. Keep it under 110 words.',
};

async function generate(snapshot: SafeSnapshot): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('AI_NOT_CONFIGURED');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-6-luna', store: false, reasoning: { effort: 'none' }, max_output_tokens: 650,
      instructions: `${instructions[snapshot.mode]} Respond in ${snapshot.lang === 'hu' ? 'Hungarian' : 'English'}.`,
      input: JSON.stringify({ dna: snapshot.dna, recentMatchesNewestFirst: snapshot.matches }),
    }),
  });
  if (!response.ok) throw new Error(`MODEL_${response.status}`);
  const data = await response.json() as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  const text = (data.output || []).flatMap(item => item.type === 'message' ? item.content || [] : [])
    .filter(item => item.type === 'output_text').map(item => item.text || '').join('\n').trim();
  if (!text) throw new Error('EMPTY_MODEL_RESPONSE');
  return text.slice(0, 4500);
}

export function createAiHandler(dependencies: {
  verify?: (token: string) => Promise<string>;
  generate?: (snapshot: SafeSnapshot) => Promise<string>;
} = {}) {
  const checkToken = dependencies.verify || verifyUser;
  const makeText = dependencies.generate || generate;
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') || undefined;
    if (origin && !allowedOrigins.has(origin)) return json({ error: 'Origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin || productionOrigin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '600', Vary: 'Origin',
    } });
    const pathname = new URL(request.url).pathname;
    if (pathname === '/health' && request.method === 'GET') return json({ ok: true }, 200, origin);
    if (pathname !== '/analyze' || request.method !== 'POST') return json({ error: 'Not found' }, 404, origin);
    const bearer = request.headers.get('authorization') || '';
    if (!bearer.startsWith('Bearer ') || bearer.length > 10000) return json({ error: 'Sign in required' }, 401, origin);
    let uid: string;
    try { uid = await checkToken(bearer.slice(7)); }
    catch { return json({ error: 'Sign in required' }, 401, origin); }
    const raw = await request.text();
    if (raw.length > 16000) return json({ error: 'Request too large' }, 413, origin);
    let snapshot: SafeSnapshot | null = null;
    try { snapshot = parseSnapshot(JSON.parse(raw)); }
    catch { /* Invalid JSON is handled below. */ }
    if (!snapshot) return json({ error: 'Invalid analysis request' }, 400, origin);
    const cacheKey = `${uid}:${JSON.stringify(snapshot)}`;
    const previous = cached.get(cacheKey);
    if (previous && previous.until > Date.now()) return json({ text: previous.text, cached: true }, 200, origin);
    const day = new Date().toISOString().slice(0, 10);
    const current = daily.get(uid)?.day === day ? daily.get(uid)! : { day, count: 0 };
    if (globalDaily.day !== day) globalDaily = { day, count: 0 };
    if (current.count >= dailyLimit || globalDaily.count >= globalDailyLimit) return json({ error: 'Daily AI limit reached' }, 429, origin);
    if (inFlight.has(uid)) return json({ error: 'An analysis is already running' }, 429, origin);
    if (!process.env.OPENAI_API_KEY && !dependencies.generate) return json({ error: 'AI service is not configured' }, 503, origin);
    current.count += 1; globalDaily.count += 1; daily.set(uid, current); inFlight.add(uid);
    try {
      const text = await makeText(snapshot);
      cached.set(cacheKey, { text, until: Date.now() + 60 * 60 * 1000 });
      return json({ text, cached: false }, 200, origin);
    } catch {
      return json({ error: 'AI response unavailable' }, 502, origin);
    } finally { inFlight.delete(uid); }
  };
}

const server = { port: Number(process.env.PORT || 3000), fetch: createAiHandler() };
export default server;
