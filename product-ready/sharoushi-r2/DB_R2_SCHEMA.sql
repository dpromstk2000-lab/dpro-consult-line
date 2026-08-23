-- DPRO PRODUCT READY #24 SHAROUSHI R2
-- Product-local support schema only. STANDARD and other products are out of scope.
-- Demo staff PIN material below is DEMO ONLY (1001/1002/1003) and must never be reused as production authentication.

create table if not exists public.sharoushi_system_versions (
  singleton boolean primary key default true check (singleton),
  database_version text not null,
  frontend_version text not null,
  adapter_version text not null,
  worker_version text not null,
  environment text not null default 'precontract_demo',
  updated_at timestamptz not null default now()
);

create table if not exists public.sharoushi_calendar_exceptions (
  exception_date date primary key,
  exception_type text not null check (exception_type in ('temporary_closed','special_open')),
  open_time time,
  close_time time,
  note text,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (exception_type='temporary_closed' and open_time is null and close_time is null)
    or
    (exception_type='special_open' and open_time is not null and close_time is not null and open_time < close_time)
  )
);

create table if not exists public.sharoushi_staff_auth_bindings (
  staff_id uuid primary key,
  staff_code text not null unique,
  staff_name text not null,
  role text not null,
  pin_salt_hex text not null,
  pin_hash_hex text not null,
  pin_iterations integer not null default 120000 check (pin_iterations >= 100000),
  is_active boolean not null default true,
  revoked_before timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sharoushi_staff_permissions (
  staff_id uuid not null references public.sharoushi_staff_auth_bindings(staff_id) on delete cascade,
  permission_code text not null,
  granted boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (staff_id, permission_code)
);

create table if not exists public.sharoushi_staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.sharoushi_staff_auth_bindings(staff_id) on delete cascade,
  token_hash_hex text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.sharoushi_staff_audit_logs (
  id bigint generated always as identity primary key,
  staff_id uuid,
  actor_staff_code text,
  action_code text not null,
  target_type text,
  target_id text,
  result text not null,
  http_status integer,
  request_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sharoushi_staff_sessions_staff_idx
  on public.sharoushi_staff_sessions (staff_id, expires_at desc);

create index if not exists sharoushi_staff_audit_logs_actor_idx
  on public.sharoushi_staff_audit_logs (staff_id, created_at desc);

alter table public.sharoushi_system_versions enable row level security;
alter table public.sharoushi_calendar_exceptions enable row level security;
alter table public.sharoushi_staff_auth_bindings enable row level security;
alter table public.sharoushi_staff_permissions enable row level security;
alter table public.sharoushi_staff_sessions enable row level security;
alter table public.sharoushi_staff_audit_logs enable row level security;

revoke all on table public.sharoushi_system_versions from anon, authenticated;
revoke all on table public.sharoushi_calendar_exceptions from anon, authenticated;
revoke all on table public.sharoushi_staff_auth_bindings from anon, authenticated;
revoke all on table public.sharoushi_staff_permissions from anon, authenticated;
revoke all on table public.sharoushi_staff_sessions from anon, authenticated;
revoke all on table public.sharoushi_staff_audit_logs from anon, authenticated;

insert into public.sharoushi_system_versions
(singleton,database_version,frontend_version,adapter_version,worker_version,environment,updated_at)
values
(true,'SHAROUSHI-DB-PR2-20260823','SHAROUSHI-PR2-FRONTEND-20260823','DPRO-CONTROL-ADAPTER-1.0-SHAROUSHI-20260823-R2V2','DPRO-CONTROL-ADAPTER-1.0-SHAROUSHI-20260823-R2V2','precontract_demo',now())
on conflict (singleton) do update set
  database_version=excluded.database_version,
  frontend_version=excluded.frontend_version,
  adapter_version=excluded.adapter_version,
  worker_version=excluded.worker_version,
  environment=excluded.environment,
  updated_at=now();

-- Demo-only staff auth fixtures. Public demo PIN mapping:
-- SR-STAFF-001 / 1001
-- SR-STAFF-002 / 1002
-- SR-STAFF-003 / 1003
insert into public.sharoushi_staff_auth_bindings
(staff_id,staff_code,staff_name,role,pin_salt_hex,pin_hash_hex,pin_iterations,is_active,revoked_before)
values
('20000000-0000-0000-0000-000000000001','SR-STAFF-001','田中 社労士','admin','149488cd373b5280d2178b4616a5fdf1','06a2eef5093e6bae0b40c688885622661a883a389ef2acb3def3ba0549e07115',120000,true,null),
('20000000-0000-0000-0000-000000000002','SR-STAFF-002','山本 社労士','sharoushi','2c30028ac3eb1c313804d595906ec077','8a4387cab6babf91e3c3a54b7953de5b76f594fdb05724caf4f63109957e52d2',120000,true,null),
('20000000-0000-0000-0000-000000000003','SR-STAFF-003','佐々木 事務スタッフ','staff','6d6e058421d33fb08af8879ba329d965','98d4bbf4f0cff74755e0d08edebc9d08c26ff771e87a6863faf04b5081cda814',120000,true,null)
on conflict (staff_id) do update set
  staff_code=excluded.staff_code,
  staff_name=excluded.staff_name,
  role=excluded.role,
  pin_salt_hex=excluded.pin_salt_hex,
  pin_hash_hex=excluded.pin_hash_hex,
  pin_iterations=excluded.pin_iterations,
  is_active=excluded.is_active,
  revoked_before=excluded.revoked_before,
  updated_at=now();

insert into public.sharoushi_staff_permissions (staff_id,permission_code,granted)
values
('20000000-0000-0000-0000-000000000001','appointment.update',true),
('20000000-0000-0000-0000-000000000001','consultation.update',true),
('20000000-0000-0000-0000-000000000001','document.update',true),
('20000000-0000-0000-0000-000000000001','message.log',true),
('20000000-0000-0000-0000-000000000001','procedure.update',true),
('20000000-0000-0000-0000-000000000001','progress.write',true),
('20000000-0000-0000-0000-000000000001','task.update',true),
('20000000-0000-0000-0000-000000000001','templates.read',true),
('20000000-0000-0000-0000-000000000001','work.read',true),
('20000000-0000-0000-0000-000000000002','appointment.update',true),
('20000000-0000-0000-0000-000000000002','consultation.update',true),
('20000000-0000-0000-0000-000000000002','document.update',true),
('20000000-0000-0000-0000-000000000002','message.log',true),
('20000000-0000-0000-0000-000000000002','procedure.update',true),
('20000000-0000-0000-0000-000000000002','progress.write',true),
('20000000-0000-0000-0000-000000000002','task.update',true),
('20000000-0000-0000-0000-000000000002','templates.read',true),
('20000000-0000-0000-0000-000000000002','work.read',true),
('20000000-0000-0000-0000-000000000003','message.log',true),
('20000000-0000-0000-0000-000000000003','progress.write',true),
('20000000-0000-0000-0000-000000000003','task.update',true),
('20000000-0000-0000-0000-000000000003','templates.read',true),
('20000000-0000-0000-0000-000000000003','work.read',true)
on conflict (staff_id,permission_code) do update set
  granted=excluded.granted,
  updated_at=now();

insert into public.sharoushi_calendar_exceptions
(exception_date,exception_type,open_time,close_time,note,is_demo)
values
('2099-01-04','special_open','10:00','12:00','PRODUCT READY R2 special-open proof',true),
('2099-01-05','temporary_closed',null,null,'PRODUCT READY R2 temporary-closed proof',true)
on conflict (exception_date) do update set
  exception_type=excluded.exception_type,
  open_time=excluded.open_time,
  close_time=excluded.close_time,
  note=excluded.note,
  is_demo=excluded.is_demo,
  updated_at=now();
