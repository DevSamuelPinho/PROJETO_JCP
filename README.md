# Projeto JCP

Frontend estático do Projeto Jovens com Propósito, preparado para publicação pelo GitHub Pages.

## Publicação

No repositório `DevSamuelPinho/projeto_jpc_producao`, configure Pages para publicar a branch principal a partir da raiz. O ponto de entrada é `index.html`; o painel administrativo fica em `admin.html`.

## Supabase

`js/supabase-config.js` contém a URL do projeto e uma chave publishable, destinada ao cliente web. Mantenha RLS e políticas do banco aplicadas. Chaves secret/service_role e scripts de provisionamento administrativo não pertencem a este bundle.

A Edge Function e as migrations Supabase são implantadas pelo Supabase separadamente; GitHub Pages publica apenas os arquivos estáticos deste diretório.
