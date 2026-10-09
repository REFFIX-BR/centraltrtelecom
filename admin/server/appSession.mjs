import crypto from 'node:crypto';
import { digits, formatDocument, postWebhook } from './sacWebhook.mjs';

const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const loginAttempts = new Map();

function sessionSecret() {
  const explicit = String(process.env.APP_SESSION_SECRET || '').trim();
  if (explicit) return explicit;
  const admin = String(process.env.ADMIN_API_TOKEN || '').trim();
  if (!admin) return '';
  return crypto.createHash('sha256').update(`app-session:${admin}`).digest('hex');
}

export function appSessionConfigured() {
  return Boolean(sessionSecret());
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(document) {
  const secret = sessionSecret();
  if (!secret) throw new Error('Sessão do app não configurada no servidor.');
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({ d: digits(document), iat: now, exp: now + SESSION_TTL_MS })
  ).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** Devolve o CPF/CNPJ (só dígitos) do token válido, ou null. */
export function verifySessionToken(token) {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.d || !data?.exp || data.exp < Date.now()) return null;
    return String(data.d);
  } catch {
    return null;
  }
}

export function requireAppSession(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const document = verifySessionToken(token);
  if (!document) {
    return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  }
  req.appDocument = document;
  return next();
}

function tooManyAttempts(key) {
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter(
    (time) => now - time < LOGIN_WINDOW_MS
  );
  recent.push(now);
  loginAttempts.set(key, recent);
  return recent.length > LOGIN_MAX_ATTEMPTS;
}

export class AppLoginError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Valida CPF/CNPJ + senha no SAC e devolve o cliente (sem a senha) e o token. */
export async function loginAppUser({ documento, senha, ip }) {
  const document = digits(documento);
  const password = String(senha || '');
  if (!document || !password) {
    throw new AppLoginError('Informe CPF/CNPJ e senha.', 400);
  }
  if (tooManyAttempts(`${ip || ''}:${document}`)) {
    throw new AppLoginError(
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      429
    );
  }

  const data = await postWebhook('/webhook/login-sac', {
    documento: formatDocument(document),
    senha: password,
    codigo_gerado: '',
    timestamp: new Date().toISOString(),
  });

  const client = Array.isArray(data) ? data[0] : null;
  if (!client?.COD_CLIENTE && !client?.CODIGO) {
    const message =
      typeof data === 'string' && data.trim()
        ? data.trim()
        : 'Cliente não encontrado com CPF e senha digitados.';
    throw new AppLoginError(message, 401);
  }

  const { SENHA_WEB: _omit, ...safeClient } = client;
  return { client: safeClient, sessionToken: createSessionToken(document) };
}
