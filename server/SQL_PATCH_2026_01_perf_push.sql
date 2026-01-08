-- Patch: performance indexes + nearby push location storage
-- Safe to run multiple times (uses IF NOT EXISTS).

-- Establishments: faster map queries (published + bounding box)
alter table establishments alter column published set default false;
create index if not exists establishments_published_lat_lng_idx on establishments (published, lat, lng);
create index if not exists establishments_created_at_idx on establishments (created_at desc);

-- Events: faster public queries + admin pending
alter table events alter column published set default false;
create index if not exists events_published_starts_at_idx on events (published, starts_at);

-- User events: faster public queries + admin pending
alter table user_events alter column published set default false;
create index if not exists user_events_published_starts_at_idx on user_events (published, starts_at);

-- Push tokens: store last known location for nearby notifications
alter table push_tokens add column if not exists lat double precision;
alter table push_tokens add column if not exists lng double precision;
create index if not exists push_tokens_lat_lng_idx on push_tokens (lat, lng);
create index if not exists push_tokens_updated_at_idx on push_tokens (updated_at);









