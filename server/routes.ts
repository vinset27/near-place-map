import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStoreFactory from "memorystore";
import crypto from "crypto";
import {
  businessApplications,
  businessApplySchema,
  establishmentViews,
  events,
  establishments,
  establishmentProfiles,
  insertUserSchema,
  upsertEstablishmentProfileSchema,
  userEvents,
  users,
} from "@shared/schema";
import { hashPassword, verifyPassword } from "./auth";
import { db, ensureAppTables } from "./db";
import { pool } from "./db";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { presignBusinessPhotoPut } from "./r2";
import { googlePlacesNearbyAll, mapGoogleTypesToCategory } from "./googlePlaces";
import { resendSendEmail } from "./resend";
import { sendExpoPush } from "./push";

let _dbIdentityLogged = false;
async function logDbIdentityOnce() {
  if (_dbIdentityLogged) return;
  if (!pool) return;
  _dbIdentityLogged = true;
  try {
    const r = await pool.query(
      `select current_database() as db, inet_server_addr()::text as host, inet_server_port() as port`,
    );
    const row = r?.rows?.[0];
    console.log(`[DB] connected: db=${row?.db} host=${row?.host} port=${row?.port}`);
  } catch (e: any) {
    console.warn("[DB] identity check failed:", e?.message || e);
  }
}

type EstablishmentsCacheEntry = { at: number; body: any; etag: string };
const EST_CACHE_TTL_MS = 10_000;
const establishmentsCache = new Map<string, EstablishmentsCacheEntry>();

function computeWeakEtag(obj: unknown): string {
  // Stable enough for short-lived caching of public JSON responses.
  const json = JSON.stringify(obj);
  const hash = crypto.createHash("sha1").update(json).digest("base64");
  return `W/"${hash}"`;
}

function setPublicApiCacheHeaders(res: any, etag?: string, hit?: boolean, extra?: Record<string, string>) {
  // These endpoints are public (no user-specific data). If you're behind Cloudflare proxy,
  // `s-maxage` enables edge caching. Keep TTL short to avoid staleness after imports.
  res.setHeader("Cache-Control", "public, max-age=10, s-maxage=30, stale-while-revalidate=60");
  if (etag) res.setHeader("ETag", etag);
  if (typeof hit === "boolean") res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function asyncHandler(fn: (req: any, res: any, next: any) => any) {
  return (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);
}

function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || "").trim());
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
}

const requireVerifiedEmail = asyncHandler(async (req: any, res: any, next: any) => {
  if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = rows[0] as any;
  if (!u) return res.status(401).json({ message: "Unauthorized" });
  // Require verified email for user-generated/public actions
  if (u.emailVerified === false) {
    return res.status(403).json({ message: "Confirme ton email pour publier." });
  }
  return next();
});

async function requireEstablishment(req: any, res: any, next: any) {
  if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = rows[0];
  if (!u) return res.status(401).json({ message: "Unauthorized" });
  // Require verified email before allowing Pro actions (events, publish, applications).
  // But allow completing the profile itself even if email isn't verified yet.
  if ((u as any).email && (u as any).emailVerified === false) {
    return res.status(403).json({ message: "Confirme ton email pour activer les actions Pro." });
  }
  if (u.role !== "establishment" || !u.profileCompleted) {
    return res.status(403).json({ message: "Establishment profile required" });
  }
  next();
}

const requireAdmin = asyncHandler(async (req: any, res: any, next: any) => {
  // Option A: session user with role=admin (admin profile)
  if (db && req.session?.userId) {
    const userId = String(req.session.userId);
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const u = rows[0] as any;
    if (u && u.role === "admin" && !u.deletedAt) return next();
  }

  // Option B: master token header (for Postman/CLI, or emergency access)
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(403).json({ message: "ADMIN_TOKEN not configured" });
  const got = String(req.header("x-admin-token") || "").trim();
  const expected = String(token).trim();
  if (!got) return res.status(403).json({ message: "Missing x-admin-token header" });
  if (got !== expected) return res.status(403).json({ message: "Invalid admin token" });
  return next();
});

function safeUser(u: any) {
  if (!u) return null;
  const {
    password,
    emailVerificationToken,
    emailVerificationCode,
    emailVerificationSentAt,
    passwordResetCode,
    passwordResetSentAt,
    passwordChangeCode,
    passwordChangeSentAt,
    deletedAt,
    ...rest
  } = u;
  return rest;
}

function makeToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function make6DigitCode(): string {
  // 000000-999999, padded
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function pushNotifyNearby(params: {
  center: { lat: number; lng: number };
  radiusKm: number;
  title: string;
  body: string;
  data?: Record<string, any>;
  excludeUserId?: string | null;
}) {
  if (!pool) return;
  const { center, radiusKm, title, body, data, excludeUserId } = params;
  const lat = Number(center.lat);
  const lng = Number(center.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const rKm = Math.min(50, Math.max(1, Number(radiusKm) || 10));
  const dLat = rKm / 111.32;
  const dLng = rKm / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

  // Only consider relatively recent locations to avoid spamming stale tokens.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await pool
    .query(
      `
        select user_id, token, lat, lng
        from push_tokens
        where lat is not null and lng is not null
          and lat >= $1 and lat <= $2
          and lng >= $3 and lng <= $4
          and updated_at >= $5
      `,
      [lat - dLat, lat + dLat, lng - dLng, lng + dLng, since],
    )
    .catch(() => null as any);
  const candidates = rows?.rows || [];
  const radiusM = rKm * 1000;
  const tokens = candidates
    .filter((r: any) => (excludeUserId ? String(r.user_id || "") !== String(excludeUserId) : true))
    .filter((r: any) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)))
    .filter((r: any) => haversineMeters({ lat, lng }, { lat: Number(r.lat), lng: Number(r.lng) }) <= radiusM)
    .map((r: any) => String(r.token || ""))
    .filter(Boolean)
    .slice(0, 900); // keep bounded

  if (!tokens.length) return;
  await sendExpoPush(tokens, { title, body, data }).catch(() => {});
}

function inferCommuneFromAddress(address: string | null | undefined): string | null {
  const a = String(address || "").toLowerCase();
  if (!a) return null;
  // Quick heuristic for Abidjan communes (best-effort; avoids showing wrong "Plateau" everywhere).
  const rules: Array<[string, string]> = [
    ["cocody", "Cocody"],
    ["angré", "Cocody"],
    ["angre", "Cocody"],
    ["riviera", "Cocody"],
    ["deux plateaux", "Cocody"],
    ["2 plateaux", "Cocody"],
    ["plateau", "Plateau"],
    ["treichville", "Treichville"],
    ["marcory", "Marcory"],
    ["koumassi", "Koumassi"],
    ["port-bouët", "Port-Bouët"],
    ["port bouet", "Port-Bouët"],
    ["yopougon", "Yopougon"],
    ["abobo", "Abobo"],
    ["adjame", "Adjamé"],
    ["adjamé", "Adjamé"],
    ["anyama", "Anyama"],
    ["bingerville", "Bingerville"],
  ];
  for (const [needle, label] of rules) {
    if (a.includes(needle)) return label;
  }
  return null;
}

function buildGooglePhotoUrl(photoReference: string, opts?: { maxWidth?: number }) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const maxWidth = opts?.maxWidth ?? 1200;
  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("maxwidth", String(maxWidth));
  url.searchParams.set("photo_reference", photoReference);
  url.searchParams.set("key", key);
  return url.toString();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const MemoryStore = MemoryStoreFactory(session);
  const isProd = process.env.NODE_ENV === "production";

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        // When frontend and backend are on different origins (Cloudflare Pages + Render),
        // cookies must be sent cross-site => SameSite=None; Secure is required.
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 24 * 14,
      },
      store: new MemoryStore({ checkPeriod: 1000 * 60 * 60 }),
    }),
  );

  await ensureAppTables();

  // Admin: Resend smoke test (helps diagnose "200 but no email" situations on Render).
  app.post(
    "/api/admin/resend/test",
    requireAdmin,
    asyncHandler(async (req, res) => {
      const parsed = z.object({ to: z.string().min(3).max(200) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const to = String(parsed.data.to || "").trim().toLowerCase();
      console.log(`[Resend] test: attempting to send to=${to}`);
      try {
        const out = await resendSendEmail({
          // Prefer env-configured sender; fallback is handled in resendSendEmail().
          // Default sender should match your verified domain (note the dash).
          from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
          to,
          subject: "Resend test — O'Show",
          html: `<div style="font-family:system-ui;line-height:1.5"><h3>Resend OK ✅</h3><p>Si tu lis ce message, Resend fonctionne depuis Render.</p></div>`,
        });
        console.log(`[Resend] test: sent id=${String((out as any)?.id || "")}`);
        return res.json({ ok: true, id: (out as any)?.id || null });
      } catch (e: any) {
        const msg = String(e?.message || e || "Resend failed");
        // Bubble up a clearer status instead of generic 500.
        const m = msg.match(/Resend error \((\d+)\):/);
        const code = m ? Number(m[1]) : 500;
        const status = Number.isFinite(code) && code >= 400 && code < 600 ? code : 500;
        return res.status(status).json({ message: msg });
      }
    }),
  );

  // Notifications: register device push token (Expo) for the authenticated user.
  // NOTE: Expo Go can't receive remote push on Android SDK53+, so mobile keeps local test notifications separately.
  app.post(
    "/api/notifications/push-token",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!pool) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const userId = String(req.session.userId || "");
      const parsed = z
        .object({
          token: z.string().min(10).max(300),
          platform: z.string().max(20).optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const token = String(parsed.data.token || "").trim();
      if (!token) return res.status(400).json({ message: "token is required" });

      await pool.query(
        `
          insert into push_tokens (user_id, token, platform, updated_at)
          values ($1, $2, $3, now())
          on conflict (user_id, token)
          do update set platform = excluded.platform, updated_at = now()
        `,
        [userId, token, parsed.data.platform ? String(parsed.data.platform).trim() : null],
      );

      // Optional: update last known device location for "nearby" notifications (best-effort).
      const lat = parsed.data.lat;
      const lng = parsed.data.lng;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        await pool
          .query(
            `update push_tokens set lat = $1, lng = $2, updated_at = now() where user_id = $3 and token = $4`,
            [Number(lat), Number(lng), userId, token],
          )
          .catch(() => {});
      }
      return res.json({ ok: true });
    }),
  );

  // Favorites (auth-required): used for notifications + a consistent cross-device experience.
  app.get(
    "/api/favorites",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!pool) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const userId = String(req.session.userId || "");
      const rows = await pool.query(`select establishment_id, created_at from favorites where user_id = $1 order by created_at desc`, [userId]);
      return res.json({ favorites: rows.rows });
    }),
  );

  // Set favorite state (idempotent).
  app.post(
    "/api/favorites/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!pool) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const userId = String(req.session.userId || "");
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

      if (parsed.data.active) {
        await pool.query(`insert into favorites (user_id, establishment_id) values ($1, $2) on conflict do nothing`, [userId, id]);
      } else {
        await pool.query(`delete from favorites where user_id = $1 and establishment_id = $2`, [userId, id]);
      }
      return res.json({ ok: true });
    }),
  );

  // Navigation signal: when a user starts an itinerary toward an establishment,
  // notify the establishment owner (if any).
  app.post(
    "/api/analytics/establishments/:id/navigation-start",
    requireAuth,
    asyncHandler(async (req, res) => {
      if (!db || !pool) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const userId = String(req.session.userId || "");
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      const parsed = z.object({ mode: z.string().max(24).optional() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

      // Record event (best-effort)
      await pool
        .query(
          `insert into establishment_navigation_events (establishment_id, user_id, mode) values ($1, $2, $3)`,
          [id, userId, parsed.data.mode ? String(parsed.data.mode).trim() : null],
        )
        .catch(() => {});

      // Find owner for push
      const estRows = await db.select().from(establishments).where(eq(establishments.id, id as any)).limit(1);
      const est = estRows[0] as any;
      const ownerUserId = String(est?.ownerUserId || "").trim();
      if (!ownerUserId || ownerUserId === userId) return res.json({ ok: true });

      const tokenRows = await pool.query(`select token from push_tokens where user_id = $1 order by updated_at desc limit 20`, [ownerUserId]);
      const tokens = tokenRows.rows.map((r: any) => String(r.token || "")).filter(Boolean);
      await sendExpoPush(tokens, {
        title: "Itinéraire",
        body: `Un utilisateur trace un itinéraire vers ${String(est?.name || "votre établissement")}.`,
        data: { type: "navigation_start", establishmentId: id },
      }).catch(() => {});

      return res.json({ ok: true });
    }),
  );

  // Healthcheck endpoint (Render / UptimeRobot). Must be fast and not require auth.
  app.get("/api/health", async (_req, res) => {
    try {
      if (!db) return res.status(200).json({ ok: true, db: false });
      // lightweight DB probe (if DB is reachable, this resolves quickly)
      await (db as any).execute(sql`select 1`);
      return res.status(200).json({ ok: true, db: true });
    } catch (e: any) {
      return res.status(200).json({ ok: true, db: false, warn: String(e?.message || e) });
    }
  });

  // Analytics: track a view for an establishment (public, no auth required).
  // Mobile calls this when opening details.
  app.post("/api/analytics/establishments/:id/view", asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const id = String(req.params.id || "").trim();
    if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });

    const body = z
      .object({
        anonId: z.string().min(6).max(120).optional(),
        source: z.string().min(0).max(80).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.message });

    const viewerUserId = req.session?.userId || null;
    const anonId = body.data.anonId ? String(body.data.anonId) : null;
    const source = body.data.source ? String(body.data.source) : null;
    const userAgent = String(req.header("user-agent") || "").slice(0, 240) || null;

    // Light de-dupe: if same viewer hits same establishment within 10 minutes, don't spam.
    const since = new Date(Date.now() - 10 * 60 * 1000);
    if (viewerUserId || anonId) {
      const keyExpr = viewerUserId ? eq(establishmentViews.viewerUserId, String(viewerUserId)) : eq(establishmentViews.anonId, String(anonId));
      const existing = await db
        .select({ id: establishmentViews.id })
        .from(establishmentViews)
        .where(and(eq(establishmentViews.establishmentId, id as any), keyExpr, gte(establishmentViews.createdAt, since)))
        .limit(1);
      if (existing[0]?.id) return res.json({ ok: true, deduped: true });
    }

    await db.insert(establishmentViews).values({
      establishmentId: id as any,
      viewerUserId: viewerUserId ? String(viewerUserId) : null,
      anonId,
      source,
      userAgent,
    });

    return res.json({ ok: true });
  }));

  // Pro dashboard statistics (requires establishment)
  app.get("/api/pro/stats", requireAuth, requireEstablishment, asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;

    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows7 = await db.execute(sql`
      select
        count(*)::int as views,
        count(distinct coalesce(${establishmentViews.viewerUserId}, ${establishmentViews.anonId}))::int as visitors
      from ${establishmentViews}
      join ${establishments} on ${establishments.id} = ${establishmentViews.establishmentId}
      where ${establishments.ownerUserId} = ${userId}
        and ${establishmentViews.createdAt} >= ${since7}
    `);

    const rows30 = await db.execute(sql`
      select
        count(*)::int as views,
        count(distinct coalesce(${establishmentViews.viewerUserId}, ${establishmentViews.anonId}))::int as visitors
      from ${establishmentViews}
      join ${establishments} on ${establishments.id} = ${establishmentViews.establishmentId}
      where ${establishments.ownerUserId} = ${userId}
        and ${establishmentViews.createdAt} >= ${since30}
    `);

    const top = await db.execute(sql`
      select
        ${establishmentViews.establishmentId} as id,
        max(${establishments.name}) as name,
        count(*)::int as views,
        count(distinct coalesce(${establishmentViews.viewerUserId}, ${establishmentViews.anonId}))::int as visitors
      from ${establishmentViews}
      join ${establishments} on ${establishments.id} = ${establishmentViews.establishmentId}
      where ${establishments.ownerUserId} = ${userId}
        and ${establishmentViews.createdAt} >= ${since30}
      group by ${establishmentViews.establishmentId}
      order by views desc
      limit 10
    `);

    const r7 = (rows7 as any)?.rows?.[0] || { views: 0, visitors: 0 };
    const r30 = (rows30 as any)?.rows?.[0] || { views: 0, visitors: 0 };
    const topRows = ((top as any)?.rows || []) as any[];

    return res.json({
      range7d: { views: Number(r7.views || 0), visitors: Number(r7.visitors || 0) },
      range30d: { views: Number(r30.views || 0), visitors: Number(r30.visitors || 0) },
      topEstablishments: topRows.map((x) => ({
        id: String(x.id),
        name: String(x.name || ""),
        views: Number(x.views || 0),
        visitors: Number(x.visitors || 0),
      })),
    });
  }));

  // R2 presign (browser uploads directly to Cloudflare R2 via PUT)
  // Pro requirement: account required before any submission.
  // Note: we keep this at requireAuth (not requireEstablishment) because it's also used
  // by the "complete profile" step (avatar upload) before profileCompleted becomes true.
  app.post("/api/business/photos/presign", requireAuth, async (req, res) => {
    const parsed = z
      .object({
        fileName: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const out = await presignBusinessPhotoPut(parsed.data);
    if (!out) {
      return res.status(500).json({
        message:
          "R2 not configured. Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET",
      });
    }

    return res.json(out);
  });

  // Business application — creates a pending request.
  // Pro requirement: user must be logged in before submitting.
  app.post("/api/business/apply", requireAuth, requireEstablishment, async (req, res) => {
    const parsed = businessApplySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });

    const userId = req.session.userId!;
    const { name, category, phone, description, photos, address, commune, lat, lng } = parsed.data;
    if (typeof lat === "number" || typeof lng === "number") {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ message: "lat/lng invalid" });
      }
      if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) {
        return res.status(400).json({ message: "lat/lng out of bounds" });
      }
      if (Math.abs(lat!) < 0.000001 && Math.abs(lng!) < 0.000001) {
        return res.status(400).json({ message: "lat/lng cannot be 0,0" });
      }
    }
    const rows = await db
      .insert(businessApplications)
      .values({
        userId,
        name,
        category,
        phone,
        description: description ?? null,
        photos: photos ?? null,
        address: address || null,
        commune: commune || null,
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
      })
      .returning();
    const row = rows[0];
    return res.status(201).json({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
    });
  });

  // Pro: list my business applications
  app.get("/api/business/applications/me", requireAuth, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const rows = await db
      .select()
      .from(businessApplications)
      .where(eq(businessApplications.userId, userId))
      .orderBy(desc(businessApplications.createdAt));
    return res.json({ applications: rows });
  });

  // Admin: list applications
  app.get("/api/admin/business/applications", requireAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const status = String(req.query.status || "pending");
    const rows =
      status === "all"
        ? await db.select().from(businessApplications).orderBy(desc(businessApplications.createdAt))
        : await db
            .select()
            .from(businessApplications)
            .where(eq(businessApplications.status, status))
            .orderBy(desc(businessApplications.createdAt));
    return res.json({ applications: rows });
  });

  // Admin: approve -> create establishment
  app.post("/api/admin/business/applications/:id/approve", requireAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const id = String(req.params.id);
    const bodyLat = req.body?.lat;
    const bodyLng = req.body?.lng;
    const addressFromBody = req.body?.address ? String(req.body.address) : null;
    const communeFromBody = req.body?.commune ? String(req.body.commune) : null;

    const apps = await db.select().from(businessApplications).where(eq(businessApplications.id, id as any)).limit(1);
    const appRow = apps[0];
    if (!appRow) return res.status(404).json({ message: "Application not found" });

    const lat = Number.isFinite(Number(bodyLat)) ? Number(bodyLat) : (appRow as any).lat;
    const lng = Number.isFinite(Number(bodyLng)) ? Number(bodyLng) : (appRow as any).lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "lat/lng missing (provide them or set them on the application)" });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: "lat/lng out of bounds" });
    }
    if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) {
      return res.status(400).json({ message: "lat/lng cannot be 0,0" });
    }

    const address = addressFromBody ?? ((appRow as any).address ?? null);
    const commune = communeFromBody ?? ((appRow as any).commune ?? null);

    // Idempotent: 1 establishment per application. If it already exists (e.g. wrong coords), update it.
    const estRows = await db
      .insert(establishments)
      .values({
        name: appRow.name,
        category: appRow.category,
        phone: appRow.phone,
        description: appRow.description ?? null,
        photos: (appRow as any).photos ?? null,
        address,
        commune,
        lat,
        lng,
        sourceApplicationId: appRow.id,
        ownerUserId: (appRow as any).userId ?? null,
        provider: null,
        providerPlaceId: null,
        published: true,
      })
      .onConflictDoUpdate({
        target: establishments.sourceApplicationId,
        set: {
          name: appRow.name,
          category: appRow.category,
          phone: appRow.phone,
          description: appRow.description ?? null,
          photos: (appRow as any).photos ?? null,
          address,
          commune,
          lat,
          lng,
          ownerUserId: (appRow as any).userId ?? null,
          published: true,
        },
      })
      .returning();

    await db.update(businessApplications).set({ status: "approved" }).where(eq(businessApplications.id, appRow.id));

    // New/updated place => invalidate nearby caches quickly.
    establishmentsCache.clear();
    return res.json({ application: { ...appRow, status: "approved" }, establishment: estRows[0] });
  });

  // Admin: import places from Google Places API (official). This is NOT "scraping".
  // Note: Google returns limited results per request; run multiple times with different areas/types.
  app.post("/api/admin/import/google/nearby", requireAdmin, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });

    const parsed = z
      .object({
        lat: z.number(),
        lng: z.number(),
        radiusMeters: z.number().min(100).max(50000).default(3000),
        types: z.array(z.string().min(2)).min(1).max(10),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    try {
      const { lat, lng, radiusMeters, types } = parsed.data;
      const allowed = new Set([
        "restaurant",
        "bar",
        "night_club",
        "lodging",
        "liquor_store",
        "pharmacy",
        "police",
        "hospital",
        "fire_station",
        "doctor",
      ]);
      const unknown = types.filter((t) => !allowed.has(t));
      if (unknown.length) {
        return res.status(400).json({
          message: `Type(s) Google invalide(s): ${unknown.join(", ")}. Types autorisés: ${Array.from(allowed).join(", ")}`,
        });
      }
      const inserted: string[] = [];
      let seen = 0;

      for (const type of types) {
        const results = await googlePlacesNearbyAll({ lat, lng, radiusMeters, type });
        for (const r of results) {
          if (!r.place_id || !r.geometry?.location) continue;
          seen++;

          const category = mapGoogleTypesToCategory(r.types);
          const address = r.vicinity || null;
          const commune = inferCommuneFromAddress(address);

          const photoRefs = Array.isArray((r as any).photos) ? (r as any).photos : [];
          const photoUrls = photoRefs
            .map((p: any) => String(p?.photo_reference || ""))
            .filter(Boolean)
            .slice(0, 3)
            .map((ref: string) => buildGooglePhotoUrl(ref, { maxWidth: 1200 }))
            .filter(Boolean) as string[];

          const rows = await db
            .insert(establishments)
            .values({
              name: r.name,
              category,
              address,
              commune,
              phone: null,
              description: null,
              photos: photoUrls.length ? photoUrls : null,
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
              sourceApplicationId: null,
              provider: "google",
              providerPlaceId: r.place_id,
              published: true,
            })
            .onConflictDoUpdate({
              target: [establishments.provider, establishments.providerPlaceId],
              set: {
                name: r.name,
                category,
                address,
                commune,
                photos: photoUrls.length ? photoUrls : null,
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
                published: true,
              },
            })
            .returning({ id: establishments.id });

          if (rows[0]?.id) inserted.push(rows[0].id);
        }
      }

      // Imported/updated places => invalidate nearby caches quickly.
      establishmentsCache.clear();
      return res.json({ ok: true, scanned: seen, upserted: inserted.length, ids: inserted.slice(0, 50) });
    } catch (e: any) {
      const msg = e?.message || "Google import failed";
      return res.status(400).json({ message: msg });
    }
  });

  // Public: fetch establishments around a point
  app.get("/api/establishments", async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Math.min(250, Math.max(1, Number(req.query.radiusKm || 10)));
    const category = req.query.category ? String(req.query.category) : "all";
    const q = req.query.q ? String(req.query.q).trim() : "";
    // Default higher because Abidjan imports can easily exceed 200 within 10-25km.
    // Client can still request lower via `limit`.
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit || 1500)));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        message:
          "lat/lng are required. Example: /api/establishments?lat=5.3261&lng=-4.0200&radiusKm=10&category=all",
      });
    }

    // Very small TTL cache to avoid hammering DB during map drags / quick filter toggles.
    // Rounded lat/lng to dedupe noisy updates.
    const key = [
      Math.round(lat * 1e4) / 1e4,
      Math.round(lng * 1e4) / 1e4,
      radiusKm,
      category,
      q.toLowerCase(),
      limit,
    ].join("|");
    const cached = establishmentsCache.get(key);
    if (cached && Date.now() - cached.at < EST_CACHE_TTL_MS) {
      setPublicApiCacheHeaders(res, cached.etag, true);
      const inm = String(req.header("if-none-match") || "");
      if (inm && inm === cached.etag) return res.status(304).end();
      return res.json(cached.body);
    }

    const origin = { lat, lng };
    const radiusM = radiusKm * 1000;
    const dLat = radiusKm / 111.32;
    const dLng = radiusKm / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

    const whereParts: any[] = [
      eq(establishments.published, true),
      gte(establishments.lat, lat - dLat),
      lte(establishments.lat, lat + dLat),
      gte(establishments.lng, lng - dLng),
      lte(establishments.lng, lng + dLng),
    ];
    if (category && category !== "all") whereParts.push(eq(establishments.category, category));

    // Important: Without ORDER BY, LIMIT can return arbitrary rows => some categories might "randomly" disappear.
    // We order by a cheap approximate distance so results are stable and relevant.
    const candidateLimit = Math.min(60000, Math.max(5000, limit * 12));
    const candidates = await db
      .select()
      .from(establishments)
      .where(and(...whereParts))
      .orderBy(
        sql`ABS(${establishments.lat} - ${lat}) + ABS(${establishments.lng} - ${lng})`,
      )
      .limit(candidateLimit);

    const qLower = q.toLowerCase();
    const filtered = candidates
      .map((e) => ({ ...e, distanceMeters: haversineMeters(origin, { lat: e.lat, lng: e.lng }) }))
      .filter((e) => e.distanceMeters <= radiusM)
      .filter((e) => {
        if (!q) return true;
        const hay = `${e.name ?? ""} ${e.address ?? ""} ${e.commune ?? ""} ${e.category ?? ""}`.toLowerCase();
        return hay.includes(qLower);
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    const body = { establishments: filtered };
    const etag = computeWeakEtag(body);
    establishmentsCache.set(key, { at: Date.now(), body, etag });
    if (establishmentsCache.size > 200) {
      const first = establishmentsCache.keys().next().value;
      if (first) establishmentsCache.delete(first);
    }
    setPublicApiCacheHeaders(res, etag, false);
    const inm = String(req.header("if-none-match") || "");
    if (inm && inm === etag) return res.status(304).end();
    return res.json(body);
  });

  // Establishment: publish a place directly to the map (requires logged-in establishment profile)
  app.post("/api/establishments", requireAuth, requireEstablishment, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;

    const parsed = z
      .object({
        name: z.string().min(2).max(120),
        category: z.string().min(2).max(40),
        address: z.string().max(200).optional(),
        commune: z.string().max(80).optional(),
        phone: z.string().max(30).optional(),
        description: z.string().max(500).optional(),
        photos: z.array(z.string().url()).max(10).optional(),
        lat: z.number(),
        lng: z.number(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const data = parsed.data;
    const rows = await db
      .insert(establishments)
      .values({
        name: data.name,
        category: data.category,
        address: data.address || null,
        commune: data.commune || null,
        phone: data.phone || null,
        description: data.description || null,
        photos: data.photos?.length ? data.photos : null,
        lat: data.lat,
        lng: data.lng,
        sourceApplicationId: null,
        ownerUserId: userId,
        provider: "manual",
        providerPlaceId: null,
        // Moderation: admin must approve before public listing
        published: false,
      })
      .returning();
    // New place => invalidate nearby caches quickly.
    establishmentsCache.clear();
    return res.status(201).json({ establishment: rows[0] });
  });

  // Pro: list my establishments (owned)
  app.get("/api/establishments/me", requireAuth, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const rows = await db
      .select()
      .from(establishments)
      .where(eq(establishments.ownerUserId, userId))
      .orderBy(desc(establishments.createdAt));
    return res.json({ establishments: rows });
  });

  // Public: fetch a single establishment (used by Details/Navigation when coming from DB)
  app.get("/api/establishments/:id", asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const id = String(req.params.id);
    // Safety: prevent UUID cast errors (e.g. "/api/establishments/me" accidentally hitting this route)
    if (id === "me") return res.status(404).json({ message: "Not found" });
    if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
    const rows = await db.select().from(establishments).where(eq(establishments.id, id as any)).limit(1);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Not found" });
    // Do not leak non-published establishments publicly. Owner or admin can still access.
    if ((row as any).published === false) {
      const sessionUserId = req.session?.userId;
      const isOwner = sessionUserId && String((row as any).ownerUserId || "") === String(sessionUserId);
      let isAdmin = false;
      if (db && sessionUserId) {
        const uRows = await db.select().from(users).where(eq(users.id, String(sessionUserId))).limit(1);
        isAdmin = String((uRows[0] as any)?.role || "") === "admin" && !(uRows[0] as any)?.deletedAt;
      }
      if (!isOwner && !isAdmin) return res.status(404).json({ message: "Not found" });
    }
    return res.json({ establishment: row });
  }));

  app.get("/api/auth/me", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if ((user as any).deletedAt) return res.status(401).json({ message: "Unauthorized" });
    return res.json({ user: safeUser(user) });
  });

  // Email verification link (clicked from mailbox)
  app.get("/api/auth/verify-email", asyncHandler(async (req, res) => {
    if (!db) return res.status(500).send("DATABASE_URL not configured");
    const token = String(req.query.token || "").trim();
    if (!token) return res.status(400).send("Missing token");

    const rows = await db.select().from(users).where(eq(users.emailVerificationToken, token)).limit(1);
    const u = rows[0] as any;
    if (!u) return res.status(400).send("Invalid or expired token");

    await db
      .update(users)
      .set({ emailVerified: true, emailVerificationToken: null, emailVerificationCode: null, emailVerificationSentAt: null })
      .where(eq(users.id, u.id));

    // Simple confirmation page (works in mobile browser too)
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`
      <html><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
      <body style="font-family:system-ui; padding:24px;">
        <h2>Email confirmé ✅</h2>
        <p>Vous pouvez revenir dans l’application et continuer sur l’espace Pro.</p>
      </body></html>
    `);
  }));

  // Email verification via code (preferred for mobile)
  // Supports both authenticated (session) and unauthenticated (email+code) verification.
  app.post("/api/auth/verify-email-code", asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const parsed = z
      .object({
        code: z.string().min(4).max(12),
        email: z.string().min(3).max(200).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const code = String(parsed.data.code || "").trim().replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: "Code invalide" });

    const sessionUserId = req.session?.userId ? String(req.session.userId) : "";
    let rows: any[] = [];
    if (sessionUserId) {
      rows = await db.select().from(users).where(eq(users.id, sessionUserId)).limit(1);
    } else {
      const login = String(parsed.data.email || "").trim().toLowerCase();
      if (!login || !looksLikeEmail(login)) return res.status(400).json({ message: "Email requis" });
      rows = await db
        .select()
        .from(users)
        .where(or(sql`lower(trim(${users.email})) = ${login}`, sql`lower(trim(${users.username})) = ${login}`))
        .limit(1);
    }
    const u = rows[0] as any;
    // Don't leak whether the account exists.
    if (!u || u.deletedAt) return res.status(400).json({ message: "Code invalide" });
    if (u.emailVerified) return res.json({ ok: true, alreadyVerified: true, user: safeUser(u) });

    const stored = String(u.emailVerificationCode || "").replace(/\D/g, "").slice(0, 6);
    let sentAtMs =
      u.emailVerificationSentAt instanceof Date
        ? u.emailVerificationSentAt.getTime()
        : (u.emailVerificationSentAt ? Date.parse(String(u.emailVerificationSentAt)) : 0);
    if (!stored) return res.status(400).json({ message: "Aucun code actif. Appuie sur “Renvoyer le code”." });
    // Be tolerant if timestamp parsing fails (some drivers can return non-parseable strings).
    if (!Number.isFinite(sentAtMs) || sentAtMs <= 0) sentAtMs = Date.now();
    if (Date.now() - sentAtMs > 15 * 60_000) return res.status(400).json({ message: "Code expiré. Appuie sur “Renvoyer le code”." });
    if (stored !== code) return res.status(400).json({ message: "Code invalide (utilise le dernier code reçu)." });

    await db
      .update(users)
      .set({ emailVerified: true, emailVerificationCode: null, emailVerificationToken: null, emailVerificationSentAt: null })
      .where(eq(users.id, u.id));

    const updated = await storage.getUser(String(u.id));
    return res.json({ ok: true, user: safeUser(updated) });
  }));

  app.post("/api/auth/register", async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    await logDbIdentityOnce();
    // We accept {username,password} for backwards compatibility, but we require username to be an email
    // so we can send a confirmation email.
    const parsed = z
      .object({
        username: z.string().min(3).max(200),
        password: z.string().min(6).max(200),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { username, password } = parsed.data;
    const email = String(username).trim().toLowerCase();
    if (!looksLikeEmail(email)) return res.status(400).json({ message: "Email invalide (utilise un email comme identifiant)." });

    // Check both username and email (some older accounts may have username != email but email filled).
    const existingRows = await db
      .select()
      .from(users)
      .where(
        or(
          sql`lower(trim(${users.username})) = ${email}`,
          sql`lower(trim(${users.email})) = ${email}`,
        ),
      )
      .limit(1);
    if (existingRows[0]) return res.status(409).json({ message: "Un compte existe déjà avec cet email." });

    const user = await storage.createUser({
      username: email,
      email,
      password: await hashPassword(password),
    });
    const token = makeToken(24); // legacy link support (kept as fallback)
    const code = make6DigitCode();
    await db
      .update(users)
      .set({
        emailVerified: false,
        emailVerificationToken: token,
        emailVerificationCode: code,
        emailVerificationSentAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Send verification email (best effort)
    try {
      console.log(`[Resend] register: attempting to send verification email to=${email}`);
      await resendSendEmail({
        from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
        to: email,
        subject: "Confirme ton email — O'Show",
        html: `
          <div style="font-family:system-ui; line-height:1.5">
            <h2>Bienvenue sur O'Show</h2>
            <p>Voici ton code de confirmation :</p>
            <div style="font-size:28px; font-weight:700; letter-spacing:6px; padding:12px 0">${code}</div>
            <p style="color:#64748b; font-size:12px">Ce code expire dans 15 minutes.</p>
          </div>
        `,
      });
      console.log(`[Resend] register: sent verification email to=${email}`);
    } catch (e: any) {
      console.warn("[Resend] email verification failed:", e?.message || e);
      // Don't block registration.
    }
    req.session.userId = user.id;
    const updated = await storage.getUser(user.id);
    return res.status(201).json({ user: safeUser(updated) });
  });

  app.post("/api/auth/login", async (req, res) => {
    await logDbIdentityOnce();
    const parsed = z
      .object({
        username: z.string().min(3).max(200),
        password: z.string().min(6).max(200),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { username, password } = parsed.data;
    const login = String(username).trim().toLowerCase();

    // Allow login by username OR email.
    let user = await storage.getUserByUsername(login);
    if (!user && db) {
      const rows = await db
        .select()
        .from(users)
        .where(sql`lower(trim(${users.email})) = ${login}`)
        .limit(1);
      user = rows[0] as any;
    }
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if ((user as any).deletedAt) return res.status(403).json({ message: "Compte supprimé." });
    const ok = await verifyPassword(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    req.session.userId = user.id;
    return res.json({ user: safeUser(user) });
  });

  // Password reset (request) - generates a short code and sends it with Resend.
  app.post("/api/auth/request-password-reset", asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    await logDbIdentityOnce();
    const parsed = z.object({ email: z.string().min(3).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const email = String(parsed.data.email).trim().toLowerCase();
    if (!looksLikeEmail(email)) return res.status(200).json({ ok: true });

    // Always return ok (avoid user enumeration).
    console.log(`[PasswordReset] request: email=${email}`);
    const rows = await db
      .select()
      .from(users)
      .where(
        or(
          sql`lower(trim(${users.email})) = ${email}`,
          sql`lower(trim(${users.username})) = ${email}`,
        ),
      )
      .limit(1);
    const u = rows[0] as any;
    if (!u || u.deletedAt) {
      console.log(`[PasswordReset] request: user_not_found_or_deleted email=${email}`);
      return res.json({ ok: true });
    }

    // Anti-spam: 1 reset / 60s
    const last = u.passwordResetSentAt ? Date.parse(String(u.passwordResetSentAt)) : 0;
    if (last && Date.now() - last < 60_000) {
      console.log(`[PasswordReset] request: throttled email=${email}`);
      return res.json({ ok: true });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
    await db
      .update(users)
      .set({ passwordResetCode: code, passwordResetSentAt: new Date() })
      .where(eq(users.id, u.id));

    try {
      console.log(`[Resend] password-reset: attempting to send to=${email}`);
      const out = await resendSendEmail({
        from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
        to: email,
        subject: "Réinitialiser ton mot de passe — O'Show",
        html: `
          <div style="font-family:system-ui; line-height:1.5">
            <h2>Réinitialisation du mot de passe</h2>
            <p>Voici ton code (valable ~15 minutes) :</p>
            <p style="font-size:24px; font-weight:800; letter-spacing:2px">${code}</p>
            <p>Dans l’application, ouvre Settings → Mot de passe puis saisis ce code.</p>
          </div>
        `,
      });
      console.log(`[Resend] password-reset: sent id=${String((out as any)?.id || "")} to=${email}`);
    } catch (e: any) {
      console.warn("[Resend] password reset failed:", e?.message || e);
      return res.status(503).json({
        message:
          "Service email indisponible. Vérifie RESEND_KEY_API sur le backend et que le domaine d'envoi est validé dans Resend.",
      });
    }
    return res.json({ ok: true });
  }));

  // Password reset (confirm) - user provides email + code + new password.
  app.post("/api/auth/reset-password", asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const parsed = z
      .object({
        email: z.string().min(3).max(200),
        code: z.string().min(4).max(12),
        newPassword: z.string().min(6).max(200),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const email = String(parsed.data.email).trim().toLowerCase();
    const code = String(parsed.data.code).trim();
    const newPassword = parsed.data.newPassword;
    if (!looksLikeEmail(email)) return res.status(400).json({ message: "Email invalide" });

    const rows = await db
      .select()
      .from(users)
      .where(
        or(
          sql`lower(trim(${users.email})) = ${email}`,
          sql`lower(trim(${users.username})) = ${email}`,
        ),
      )
      .limit(1);
    const u = rows[0] as any;
    if (!u || u.deletedAt) return res.status(400).json({ message: "Code invalide" });

    const sentAt = u.passwordResetSentAt ? Date.parse(String(u.passwordResetSentAt)) : 0;
    if (!u.passwordResetCode || !sentAt) return res.status(400).json({ message: "Code invalide" });
    if (Date.now() - sentAt > 15 * 60_000) return res.status(400).json({ message: "Code expiré" });
    if (String(u.passwordResetCode) !== code) return res.status(400).json({ message: "Code invalide" });

    await db
      .update(users)
      .set({ password: await hashPassword(newPassword), passwordResetCode: null, passwordResetSentAt: null })
      .where(eq(users.id, u.id));

    try {
      await resendSendEmail({
        from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
        to: email,
        subject: "Mot de passe modifié — O'Show",
        html: `<div style="font-family:system-ui; line-height:1.5"><h2>Mot de passe modifié ✅</h2><p>Si ce n’est pas toi, contacte le support immédiatement.</p></div>`,
      });
    } catch (e: any) {
      console.warn("[Resend] password change notice failed:", e?.message || e);
    }
    return res.json({ ok: true });
  }));

  // Change password (logged-in)
  app.post("/api/auth/change-password", requireAuth, asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const parsed = z
      .object({
        currentPassword: z.string().min(6).max(200),
        newPassword: z.string().min(6).max(200),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const u = await storage.getUser(userId);
    if (!u) return res.status(401).json({ message: "Unauthorized" });
    if ((u as any).deletedAt) return res.status(403).json({ message: "Compte supprimé." });
    const ok = await verifyPassword(parsed.data.currentPassword, (u as any).password);
    if (!ok) return res.status(400).json({ message: "Mot de passe actuel invalide" });

    await db.update(users).set({ password: await hashPassword(parsed.data.newPassword) }).where(eq(users.id, userId));
    const email = String((u as any).email || (u as any).username || "").trim().toLowerCase();
    if (email && looksLikeEmail(email)) {
      try {
        await resendSendEmail({
          from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
          to: email,
          subject: "Mot de passe modifié — O'Show",
          html: `<div style="font-family:system-ui; line-height:1.5"><h2>Mot de passe modifié ✅</h2><p>Si ce n’est pas toi, contacte le support immédiatement.</p></div>`,
        });
      } catch (e: any) {
        console.warn("[Resend] password change notice failed:", e?.message || e);
      }
    }
    return res.json({ ok: true });
  }));

  // Change password via code (logged-in, 2-step)
  app.post("/api/auth/request-password-change-code", requireAuth, asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const u = await storage.getUser(userId);
    if (!u) return res.status(401).json({ message: "Unauthorized" });
    if ((u as any).deletedAt) return res.status(403).json({ message: "Compte supprimé." });
    const email = String((u as any).email || (u as any).username || "").trim().toLowerCase();
    if (!email || !looksLikeEmail(email)) return res.status(400).json({ message: "Email invalide sur le compte." });

    const rowsUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const dbUser = rowsUser[0] as any;
    const last = dbUser?.passwordChangeSentAt ? Date.parse(String(dbUser.passwordChangeSentAt)) : 0;
    if (last && Date.now() - last < 60_000) {
      return res.status(429).json({ message: "Veuillez patienter avant de renvoyer le code." });
    }

    const code = make6DigitCode();
    await db
      .update(users)
      .set({ passwordChangeCode: code, passwordChangeSentAt: new Date() })
      .where(eq(users.id, userId));

    try {
      await resendSendEmail({
        from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
        to: email,
        subject: "Code de changement de mot de passe — O'Show",
        html: `
          <div style="font-family:system-ui; line-height:1.5">
            <h2>Changement de mot de passe</h2>
            <p>Voici ton code :</p>
            <div style="font-size:28px; font-weight:700; letter-spacing:6px; padding:12px 0">${code}</div>
            <p style="color:#64748b; font-size:12px">Ce code expire dans 15 minutes.</p>
          </div>
        `,
      });
    } catch (e: any) {
      console.warn("[Resend] password change code failed:", e?.message || e);
      return res.status(503).json({ message: "Service email indisponible." });
    }

    return res.json({ ok: true });
  }));

  app.post("/api/auth/confirm-password-change", requireAuth, asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const parsed = z.object({ code: z.string().min(4).max(12), newPassword: z.string().min(6).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const code = String(parsed.data.code || "").trim().replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ message: "Code invalide" });

    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const u = rows[0] as any;
    if (!u || u.deletedAt) return res.status(401).json({ message: "Unauthorized" });

    const sentAt = u.passwordChangeSentAt ? Date.parse(String(u.passwordChangeSentAt)) : 0;
    if (!u.passwordChangeCode || !sentAt) return res.status(400).json({ message: "Code invalide" });
    if (Date.now() - sentAt > 15 * 60_000) return res.status(400).json({ message: "Code expiré" });
    if (String(u.passwordChangeCode).replace(/\D/g, "").slice(0, 6) !== code) return res.status(400).json({ message: "Code invalide" });

    await db
      .update(users)
      .set({
        password: await hashPassword(parsed.data.newPassword),
        passwordChangeCode: null,
        passwordChangeSentAt: null,
      })
      .where(eq(users.id, userId));

    const email = String(u.email || u.username || "").trim().toLowerCase();
    if (email && looksLikeEmail(email)) {
      try {
        await resendSendEmail({
          from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
          to: email,
          subject: "Mot de passe modifié — O'Show",
          html: `<div style="font-family:system-ui; line-height:1.5"><h2>Mot de passe modifié ✅</h2><p>Si ce n’est pas toi, contacte le support immédiatement.</p></div>`,
        });
      } catch (e: any) {
        console.warn("[Resend] password change notice failed:", e?.message || e);
      }
    }

    return res.json({ ok: true });
  }));

  // Delete account (soft delete)
  app.post("/api/auth/delete-account", requireAuth, asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const parsed = z.object({ confirm: z.literal("DELETE") }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Confirmation requise" });

    const u = await storage.getUser(userId);
    if (!u) return res.status(401).json({ message: "Unauthorized" });
    if ((u as any).deletedAt) return res.json({ ok: true, already: true });

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
    const email = String((u as any).email || (u as any).username || "").trim().toLowerCase();
    if (email && looksLikeEmail(email)) {
      try {
        await resendSendEmail({
          from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
          to: email,
          subject: "Compte supprimé — O'Show",
          html: `<div style="font-family:system-ui; line-height:1.5"><h2>Votre compte a été supprimé</h2><p>Si ce n’est pas vous, contactez le support immédiatement.</p></div>`,
        });
      } catch (e: any) {
        console.warn("[Resend] delete notice failed:", e?.message || e);
      }
    }

    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  }));

  // Resend verification email (Pro onboarding helper)
  app.post("/api/auth/resend-verification", requireAuth, asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const rowsUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const u = rowsUser[0] as any;
    if (!u) return res.status(401).json({ message: "Unauthorized" });
    const email = String(u.email || u.username || "").trim().toLowerCase();
    if (!email || !looksLikeEmail(email)) return res.status(400).json({ message: "Email invalide sur le compte." });
    if (u.emailVerified) return res.json({ ok: true, alreadyVerified: true });

    // Basic anti-spam: 1 email / 60s
    const last = u.emailVerificationSentAt ? Date.parse(String(u.emailVerificationSentAt)) : 0;
    if (last && Date.now() - last < 60_000) {
      return res.status(429).json({ message: "Veuillez patienter avant de renvoyer l’email." });
    }

    const token = makeToken(24);
    const code = make6DigitCode();
    await db
      .update(users)
      .set({
        emailVerified: false,
        emailVerificationToken: token,
        emailVerificationCode: code,
        emailVerificationSentAt: new Date(),
      })
      .where(eq(users.id, userId));

    try {
      await resendSendEmail({
        from: String(process.env.RESEND_FROM || "mapper-oshow@binary-security.com"),
        to: email,
        subject: "Confirme ton email — O'Show",
        html: `
          <div style="font-family:system-ui; line-height:1.5">
            <h2>Confirmer l’email</h2>
            <p>Voici ton code de confirmation :</p>
            <div style="font-size:28px; font-weight:700; letter-spacing:6px; padding:12px 0">${code}</div>
            <p style="color:#64748b; font-size:12px">Ce code expire dans 15 minutes.</p>
          </div>
        `,
      });
    } catch (e: any) {
      console.warn("[Resend] email verification resend failed:", e?.message || e);
      return res.status(503).json({
        message:
          "Service email indisponible. Vérifie RESEND_KEY_API/RESEND_API_KEY et RESEND_FROM (ou vérifie le domaine d’envoi dans Resend).",
      });
    }

    return res.json({ ok: true });
  }));

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  // Establishment profile
  app.get("/api/profile", requireAuth, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const rows = await db.select().from(establishmentProfiles).where(eq(establishmentProfiles.userId, userId)).limit(1);
    return res.json({ profile: rows[0] ?? null });
  });

  // Role intent (allows establishment accounts to continue onboarding and complete profile later).
  app.post("/api/profile/intent", requireAuth, asyncHandler(async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const parsed = z.object({ role: z.enum(["user", "establishment"]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const u = rows[0] as any;
    if (!u) return res.status(401).json({ message: "Unauthorized" });

    const nextRole = parsed.data.role;
    // Never downgrade an already completed establishment profile.
    const nextProfileCompleted = nextRole === "establishment" ? !!u.profileCompleted : false;

    await db
      .update(users)
      .set({ role: nextRole, profileCompleted: nextProfileCompleted })
      .where(eq(users.id, userId));

    const updatedUser = await storage.getUser(userId);
    return res.json({ user: safeUser(updatedUser) });
  }));

  app.post("/api/profile", requireAuth, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const parsed = upsertEstablishmentProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { ownerFirstName, ownerLastName, name, category, address, phone, lat, lng, description, avatarUrl, instagram, whatsapp, website } = parsed.data;

    const rows = await db
      .insert(establishmentProfiles)
      .values({
        userId,
        ownerFirstName: ownerFirstName || null,
        ownerLastName: ownerLastName || null,
        name,
        category,
        address: address || null,
        phone: phone || null,
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        description: description || null,
        avatarUrl: avatarUrl || null,
        instagram: instagram || null,
        whatsapp: whatsapp || null,
        website: website || null,
      })
      .onConflictDoUpdate({
        target: establishmentProfiles.userId,
        set: {
          ownerFirstName: ownerFirstName || null,
          ownerLastName: ownerLastName || null,
          name,
          category,
          address: address || null,
          phone: phone || null,
          lat: typeof lat === "number" ? lat : null,
          lng: typeof lng === "number" ? lng : null,
          description: description || null,
          avatarUrl: avatarUrl || null,
          instagram: instagram || null,
          whatsapp: whatsapp || null,
          website: website || null,
        },
      })
      .returning();

    await db.update(users).set({ role: "establishment", profileCompleted: true }).where(eq(users.id, userId));
    const updatedUser = await storage.getUser(userId);
    return res.json({ user: safeUser(updatedUser), profile: rows[0] });
  });

  // Events (public)
  app.get("/api/events", async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Math.min(250, Math.max(1, Number(req.query.radiusKm || 10)));
    const withinHours = Math.min(168, Math.max(1, Number(req.query.withinHours || 72)));
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit || 300)));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "lat/lng are required" });
    }

    const now = new Date();
    const end = new Date(Date.now() + withinHours * 60 * 60 * 1000);
    const origin = { lat, lng };
    const radiusM = radiusKm * 1000;

    // Basic join to include establishment data; we'll filter by distance in JS like establishments endpoint.
    const rows = await db
      .select({
        ev: events,
        est: establishments,
        prof: establishmentProfiles,
        user: users,
      })
      .from(events)
      .leftJoin(establishments, eq(events.establishmentId, establishments.id))
      .leftJoin(establishmentProfiles, eq(events.userId, establishmentProfiles.userId))
      .leftJoin(users, eq(events.userId, users.id))
      .where(
        and(
          eq(events.published, true),
          gte(events.startsAt, now),
          lte(events.startsAt, end),
          eq(establishments.published, true),
        ),
      )
      .orderBy(events.startsAt)
      .limit(Math.min(6000, limit * 8));

    const out = rows
      .filter((r) => r.est && Number.isFinite((r.est as any).lat) && Number.isFinite((r.est as any).lng))
      .map((r) => {
        const est = r.est as any;
        const dist = haversineMeters(origin, { lat: est.lat, lng: est.lng });
        return {
          ...r.ev,
          distanceMeters: dist,
          establishment: est,
          organizer: {
            userId: String((r.user as any)?.id || r.ev.userId),
            name: String((r.prof as any)?.name || (r.user as any)?.username || "Organisateur"),
            avatarUrl: (r.prof as any)?.avatarUrl || null,
          },
        };
      })
      .filter((x) => x.distanceMeters <= radiusM)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return res.json({ events: out });
  });

  // Events (pro): my events
  app.get("/api/events/me", requireAuth, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const rows = await db
      .select({
        ev: events,
        est: establishments,
      })
      .from(events)
      .leftJoin(establishments, eq(events.establishmentId, establishments.id))
      .where(eq(events.userId, userId))
      .orderBy(desc(events.createdAt))
      .limit(500);
    return res.json({
      events: rows.map((r) => ({ ...r.ev, establishment: r.est })),
    });
  });

  // Events (pro): create event (requires establishment profile + ownership)
  app.post("/api/events", requireAuth, requireEstablishment, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const parsed = z
      .object({
        establishmentId: z.string().uuid(),
        title: z.string().min(3).max(140),
        category: z.string().min(2).max(40).default("event"),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime().optional(),
        description: z.string().max(800).optional(),
        coverUrl: z.string().url().max(500).optional(),
        photos: z.array(z.string().url().max(500)).max(10).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const estId = parsed.data.establishmentId;
    const estRows = await db.select().from(establishments).where(eq(establishments.id, estId as any)).limit(1);
    const est = estRows[0] as any;
    if (!est) return res.status(404).json({ message: "Establishment not found" });
    if (String(est.ownerUserId || "") !== String(userId)) {
      return res.status(403).json({ message: "Not allowed for this establishment" });
    }

    const rows = await db
      .insert(events)
      .values({
        userId,
        establishmentId: estId as any,
        title: parsed.data.title,
        category: parsed.data.category,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        description: parsed.data.description ?? null,
        coverUrl: parsed.data.coverUrl ?? null,
        photos: parsed.data.photos?.length ? parsed.data.photos : null,
        // Moderation: admin must approve before public listing
        published: false,
      })
      .returning();
    return res.status(201).json({ event: rows[0] });
  });

  // User events (public): nearby meetups / parties
  app.get("/api/user-events", async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Math.min(250, Math.max(1, Number(req.query.radiusKm || 10)));
    const withinHours = Math.min(168, Math.max(1, Number(req.query.withinHours || 72)));
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit || 300)));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "lat/lng are required" });
    }

    const now = new Date();
    const end = new Date(Date.now() + withinHours * 60 * 60 * 1000);
    const origin = { lat, lng };
    const radiusM = radiusKm * 1000;

    const rows = await db
      .select({
        ue: userEvents,
        user: users,
      })
      .from(userEvents)
      .leftJoin(users, eq(userEvents.userId, users.id))
      .where(and(eq(userEvents.published, true), gte(userEvents.startsAt, now), lte(userEvents.startsAt, end)))
      .orderBy(userEvents.startsAt)
      .limit(Math.min(6000, limit * 8));

    const out = rows
      .map((r) => {
        const ue = r.ue as any;
        const dist = haversineMeters(origin, { lat: ue.lat, lng: ue.lng });
        return {
          ...ue,
          distanceMeters: dist,
          organizer: {
            userId: String((r.user as any)?.id || ue.userId),
            name: String((r.user as any)?.username || "Utilisateur"),
          },
        };
      })
      .filter((x) => x.distanceMeters <= radiusM)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return res.json({ userEvents: out });
  });

  // User events (private): my meetups
  app.get("/api/user-events/me", requireAuth, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const rows = await db.select().from(userEvents).where(eq(userEvents.userId, userId)).orderBy(desc(userEvents.createdAt)).limit(500);
    return res.json({ userEvents: rows });
  });

  // User events (private): create
  app.post("/api/user-events", requireAuth, requireVerifiedEmail, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const parsed = z
      .object({
        kind: z.enum(["party", "meet"]).default("party"),
        title: z.string().min(3).max(140),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime().optional(),
        description: z.string().max(800).optional(),
        lat: z.number(),
        lng: z.number(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const rows = await db
      .insert(userEvents)
      .values({
        userId,
        kind: parsed.data.kind,
        title: parsed.data.title,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        description: parsed.data.description ?? null,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        // Moderation: admin must approve before public listing
        published: false,
      })
      .returning();
    return res.status(201).json({ userEvent: rows[0] });
  });

  // Admin moderation endpoints (token-based)
  app.get(
    "/api/admin/moderation/pending",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));

      const pendingEstablishments = await db
        .select({
          est: establishments,
          owner: users,
          prof: establishmentProfiles,
        })
        .from(establishments)
        .leftJoin(users, eq(establishments.ownerUserId, users.id))
        .leftJoin(establishmentProfiles, eq(establishments.ownerUserId, establishmentProfiles.userId))
        .where(eq(establishments.published, false))
        .orderBy(desc(establishments.createdAt))
        .limit(limit);

      const pendingEvents = await db
        .select({
          ev: events,
          est: establishments,
          prof: establishmentProfiles,
          user: users,
        })
        .from(events)
        .leftJoin(establishments, eq(events.establishmentId, establishments.id))
        .leftJoin(establishmentProfiles, eq(events.userId, establishmentProfiles.userId))
        .leftJoin(users, eq(events.userId, users.id))
        .where(eq(events.published, false))
        .orderBy(desc(events.createdAt))
        .limit(limit);

      const pendingUserEvents = await db
        .select({
          ue: userEvents,
          user: users,
        })
        .from(userEvents)
        .leftJoin(users, eq(userEvents.userId, users.id))
        .where(eq(userEvents.published, false))
        .orderBy(desc(userEvents.createdAt))
        .limit(limit);

      return res.json({
        pending: {
          establishments: pendingEstablishments.map((r: any) => ({
            ...r.est,
            owner: {
              userId: String(r.owner?.id || r.est.ownerUserId || ""),
              name: String(r.prof?.name || r.owner?.username || "Propriétaire"),
            },
          })),
          events: pendingEvents.map((r: any) => ({
            ...r.ev,
            establishment: r.est || null,
            organizer: {
              userId: String(r.user?.id || r.ev.userId),
              name: String(r.prof?.name || r.user?.username || "Organisateur"),
              avatarUrl: r.prof?.avatarUrl || null,
            },
          })),
          userEvents: pendingUserEvents.map((r: any) => ({
            ...r.ue,
            organizer: { userId: String(r.user?.id || r.ue.userId), name: String(r.user?.username || "Utilisateur") },
          })),
        },
      });
    }),
  );

  // Admin: approve/reject establishments (manual submissions)
  app.post(
    "/api/admin/establishments/:id/approve",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.update(establishments).set({ published: true }).where(eq(establishments.id, id as any));
      establishmentsCache.clear();
      return res.json({ ok: true });
    }),
  );

  app.post(
    "/api/admin/establishments/:id/reject",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.delete(establishments).where(eq(establishments.id, id as any));
      establishmentsCache.clear();
      return res.json({ ok: true });
    }),
  );

  // Admin: hard delete any content (even if already published)
  app.delete(
    "/api/admin/establishments/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.delete(establishments).where(eq(establishments.id, id as any));
      establishmentsCache.clear();
      return res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/admin/events/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.delete(events).where(eq(events.id, id as any));
      return res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/admin/user-events/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.delete(userEvents).where(eq(userEvents.id, id as any));
      return res.json({ ok: true });
    }),
  );

  // Admin: create users + set roles (full powers)
  app.post(
    "/api/admin/users",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const parsed = z
        .object({
          email: z.string().min(3).max(200),
          password: z.string().min(6).max(200),
          role: z.enum(["user", "establishment", "admin"]).default("user"),
          emailVerified: z.boolean().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const email = String(parsed.data.email || "").trim().toLowerCase();
      if (!looksLikeEmail(email)) return res.status(400).json({ message: "Email invalide" });

      const existingRows = await db
        .select()
        .from(users)
        .where(or(sql`lower(trim(${users.username})) = ${email}`, sql`lower(trim(${users.email})) = ${email}`))
        .limit(1);
      if (existingRows[0]) return res.status(409).json({ message: "Un compte existe déjà avec cet email." });

      const hashed = await hashPassword(parsed.data.password);
      const rows = await db
        .insert(users)
        .values({
          username: email,
          email,
          password: hashed,
          role: parsed.data.role,
          emailVerified: parsed.data.emailVerified ?? false,
          profileCompleted: parsed.data.role === "establishment" ? false : true,
        } as any)
        .returning();
      return res.status(201).json({ user: safeUser(rows[0]) });
    }),
  );

  app.post(
    "/api/admin/users/set-role",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const parsed = z
        .object({
          login: z.string().min(2).max(200),
          role: z.enum(["user", "establishment", "admin"]),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const login = String(parsed.data.login || "").trim().toLowerCase();
      const role = parsed.data.role;
      const rows = await db
        .select()
        .from(users)
        .where(or(sql`lower(trim(${users.email})) = ${login}`, sql`lower(trim(${users.username})) = ${login}`))
        .limit(1);
      const u = rows[0] as any;
      if (!u) return res.status(404).json({ message: "Utilisateur introuvable" });
      if (u.deletedAt) return res.status(404).json({ message: "Utilisateur introuvable" });
      await db
        .update(users)
        .set({
          role,
          profileCompleted: role === "establishment" ? false : true,
        } as any)
        .where(eq(users.id, u.id));
      const updated = await storage.getUser(String(u.id));
      return res.json({ ok: true, user: safeUser(updated) });
    }),
  );

  app.post(
    "/api/admin/events/:id/approve",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.update(events).set({ published: true }).where(eq(events.id, id as any));

      // Notify users who favorited this establishment (best-effort).
      if (pool) {
        try {
          const evRows = await db
            .select({ ev: events, est: establishments })
            .from(events)
            .leftJoin(establishments, eq(events.establishmentId, establishments.id))
            .where(eq(events.id, id as any))
            .limit(1);
          const row = evRows[0] as any;
          const ev = row?.ev;
          const est = row?.est;
          const estId = String(ev?.establishmentId || "").trim();
          if (estId) {
            const favRows = await pool.query(`select user_id from favorites where establishment_id = $1`, [estId]);
            const userIds = Array.from(new Set(favRows.rows.map((r: any) => String(r.user_id || "")).filter(Boolean)));
            if (userIds.length) {
              const tokRows = await pool.query(`select token from push_tokens where user_id = any($1::varchar[])`, [userIds]);
              const tokens = tokRows.rows.map((r: any) => String(r.token || "")).filter(Boolean);
              await sendExpoPush(tokens, {
                title: "Nouvel évènement",
                body: `${String(est?.name || "Un établissement")} • ${String(ev?.title || "Un nouvel évènement")}`,
                data: { type: "event_published", eventId: id, establishmentId: estId },
              });
            }
          }

          // Also notify nearby users (within 10km of the establishment).
          const lat = Number(est?.lat);
          const lng = Number(est?.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            await pushNotifyNearby({
              center: { lat, lng },
              radiusKm: 10,
              title: "Évènement près de vous",
              body: `${String(est?.name || "Un établissement")} • ${String(ev?.title || "Nouvel évènement")}`,
              data: { type: "event_nearby", eventId: id, establishmentId: estId },
              excludeUserId: String(ev?.userId || ""),
            });
          }
        } catch (e: any) {
          console.warn("[push] notify favorites failed", String(e?.message || e));
        }
      }

      return res.json({ ok: true });
    }),
  );

  app.post(
    "/api/admin/user-events/:id/approve",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.update(userEvents).set({ published: true }).where(eq(userEvents.id, id as any));

      // Notify nearby users (within 10km of the meetup location).
      try {
        const rows = await db.select().from(userEvents).where(eq(userEvents.id, id as any)).limit(1);
        const ue = rows[0] as any;
        const lat = Number(ue?.lat);
        const lng = Number(ue?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          await pushNotifyNearby({
            center: { lat, lng },
            radiusKm: 10,
            title: "Soirée près de vous",
            body: String(ue?.title || "Nouvelle soirée"),
            data: { type: "user_event_nearby", userEventId: id },
            excludeUserId: String(ue?.userId || ""),
          });
        }
      } catch {
        // ignore
      }

      return res.json({ ok: true });
    }),
  );

  app.post(
    "/api/admin/events/:id/reject",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.delete(events).where(eq(events.id, id as any));
      return res.json({ ok: true });
    }),
  );

  app.post(
    "/api/admin/user-events/:id/reject",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
      const id = String(req.params.id || "").trim();
      if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
      await db.delete(userEvents).where(eq(userEvents.id, id as any));
      return res.json({ ok: true });
    }),
  );

  // User events (private): delete
  app.delete("/api/user-events/:id", requireAuth, requireVerifiedEmail, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const id = String(req.params.id || "").trim();
    if (!isUuidLike(id)) return res.status(400).json({ message: "Invalid id" });
    const rows = await db.select().from(userEvents).where(eq(userEvents.id, id as any)).limit(1);
    const ue = rows[0] as any;
    if (!ue) return res.json({ ok: true });
    if (String(ue.userId || "") !== String(userId)) return res.status(403).json({ message: "Not allowed" });
    await db.delete(userEvents).where(eq(userEvents.id, id as any));
    return res.json({ ok: true });
  });

  return httpServer;
}
