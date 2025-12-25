import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import MemoryStoreFactory from "memorystore";
import {
  businessApplications,
  businessApplySchema,
  establishments,
  establishmentProfiles,
  insertUserSchema,
  upsertEstablishmentProfileSchema,
  users,
} from "@shared/schema";
import { hashPassword, verifyPassword } from "./auth";
import { db, ensureAppTables } from "./db";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { presignBusinessPhotoPut } from "./r2";
import { googlePlacesNearbyAll, mapGoogleTypesToCategory } from "./googlePlaces";

type EstablishmentsCacheEntry = { at: number; body: any };
const EST_CACHE_TTL_MS = 10_000;
const establishmentsCache = new Map<string, EstablishmentsCacheEntry>();

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
}

async function requireEstablishment(req: any, res: any, next: any) {
  if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = rows[0];
  if (!u) return res.status(401).json({ message: "Unauthorized" });
  if (u.role !== "establishment" || !u.profileCompleted) {
    return res.status(403).json({ message: "Establishment profile required" });
  }
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(403).json({ message: "ADMIN_TOKEN not configured" });
  const got = String(req.header("x-admin-token") || "").trim();
  const expected = String(token).trim();
  if (!got) return res.status(403).json({ message: "Missing x-admin-token header" });
  if (got !== expected) return res.status(403).json({ message: "Invalid admin token" });
  next();
}

function safeUser(u: any) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
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

  // R2 presign (browser uploads directly to Cloudflare R2 via PUT)
  app.post("/api/business/photos/presign", async (req, res) => {
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

  // Business application (public) — creates a pending request.
  app.post("/api/business/apply", async (req, res) => {
    const parsed = businessApplySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });

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
          published: true,
        },
      })
      .returning();

    await db.update(businessApplications).set({ status: "approved" }).where(eq(businessApplications.id, appRow.id));

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

          const rows = await db
            .insert(establishments)
            .values({
              name: r.name,
              category,
              address,
              commune: null,
              phone: null,
              description: null,
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
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
                published: true,
              },
            })
            .returning({ id: establishments.id });

          if (rows[0]?.id) inserted.push(rows[0].id);
        }
      }

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
    const radiusKm = Math.min(50, Math.max(1, Number(req.query.radiusKm || 10)));
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
      res.setHeader("Cache-Control", "private, max-age=10");
      res.setHeader("X-Cache", "HIT");
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

    const candidateLimit = Math.min(20000, Math.max(2000, limit * 3));
    const candidates = await db
      .select()
      .from(establishments)
      .where(and(...whereParts))
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
    establishmentsCache.set(key, { at: Date.now(), body });
    if (establishmentsCache.size > 200) {
      const first = establishmentsCache.keys().next().value;
      if (first) establishmentsCache.delete(first);
    }
    res.setHeader("Cache-Control", "private, max-age=10");
    res.setHeader("X-Cache", "MISS");
    return res.json(body);
  });

  // Establishment: publish a place directly to the map (requires logged-in establishment profile)
  app.post("/api/establishments", requireAuth, requireEstablishment, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });

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
        provider: "manual",
        providerPlaceId: null,
        published: true,
      })
      .returning();
    return res.status(201).json({ establishment: rows[0] });
  });

  // Public: fetch a single establishment (used by Details/Navigation when coming from DB)
  app.get("/api/establishments/:id", async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const id = String(req.params.id);
    const rows = await db.select().from(establishments).where(eq(establishments.id, id as any)).limit(1);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Not found" });
    return res.json({ establishment: row });
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    return res.json({ user: safeUser(user) });
  });

  app.post("/api/auth/register", async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { username, password } = parsed.data;

    const existing = await storage.getUserByUsername(username);
    if (existing) return res.status(409).json({ message: "Username already exists" });

    const user = await storage.createUser({
      username,
      password: await hashPassword(password),
    });
    req.session.userId = user.id;
    return res.status(201).json({ user: safeUser(user) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { username, password } = parsed.data;

    const user = await storage.getUserByUsername(username);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await verifyPassword(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    req.session.userId = user.id;
    return res.json({ user: safeUser(user) });
  });

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

  app.post("/api/profile", requireAuth, async (req, res) => {
    if (!db) return res.status(500).json({ message: "DATABASE_URL not configured" });
    const userId = req.session.userId!;
    const parsed = upsertEstablishmentProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const { name, category, address, phone, description } = parsed.data;

    const rows = await db
      .insert(establishmentProfiles)
      .values({
        userId,
        name,
        category,
        address: address || null,
        phone: phone || null,
        description: description || null,
      })
      .onConflictDoUpdate({
        target: establishmentProfiles.userId,
        set: {
          name,
          category,
          address: address || null,
          phone: phone || null,
          description: description || null,
        },
      })
      .returning();

    await db.update(users).set({ role: "establishment", profileCompleted: true }).where(eq(users.id, userId));
    const updatedUser = await storage.getUser(userId);
    return res.json({ user: safeUser(updatedUser), profile: rows[0] });
  });

  return httpServer;
}
