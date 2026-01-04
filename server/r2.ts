import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

export type R2Config = {
  bucket: string;
  publicBaseUrl?: string;
};

let didTryLoadEnv = false;
function ensureEnvLoaded() {
  if (didTryLoadEnv) return;
  didTryLoadEnv = true;
  try {
    // Try both CWD and project-root-relative (works even if server is started from /server).
    dotenv.config();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
  } catch {
    // best-effort; missing vars will be handled by callers
  }
}

export function getR2Client(): { client: S3Client; config: R2Config } | null {
  ensureEnvLoaded();
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;

  const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || undefined;

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, config: { bucket, publicBaseUrl } };
}

export function sanitizeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() || "upload";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function makeObjectKey(originalName: string) {
  const safe = sanitizeFileName(originalName);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(8).toString("hex");
  return `business/${stamp}-${rand}-${safe}`;
}

export function makeEventMediaKey(originalName: string, opts?: { userId?: string }) {
  const safe = sanitizeFileName(originalName);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(8).toString("hex");
  const user = opts?.userId ? sanitizeFileName(String(opts.userId)) : "anon";
  return `events/${user}/${stamp}-${rand}-${safe}`;
}

export async function presignBusinessPhotoPut(params: {
  fileName: string;
  contentType: string;
}) {
  const r2 = getR2Client();
  if (!r2) return null;

  const key = makeObjectKey(params.fileName);
  const cmd = new PutObjectCommand({
    Bucket: r2.config.bucket,
    Key: key,
    ContentType: params.contentType,
  });

  const url = await getSignedUrl(r2.client, cmd, { expiresIn: 60 * 5 });
  const publicUrl = r2.config.publicBaseUrl
    ? `${r2.config.publicBaseUrl.replace(/\/$/, "")}/${key}`
    : undefined;

  return { key, url, publicUrl };
}

export async function presignEventMediaPut(params: {
  fileName: string;
  contentType: string;
  userId?: string;
}) {
  const r2 = getR2Client();
  if (!r2) return null;

  const key = makeEventMediaKey(params.fileName, { userId: params.userId });
  const cmd = new PutObjectCommand({
    Bucket: r2.config.bucket,
    Key: key,
    ContentType: params.contentType,
  });

  const url = await getSignedUrl(r2.client, cmd, { expiresIn: 60 * 5 });
  const publicUrl = r2.config.publicBaseUrl
    ? `${r2.config.publicBaseUrl.replace(/\/$/, "")}/${key}`
    : undefined;

  return { key, url, publicUrl };
}



