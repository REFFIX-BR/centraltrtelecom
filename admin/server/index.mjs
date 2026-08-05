import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import {
  listPublicMobilePlans,
  readMobilePlans,
  sortMobilePlans,
  syncMobilePlansFromAltaRede,
  toggleMobilePlan,
  updateMobilePlan,
} from './mobilePlans.mjs';
import { getMvnoStatus, lookupSubscriberByDocument } from './mvno.mjs';
import { checkDatabase, dbConfigured } from './db.mjs';
import { minioConfigured, minioStatus, uploadBannerImage } from './minio.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const DATA_FILE = path.join(__dirname, 'data', 'banners.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PORT = Number(process.env.ADMIN_API_PORT || 4050);
const HOST = process.env.ADMIN_API_HOST || '0.0.0.0';
const ADMIN_TOKEN = String(process.env.ADMIN_API_TOKEN || '').trim();
const PUBLIC_BASE_URL = (process.env.ADMIN_PUBLIC_URL || '').replace(/\/$/, '');

const ORDER_STATUSES = [
  'aguardando',
  'em_analise',
  'em_andamento',
  'concluida',
  'cancelada',
];

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
}
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
      ? ext
      : '.jpg';
    cb(null, `banner-${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExt}`);
  },
});

const upload = multer({
  storage: minioConfigured ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Envie apenas arquivos de imagem.'));
      return;
    }
    cb(null, true);
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

function readBanners() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeBanners(banners) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(banners, null, 2), 'utf8');
}

function sortBanners(banners) {
  return [...banners].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function readOrders() {
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

function sortOrders(orders) {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function makeProtocol(saleId) {
  const fromSale = String(saleId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase();
  if (fromSale.length >= 6) return fromSale;
  return `OS${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function mapIncomingStatus(raw) {
  const value = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (value.includes('cancel')) return 'cancelada';
  if (value.includes('conclu') || value.includes('finaliz')) return 'concluida';
  if (value.includes('andamento') || value.includes('execuc')) return 'em_andamento';
  if (value.includes('analise')) return 'em_analise';
  return 'aguardando';
}

function statusLabelFor(status) {
  const labels = {
    aguardando: 'Aguardando',
    em_analise: 'Em análise',
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };
  return labels[status] || 'Aguardando';
}

function sanitizeOrder(input = {}) {
  const now = new Date().toISOString();
  const customerName = String(input.customerName || '').trim();
  const requestedPlanName = String(input.requestedPlanName || '').trim();
  if (!customerName) throw new Error('Informe o nome do cliente.');
  if (!requestedPlanName) throw new Error('Informe o plano solicitado.');

  const saleId = String(input.saleId || '').trim() || null;
  const protocol = makeProtocol(saleId || input.protocol);
  const status = mapIncomingStatus(input.status);

  return {
    id: `order-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    type: 'upgrade',
    protocol,
    saleId,
    status,
    statusLabel: statusLabelFor(status),
    customerName,
    customerDocument: String(input.customerDocument || '').trim(),
    customerPhone: String(input.customerPhone || '').trim(),
    customerEmail: String(input.customerEmail || '').trim(),
    customerLogin: String(input.customerLogin || '').trim(),
    contractId: String(input.contractId || '').trim(),
    currentPlanName: String(input.currentPlanName || '').trim(),
    currentSpeedMbps: Number(input.currentSpeedMbps) || 0,
    requestedPlanName,
    requestedSpeedMbps: Number(input.requestedSpeedMbps) || 0,
    monthlyPrice: Number(input.monthlyPrice) || 0,
    commercialPlanId: Number(input.commercialPlanId) || null,
    notes: String(input.notes || '').trim(),
    source: String(input.source || 'central-assinante').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: 'ADMIN_API_TOKEN não configurado no servidor.' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  return next();
}

function getRequestBaseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

function absolutizeImageUrl(imageUrl, req) {
  const value = String(imageUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${getRequestBaseUrl(req)}${value}`;
  return value;
}

function withAbsoluteImages(banners, req) {
  return banners.map((item) => ({
    ...item,
    imageUrl: absolutizeImageUrl(item.imageUrl, req),
  }));
}

function normalizeStoredImageUrl(imageUrl) {
  const value = String(imageUrl || '').trim();
  if (!value) return '';
  if (value.startsWith('/uploads/')) return value;
  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/uploads/')) {
      return parsed.pathname;
    }
  } catch {
    // URL externa ou inválida: mantém como veio.
  }
  return value;
}

function sanitizeBanner(input = {}, current = null) {
  const now = new Date().toISOString();
  const title = String(input.title || '').trim();
  if (!title) {
    throw new Error('Informe o título do card.');
  }

  const imageUrl = normalizeStoredImageUrl(input.imageUrl);
  const imageOnly = true;
  if (!imageUrl) {
    throw new Error('Envie uma imagem para o card de propaganda.');
  }

  return {
    id: current?.id || `banner-${Date.now()}`,
    title,
    subtitle: String(input.subtitle || '').trim(),
    ctaLabel: '',
    linkUrl: String(input.linkUrl || '').trim(),
    imageUrl,
    theme: ['navy', 'sky', 'blue'].includes(input.theme) ? input.theme : 'navy',
    active: input.active !== false,
    showCta: false,
    imageOnly,
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : (current?.order ?? 99),
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };
}

/** Público: app mobile consome apenas cards ativos com imagem. */
app.get('/api/banners', (req, res) => {
  const banners = withAbsoluteImages(
    sortBanners(readBanners()).filter((item) => item.active && item.imageUrl),
    req
  );
  res.json({ banners });
});

/** Compatível com o padrão de webhook usado no app. */
app.get('/webhook/propagandas', (req, res) => {
  const banners = withAbsoluteImages(
    sortBanners(readBanners()).filter((item) => item.active && item.imageUrl),
    req
  );
  res.json({ banners });
});

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({
      error: 'ADMIN_API_TOKEN não configurado no .env do servidor.',
    });
  }
  const password = String(req.body?.password || '');
  if (!password || password !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Senha inválida' });
  }
  return res.json({ token: ADMIN_TOKEN });
});

app.get('/api/admin/banners', requireAdmin, (req, res) => {
  res.json({ banners: withAbsoluteImages(sortBanners(readBanners()), req) });
});

app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, async (error) => {
    if (error) {
      return res.status(400).json({
        error: error.message || 'Não foi possível enviar a imagem.',
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Selecione uma imagem.' });
    }

    try {
      if (minioConfigured) {
        const uploaded = await uploadBannerImage(req.file);
        return res.status(201).json(uploaded);
      }

      const relativePath = `/uploads/${req.file.filename}`;
      return res.status(201).json({
        path: relativePath,
        url: absolutizeImageUrl(relativePath, req),
        storage: 'local',
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha no upload MinIO.',
      });
    }
  });
});

app.post('/api/admin/banners', requireAdmin, (req, res) => {
  try {
    const banners = readBanners();
    const banner = sanitizeBanner(req.body);
    banners.push(banner);
    writeBanners(banners);
    res.status(201).json({ banner: withAbsoluteImages([banner], req)[0] });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Dados inválidos' });
  }
});

app.put('/api/admin/banners/:id', requireAdmin, (req, res) => {
  try {
    const banners = readBanners();
    const index = banners.findIndex((item) => item.id === req.params.id);
    if (index < 0) {
      return res.status(404).json({ error: 'Card não encontrado' });
    }
    const banner = sanitizeBanner(req.body, banners[index]);
    banners[index] = banner;
    writeBanners(banners);
    return res.json({ banner: withAbsoluteImages([banner], req)[0] });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Dados inválidos' });
  }
});

app.delete('/api/admin/banners/:id', requireAdmin, (req, res) => {
  const banners = readBanners().filter((item) => item.id !== req.params.id);
  writeBanners(banners);
  res.json({ ok: true });
});

app.patch('/api/admin/banners/:id/toggle', requireAdmin, (req, res) => {
  const banners = readBanners();
  const index = banners.findIndex((item) => item.id === req.params.id);
  if (index < 0) {
    return res.status(404).json({ error: 'Card não encontrado' });
  }
  banners[index] = {
    ...banners[index],
    active: !banners[index].active,
    updatedAt: new Date().toISOString(),
  };
  writeBanners(banners);
  return res.json({ banner: withAbsoluteImages([banners[index]], req)[0] });
});

/** App: registra ordem após upgrade no comercial. */
app.post('/api/service-orders', (req, res) => {
  try {
    const order = sanitizeOrder(req.body);
    const orders = readOrders();

    // Evita duplicar o mesmo sale_id do comercial.
    if (order.saleId) {
      const existing = orders.find((item) => item.saleId === order.saleId);
      if (existing) {
        return res.status(200).json({ order: existing, duplicated: true });
      }
    }

    orders.unshift(order);
    writeOrders(orders);
    return res.status(201).json({ order });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Dados inválidos' });
  }
});

app.get('/api/admin/service-orders', requireAdmin, (_req, res) => {
  res.json({ orders: sortOrders(readOrders()) });
});

app.patch('/api/admin/service-orders/:id', requireAdmin, (req, res) => {
  const orders = readOrders();
  const index = orders.findIndex((item) => item.id === req.params.id);
  if (index < 0) {
    return res.status(404).json({ error: 'Ordem não encontrada' });
  }

  const nextStatus = String(req.body?.status || '').trim();
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({
      error: `Status inválido. Use: ${ORDER_STATUSES.join(', ')}`,
    });
  }

  const labels = {
    aguardando: 'Aguardando',
    em_analise: 'Em análise',
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };

  orders[index] = {
    ...orders[index],
    status: nextStatus,
    statusLabel: statusLabelFor(nextStatus),
    notes:
      req.body?.notes !== undefined
        ? String(req.body.notes || '').trim()
        : orders[index].notes,
    updatedAt: new Date().toISOString(),
  };
  writeOrders(orders);
  return res.json({ order: orders[index] });
});

app.delete('/api/admin/service-orders/:id', requireAdmin, (req, res) => {
  const orders = readOrders().filter((item) => item.id !== req.params.id);
  writeOrders(orders);
  res.json({ ok: true });
});

/** Público: planos móveis liberados para o app. */
app.get('/api/mobile-plans', (_req, res) => {
  res.json({ plans: listPublicMobilePlans() });
});

/** Público: consulta assinante MVNO por CPF/CNPJ (via proxy seguro). */
app.get('/api/mobile/subscriber', async (req, res) => {
  try {
    const document = String(req.query.document || '').trim();
    const result = await lookupSubscriberByDocument(document);
    res.json(result);
  } catch (error) {
    res.status(error.status && error.status < 500 ? error.status : 502).json({
      error: error.message || 'Falha ao consultar MVNO',
      mvno: getMvnoStatus(),
    });
  }
});

app.get('/api/mobile/status', (_req, res) => {
  res.json(getMvnoStatus());
});

app.get('/api/admin/mobile-plans', requireAdmin, (_req, res) => {
  res.json({ plans: sortMobilePlans(readMobilePlans()) });
});

app.post('/api/admin/mobile-plans/sync', requireAdmin, async (_req, res) => {
  try {
    const plans = await syncMobilePlansFromAltaRede();
    res.json({
      plans,
      synced: plans.length,
      message: `${plans.length} planos móveis sincronizados do AltaRede.`,
    });
  } catch (error) {
    res.status(502).json({
      error: error.message || 'Não foi possível sincronizar com o AltaRede.',
    });
  }
});

app.patch('/api/admin/mobile-plans/:id/toggle', requireAdmin, (req, res) => {
  const plan = toggleMobilePlan(req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'Plano não encontrado' });
  }
  return res.json({ plan });
});

app.patch('/api/admin/mobile-plans/:id', requireAdmin, (req, res) => {
  const plan = updateMobilePlan(req.params.id, req.body || {});
  if (!plan) {
    return res.status(404).json({ error: 'Plano não encontrado' });
  }
  return res.json({ plan });
});

app.get('/api/health/db', requireAdmin, async (_req, res) => {
  const database = await checkDatabase();
  res.status(database.ok ? 200 : 503).json({
    ok: database.ok,
    configured: database.configured,
  });
});

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api(?:\/|$)|\/webhook(?:\/|$)|\/uploads(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.status(404).end();
  });
}

app.listen(PORT, HOST, async () => {
  console.log(`API de propagandas TR Telecom em http://${HOST}:${PORT}`);
  console.log(`Público: GET /api/banners e GET /webhook/propagandas`);
  if (!ADMIN_TOKEN) {
    console.warn('ADMIN_API_TOKEN: não definido no .env — login do painel bloqueado');
  } else {
    console.log('ADMIN_API_TOKEN: configurado via .env');
  }
  const storage = minioStatus();
  if (storage.configured) {
    console.log(
      `MinIO: OK · bucket=${storage.bucket} · ${storage.publicBase}`
    );
  } else {
    console.warn('MinIO: não configurado — upload local em /uploads');
  }
  if (!dbConfigured) {
    console.warn('Postgres: não configurado (DATABASE_URL / DB_*)');
    return;
  }
  const database = await checkDatabase();
  if (database.ok) {
    console.log(
      `Postgres: OK · db=${database.database} · user=${database.user}`
    );
  } else {
    console.warn(`Postgres: falha · ${database.message}`);
  }
});
