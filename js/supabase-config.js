/**
 * ==============================================================================
 * PROJETO JOVENS COM PROPÓSITO — JCP | CONFIGURAÇÃO DA CONEXÃO SUPABASE
 * ==============================================================================
 * Insira abaixo a URL e a Chave Pública (Anon Key) do seu projeto Supabase.
 * Você pode obter esses dados no painel do Supabase em:
 * Project Settings -> API -> Project URL & Project API Keys (anon / public).
 * ==============================================================================
 */

window.SUPABASE_CONFIG = {
    // URL do projeto Supabase de produção
    url: 'https://mznvddmscweggmbkjazh.supabase.co',

    // Chave pública anônima (anon public key)
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bnZkZG1zY3dlZ2dtYmtqYXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMjc0ODMsImV4cCI6MjEwNzYwMzQ4M30.-R9Ghs0YeTsWMrDEtDdtogeF4z0VBWEjeP5vJTh8Kxk'
};

// Inicialização segura do cliente Supabase
(function() {
    // Permite sobrescrever via localStorage pelo painel administrativo
    const savedUrl = localStorage.getItem('jcp_supabase_url');
    const savedKey = localStorage.getItem('jcp_supabase_key');

    const effectiveUrl = (savedUrl && savedUrl.trim()) || window.SUPABASE_CONFIG.url;
    const effectiveKey = (savedKey && savedKey.trim()) || window.SUPABASE_CONFIG.anonKey;

    const isValidUrl = effectiveUrl && effectiveUrl.startsWith('http') && !effectiveUrl.includes('SEU-PROJETO');
    const isValidKey = effectiveKey && effectiveKey.length > 20 && !effectiveKey.includes('SUA-CHAVE');

    if (typeof window.supabase !== 'undefined' && isValidUrl && isValidKey) {
        try {
            window.supabaseClient = window.supabase.createClient(effectiveUrl, effectiveKey, {
                auth: { persistSession: true, autoRefreshToken: true }
            });
            window.SUPABASE_CONNECTED = true;
            console.log('✅ Supabase conectado diretamente com sucesso!');
        } catch (e) {
            console.warn('⚠️ Falha ao instanciar o Supabase client:', e);
            window.supabaseClient = null;
            window.SUPABASE_CONNECTED = false;
        }
    } else {
        window.supabaseClient = null;
        window.SUPABASE_CONNECTED = false;
        if (!isValidUrl || !isValidKey) {
            console.info('ℹ️ Supabase: Chaves padrão detectadas. Configure a URL e Anon Key em js/supabase-config.js ou no Painel Admin para conexão direta.');
        }
    }
})();
