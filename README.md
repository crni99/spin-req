# spin-req

-- =============================================
--  CREATE TABLES
-- =============================================

create table if not exists parties (
  id              text primary key,
  name            text not null,
  dj_name         text,
  duration_min    integer not null,
  end_timestamp   bigint not null,
  ended           boolean default false,
  created_at      timestamptz default now()
);

create table if not exists requests (
  id          bigint generated always as identity primary key,
  party_id    text references parties(id) on delete cascade,
  song        text not null,
  ip_hash     text not null,
  status      text default 'pending',
  created_at  timestamptz default now()
);