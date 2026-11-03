# Projeto JCP

Frontend estático do Projeto Jovens com Propósito, preparado para publicação pelo GitHub Pages.

## Publicação

No repositório `DevSamuelPinho/projeto_jpc_producao`, configure Pages para publicar a branch principal a partir da raiz. O ponto de entrada é `index.html`; o painel administrativo fica em `admin.html`.

## Supabase

`js/supabase-config.js` contém a URL do projeto, uma chave publishable destinada ao cliente web e a URL pública canônica (`siteUrl`). Mantenha RLS e políticas do banco aplicadas. Chaves secret/service_role e scripts de provisionamento administrativo não pertencem a este bundle.

Convites administrativos devem usar `siteUrl/admin.html` como URL de retorno. Configure `https://devsamuelpinho.github.io/PROJETO_JCP/**` nas URLs de redirecionamento permitidas em **Supabase > Authentication > URL Configuration** e mantenha essa URL permitida também na Edge Function `jcp-admin-management`. A função deve encaminhar o campo `redirectTo` recebido para a opção `redirectTo` de `auth.admin.inviteUserByEmail`; o redirecionamento definido pelo cliente não substitui essa configuração do servidor.

A Edge Function e as migrations Supabase são implantadas pelo Supabase separadamente; GitHub Pages publica apenas os arquivos estáticos deste diretório.

### Migrações do banco

Execute os arquivos de `supabase/migrations/` no SQL Editor do projeto Supabase, em ordem cronológica pelo nome. A migration `20261102150000_jcp_remote_data.sql` cria as estruturas e políticas usadas por auditoria, mídia, mensagens e orações, além de completar permissões e leituras próprias para participantes e inscrições. Dados de negócio não são persistidos em `localStorage` (a sessão de autenticação é gerenciada pelo SDK); o frontend depende dessas estruturas e políticas remotas para ler e gravar os dados.
