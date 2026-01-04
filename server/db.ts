import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool ? drizzle(pool) : null;

export async function ensureAppTables() {
  if (!pool) return;

  // Users table (auth) - some DBs already have it; keep it defensive.
  await pool.query(`
    create table if not exists users (
      id varchar primary key default gen_random_uuid(),
      username text not null unique,
      email text,
      password text not null,
      role text not null default 'user',
      profile_completed boolean not null default false,
      email_verified boolean not null default false,
      email_verification_token text,
      email_verification_code text,
      email_verification_sent_at timestamptz,
      password_reset_code text,
      password_reset_sent_at timestamptz,
      password_change_code text,
      password_change_sent_at timestamptz,
      deleted_at timestamptz,
      created_at timestamp not null default now()
    );
  `);
  await pool.query(`alter table users add column if not exists email text;`);
  await pool.query(`alter table users add column if not exists email_verified boolean not null default false;`);
  await pool.query(`alter table users add column if not exists email_verification_token text;`);
  await pool.query(`alter table users add column if not exists email_verification_code text;`);
  await pool.query(`alter table users add column if not exists email_verification_sent_at timestamptz;`);
  await pool.query(`alter table users add column if not exists password_reset_code text;`);
  await pool.query(`alter table users add column if not exists password_reset_sent_at timestamptz;`);
  await pool.query(`alter table users add column if not exists password_change_code text;`);
  await pool.query(`alter table users add column if not exists password_change_sent_at timestamptz;`);
  await pool.query(`alter table users add column if not exists deleted_at timestamptz;`);
  // Unique email (allows multiple NULLs)
  await pool.query(`create unique index if not exists users_email_uidx on users (email);`);

  // Existing table (kept for safety if DB is empty).
  await pool.query(`
    create table if not exists business_applications (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      status text not null default 'pending',
      user_id varchar,
      name text not null,
      category text not null,
      phone text not null,
      description text,
      photos text[],
      address text,
      commune text,
      lat double precision,
      lng double precision
    );
  `);

  // If table already existed, add new columns safely.
  await pool.query(`alter table business_applications add column if not exists address text;`);
  await pool.query(`alter table business_applications add column if not exists commune text;`);
  await pool.query(`alter table business_applications add column if not exists lat double precision;`);
  await pool.query(`alter table business_applications add column if not exists lng double precision;`);
  await pool.query(`alter table business_applications add column if not exists user_id varchar;`);

  await pool.query(`
    create table if not exists establishment_profiles (
      user_id varchar primary key,
      owner_first_name text,
      owner_last_name text,
      name text not null,
      category text not null,
      address text,
      phone text,
      lat double precision,
      lng double precision,
      description text,
      avatar_url text,
      instagram text,
      whatsapp text,
      website text
    );
  `);
  await pool.query(`alter table establishment_profiles add column if not exists owner_first_name text;`);
  await pool.query(`alter table establishment_profiles add column if not exists owner_last_name text;`);
  await pool.query(`alter table establishment_profiles add column if not exists avatar_url text;`);
  await pool.query(`alter table establishment_profiles add column if not exists instagram text;`);
  await pool.query(`alter table establishment_profiles add column if not exists whatsapp text;`);
  await pool.query(`alter table establishment_profiles add column if not exists website text;`);
  await pool.query(`alter table establishment_profiles add column if not exists lat double precision;`);
  await pool.query(`alter table establishment_profiles add column if not exists lng double precision;`);

  // Needed for ON CONFLICT (user_id) DO UPDATE to work even if DB was created without PK/unique.
  await pool.query(`
    create unique index if not exists establishment_profiles_user_id_uidx
    on establishment_profiles (user_id);
  `);

  // New table used to show places on the map.
  await pool.query(`
    create table if not exists establishments (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      name text not null,
      category text not null,
      address text,
      commune text,
      phone text,
      description text,
      photos text[],
      lat double precision not null,
      lng double precision not null,
      source_application_id uuid,
      owner_user_id varchar,
      provider text,
      provider_place_id text,
      published boolean not null default false
    );
  `);
  // Ensure moderation default even if table existed before.
  await pool.query(`alter table establishments alter column published set default false;`);

  // If table already existed, add new columns safely.
  await pool.query(`alter table establishments add column if not exists provider text;`);
  await pool.query(`alter table establishments add column if not exists provider_place_id text;`);
  await pool.query(`alter table establishments add column if not exists source_application_id uuid;`);
  await pool.query(`alter table establishments add column if not exists photos text[];`);
  await pool.query(`alter table establishments add column if not exists owner_user_id varchar;`);
  await pool.query(`create index if not exists establishments_published_lat_lng_idx on establishments (published, lat, lng);`);
  await pool.query(`create index if not exists establishments_created_at_idx on establishments (created_at desc);`);

  // Avoid duplicates for imported providers (google place_id).
  // Use a real UNIQUE constraint so `ON CONFLICT (provider, provider_place_id)` always matches.
  await pool.query(`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'establishments_provider_place_uniq'
      ) then
        alter table establishments
        add constraint establishments_provider_place_uniq
        unique (provider, provider_place_id);
      end if;
    end$$;
  `);

  // One published establishment per business application (idempotent approve).
  await pool.query(`
    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'establishments_source_application_uniq'
      ) then
        alter table establishments
        add constraint establishments_source_application_uniq
        unique (source_application_id);
      end if;
    end$$;
  `);

  // Events table (Pro)
  await pool.query(`
    create table if not exists events (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      user_id varchar not null,
      establishment_id uuid not null,
      title text not null,
      category text not null default 'event',
      starts_at timestamptz not null,
      ends_at timestamptz,
      description text,
      cover_url text,
      photos text[],
      videos text[],
      moderation_status text not null default 'pending',
      moderation_reason text,
      moderated_at timestamptz,
      published boolean not null default false
    );
  `);
  await pool.query(`alter table events add column if not exists videos text[];`);
  await pool.query(`alter table events add column if not exists moderation_status text not null default 'pending';`);
  await pool.query(`alter table events add column if not exists moderation_reason text;`);
  await pool.query(`alter table events add column if not exists moderated_at timestamptz;`);
  // Ensure moderation default even if table existed before.
  await pool.query(`alter table events alter column published set default false;`);
  await pool.query(`create index if not exists events_published_starts_at_idx on events (published, starts_at);`);

  await pool.query(`create index if not exists events_starts_at_idx on events (starts_at);`);
  await pool.query(`create index if not exists events_establishment_id_idx on events (establishment_id);`);
  await pool.query(`create index if not exists events_user_id_idx on events (user_id);`);

  // User events table (public meetups)
  await pool.query(`
    create table if not exists user_events (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      user_id varchar not null,
      kind text not null default 'party',
      title text not null,
      starts_at timestamptz not null,
      ends_at timestamptz,
      description text,
      lat double precision not null,
      lng double precision not null,
      moderation_status text not null default 'pending',
      moderation_reason text,
      moderated_at timestamptz,
      published boolean not null default false
    );
  `);
  await pool.query(`alter table user_events add column if not exists moderation_status text not null default 'pending';`);
  await pool.query(`alter table user_events add column if not exists moderation_reason text;`);
  await pool.query(`alter table user_events add column if not exists moderated_at timestamptz;`);
  // Ensure moderation default even if table existed before.
  await pool.query(`alter table user_events alter column published set default false;`);
  await pool.query(`create index if not exists user_events_published_starts_at_idx on user_events (published, starts_at);`);
  await pool.query(`create index if not exists user_events_starts_at_idx on user_events (starts_at);`);
  await pool.query(`create index if not exists user_events_user_id_idx on user_events (user_id);`);
  await pool.query(`create index if not exists user_events_lat_lng_idx on user_events (lat, lng);`);

  // Analytics table: establishment views
  await pool.query(`
    create table if not exists establishment_views (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      establishment_id uuid not null,
      viewer_user_id varchar,
      anon_id text,
      source text,
      user_agent text
    );
  `);
  await pool.query(`create index if not exists establishment_views_establishment_id_idx on establishment_views (establishment_id);`);

  // Favorites (auth-required): users subscribe to establishments they like.
  await pool.query(`
    create table if not exists favorites (
      user_id varchar not null,
      establishment_id uuid not null,
      created_at timestamptz not null default now(),
      primary key (user_id, establishment_id)
    );
  `);
  await pool.query(`create index if not exists favorites_establishment_id_idx on favorites (establishment_id);`);

  // Push tokens (Expo): allow sending remote notifications to devices (requires dev build / production app).
  await pool.query(`
    create table if not exists push_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id varchar not null,
      token text not null,
      platform text,
      lat double precision,
      lng double precision,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (user_id, token)
    );
  `);
  await pool.query(`alter table push_tokens add column if not exists lat double precision;`);
  await pool.query(`alter table push_tokens add column if not exists lng double precision;`);
  await pool.query(`create index if not exists push_tokens_user_id_idx on push_tokens (user_id);`);
  await pool.query(`create index if not exists push_tokens_lat_lng_idx on push_tokens (lat, lng);`);
  await pool.query(`create index if not exists push_tokens_updated_at_idx on push_tokens (updated_at);`);

  // Navigation signals: when a user starts an itinerary to an establishment.
  await pool.query(`
    create table if not exists establishment_navigation_events (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      establishment_id uuid not null,
      user_id varchar not null,
      mode text
    );
  `);
  await pool.query(`create index if not exists establishment_navigation_events_est_id_idx on establishment_navigation_events (establishment_id);`);
  await pool.query(`create index if not exists establishment_views_created_at_idx on establishment_views (created_at);`);
  await pool.query(`create index if not exists establishment_views_viewer_user_id_idx on establishment_views (viewer_user_id);`);
  await pool.query(`create index if not exists establishment_views_anon_id_idx on establishment_views (anon_id);`);

  // Trips: persist every itinerary a user starts (including POIs not in DB).
  await pool.query(`
    create table if not exists user_trips (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      user_id varchar not null,
      mode text,
      origin_lat double precision,
      origin_lng double precision,
      destination_type text not null default 'poi',
      establishment_id uuid,
      destination_name text,
      destination_lat double precision,
      destination_lng double precision
    );
  `);
  await pool.query(`create index if not exists user_trips_user_id_created_at_idx on user_trips (user_id, created_at desc);`);
  await pool.query(`create index if not exists user_trips_created_at_idx on user_trips (created_at desc);`);
}


