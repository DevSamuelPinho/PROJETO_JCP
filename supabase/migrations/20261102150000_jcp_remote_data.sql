begin;

create table if not exists public.jcp_audit_logs (
    id text primary key,
    actor_id text not null,
    actor_name text not null,
    actor_role text not null,
    action text not null,
    affected_record text not null default '',
    details text not null default '',
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_jcp_audit_logs_created_at
    on public.jcp_audit_logs(created_at desc);

alter table public.jcp_audit_logs enable row level security;
revoke all on public.jcp_audit_logs from public, anon, authenticated;
grant select, insert on public.jcp_audit_logs to authenticated;

drop policy if exists jcp_audit_logs_admin_read on public.jcp_audit_logs;
create policy jcp_audit_logs_admin_read on public.jcp_audit_logs
    for select to authenticated
    using (public.jcp_has_permission('logs:read'));

drop policy if exists jcp_audit_logs_admin_insert on public.jcp_audit_logs;
create policy jcp_audit_logs_admin_insert on public.jcp_audit_logs
    for insert to authenticated
    with check (
        public.jcp_has_permission('logs:read')
        or actor_id in (
            select id from public.participants
            where lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
    );

create table if not exists public.jcp_media (
    id text primary key,
    title text not null,
    alt text not null default '',
    storage_path text not null unique,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.jcp_media enable row level security;
revoke all on public.jcp_media from public, anon, authenticated;
grant select, insert, update, delete on public.jcp_media to authenticated;

drop policy if exists jcp_media_admin_read on public.jcp_media;
create policy jcp_media_admin_read on public.jcp_media
    for select to authenticated
    using (public.jcp_has_permission('media:read'));

drop policy if exists jcp_media_admin_insert on public.jcp_media;
create policy jcp_media_admin_insert on public.jcp_media
    for insert to authenticated
    with check (public.jcp_has_permission('media:write'));

drop policy if exists jcp_media_admin_update on public.jcp_media;
create policy jcp_media_admin_update on public.jcp_media
    for update to authenticated
    using (public.jcp_has_permission('media:write'))
    with check (public.jcp_has_permission('media:write'));

drop policy if exists jcp_media_admin_delete on public.jcp_media;
create policy jcp_media_admin_delete on public.jcp_media
    for delete to authenticated
    using (public.jcp_has_permission('media:write'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jcp-media', 'jcp-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists jcp_media_storage_public_read on storage.objects;
create policy jcp_media_storage_public_read on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'jcp-media');

drop policy if exists jcp_media_storage_admin_insert on storage.objects;
create policy jcp_media_storage_admin_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'jcp-media' and public.jcp_has_permission('media:write'));

drop policy if exists jcp_media_storage_admin_update on storage.objects;
create policy jcp_media_storage_admin_update on storage.objects
    for update to authenticated
    using (bucket_id = 'jcp-media' and public.jcp_has_permission('media:write'))
    with check (bucket_id = 'jcp-media' and public.jcp_has_permission('media:write'));

drop policy if exists jcp_media_storage_admin_delete on storage.objects;
create policy jcp_media_storage_admin_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'jcp-media' and public.jcp_has_permission('media:write'));

create table if not exists public.jcp_messages (
    id text primary key,
    name text not null default '',
    email text not null default '',
    subject text not null default '',
    message text not null default '',
    read boolean not null default false,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_jcp_messages_created_at
    on public.jcp_messages(created_at desc);

alter table public.jcp_messages enable row level security;
revoke all on public.jcp_messages from public, anon, authenticated;
grant select, update, delete on public.jcp_messages to authenticated;

drop policy if exists jcp_messages_admin_read on public.jcp_messages;
create policy jcp_messages_admin_read on public.jcp_messages
    for select to authenticated
    using (public.jcp_has_permission('logs:read'));

drop policy if exists jcp_messages_admin_update on public.jcp_messages;
create policy jcp_messages_admin_update on public.jcp_messages
    for update to authenticated
    using (public.jcp_has_permission('logs:read'))
    with check (public.jcp_has_permission('logs:read'));

drop policy if exists jcp_messages_admin_delete on public.jcp_messages;
create policy jcp_messages_admin_delete on public.jcp_messages
    for delete to authenticated
    using (public.jcp_has_permission('logs:read'));

create table if not exists public.jcp_prayers (
    id text primary key,
    participant_id text not null references public.participants(id) on delete cascade,
    participant_name text not null,
    prayer_date date not null default current_date,
    created_at timestamptz not null default timezone('utc', now()),
    constraint jcp_prayers_participant_date_unique unique (participant_id, prayer_date)
);

alter table public.jcp_prayers enable row level security;
revoke all on public.jcp_prayers from public, anon, authenticated;
grant select, insert on public.jcp_prayers to authenticated;

drop policy if exists jcp_prayers_self_read on public.jcp_prayers;
create policy jcp_prayers_self_read on public.jcp_prayers
    for select to authenticated
    using (
        participant_id in (
            select id from public.participants
            where lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
    );

drop policy if exists jcp_prayers_self_insert on public.jcp_prayers;
create policy jcp_prayers_self_insert on public.jcp_prayers
    for insert to authenticated
    with check (
        participant_id in (
            select id from public.participants
            where lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        )
    );

create or replace function public.jcp_public_prayer_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
    select count(*) from public.jcp_prayers;
$$;

revoke all on function public.jcp_public_prayer_count() from public;
grant execute on function public.jcp_public_prayer_count() to anon, authenticated;

drop policy if exists participants_self_read on public.participants;
create policy participants_self_read on public.participants
    for select to authenticated
    using (
        lower(coalesce(email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        or public.jcp_has_permission('volunteers:read')
    );

drop policy if exists enrollments_self_read on public.enrollments;
create policy enrollments_self_read on public.enrollments
    for select to authenticated
    using (
        lower(coalesce(participant_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        or public.jcp_has_permission('enrollments:read')
    );

alter table public.participants enable row level security;
alter table public.enrollments enable row level security;
grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, update, delete on public.enrollments to authenticated;

drop policy if exists jcp_participants_admin_read on public.participants;
create policy jcp_participants_admin_read on public.participants
    for select to authenticated
    using (public.jcp_has_permission('volunteers:read'));

drop policy if exists jcp_participants_admin_manage on public.participants;
create policy jcp_participants_admin_manage on public.participants
    for all to authenticated
    using (public.jcp_has_permission('volunteers:write'))
    with check (public.jcp_has_permission('volunteers:write'));

drop policy if exists jcp_enrollments_admin_read on public.enrollments;
create policy jcp_enrollments_admin_read on public.enrollments
    for select to authenticated
    using (public.jcp_has_permission('enrollments:read'));

drop policy if exists jcp_enrollments_admin_manage on public.enrollments;
create policy jcp_enrollments_admin_manage on public.enrollments
    for all to authenticated
    using (public.jcp_has_permission('enrollments:write'))
    with check (public.jcp_has_permission('enrollments:write'));

grant select, insert, update, delete on public.editions, public.actions,
    public.departments, public.leaders to authenticated;

drop policy if exists jcp_editions_admin_manage on public.editions;
create policy jcp_editions_admin_manage on public.editions
    for all to authenticated
    using (public.jcp_has_permission('editions:write'))
    with check (public.jcp_has_permission('editions:write'));

drop policy if exists jcp_actions_admin_manage on public.actions;
create policy jcp_actions_admin_manage on public.actions
    for all to authenticated
    using (public.jcp_has_permission('actions:write'))
    with check (public.jcp_has_permission('actions:write'));

drop policy if exists jcp_departments_admin_manage on public.departments;
create policy jcp_departments_admin_manage on public.departments
    for all to authenticated
    using (public.jcp_has_permission('leaders:write'))
    with check (public.jcp_has_permission('leaders:write'));

drop policy if exists jcp_leaders_admin_manage on public.leaders;
create policy jcp_leaders_admin_manage on public.leaders
    for all to authenticated
    using (public.jcp_has_permission('leaders:write'))
    with check (public.jcp_has_permission('leaders:write'));

alter table public.settings enable row level security;
grant select on public.settings to anon, authenticated;
grant insert, update on public.settings to authenticated;

drop policy if exists jcp_settings_public_read on public.settings;
create policy jcp_settings_public_read on public.settings
    for select to anon, authenticated
    using (true);

drop policy if exists jcp_settings_admin_insert on public.settings;
create policy jcp_settings_admin_insert on public.settings
    for insert to authenticated
    with check (public.jcp_has_permission('settings:write'));

drop policy if exists jcp_settings_admin_update on public.settings;
create policy jcp_settings_admin_update on public.settings
    for update to authenticated
    using (public.jcp_has_permission('settings:write'))
    with check (public.jcp_has_permission('settings:write'));

alter table public.settings
    add column if not exists pix_key text not null default '',
    add column if not exists pix_key_type text not null default '',
    add column if not exists pix_beneficiary text not null default '',
    add column if not exists pix_bank text not null default '',
    add column if not exists pix_city text not null default '',
    add column if not exists pix_notice text not null default '',
    add column if not exists contact_email text not null default '',
    add column if not exists contact_phone text not null default '',
    add column if not exists instagram text not null default '',
    add column if not exists updated_at timestamptz not null default timezone('utc', now());

insert into public.settings (
    id, pix_key, pix_key_type, pix_beneficiary, pix_bank, pix_city, pix_notice
)
values (
    'global_settings',
    'projetojovenscomproposito@gmail.com',
    'E-mail',
    'Projeto Jovens com Propósito',
    'Banco do Brasil',
    'Patos - PB',
    'Sua contribuição sustenta a realização dos encontros e viagens missionárias pelo sertão.'
)
on conflict (id) do nothing;

alter table public.cms_content enable row level security;
grant select on public.cms_content to anon, authenticated;
grant insert, update on public.cms_content to authenticated;

drop policy if exists jcp_cms_admin_insert on public.cms_content;
create policy jcp_cms_admin_insert on public.cms_content
    for insert to authenticated
    with check (public.jcp_has_permission('content:write'));

drop policy if exists jcp_cms_admin_update on public.cms_content;
create policy jcp_cms_admin_update on public.cms_content
    for update to authenticated
    using (public.jcp_has_permission('content:write'))
    with check (public.jcp_has_permission('content:write'));

alter table public.contributions enable row level security;
grant select on public.contributions to authenticated;

drop policy if exists jcp_contributions_admin_read on public.contributions;
create policy jcp_contributions_admin_read on public.contributions
    for select to authenticated
    using (public.jcp_has_permission('contributions:read'));

commit;
