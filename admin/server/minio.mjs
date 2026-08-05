import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function trimSlash(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function normalizeEndpoint(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return trimSlash(value);
  return `https://${trimSlash(value)}`;
}

const ENDPOINT = normalizeEndpoint(process.env.MINIO_ENDPOINT);
const ACCESS_KEY = String(process.env.MINIO_ACCESS_KEY || '').trim();
const SECRET_KEY = String(process.env.MINIO_SECRET_KEY || '').trim();
const BUCKET = String(process.env.MINIO_BUCKET || 'centralapp').trim();
const REGION = String(process.env.MINIO_REGION || 'us-east-1').trim();
const PUBLIC_BASE = trimSlash(process.env.MINIO_PUBLIC_URL || ENDPOINT);
const KEY_PREFIX = String(process.env.MINIO_KEY_PREFIX || 'banners')
  .trim()
  .replace(/^\/+|\/+$/g, '');

export const minioConfigured = Boolean(
  ENDPOINT && ACCESS_KEY && SECRET_KEY && BUCKET
);

const client = minioConfigured
  ? new S3Client({
      endpoint: ENDPOINT,
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
      },
      forcePathStyle: true,
    })
  : null;

function extensionFrom(file) {
  const fromName = path.extname(file?.originalname || '').toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(fromName)) {
    return fromName === '.jpeg' ? '.jpg' : fromName;
  }
  const mime = String(file?.mimetype || '').toLowerCase();
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.jpg';
}

export function buildPublicObjectUrl(key) {
  const cleanKey = String(key || '').replace(/^\/+/, '');
  return `${PUBLIC_BASE}/${BUCKET}/${cleanKey}`;
}

export async function uploadBannerImage(file) {
  if (!minioConfigured || !client) {
    throw new Error('MinIO não configurado (MINIO_ENDPOINT / keys / bucket).');
  }
  if (!file?.buffer?.length) {
    throw new Error('Arquivo de imagem inválido.');
  }

  const ext = extensionFrom(file);
  const key = `${KEY_PREFIX}/banner-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const url = buildPublicObjectUrl(key);
  return { key, url, path: url, storage: 'minio' };
}

export function minioStatus() {
  return {
    configured: minioConfigured,
    endpoint: ENDPOINT || null,
    bucket: BUCKET || null,
    publicBase: PUBLIC_BASE || null,
  };
}
