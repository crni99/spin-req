# spin-req

** SUPABASE SETUP

create table if not exists parties (
  id              text primary key,
  name            text not null,
  dj_name         text,
  duration_min    integer not null,
  end_timestamp   bigint not null,
  ended           boolean default false,
  created_at      timestamptz default now(),
  dj_token text
);

create table if not exists requests (
  id          bigint generated always as identity primary key,
  party_id    text references parties(id) on delete cascade,
  song        text not null,
  ip_hash     text not null,
  status      text default 'pending',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter publication supabase_realtime add table requests;
alter publication supabase_realtime add table parties;

alter table public.requests disable row level security;
alter table public.parties disable row level security;

create index if not exists requests_party_id_idx ON public.requests (party_id);