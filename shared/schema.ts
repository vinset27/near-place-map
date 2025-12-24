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
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  profileCompleted: boolean("profile_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const establishmentProfiles = pgTable("establishment_profiles", {
  userId: varchar("user_id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  address: text("address"),
  phone: text("phone"),
  description: text("description"),
});

export const businessApplications = pgTable("business_applications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
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
  // External provider import (e.g. Google Places)
  provider: text("provider"),
  providerPlaceId: text("provider_place_id"),
  published: boolean("published").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const upsertEstablishmentProfileSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(40),
  address: z.string().min(0).max(160).optional(),
  phone: z.string().min(0).max(30).optional(),
  description: z.string().min(0).max(500).optional(),
});

export const businessApplySchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(40),
  phone: z.string().min(6).max(30),
  description: z.string().max(500).optional(),
  photos: z.array(z.string().url()).max(10).optional(),
  address: z.string().max(200).optional(),
  commune: z.string().max(80).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type EstablishmentProfile = typeof establishmentProfiles.$inferSelect;
export type BusinessApplication = typeof businessApplications.$inferSelect;
export type Establishment = typeof establishments.$inferSelect;
