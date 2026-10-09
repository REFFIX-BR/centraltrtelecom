import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getPushProfiles,
  hasSegmentFilters,
  matchesSegment,
  normalizeSegmentFilters,
} from './pushProfiles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_FILE = path.join(__dirname, 'data', 'push-tokens.json');
const HISTORY_FILE = path.join(__dirname, 'data', 'push-history.json');
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function ensureFile(file, fallback) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

function readJson(file, fallback) {
  try {
    ensureFile(file, fallback);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureFile(file, []);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function listPushTokens() {
  return readJson(TOKENS_FILE, []).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function listPushHistory() {
  return readJson(HISTORY_FILE, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function registerPushToken(input = {}) {
  const token = String(input.token || '').trim();
  if (!token.startsWith('ExponentPushToken[')) {
    throw new Error('Token Expo inválido.');
  }

  const now = new Date().toISOString();
  const tokens = listPushTokens();
  const existing = tokens.findIndex((item) => item.token === token);
  const next = {
    token,
    document: digits(input.document),
    login: String(input.login || '').trim(),
    name: String(input.name || '').trim(),
    platform: String(input.platform || '').trim(),
    createdAt: tokens[existing]?.createdAt || now,
    updatedAt: now,
  };

  if (existing >= 0) tokens[existing] = next;
  else tokens.unshift(next);

  writeJson(TOKENS_FILE, tokens);
  return next;
}

function pickRecipients({ document, login, sendToAll }) {
  const tokens = listPushTokens();
  const doc = digits(document);
  const loginValue = String(login || '').trim();

  if (sendToAll) return tokens;
  if (doc) return tokens.filter((item) => item.document === doc);
  if (loginValue) {
    return tokens.filter(
      (item) => item.login.toLowerCase() === loginValue.toLowerCase()
    );
  }
  return [];
}

const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const RECEIPT_ATTEMPTS = 4;
const RECEIPT_DELAY_MS = 4000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function removePushTokens(dead) {
  if (!dead.length) return 0;
  const deadSet = new Set(dead);
  const tokens = listPushTokens();
  const next = tokens.filter((item) => !deadSet.has(item.token));
  writeJson(TOKENS_FILE, next);
  return tokens.length - next.length;
}

/**
 * O ticket "ok" só diz que a Expo aceitou; a entrega real (FCM/APNs) vem no
 * recibo, que fica pronto alguns segundos depois.
 */
async function fetchReceipts(ids) {
  const receipts = {};
  let pending = [...ids];
  for (let attempt = 0; attempt < RECEIPT_ATTEMPTS && pending.length; attempt += 1) {
    await sleep(RECEIPT_DELAY_MS);
    for (let i = 0; i < pending.length; i += 300) {
      const chunk = pending.slice(i, i + 300);
      try {
        const response = await fetch(EXPO_RECEIPTS_URL, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunk }),
        });
        const data = await response.json().catch(() => ({}));
        Object.assign(receipts, data?.data || {});
      } catch {
        // tenta de novo na próxima rodada
      }
    }
    pending = pending.filter((id) => !receipts[id]);
  }
  return receipts;
}

async function sendExpoMessages(messages) {
  const tickets = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message || 'Falha no Expo Push Service.');
    }
    const list = Array.isArray(data.data) ? data.data : [];
    tickets.push(...list);
  }
  return tickets;
}

function personalize(template, recipient) {
  const name = String(recipient.name || '').trim();
  const first = name.split(/\s+/)[0] || 'cliente';
  return String(template || '')
    .replaceAll('{{nome}}', name || first)
    .replaceAll('{nome}', name || first)
    .replaceAll('{{primeiroNome}}', first)
    .replaceAll('{primeiroNome}', first)
    .replaceAll('{{login}}', recipient.login || '')
    .replaceAll('{login}', recipient.login || '');
}

export async function sendPushNotification(input = {}) {
  const title = String(input.title || '').trim();
  const body = String(input.body || input.message || '').trim();
  const route = String(input.route || '').trim();
  const sendToAll = input.sendToAll === true;
  const document = input.document;
  const login = input.login;
  const token = String(input.token || '').trim();

  if (!title) throw new Error('Informe o título da notificação.');
  if (!body) throw new Error('Informe a mensagem da notificação.');

  const filters = normalizeSegmentFilters(input.filters);
  const segmented = sendToAll && hasSegmentFilters(filters);

  let recipients = pickRecipients({ document, login, sendToAll });
  if (token) {
    recipients = listPushTokens().filter((item) => item.token === token);
  }
  if (segmented) {
    const profiles = await getPushProfiles(recipients);
    recipients = recipients.filter((item) =>
      matchesSegment(profiles[item.token], filters)
    );
  }
  if (!recipients.length) {
    throw new Error(
      segmented
        ? 'Nenhum aparelho corresponde aos filtros escolhidos.'
        : sendToAll
          ? 'Nenhum aparelho registrado ainda.'
          : 'Nenhum aparelho encontrado para este CPF/login.'
    );
  }

  const messages = recipients.map((item) => ({
    to: item.token,
    sound: 'default',
    title: personalize(title, item),
    body: personalize(body, item),
    channelId: 'default',
    data: {
      route: route || '/notificacoes',
    },
  }));

  const tickets = await sendExpoMessages(messages);

  const deadTokens = [];
  const errorMessages = new Set();
  const receiptToToken = new Map();
  let failed = 0;

  tickets.forEach((ticket, index) => {
    const tokenValue = messages[index]?.to;
    if (ticket?.status === 'ok' && ticket.id) {
      receiptToToken.set(ticket.id, tokenValue);
      return;
    }
    failed += 1;
    if (ticket?.message) errorMessages.add(ticket.message);
    if (ticket?.details?.error === 'DeviceNotRegistered') deadTokens.push(tokenValue);
  });

  const receipts = await fetchReceipts([...receiptToToken.keys()]);
  let delivered = 0;
  for (const [id, tokenValue] of receiptToToken) {
    const receipt = receipts[id];
    if (!receipt) continue;
    if (receipt.status === 'ok') {
      delivered += 1;
      continue;
    }
    failed += 1;
    const reason = receipt.details?.error;
    if (reason === 'DeviceNotRegistered') {
      deadTokens.push(tokenValue);
      errorMessages.add(
        'Aparelho não registrado (app desinstalado ou token do Expo Go) — removido da lista.'
      );
    } else if (receipt.message) {
      errorMessages.add(reason ? `${reason}: ${receipt.message}` : receipt.message);
    }
  }
  const pending = recipients.length - delivered - failed;
  const removedTokens = removePushTokens(deadTokens);

  const record = {
    id: `push-${Date.now()}`,
    title,
    body,
    route,
    sendToAll,
    filters: segmented ? filters : null,
    document: digits(document),
    login: String(login || '').trim(),
    recipients: recipients.length,
    delivered,
    failed,
    pending,
    removedTokens,
    errors: [...errorMessages],
    createdAt: new Date().toISOString(),
  };

  const history = listPushHistory();
  history.unshift(record);
  writeJson(HISTORY_FILE, history.slice(0, 50));

  return record;
}
