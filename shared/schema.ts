import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  uuid,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Matches existing Neon tables (see script/inspectDb.ts output).
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  profileCompleted: boolean("profile_completed").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationSentAt: timestamp("email_verification_sent_at", { withTimezone: true }),
  // New: email verification via code (preferred in mobile)
  emailVerificationCode: text("email_verification_code"),
  passwordResetCode: text("password_reset_code"),
  passwordResetSentAt: timestamp("password_reset_sent_at", { withTimezone: true }),
  // New: logged-in password change via code (2-step)
  passwordChangeCode: text("password_change_code"),
  passwordChangeSentAt: timestamp("password_change_sent_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const establishmentProfiles = pgTable("establishment_profiles", {
  userId: varchar("user_id").primaryKey(),
  ownerFirstName: text("owner_first_name"),
  ownerLastName: text("owner_last_name"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  address: text("address"),
  phone: text("phone"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  instagram: text("instagram"),
  whatsapp: text("whatsapp"),
  website: text("website"),
});

export const businessApplications = pgTable("business_applications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  // Owner account (establishment user) who submitted the application
  userId: varchar("user_id"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  phone: text("phone").notNull(),
  description: text("description"),
  // drizzle pg-core uses text[] via `text("col").array()`
  photos: text("photos").array(),
  address: text("address"),
  commune: text("commune"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
});

// New table for places visible on the map.
export const establishments = pgTable("establishments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  address: text("address"),
  commune: text("commune"),
  phone: text("phone"),
  description: text("description"),
  photos: text("photos").array(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  // Link to application when created via approval flow
  sourceApplicationId: uuid("source_application_id"),
  // Owner account (establishment user) responsible for this place (for Pro)
  ownerUserId: varchar("owner_user_id"),
  // External provider import (e.g. Google Places)
  provider: text("provider"),
  providerPlaceId: text("provider_place_id"),
  // Moderation gate: admin must approve before it becomes public (manual submissions).
  // Imports/admin-approved items can still explicitly set published=true.
  published: boolean("published").notNull().default(false),
});

// Events published by establishments (Pro)
export const events = pgTable("events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Creator account (must be establishment role)
  userId: varchar("user_id").notNull(),
  // Event is attached to a specific establishment
  establishmentId: uuid("establishment_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("event"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  description: text("description"),
  coverUrl: text("cover_url"),
  photos: text("photos").array(),
  videos: text("videos").array(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  moderationStatus: text("moderation_status").notNull().default("pending"),
  moderationReason: text("moderation_reason"),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  // Moderation gate: admin must approve before it becomes public
  published: boolean("published").notNull().default(false),
});

// User-created meetups/parties (public, location-based)
export const userEvents = pgTable("user_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: varchar("user_id").notNull(),
  kind: text("kind").notNull().default("party"), // party | meet
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  description: text("description"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  moderationStatus: text("moderation_status").notNull().default("pending"),
  moderationReason: text("moderation_reason"),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  // Moderation gate: admin must approve before it becomes public
  published: boolean("published").notNull().default(false),
});

// Analytics: every time someone opens an establishment details page we insert a view event.
export const establishmentViews = pgTable("establishment_views", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  establishmentId: uuid("establishment_id").notNull(),
  // Logged-in viewer (if session exists); otherwise null
  viewerUserId: varchar("viewer_user_id"),
  // Anonymous id generated on device (for unique visitors without login)
  anonId: text("anon_id"),
  source: text("source"),
  userAgent: text("user_agent"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
});

export const upsertEstablishmentProfileSchema = z.object({
  // Owner identity (required)
  ownerFirstName: z.string().min(2).max(80),
  ownerLastName: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(40),
  // Optional: we use map pin for location precision; address is just display info.
  address: z.string().min(0).max(160).optional(),
  phone: z.string().min(6).max(30),
  // Required: precise location from map
  lat: z.number(),
  lng: z.number(),
  description: z.string().min(0).max(500).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  instagram: z.string().min(0).max(80).optional(),
  whatsapp: z.string().min(0).max(40).optional(),
  website: z.string().url().max(500).optional(),
});

export const businessApplySchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(40),
  phone: z.string().min(6).max(30),
  description: z.string().max(500).optional(),
  photos: z.array(z.string().url()).max(10).optional(),
  // Optional: map pin is the source of truth for location precision
  address: z.string().max(200).optional(),
  commune: z.string().max(80).optional(),
  lat: z.number(),
  lng: z.number(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type EstablishmentProfile = typeof establishmentProfiles.$inferSelect;
export type BusinessApplication = typeof businessApplications.$inferSelect;
export type Establishment = typeof establishments.$inferSelect;
export type EstablishmentView = typeof establishmentViews.$inferSelect;
export type UserEvent = typeof userEvents.$inferSelect;
