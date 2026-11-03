-- ==============================================================================
-- JCP — SINCRONIZAÇÃO COMPLETA PAINEL ADMIN <-> SITE PÚBLICO (PRODUÇÃO)
-- ==============================================================================
-- Execute este script no SQL Editor do projeto Supabase configurado em
-- js/supabase-config.js.
-- O que este script faz (100% seguro, não apaga nenhum dado):
--   1. Cria a tabela `public.testimonials` (Galeria de Vídeos) e suas políticas RLS.
--   2. Libera leitura pública (`SELECT`) em `public.cms_content` para que os textos
--      editados no módulo CMS do painel apareçam na Landing Page para os visitantes.
--   3. Permite que participantes autenticados cadastrem seu perfil e inscrições
--      e que doações públicas com comprovante PIX cheguem ao painel administrativo.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. TABELA E POLÍTICAS DE TESTEMUNHOS (GALERIA DE VÍDEOS)
-- ------------------------------------------------------------------------------
create table if not exists public.testimonials (
    id            text primary key,
    title         text not null,
    person_name   text not null,
    description   text default '',
    video_url     text not null,
    thumbnail_url text default '',
    status        text not null default 'published' check (status in ('published', 'draft')),
    published     boolean not null default true,
    active        boolean not null default true,
    order_index   integer not null default 1,
    created_at    timestamptz not null default timezone('utc', now()),
    updated_at    timestamptz not null default timezone('utc', now())
);

create index if not exists idx_testimonials_order
    on public.testimonials(order_index);

create index if not exists idx_testimonials_public
    on public.testimonials(active, published, order_index);

alter table public.testimonials enable row level security;

revoke all privileges on table public.testimonials from public, anon, authenticated;
grant select on table public.testimonials to anon, authenticated;
grant insert, update, delete on table public.testimonials to authenticated;

drop policy if exists testimonials_public_read on public.testimonials;
create policy testimonials_public_read on public.testimonials
    for select to anon, authenticated
    using (active = true and published = true);

drop policy if exists testimonials_admin_read on public.testimonials;
create policy testimonials_admin_read on public.testimonials
    for select to authenticated
    using (
        public.jcp_has_permission('testimonials:read')
        or public.jcp_has_permission('media:read')
        or public.jcp_has_permission('leaders:read')
    );

drop policy if exists testimonials_admin_insert on public.testimonials;
create policy testimonials_admin_insert on public.testimonials
    for insert to authenticated
    with check (
        public.jcp_has_permission('testimonials:write')
        or public.jcp_has_permission('media:write')
        or public.jcp_has_permission('leaders:write')
    );

drop policy if exists testimonials_admin_update on public.testimonials;
create policy testimonials_admin_update on public.testimonials
    for update to authenticated
    using (
        public.jcp_has_permission('testimonials:write')
        or public.jcp_has_permission('media:write')
        or public.jcp_has_permission('leaders:write')
    )
    with check (
        public.jcp_has_permission('testimonials:write')
        or public.jcp_has_permission('media:write')
        or public.jcp_has_permission('leaders:write')
    );

drop policy if exists testimonials_admin_delete on public.testimonials;
create policy testimonials_admin_delete on public.testimonials
    for delete to authenticated
    using (
        public.jcp_has_permission('testimonials:write')
        or public.jcp_has_permission('media:write')
        or public.jcp_has_permission('leaders:write')
    );

-- ------------------------------------------------------------------------------
-- 2. LEITURA PÚBLICA DO CMS (TEXTOS EDITORIAIS DO SITE)
-- ------------------------------------------------------------------------------
grant select on table public.cms_content to anon, authenticated;

drop policy if exists cms_content_public_read on public.cms_content;
create policy cms_content_public_read on public.cms_content
    for select to anon, authenticated
    using (true);

-- ------------------------------------------------------------------------------
-- 3. LEITURA PÚBLICA DE EDIÇÕES, AÇÕES, DEPARTAMENTOS E LÍDERES
--    (Garante que tanto o site público quanto o painel leiam todos os registros)
-- ------------------------------------------------------------------------------
grant select on table
    public.editions, public.actions, public.departments, public.leaders, public.settings
to anon, authenticated;

drop policy if exists editions_public_read_all on public.editions;
create policy editions_public_read_all on public.editions
    for select to anon, authenticated using (true);

drop policy if exists actions_public_read_all on public.actions;
create policy actions_public_read_all on public.actions
    for select to anon, authenticated using (true);

drop policy if exists departments_public_read_all on public.departments;
create policy departments_public_read_all on public.departments
    for select to anon, authenticated using (true);

drop policy if exists leaders_public_read_all on public.leaders;
create policy leaders_public_read_all on public.leaders
    for select to anon, authenticated using (true);

-- ------------------------------------------------------------------------------
-- 4. INSCRIÇÕES E CADASTROS DE PARTICIPANTES AUTENTICADOS NO SITE PÚBLICO
-- ------------------------------------------------------------------------------
-- O frontend grava o e-mail do participante na inscrição. Bancos anteriores
-- podem não ter essa coluna, então a adicionamos antes de criar a política RLS.
alter table public.enrollments
    add column if not exists participant_email text;

drop policy if exists participants_self_insert on public.participants;
create policy participants_self_insert on public.participants
    for insert to authenticated
    with check (
        lower(coalesce(email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        or public.jcp_has_permission('volunteers:write')
    );

drop policy if exists participants_self_update on public.participants;
create policy participants_self_update on public.participants
    for update to authenticated
    using (
        lower(coalesce(email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        or public.jcp_has_permission('volunteers:write')
    )
    with check (
        lower(coalesce(email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        or public.jcp_has_permission('volunteers:write')
    );

drop policy if exists enrollments_self_insert on public.enrollments;
create policy enrollments_self_insert on public.enrollments
    for insert to authenticated
    with check (
        lower(coalesce(participant_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        or public.jcp_has_permission('enrollments:write')
    );

-- Permite envio público de comprovante de contribuição voluntária para o painel
grant insert on table public.contributions to anon, authenticated;
drop policy if exists contributions_public_insert on public.contributions;
create policy contributions_public_insert on public.contributions
    for insert to anon, authenticated
    with check (true);

commit;
