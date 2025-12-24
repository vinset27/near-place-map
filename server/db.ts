import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool ? drizzle(pool) : null;

export async function ensureAppTables() {
  if (!pool) return;

  // Existing table (kept for safety if DB is empty).
  await pool.query(`
    create table if not exists business_applications (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      status text not null default 'pending',
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

  await pool.query(`
    create table if not exists establishment_profiles (
      user_id varchar primary key,
      name text not null,
      category text not null,
      address text,
      phone text,
      description text
    );
  `);

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
      provider text,
      provider_place_id text,
      published boolean not null default true
    );
  `);

  // If table already existed, add new columns safely.
  await pool.query(`alter table establishments add column if not exists provider text;`);
  await pool.query(`alter table establishments add column if not exists provider_place_id text;`);
  await pool.query(`alter table establishments add column if not exists source_application_id uuid;`);
  await pool.query(`alter table establishments add column if not exists photos text[];`);

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
}


