/**
 * ==============================================================================
 * PROJETO JOVENS COM PROPÓSITO — JCP | CONTROLADOR DO PAINEL ADMINISTRATIVO
 * ==============================================================================
 * Gerenciador completo de Edições, Ações, Inscrições, Comprovantes, Voluntários,
 * Usuários, Permissões (RBAC), Auditoria/Logs e Configurações Globais.
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    /* ==========================================================================
       ESTADO E REFERÊNCIAS GLOBAIS
       ========================================================================== */
    let currentAdmin = null;
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const sections = document.querySelectorAll('.admin-section');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('topbar-desc');

    const PAGE_TITLES = {
        dashboard: { title: 'Dashboard', desc: 'Resumo das métricas reais e atividades do Projeto JCP.' },
        eventos:   { title: 'Edições & Missões', desc: 'Gerenciamento de edições, inscrições e capas do site.' },
        acoes:     { title: 'Ações Missionárias', desc: 'Ações práticas vinculadas às edições e cronograma.' },
        membros:   { title: 'Voluntários & Membros', desc: 'Base de participantes com cadastro e ministérios.' },
        mensagens: { title: 'Inscrições & Comprovantes', desc: 'Conferência de comprovantes PIX, camisas e vagas.' },
        midia:     { title: 'Fotos & Vídeos', desc: 'Galeria visual e registros de missões no sertão.' },
        conteudo:  { title: 'Conteúdos (CMS)', desc: 'Textos institucionais e mensagens da landing page.' },
        lideres:   { title: 'Nossas Lideranças', desc: 'Apresentação institucional e gestão de líderes do JCP.' },
        departamentos: { title: 'Departamentos & Ministérios', desc: 'Organização de departamentos e áreas de atuação.' },
        testemunhos: { title: 'Testemunhos', desc: 'Galeria de vídeos e depoimentos de vidas impactadas pelo JCP.' },
        usuarios:  { title: 'Usuários & Perfis', desc: 'Gerenciamento de administradores e permissões granulares.' },
        config:    { title: 'Configurações Globais', desc: 'Chave Pix, dados de contribuição e informações oficiais.' },
        logs:      { title: 'Auditoria / Logs', desc: 'Registro de todas as atividades e operações do sistema.' }
    };

    
    /**
     * Otimiza e redimensiona imagem via Canvas para armazenamento seguro no navegador
     */
    function compressImageFile(file, maxWidth = 600, maxHeight = 800) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error('Nenhum arquivo fornecido.'));
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error('O arquivo selecionado não é uma imagem válida.'));
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    const isPng = file.type === 'image/png';
                    let dataUrl;
                    if (isPng) {
                        try {
                            dataUrl = canvas.toDataURL('image/webp', 0.85);
                            if (!dataUrl.startsWith('data:image/webp')) {
                                dataUrl = canvas.toDataURL('image/png');
                            }
                        } catch (err) {
                            dataUrl = canvas.toDataURL('image/png');
                        }
                    } else {
                        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    }
                    resolve(dataUrl);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    /* ==========================================================================
       AUTENTICAÇÃO & CONTROLE DE SESSÃO
       ========================================================================== */
    const loginScreen = document.getElementById('admin-login-screen');
    const formLogin = document.getElementById('form-admin-login');
    const loginErrorMsg = document.getElementById('login-error-msg');
    const btnSidebarLogout = document.getElementById('btn-sidebar-logout');

    async function checkAuth() {
        currentAdmin = await window.db.getCurrentAdmin();
        if (!currentAdmin) {
            loginScreen.style.display = 'flex';
            return false;
        }

        loginScreen.style.display = 'none';
        updateUserUI();
        await applyRolePermissions();
        return true;
    }

    function updateUserUI() {
        if (!currentAdmin) return;
        const nameEl = document.getElementById('sidebar-user-name');
        const roleEl = document.getElementById('sidebar-user-role');
        const avatarEl = document.getElementById('sidebar-avatar');
        const topbarUserEl = document.getElementById('topbar-user');

        const roleLabels = {
            super_admin: 'Super Admin',
            coordenador: 'Coordenador',
            midia: 'Mídia'
        };

        const roleText = roleLabels[currentAdmin.roleId] || currentAdmin.roleId;

        if (nameEl) nameEl.textContent = currentAdmin.name;
        if (roleEl) roleEl.textContent = roleText;
        if (avatarEl) avatarEl.textContent = currentAdmin.avatar || currentAdmin.name.substring(0, 2).toUpperCase();
        if (topbarUserEl) topbarUserEl.textContent = currentAdmin.name.split(' ')[0];
    }

    async function applyRolePermissions() {
        if (!currentAdmin) return;

        // Itera sobre todos os itens de navegação com permissão
        for (const nav of navItems) {
            const requiredPerm = nav.getAttribute('data-perm');
            if (requiredPerm) {
                const allowed = await window.db.hasPermission(requiredPerm);
                nav.style.display = allowed ? 'flex' : 'none';
            }
        }

        // Se o usuário atual estiver em uma seção que não tem permissão, volta para dashboard
        const currentActive = document.querySelector('.admin-section.active');
        if (currentActive && currentActive.id !== 'dashboard') {
            const nav = document.querySelector(`.nav-item[data-target="${currentActive.id}"]`);
            if (nav && nav.style.display === 'none') {
                navigateTo('dashboard');
            }
        }
    }

    // Formulário de Login
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            loginErrorMsg.style.display = 'none';

            try {
                await window.db.loginAdmin(email, pass);
                await checkAuth();
                await loadAllData();
                showToast('Login realizado com sucesso!');
            } catch (err) {
                loginErrorMsg.textContent = err.message || 'Falha na autenticação.';
                loginErrorMsg.style.display = 'block';
            }
        });
    }

    // Logout
    if (btnSidebarLogout) {
        btnSidebarLogout.addEventListener('click', async () => {
            if (confirm('Deseja realmente encerrar a sessão administrativa?')) {
                await window.db.logoutAdmin();
                currentAdmin = null;
                loginScreen.style.display = 'flex';
                showToast('Sessão encerrada.');
            }
        });
    }

    /* ==========================================================================
       NAVEGAÇÃO ENTRE SEÇÕES
       ========================================================================== */
    function navigateTo(targetId) {
        navItems.forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (activeNav) activeNav.classList.add('active');

        sections.forEach(s => s.classList.remove('active'));
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');

        const meta = PAGE_TITLES[targetId] || { title: targetId, desc: '' };
        if (pageTitle) pageTitle.textContent = meta.title;
        if (pageSubtitle) pageSubtitle.textContent = meta.desc;

        // Recarrega dados específicos da seção
        if (targetId === 'dashboard') loadDashboard();
        if (targetId === 'eventos') loadEditions();
        if (targetId === 'acoes') loadActions();
        if (targetId === 'membros') loadVolunteers();
        if (targetId === 'mensagens') loadEnrollments();
        if (targetId === 'usuarios') loadUsersAndRoles();
        if (targetId === 'config') loadSettings();
        if (targetId === 'logs') loadLogs();
        if (targetId === 'conteudo') loadCMS();
        if (targetId === 'midia') loadMedia();
        if (targetId === 'lideres') loadLeaders();
        if (targetId === 'departamentos') loadDepartments();
        if (targetId === 'testemunhos') loadTestimonials();
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.getAttribute('data-target'));
        });
    });

    document.querySelectorAll('[data-target]').forEach(el => {
        if (!el.classList.contains('nav-item')) {
            el.addEventListener('click', (e) => {
                if (el.tagName === 'A') e.preventDefault();
                navigateTo(el.getAttribute('data-target'));
            });
        }
    });

    /* ==========================================================================
       CARREGAMENTO DE DADOS
       ========================================================================== */
    async function loadAllData() {
        const permissionNames = [
            'dashboard:read', 'editions:read', 'actions:read', 'volunteers:read',
            'enrollments:read', 'content:read', 'leaders:read', 'testimonials:read'
        ];
        const permissions = new Map(await Promise.all(permissionNames.map(async permission => [
            permission,
            await window.db.hasPermission(permission)
        ])));
        const loaders = [
            ['dashboard:read', loadDashboard],
            ['editions:read', loadEditions],
            ['actions:read', loadActions],
            ['volunteers:read', loadVolunteers],
            ['enrollments:read', loadEnrollments],
            ['content:read', loadCMS],
            ['leaders:read', loadLeaders],
            ['leaders:read', loadDepartments],
            ['testimonials:read', loadTestimonials],
            [null, loadSettings]
        ].filter(([permission]) => !permission || permissions.get(permission));

        const results = await Promise.allSettled(loaders.map(([, load]) => load()));
        const failures = results.flatMap((result, index) => result.status === 'rejected'
            ? [{ module: loaders[index][0] || 'settings', error: result.reason }]
            : []);
        if (failures.length) {
            failures.forEach(({ module, error }) => {
                console.error(`[JCP Supabase] Falha ao carregar ${module}:`, error);
            });
            const firstError = failures[0].error?.message || 'Falha de leitura no Supabase.';
            showToast(`Dados não carregados (${failures[0].module}): ${firstError}`);
        }

        if (await window.db.hasPermission('users:manage')) {
            try {
                await loadUsersAndRoles();
            } catch (err) {
                const body = document.getElementById('admins-table-body');
                if (body) {
                    body.replaceChildren();
                    const row = body.insertRow();
                    const cell = row.insertCell();
                    cell.colSpan = 6;
                    cell.className = 'empty-state';
                    cell.textContent = err.message || 'Gestão de usuários ainda não está configurada.';
                }
            }
        }
        if (await window.db.hasPermission('logs:read')) {
            await loadLogs();
        }
        if (await window.db.hasPermission('media:read')) {
            await loadMedia();
        }
        await loadNotifications();
    }

    /* ==========================================================================
       8. DASHBOARD (MÉTRICAS 100% REAIS)
       ========================================================================== */
    async function loadSettings() {
        const settings = await window.db.getSettings();
        setVal('cfg-pix-key', settings.pixKey || '');
        setVal('cfg-pix-type', settings.pixKeyType || '');
        setVal('cfg-pix-beneficiary', settings.pixBeneficiary || '');
        setVal('cfg-pix-bank', settings.pixBank || '');
        setVal('cfg-pix-city', settings.pixCity || '');
        setVal('cfg-contact-email', settings.contactEmail || '');
        setVal('cfg-pix-notice', settings.pixNotice || '');
    }

    async function loadCMS() {
        const content = await window.db.getContent();
        setVal('cms-hero-title', content.heroTitle || '');
        setVal('cms-hero-subtitle', content.heroSubtitle || '');
        setVal('cms-about-text', content.aboutText || '');
    }

    async function loadUsersAndRoles() {
        const [admins, roles] = await Promise.all([window.db.getAdmins(), window.db.getRoles()]);
        const roleSelect = document.getElementById('form-adm-role');
        if (roleSelect) {
            roleSelect.replaceChildren();
            roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role.id;
                option.textContent = role.name;
                roleSelect.appendChild(option);
            });
        }
        const adminBody = document.getElementById('admins-table-body');
        if (adminBody) {
            adminBody.replaceChildren();
            if (!admins.length) {
                const row = adminBody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 6;
                cell.className = 'empty-state';
                cell.textContent = 'Nenhum administrador cadastrado.';
            } else admins.forEach(admin => {
                const row = adminBody.insertRow();
                [admin.name, admin.email, admin.roleName, admin.status,
                    admin.createdAt ? new Date(admin.createdAt).toLocaleDateString('pt-BR') : '—'
                ].forEach(value => { row.insertCell().textContent = value || '—'; });
                const actions = row.insertCell();
                const toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'btn-outline';
                toggle.dataset.toggleAdmin = admin.id;
                toggle.dataset.nextStatus = admin.status === 'Ativo' ? 'Inativo' : 'Ativo';
                toggle.textContent = admin.status === 'Ativo' ? 'Inativar' : 'Ativar';
                actions.appendChild(toggle);
            });
        }
        const rolesContainer = document.getElementById('roles-list-container');
        if (rolesContainer) {
            rolesContainer.replaceChildren();
            if (!roles.length) rolesContainer.textContent = 'Nenhum perfil cadastrado.';
            else roles.forEach(role => {
                const card = document.createElement('article');
                card.className = 'panel';
                card.style.padding = '16px';
                const title = document.createElement('strong');
                title.textContent = role.name || role.id;
                const description = document.createElement('p');
                description.className = 'section-desc';
                description.textContent = role.description || '';
                const permissions = document.createElement('small');
                permissions.textContent = `${(role.permissions || []).length} permissões`;
                card.append(title, description, permissions);
                rolesContainer.appendChild(card);
            });
        }
    }

    const modalAdmin = document.getElementById('modal-admin-user');
    const modalRole = document.getElementById('modal-role');
    const closeModal = modal => { if (modal) modal.style.display = 'none'; };
    document.getElementById('btn-add-admin-user')?.addEventListener('click', async () => {
        try { await loadUsersAndRoles(); } catch (err) { alert(err.message); return; }
        document.getElementById('form-adm-id').value = '';
        document.getElementById('form-adm-name').value = '';
        document.getElementById('form-adm-email').value = '';
        document.getElementById('form-adm-role').value = 'coordenador';
        document.getElementById('form-adm-status').value = 'Ativo';
        modalAdmin.style.display = 'flex';
    });
    document.getElementById('btn-add-role')?.addEventListener('click', () => {
        document.getElementById('form-role-name').value = '';
        document.getElementById('form-role-desc').value = '';
        document.querySelectorAll('input[name="role_perm"]').forEach(input => { input.checked = input.value === 'dashboard:read'; });
        modalRole.style.display = 'flex';
    });
    ['modal-admin-close', 'btn-cancel-adm'].forEach(id => document.getElementById(id)?.addEventListener('click', () => closeModal(modalAdmin)));
    ['modal-role-close', 'btn-cancel-role'].forEach(id => document.getElementById(id)?.addEventListener('click', () => closeModal(modalRole)));

    document.getElementById('btn-save-adm')?.addEventListener('click', async event => {
        const name = getVal('form-adm-name').trim();
        const email = getVal('form-adm-email').trim();
        const roleId = getVal('form-adm-role');
        const status = getVal('form-adm-status');
        if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert('Informe um nome e um e-mail válidos.');
            return;
        }
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const created = await window.db.addAdmin({ name, email, roleId, status });
            closeModal(modalAdmin);
            await loadUsersAndRoles();
            showToast(created.invited ? 'Convite enviado pelo Supabase Auth.' : 'Conta Auth existente vinculada ao perfil.');
        } catch (err) {
            alert(err.message || 'Não foi possível convidar o administrador.');
        } finally { button.disabled = false; }
    });

    document.getElementById('btn-save-role')?.addEventListener('click', async event => {
        const name = getVal('form-role-name').trim();
        if (name.length < 2) { alert('Informe um nome de perfil válido.'); return; }
        const permissions = [...document.querySelectorAll('input[name="role_perm"]:checked')].map(input => input.value);
        const button = event.currentTarget;
        button.disabled = true;
        try {
            await window.db.addRole({ name, description: getVal('form-role-desc').trim(), permissions });
            closeModal(modalRole);
            await loadUsersAndRoles();
            showToast('Perfil de acesso criado.');
        } catch (err) {
            alert(err.message || 'Não foi possível criar o perfil.');
        } finally { button.disabled = false; }
    });

    document.getElementById('admins-table-body')?.addEventListener('click', async event => {
        const button = event.target.closest('[data-toggle-admin]');
        if (!button) return;
        const verb = button.dataset.nextStatus === 'Inativo' ? 'inativar' : 'ativar';
        if (!confirm(`Deseja ${verb} este acesso administrativo?`)) return;
        button.disabled = true;
        try {
            await window.db.updateAdmin(button.dataset.toggleAdmin, { status: button.dataset.nextStatus });
            await loadUsersAndRoles();
            showToast('Acesso administrativo atualizado.');
        } catch (err) {
            alert(err.message || 'Não foi possível atualizar o acesso.');
        }
    });

    async function loadLogs() {
        const logs = await window.db.getLogs({
            action: getVal('logs-action-filter'),
            search: getVal('logs-search-input').trim()
        });
        const body = document.getElementById('logs-table-body');
        if (!body) return;
        body.replaceChildren();
        if (!logs.length) {
            const row = body.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 6;
            cell.className = 'empty-state';
            cell.textContent = 'Nenhum log encontrado.';
            return;
        }
        logs.forEach(log => {
            const row = body.insertRow();
            const date = log.createdAt || log.timestamp || log.date;
            [date ? new Date(date).toLocaleString('pt-BR') : (log.formattedTime || '—'),
                log.userName, log.action, log.affectedRecord, log.ip, log.details
            ].forEach(value => { row.insertCell().textContent = value || '—'; });
        });
    }

    async function loadMedia() {
        const grid = document.getElementById('media-gallery-grid');
        if (!grid) return;
        try {
            const items = await window.db.getMedia();
            grid.replaceChildren();
            if (!items.length) {
                grid.textContent = 'Nenhuma foto cadastrada.';
                return;
            }
            items.forEach(item => {
                const card = document.createElement('article');
                card.className = 'panel media-card';
                const image = document.createElement('img');
                image.src = item.src;
                image.alt = item.alt || item.title || 'Foto da galeria JCP';
                image.loading = 'lazy';
                const body = document.createElement('div');
                body.className = 'media-card-body';
                const title = document.createElement('strong');
                title.textContent = item.title || 'Sem título';
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'btn-outline';
                remove.dataset.deleteMedia = item.id;
                remove.textContent = 'Remover';
                body.append(title, remove);
                card.append(image, body);
                grid.appendChild(card);
            });
        } catch (err) {
            grid.textContent = err.message || 'Não foi possível carregar a galeria.';
        }
    }

    document.getElementById('form-media-upload')?.addEventListener('submit', async event => {
        event.preventDefault();
        const title = getVal('media-title').trim();
        const fileInput = document.getElementById('media-file');
        const file = fileInput?.files?.[0];
        const submit = document.getElementById('btn-upload-media');
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert('Selecione uma imagem JPEG, PNG ou WebP.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('A imagem deve ter no máximo 10 MB.');
            return;
        }
        if (submit) submit.disabled = true;
        try {
            const src = await compressImageFile(file, 1200, 900);
            await window.db.addMedia({ title, src, alt: title });
            event.currentTarget.reset();
            await loadMedia();
            showToast('Foto adicionada à galeria.');
        } catch (err) {
            alert(err.message || 'Não foi possível adicionar a foto.');
        } finally {
            if (submit) submit.disabled = false;
        }
    });

    document.getElementById('media-gallery-grid')?.addEventListener('click', async event => {
        const button = event.target.closest('[data-delete-media]');
        if (!button) return;
        if (!confirm('Remover esta foto da galeria?')) return;
        try {
            await window.db.deleteMedia(button.dataset.deleteMedia);
            await loadMedia();
            showToast('Foto removida.');
        } catch (err) {
            alert(err.message || 'Não foi possível remover a foto.');
        }
    });

    async function loadNotifications() {
        const panel = document.getElementById('notification-panel');
        const dot = document.getElementById('topbar-notif-dot');
        if (!panel) return;
        try {
            const [messages, canReadEnrollments] = await Promise.all([
                window.db.getMessages(),
                window.db.hasPermission('enrollments:read')
            ]);
            const enrollments = canReadEnrollments
                ? await window.db.getEnrollments({ paymentStatus: 'Comprovante Enviado' })
                : [];
            const unread = messages.filter(message => !message.read);
            const count = unread.length + enrollments.length;
            if (dot) dot.style.display = count ? '' : 'none';
            panel.replaceChildren();
            const heading = document.createElement('strong');
            heading.className = 'notification-heading';
            heading.textContent = 'Notificações';
            panel.appendChild(heading);
            if (!count) {
                const empty = document.createElement('p');
                empty.className = 'notification-empty';
                empty.textContent = 'Tudo em dia.';
                panel.appendChild(empty);
                return;
            }
            enrollments.forEach(enrollment => {
                const link = document.createElement('a');
                link.href = '#mensagens';
                link.dataset.target = 'mensagens';
                link.className = 'notification-item';
                link.textContent = `Comprovante recebido: ${enrollment.participant?.name || 'Participante'}`;
                panel.appendChild(link);
            });
            unread.forEach(message => {
                const item = document.createElement('div');
                item.className = 'notification-item';
                const text = document.createElement('span');
                text.textContent = `Nova mensagem: ${message.name || message.email || 'Contato'}`;
                const mark = document.createElement('button');
                mark.type = 'button';
                mark.className = 'notification-mark-read';
                mark.dataset.readMessage = message.id;
                mark.textContent = 'Marcar lida';
                item.append(text, mark);
                panel.appendChild(item);
            });
        } catch (err) {
            panel.replaceChildren();
            const message = document.createElement('p');
            message.className = 'notification-empty';
            message.textContent = err.message || 'Não foi possível carregar notificações.';
            panel.appendChild(message);
        }
    }

    document.getElementById('topbar-notification-btn')?.addEventListener('click', async event => {
        const panel = document.getElementById('notification-panel');
        if (!panel) return;
        panel.hidden = !panel.hidden;
        event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden) await loadNotifications();
    });

    document.getElementById('notification-panel')?.addEventListener('click', async event => {
        const targetLink = event.target.closest('[data-target]');
        if (targetLink) {
            event.preventDefault();
            navigateTo(targetLink.dataset.target);
            document.getElementById('notification-panel').hidden = true;
            document.getElementById('topbar-notification-btn')?.setAttribute('aria-expanded', 'false');
            return;
        }
        const button = event.target.closest('[data-read-message]');
        if (!button) return;
        try {
            await window.db.markMessageAsRead(button.dataset.readMessage);
            await loadNotifications();
        } catch (err) {
            alert(err.message || 'Não foi possível atualizar a mensagem.');
        }
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
        const patch = {
            pixKey: getVal('cfg-pix-key').trim(),
            pixKeyType: getVal('cfg-pix-type'),
            pixBeneficiary: getVal('cfg-pix-beneficiary').trim(),
            pixBank: getVal('cfg-pix-bank').trim(),
            pixCity: getVal('cfg-pix-city').trim(),
            contactEmail: getVal('cfg-contact-email').trim(),
            pixNotice: getVal('cfg-pix-notice').trim()
        };
        if (!patch.pixKey || !patch.pixBeneficiary) {
            alert('Preencha a chave PIX e o nome do favorecido.');
            return;
        }
        try {
            await window.db.updateSettings(patch);
            showToast('Configurações salvas.');
        } catch (err) {
            alert(err.message || 'Não foi possível salvar as configurações.');
        }
    });

    document.getElementById('btn-save-cms-hero')?.addEventListener('click', async () => {
        const patch = {
            heroTitle: getVal('cms-hero-title').trim(),
            heroSubtitle: getVal('cms-hero-subtitle').trim()
        };
        if (!patch.heroTitle) {
            alert('Informe o título principal.');
            return;
        }
        try {
            await window.db.updateContent(patch);
            showToast('Texto principal salvo.');
        } catch (err) {
            alert(err.message || 'Não foi possível salvar o conteúdo.');
        }
    });

    document.getElementById('btn-save-cms-about')?.addEventListener('click', async () => {
        try {
            await window.db.updateContent({ aboutText: getVal('cms-about-text').trim() });
            showToast('Texto institucional salvo.');
        } catch (err) {
            alert(err.message || 'Não foi possível salvar o conteúdo.');
        }
    });

    const logsSearchInput = document.getElementById('logs-search-input');
    const logsActionFilter = document.getElementById('logs-action-filter');
    let logsSearchTimer;
    logsSearchInput?.addEventListener('input', () => {
        clearTimeout(logsSearchTimer);
        logsSearchTimer = setTimeout(loadLogs, 250);
    });
    logsActionFilter?.addEventListener('change', loadLogs);

    document.getElementById('btn-export-enrollments')?.addEventListener('click', async () => {
        try {
            if (!(await window.db.hasPermission('enrollments:read'))) throw new Error('Você não tem permissão para exportar inscrições.');
            const enrollments = await window.db.getEnrollments({
                editionId: getVal('enrollment-edition-filter'),
                status: getVal('enrollment-status-filter'),
                paymentStatus: getVal('enrollment-payment-filter')
            });
            const header = ['Participante', 'Telefone', 'E-mail', 'Edição', 'Cidade', 'Tipo', 'Tamanho', 'Valor', 'Status da inscrição', 'Status do pagamento', 'Data'];
            const rows = enrollments.map(en => [
                en.participant?.name, en.participant?.phone, en.participant?.email,
                en.edition?.name, en.edition?.city, en.registrationType, en.shirtSize,
                en.amount, en.status, en.paymentStatus, en.createdAt
            ]);
            downloadCsv(header, rows, `inscricoes-jcp-${new Date().toISOString().slice(0, 10)}.csv`);
        } catch (err) {
            alert(err.message || 'Não foi possível exportar as inscrições.');
        }
    });

    document.getElementById('btn-export-logs')?.addEventListener('click', async () => {
        try {
            if (!(await window.db.hasPermission('logs:read'))) throw new Error('Você não tem permissão para exportar logs.');
            const logs = await window.db.getLogs({
                action: getVal('logs-action-filter'),
                search: getVal('logs-search-input').trim()
            });
            const header = ['Data', 'Usuário', 'Perfil', 'Ação', 'Registro', 'IP', 'Detalhes'];
            const rows = logs.map(log => [
                log.timestamp || log.createdAt || `${log.formattedDate || ''} ${log.formattedTime || ''}`.trim(),
                log.userName, log.userRole, log.action, log.affectedRecord, log.ip, log.details
            ]);
            downloadCsv(header, rows, `logs-jcp-${new Date().toISOString().slice(0, 10)}.csv`);
        } catch (err) {
            alert(err.message || 'Não foi possível exportar os logs.');
        }
    });

    async function loadDashboard() {
        const stats = await window.db.getStats();

        setEl('stat-participants', stats.totalParticipants);
        setEl('stat-volunteers', stats.totalVolunteers);
        setEl('stat-editions', stats.totalEditions);
        setEl('stat-editions-sub', `${stats.activeEditions} ativas`);
        setEl('stat-enrollments', stats.totalEnrollments);
        setEl('stat-actions', stats.totalActions);
        setEl('stat-cities', stats.citiesCovered);
        setEl('stat-raised', (stats.totalRaised || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

        // Atualiza badge de inscrições pendentes
        const badge = document.getElementById('pending-badge');
        if (badge) {
            badge.textContent = stats.pendingEnrollments;
            badge.style.display = stats.pendingEnrollments > 0 ? '' : 'none';
        }

        // Próximas edições no Dashboard
        const editions = await window.db.getEditions();
        const canReadEnrollments = await window.db.hasPermission('enrollments:read');
        const enrollments = canReadEnrollments ? await window.db.getEnrollments() : [];
        const elEd = document.getElementById('dashboard-editions-list');
        if (elEd) {
            if (!editions.length) {
                elEd.innerHTML = '<div class="empty-state">Nenhuma edição cadastrada.</div>';
            } else {
                elEd.innerHTML = editions.slice(0, 3).map(ed => {
                    const count = enrollments.filter(en => en.editionId === ed.id).length;
                    return `
                        <div class="event-item">
                            <div class="event-info">
                                <span class="event-location">${ed.city} – ${ed.state}</span>
                                <span class="event-name">${ed.name}</span>
                                <span class="event-meta">Data: ${ed.date} • <strong style="color:var(--primary)">${ed.status}</strong></span>
                            </div>
                            <div class="event-stats">
                                <div class="event-stats-number">${count}</div>
                                <div class="event-stats-label">Inscritos</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Voluntários recentes no Dashboard
        const canReadVolunteers = await window.db.hasPermission('volunteers:read');
        const volunteers = canReadVolunteers ? await window.db.getVolunteers() : [];
        const elVol = document.getElementById('dashboard-volunteers-list');
        if (elVol) {
            if (!volunteers.length) {
                elVol.innerHTML = '<div class="empty-state">Nenhum voluntário cadastrado.</div>';
            } else {
                elVol.innerHTML = volunteers.slice(0, 4).map(v => `
                    <div class="volunteer-item">
                        <div class="vol-info">
                            <span class="vol-name">${v.name}</span>
                            <span class="vol-meta">${v.phone} • ${v.address?.city || 'Sertão'} – ${v.address?.state || 'PB'}</span>
                            <div style="margin-top: 4px;">
                                ${(v.volunteerAreas || []).slice(0, 2).map(a => `<span class="area-pill">${a}</span>`).join('')}
                            </div>
                        </div>
                        <span class="badge-green">${v.status || 'Ativo'}</span>
                    </div>
                `).join('');
            }
        }

        // Inscrições recentes no Dashboard
        const elEnr = document.getElementById('dashboard-enrollments-list');
        if (elEnr) {
            if (!enrollments.length) {
                elEnr.innerHTML = '<div class="empty-state">Nenhuma inscrição recente.</div>';
            } else {
                elEnr.innerHTML = enrollments.slice(0, 4).map(en => `
                    <div style="padding: 10px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 13px; font-weight: 700;">${en.participant?.name || 'Participante'}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${en.edition?.name || 'Edição'} ${en.shirtSize ? '• Camisa: ' + en.shirtSize : ''}</div>
                        </div>
                        <span class="${en.paymentStatus === 'Aprovado' ? 'badge-paid' : 'badge-pending'}">${en.paymentStatus}</span>
                    </div>
                `).join('');
            }
        }

        // Auditoria no Dashboard (se tiver permissão)
        const panelLogs = document.getElementById('dashboard-logs-panel');
        const canViewLogs = await window.db.hasPermission('logs:read');
        if (panelLogs) {
            if (!canViewLogs) {
                panelLogs.style.display = 'none';
            } else {
                panelLogs.style.display = '';
                const elLogs = document.getElementById('dashboard-logs-list');
                const logs = await window.db.getLogs();
                if (elLogs) {
                    if (!logs.length) {
                        elLogs.innerHTML = '<div class="empty-state">Nenhum log registrado.</div>';
                    } else {
                        elLogs.innerHTML = logs.slice(0, 5).map(l => `
                            <div class="log-item">
                                <div class="log-content">
                                    <strong>${l.userName}:</strong> ${l.details || l.action}
                                    <div style="font-size: 11px; color: var(--text-light);">${l.affectedRecord}</div>
                                </div>
                                <span class="log-time">${l.formattedTime}</span>
                            </div>
                        `).join('');
                    }
                }
            }
        }
    }

    /* ==========================================================================
       1. EDIÇÕES (CRUD, UPLOAD DE IMAGEM, MODELOS DE INSCRIÇÃO & CAMISA)
       ========================================================================== */
    const modalEdition = document.getElementById('modal-edition');
    const btnAddEdition = document.getElementById('btn-add-edition');
    const btnCancelEdition = document.getElementById('btn-cancel-edition');
    const modalEditionClose = document.getElementById('modal-edition-close');
    const btnSaveEdition = document.getElementById('btn-save-edition');
    const selectRegType = document.getElementById('form-edition-regtype');
    const groupPrice = document.getElementById('group-edition-price');
    const groupShirts = document.getElementById('group-edition-shirts');
    const editionFileDropzone = document.getElementById('edition-image-dropzone');
    const editionFileInput = document.getElementById('form-edition-file');
    const editionImagePreview = document.getElementById('edition-image-preview');
    const editionImageVal = document.getElementById('form-edition-image-val');

    // Filtros de Edição
    const editionSearch = document.getElementById('edition-search-input');
    const editionTypeFilter = document.getElementById('edition-type-filter');
    const editionStatusFilter = document.getElementById('edition-status-filter');

    if (editionSearch) editionSearch.addEventListener('input', () => filterAndRenderEditions());
    if (editionTypeFilter) editionTypeFilter.addEventListener('change', () => filterAndRenderEditions());
    if (editionStatusFilter) editionStatusFilter.addEventListener('change', () => filterAndRenderEditions());

    // Altera campos de preço e tamanhos conforme o tipo de inscrição escolhido
    if (selectRegType) {
        selectRegType.addEventListener('change', () => {
            const val = selectRegType.value;
            if (val === 'paid') {
                groupPrice.style.display = '';
                document.getElementById('label-edition-price').textContent = 'Valor da Taxa (R$) *';
                groupShirts.style.display = 'none';
            } else if (val === 'shirt') {
                groupPrice.style.display = '';
                document.getElementById('label-edition-price').textContent = 'Valor da Camisa (R$) *';
                groupShirts.style.display = '';
            } else {
                groupPrice.style.display = 'none';
                groupShirts.style.display = 'none';
            }
        });
    }

    // Upload de Imagem via FileReader (com otimização)
    if (editionFileDropzone && editionFileInput) {
        editionFileDropzone.addEventListener('click', () => editionFileInput.click());
        editionFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
                alert('A imagem deve ter no máximo 10MB.');
                return;
            }
            try {
                showToast('Otimizando imagem...');
                const optimized = await compressImageFile(file, 1200, 800);
                editionImageVal.value = optimized;
                editionImagePreview.src = optimized;
                editionImagePreview.style.display = 'block';
                showToast('Imagem carregada com sucesso!');
            } catch (err) {
                console.error(err);
                alert('Erro ao processar imagem.');
            }
        });
    }

    async function loadEditions() {
        await filterAndRenderEditions();
        // Atualiza selects de edições vinculadas nas outras abas
        await populateEditionDropdowns();
    }

    async function filterAndRenderEditions() {
        const container = document.getElementById('editions-container');
        if (!container) return;

        const filter = {
            search: editionSearch?.value || '',
            type: editionTypeFilter?.value || '',
            status: editionStatusFilter?.value || ''
        };

        const editions = await window.db.getEditions(filter);
        const canReadEnrollments = await window.db.hasPermission('enrollments:read');
        const enrollments = canReadEnrollments ? await window.db.getEnrollments() : [];
        const actions = await window.db.getActions();

        if (!editions.length) {
            container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">Nenhuma edição encontrada com os filtros selecionados.</div>';
            return;
        }

        const statusClassMap = {
            'Inscrições Abertas': 'status-aberta',
            'Planejamento': 'status-planejamento',
            'Inscrições Encerradas': 'status-encerrada',
            'Em Andamento': 'status-andamento',
            'Finalizada': 'status-finalizada',
            'Cancelada': 'status-cancelada'
        };

        const regTypeLabels = {
            none: 'Livre / Sem Inscrição',
            free: 'Inscrição Gratuita',
            paid: 'Inscrição com Taxa',
            shirt: 'Inscrição com Camisa'
        };

        container.innerHTML = editions.map(ed => {
            const edEnrollments = enrollments.filter(en => en.editionId === ed.id);
            const edActions = actions.filter(a => a.editionId === ed.id);
            const statusClass = statusClassMap[ed.status] || 'status-planejamento';
            const regLabel = regTypeLabels[ed.registrationType] || ed.registrationType;

            return `
                <div class="edition-admin-card">
                    <div class="edition-card-media">
                        <img src="${ed.image || 'assets/images/noite_clamor.jpg'}" alt="${ed.name}" onerror="this.src='assets/images/noite_clamor.jpg'">
                        <span class="status-badge ${statusClass} edition-card-badge">${ed.status}</span>
                        <span class="edition-card-type">${ed.type}</span>
                    </div>
                    <div class="edition-card-body">
                        <h3 class="edition-card-title">${ed.name}</h3>
                        <div class="edition-card-info">
                            <div class="edition-card-info-item">
                                <i class="ph ph-map-pin"></i>
                                <span>${ed.city} – ${ed.state}, ${ed.country || 'Brasil'}</span>
                            </div>
                            <div class="edition-card-info-item">
                                <i class="ph ph-calendar"></i>
                                <span>${ed.date}</span>
                            </div>
                            <div class="edition-card-info-item">
                                <span class="reg-type-badge ${ed.registrationType}">
                                    <i class="ph ph-tag"></i> ${regLabel} ${ed.price ? '• R$ ' + Number(ed.price).toFixed(2) : ''}
                                </span>
                            </div>
                        </div>

                        <div class="edition-card-stats-row">
                            <div class="edition-mini-stat">
                                <span class="edition-mini-stat-num">${edEnrollments.length}</span>
                                <span class="edition-mini-stat-lbl">Inscrições</span>
                            </div>
                            <div class="edition-mini-stat">
                                <span class="edition-mini-stat-num">${edActions.length}</span>
                                <span class="edition-mini-stat-lbl">Ações</span>
                            </div>
                        </div>

                        <div class="edition-card-actions">
                            <button class="btn-sm-action" onclick="openEditEdition('${ed.id}')">
                                <i class="ph ph-pencil-simple"></i> Editar
                            </button>
                            <button class="btn-sm-action" onclick="viewEditionActions('${ed.id}')">
                                <i class="ph ph-lightning"></i> Ações
                            </button>
                            <button class="btn-sm-action danger" onclick="deleteEditionConfirm('${ed.id}')" title="Excluir">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function openEditionModal(edition = null) {
        document.getElementById('form-edition-id').value = edition ? edition.id : '';
        document.getElementById('form-edition-name').value = edition ? edition.name : '';
        document.getElementById('form-edition-type').value = edition ? edition.type : 'Encontro';
        document.getElementById('form-edition-city').value = edition ? edition.city : '';
        document.getElementById('form-edition-state').value = edition ? edition.state : 'PB';
        document.getElementById('form-edition-country').value = edition ? (edition.country || 'Brasil') : 'Brasil';
        document.getElementById('form-edition-date').value = edition ? edition.date : '';
        document.getElementById('form-edition-status').value = edition ? edition.status : 'Inscrições Abertas';
        document.getElementById('form-edition-desc').value = edition ? (edition.description || '') : '';

        // Imagem
        const imgVal = edition ? (edition.image || '') : 'assets/images/noite_clamor.jpg';
        editionImageVal.value = imgVal;
        if (imgVal) {
            editionImagePreview.src = imgVal;
            editionImagePreview.style.display = 'block';
        } else {
            editionImagePreview.style.display = 'none';
        }

        // Modelo de inscrição
        const regType = edition ? (edition.registrationType || 'free') : 'free';
        selectRegType.value = regType;
        selectRegType.dispatchEvent(new Event('change'));

        const price = edition ? (regType === 'shirt' ? edition.shirtPrice : edition.price) : 0;
        document.getElementById('form-edition-price').value = price || '';

        // Checkboxes de tamanhos
        const savedSizes = edition && edition.shirtSizes ? edition.shirtSizes : ['P', 'M', 'G', 'GG'];
        document.querySelectorAll('input[name="shirt_size"]').forEach(cb => {
            cb.checked = savedSizes.includes(cb.value);
        });

        document.getElementById('modal-edition-title').textContent = edition ? 'Editar Edição' : 'Nova Edição';
        modalEdition.style.display = 'flex';
    }

    function closeEditionModal() {
        modalEdition.style.display = 'none';
    }

    if (btnAddEdition) btnAddEdition.addEventListener('click', () => openEditionModal());
    if (btnCancelEdition) btnCancelEdition.addEventListener('click', closeEditionModal);
    if (modalEditionClose) modalEditionClose.addEventListener('click', closeEditionModal);

    window.openEditEdition = async (id) => {
        const ed = await window.db.getEditionById(id);
        if (ed) openEditionModal(ed);
    };

    window.deleteEditionConfirm = async (id) => {
        if (!confirm('Tem certeza que deseja excluir esta edição? Todas as ações e inscrições vinculadas também serão removidas!')) return;
        try {
            await window.db.deleteEdition(id);
            showToast('Edição excluída com sucesso.');
            await loadEditions();
            await loadDashboard();
        } catch (err) {
            alert(err.message || 'Erro ao excluir edição.');
        }
    };

    window.viewEditionActions = (editionId) => {
        const actionSelect = document.getElementById('action-edition-filter');
        if (actionSelect) actionSelect.value = editionId;
        navigateTo('acoes');
        loadActions();
    };

    if (btnSaveEdition) {
        btnSaveEdition.addEventListener('click', async () => {
            const id = document.getElementById('form-edition-id').value;
            const name = document.getElementById('form-edition-name').value.trim();
            const type = document.getElementById('form-edition-type').value;
            const city = document.getElementById('form-edition-city').value.trim();
            const state = document.getElementById('form-edition-state').value.trim();
            const country = document.getElementById('form-edition-country').value.trim();
            const date = document.getElementById('form-edition-date').value.trim();
            const status = document.getElementById('form-edition-status').value;
            const description = document.getElementById('form-edition-desc').value.trim();
            const image = editionImageVal.value || 'assets/images/noite_clamor.jpg';
            const registrationType = selectRegType.value;
            const price = parseFloat(document.getElementById('form-edition-price').value) || 0;

            if (!name || !city || !state || !date) {
                alert('Preencha os campos obrigatórios (Nome, Cidade, Estado e Data).');
                return;
            }

            const selectedSizes = [];
            document.querySelectorAll('input[name="shirt_size"]:checked').forEach(cb => {
                selectedSizes.push(cb.value);
            });

            const editionData = {
                name,
                type,
                city,
                state,
                country,
                date,
                status,
                description,
                image,
                registrationType,
                price: registrationType === 'paid' ? price : 0,
                shirtPrice: registrationType === 'shirt' ? price : 0,
                shirtSizes: registrationType === 'shirt' ? selectedSizes : []
            };

            try {
                if (id) {
                    await window.db.updateEdition(id, editionData);
                    showToast('Edição atualizada com sucesso!');
                } else {
                    await window.db.addEdition(editionData);
                    showToast('Nova edição cadastrada com sucesso!');
                }
                closeEditionModal();
                await loadEditions();
                await loadDashboard();
            } catch (err) {
                alert(err.message || 'Erro ao salvar edição.');
            }
        });
    }

    /* ==========================================================================
       4. AÇÕES VINCULADAS ÀS EDIÇÕES
       ========================================================================== */
    const modalAction = document.getElementById('modal-action');
    const btnAddAction = document.getElementById('btn-add-action');
    const btnCancelAction = document.getElementById('btn-cancel-action');
    const modalActionClose = document.getElementById('modal-action-close');
    const btnSaveAction = document.getElementById('btn-save-action');
    const actionEditionFilter = document.getElementById('action-edition-filter');
    const formActionEdition = document.getElementById('form-action-edition');

    async function populateEditionDropdowns() {
        const editions = await window.db.getEditions();
        const optionsHtml = '<option value="">Todas as Edições</option>' + editions.map(e => `<option value="${e.id}">${e.name}</option>`).join('');

        if (actionEditionFilter) {
            const currentVal = actionEditionFilter.value;
            actionEditionFilter.innerHTML = optionsHtml;
            actionEditionFilter.value = currentVal;
        }

        const enrollmentEditionFilter = document.getElementById('enrollment-edition-filter');
        if (enrollmentEditionFilter) {
            const currentVal = enrollmentEditionFilter.value;
            enrollmentEditionFilter.innerHTML = optionsHtml;
            enrollmentEditionFilter.value = currentVal;
        }

        if (formActionEdition) {
            formActionEdition.innerHTML = editions.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        }
    }

    if (actionEditionFilter) {
        actionEditionFilter.addEventListener('change', () => loadActions());
    }

    async function loadActions() {
        const container = document.getElementById('actions-list-container');
        if (!container) return;

        const editionId = actionEditionFilter?.value || null;
        const actions = await window.db.getActions(editionId);
        const editions = await window.db.getEditions();

        if (!actions.length) {
            container.innerHTML = '<div class="empty-state">Nenhuma ação missionária cadastrada nesta edição.</div>';
            return;
        }

        container.innerHTML = actions.map(act => {
            const edition = editions.find(e => e.id === act.editionId);
            return `
                <div class="action-card">
                    <div class="action-main-info">
                        <span class="action-edition-tag"><i class="ph ph-map-pin"></i> ${edition ? edition.name : 'Edição'}</span>
                        <h4 class="action-title">${act.title}</h4>
                        <div class="action-meta-row">
                            <span><i class="ph ph-calendar"></i> ${act.date || 'Data a definir'}</span>
                            <span><i class="ph ph-clock"></i> ${act.time || '—'}</span>
                            <span><i class="ph ph-compass"></i> ${act.location || 'Local a definir'}</span>
                            <span><i class="ph ph-user"></i> Líder: ${act.leader || 'Equipe'}</span>
                            <span class="status-badge active" style="font-size:10px;">${act.status}</span>
                        </div>
                        ${act.description ? `<p style="font-size:12px; color:var(--text-muted); margin-top:6px;">${act.description}</p>` : ''}
                    </div>
                    <div class="table-actions">
                        <button onclick="openEditAction('${act.id}')" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                        <button class="danger" onclick="deleteActionConfirm('${act.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function openActionModal(action = null) {
        document.getElementById('form-action-id').value = action ? action.id : '';
        document.getElementById('form-action-title').value = action ? action.title : '';
        document.getElementById('form-action-date').value = action ? action.date : '';
        document.getElementById('form-action-time').value = action ? action.time : '';
        document.getElementById('form-action-location').value = action ? action.location : '';
        document.getElementById('form-action-leader').value = action ? action.leader : '';
        document.getElementById('form-action-desc').value = action ? (action.description || '') : '';
        document.getElementById('form-action-status').value = action ? action.status : 'Confirmada';

        if (action && formActionEdition) {
            formActionEdition.value = action.editionId;
        } else if (actionEditionFilter && actionEditionFilter.value) {
            formActionEdition.value = actionEditionFilter.value;
        }

        document.getElementById('modal-action-title').textContent = action ? 'Editar Ação Missionária' : 'Nova Ação Missionária';
        modalAction.style.display = 'flex';
    }

    function closeActionModal() { modalAction.style.display = 'none'; }

    if (btnAddAction) btnAddAction.addEventListener('click', () => openActionModal());
    if (btnCancelAction) btnCancelAction.addEventListener('click', closeActionModal);
    if (modalActionClose) modalActionClose.addEventListener('click', closeActionModal);

    window.openEditAction = async (id) => {
        const actions = await window.db.getActions();
        const act = actions.find(a => a.id === id);
        if (act) openActionModal(act);
    };

    window.deleteActionConfirm = async (id) => {
        if (!confirm('Deseja excluir esta ação missionária?')) return;
        await window.db.deleteAction(id);
        showToast('Ação excluída com sucesso.');
        await loadActions();
        await loadDashboard();
    };

    if (btnSaveAction) {
        btnSaveAction.addEventListener('click', async () => {
            const id = document.getElementById('form-action-id').value;
            const editionId = formActionEdition.value;
            const title = document.getElementById('form-action-title').value.trim();

            if (!editionId || !title) {
                alert('Selecione a edição vinculada e informe o título da ação.');
                return;
            }

            const actionData = {
                editionId,
                title,
                date: document.getElementById('form-action-date').value,
                time: document.getElementById('form-action-time').value,
                location: document.getElementById('form-action-location').value.trim(),
                leader: document.getElementById('form-action-leader').value.trim(),
                description: document.getElementById('form-action-desc').value.trim(),
                status: document.getElementById('form-action-status').value
            };

            try {
                if (id) {
                    await window.db.updateAction(id, actionData);
                    showToast('Ação atualizada!');
                } else {
                    await window.db.addAction(actionData);
                    showToast('Ação criada com sucesso!');
                }
                closeActionModal();
                await loadActions();
                await loadDashboard();
            } catch (err) {
                alert(err.message || 'Erro ao salvar ação.');
            }
        });
    }

    /* ==========================================================================
       3. VOLUNTÁRIOS & PARTICIPANTES
       ========================================================================== */
    const modalVolunteer = document.getElementById('modal-volunteer');
    const btnAddVolunteer = document.getElementById('btn-add-volunteer');
    const btnCancelVolunteer = document.getElementById('btn-cancel-volunteer');
    const modalVolunteerClose = document.getElementById('modal-volunteer-close');
    const btnSaveVolunteer = document.getElementById('btn-save-volunteer');
    const selectIsVolunteer = document.getElementById('form-vol-isvolunteer');
    const boxVolunteerAreas = document.getElementById('box-volunteer-areas');

    // Filtros
    const volunteerSearch = document.getElementById('volunteers-search');
    const volunteerStatusFilter = document.getElementById('volunteer-status-filter');
    const volunteerAreaFilter = document.getElementById('volunteer-area-filter');

    if (volunteerSearch) volunteerSearch.addEventListener('input', () => loadVolunteers());
    if (volunteerStatusFilter) volunteerStatusFilter.addEventListener('change', () => loadVolunteers());
    if (volunteerAreaFilter) volunteerAreaFilter.addEventListener('change', () => loadVolunteers());

    if (selectIsVolunteer) {
        selectIsVolunteer.addEventListener('change', () => {
            boxVolunteerAreas.style.display = selectIsVolunteer.value === 'true' ? 'block' : 'none';
        });
    }

    // Toggle de "Outros"
    const cbOutros = document.querySelector('input[name="vol_area"][value="Outros"]');
    const groupVolOther = document.getElementById('group-vol-other');
    if (cbOutros && groupVolOther) {
        cbOutros.addEventListener('change', () => {
            groupVolOther.style.display = cbOutros.checked ? 'block' : 'none';
        });
    }

    async function loadVolunteers() {
        const tbody = document.getElementById('volunteers-table-body');
        if (!tbody) return;

        const filter = {
            search: volunteerSearch?.value || '',
            status: volunteerStatusFilter?.value || ''
        };

        let participants = await window.db.getParticipants(filter);

        if (volunteerAreaFilter && volunteerAreaFilter.value) {
            const area = volunteerAreaFilter.value;
            participants = participants.filter(p => (p.volunteerAreas || []).includes(area));
        }

        if (!participants.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum voluntário encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = participants.map(p => {
            const age = p.birthDate ? calculateAge(p.birthDate) : '—';
            const city = p.address?.city ? `${p.address.city} – ${p.address.state || 'PB'}` : '—';

            return `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="cell-avatar">${initials(p.name)}</div>
                            <div>
                                <span style="font-weight:700;">${p.name}</span>
                                <div style="font-size:11px; color:var(--text-light);">${p.birthDate || ''} (${age} anos)</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <strong>${p.phone}</strong><br>
                        <small style="color:var(--text-muted)">${p.email}</small>
                    </td>
                    <td>${city}</td>
                    <td>
                        <strong>${p.church || '—'}</strong><br>
                        <small style="color:var(--text-muted)">${p.pastor ? 'Pr. ' + p.pastor : ''}</small>
                    </td>
                    <td>
                        ${p.isVolunteer ? (p.volunteerAreas || []).map(a => `<span class="area-pill">${a}</span>`).join('') : '<span style="color:var(--text-light); font-size:11px;">Apenas participante</span>'}
                    </td>
                    <td>
                        <span class="status-badge ${p.status === 'Ativo' ? 'active' : 'inactive'}">${p.status || 'Ativo'}</span>
                    </td>
                    <td>
                        <div class="table-actions">
                            <button onclick="openEditVolunteer('${p.id}')" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                            <button class="danger" onclick="deleteVolunteerConfirm('${p.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openVolunteerModal(volunteer = null) {
        document.getElementById('form-vol-id').value = volunteer ? volunteer.id : '';
        document.getElementById('form-vol-name').value = volunteer ? volunteer.name : '';
        document.getElementById('form-vol-birth').value = volunteer ? volunteer.birthDate : '';
        document.getElementById('form-vol-phone').value = volunteer ? volunteer.phone : '';
        document.getElementById('form-vol-email').value = volunteer ? volunteer.email : '';
        document.getElementById('form-vol-street').value = volunteer ? (volunteer.address?.street || '') : '';
        document.getElementById('form-vol-neighborhood').value = volunteer ? (volunteer.address?.neighborhood || '') : '';
        document.getElementById('form-vol-city').value = volunteer ? (volunteer.address?.city || 'Patos') : 'Patos';
        document.getElementById('form-vol-state').value = volunteer ? (volunteer.address?.state || 'PB') : 'PB';
        document.getElementById('form-vol-pastor').value = volunteer ? (volunteer.pastor || '') : '';
        document.getElementById('form-vol-church').value = volunteer ? (volunteer.church || '') : '';

        const isVol = volunteer ? volunteer.isVolunteer : true;
        selectIsVolunteer.value = isVol ? 'true' : 'false';
        boxVolunteerAreas.style.display = isVol ? 'block' : 'none';

        const areas = volunteer && volunteer.volunteerAreas ? volunteer.volunteerAreas : ['Apoio'];
        document.querySelectorAll('input[name="vol_area"]').forEach(cb => {
            cb.checked = areas.includes(cb.value);
        });

        const otherDetail = volunteer ? (volunteer.volunteerOtherDetails || '') : '';
        document.getElementById('form-vol-other-detail').value = otherDetail;
        groupVolOther.style.display = areas.includes('Outros') ? 'block' : 'none';

        document.getElementById('modal-volunteer-title').textContent = volunteer ? 'Editar Voluntário' : 'Novo Cadastro de Voluntário';
        modalVolunteer.style.display = 'flex';
    }

    function closeVolunteerModal() { modalVolunteer.style.display = 'none'; }

    if (btnAddVolunteer) btnAddVolunteer.addEventListener('click', () => openVolunteerModal());
    if (btnCancelVolunteer) btnCancelVolunteer.addEventListener('click', closeVolunteerModal);
    if (modalVolunteerClose) modalVolunteerClose.addEventListener('click', closeVolunteerModal);

    window.openEditVolunteer = async (id) => {
        const parts = await window.db.getParticipants();
        const v = parts.find(p => p.id === id);
        if (v) openVolunteerModal(v);
    };

    window.deleteVolunteerConfirm = async (id) => {
        if (!confirm('Deseja realmente excluir este participante/voluntário?')) return;
        try {
            await window.db.deleteParticipant(id);
            showToast('Voluntário removido com sucesso.');
            await loadVolunteers();
            await loadDashboard();
        } catch (err) {
            alert(err.message || 'Erro ao excluir.');
        }
    };

    if (btnSaveVolunteer) {
        btnSaveVolunteer.addEventListener('click', async () => {
            const id = document.getElementById('form-vol-id').value;
            const name = document.getElementById('form-vol-name').value.trim();
            const birthDate = document.getElementById('form-vol-birth').value;
            const phone = document.getElementById('form-vol-phone').value.trim();
            const email = document.getElementById('form-vol-email').value.trim();

            if (!name || !phone || !email) {
                alert('Nome, telefone e e-mail são obrigatórios.');
                return;
            }

            const isVolunteer = selectIsVolunteer.value === 'true';
            const selectedAreas = [];
            if (isVolunteer) {
                document.querySelectorAll('input[name="vol_area"]:checked').forEach(cb => {
                    selectedAreas.push(cb.value);
                });
            }

            const payload = {
                name,
                birthDate,
                phone,
                email,
                address: {
                    street: document.getElementById('form-vol-street').value.trim(),
                    neighborhood: document.getElementById('form-vol-neighborhood').value.trim(),
                    city: document.getElementById('form-vol-city').value.trim(),
                    state: document.getElementById('form-vol-state').value.trim()
                },
                pastor: document.getElementById('form-vol-pastor').value.trim(),
                church: document.getElementById('form-vol-church').value.trim(),
                isVolunteer,
                volunteerAreas: selectedAreas,
                volunteerOtherDetails: document.getElementById('form-vol-other-detail').value.trim()
            };

            try {
                if (id) {
                    await window.db.updateParticipant(id, payload);
                    showToast('Cadastro atualizado com sucesso!');
                } else {
                    await window.db.registerParticipant(payload);
                    showToast('Voluntário cadastrado com sucesso!');
                }
                closeVolunteerModal();
                await loadVolunteers();
                await loadDashboard();
            } catch (err) {
                alert(err.message || 'Erro ao salvar voluntário.');
            }
        });
    }

    /* ==========================================================================
       2. INSCRIÇÕES & COMPROVANTES DE PAGAMENTO
       ========================================================================== */
    const modalProof = document.getElementById('modal-proof');
    const modalProofClose = document.getElementById('modal-proof-close');
    const btnCloseProof = document.getElementById('btn-close-proof');
    const btnApproveEnrollment = document.getElementById('btn-approve-enrollment');
    const btnRejectEnrollment = document.getElementById('btn-reject-enrollment');

    const enrollmentEditionFilter = document.getElementById('enrollment-edition-filter');
    const enrollmentStatusFilter = document.getElementById('enrollment-status-filter');
    const enrollmentPaymentFilter = document.getElementById('enrollment-payment-filter');

    if (enrollmentEditionFilter) enrollmentEditionFilter.addEventListener('change', () => loadEnrollments());
    if (enrollmentStatusFilter) enrollmentStatusFilter.addEventListener('change', () => loadEnrollments());
    if (enrollmentPaymentFilter) enrollmentPaymentFilter.addEventListener('change', () => loadEnrollments());

    async function loadEnrollments() {
        const tbody = document.getElementById('enrollments-table-body');
        const contribTbody = document.getElementById('contributions-table-body');
        if (!tbody) return;

        // Garante que o select de edições tenha as opções carregadas
        if (enrollmentEditionFilter && enrollmentEditionFilter.options.length <= 1) {
            await populateEditionDropdowns();
        }

        const filter = {
            editionId: enrollmentEditionFilter?.value || '',
            status: enrollmentStatusFilter?.value || '',
            paymentStatus: enrollmentPaymentFilter?.value || ''
        };

        // 1. Carrega Inscrições
        try {
            const enrollments = await window.db.getEnrollments(filter);

            if (!enrollments || !enrollments.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma inscrição encontrada com os filtros selecionados.</td></tr>';
            } else {
                tbody.innerHTML = enrollments.map(en => {
                    const hasProof = Boolean(en.proofFile);
                    const regTypeLabel = en.registrationType === 'shirt'
                        ? '👕 Camisa: ' + (en.shirtSize || 'M')
                        : (en.registrationType === 'paid' ? 'Taxa' : 'Gratuita');
                    const amountFormatted = (typeof en.amount === 'number')
                        ? 'R$ ' + en.amount.toFixed(2)
                        : (en.amount ? (String(en.amount).startsWith('R$') ? String(en.amount) : 'R$ ' + Number(en.amount).toFixed(2)) : 'R$ 0,00');

                    return `
                        <tr>
                            <td>
                                <div class="user-cell">
                                    <div class="cell-avatar">${initials(en.participant?.name || 'P')}</div>
                                    <div>
                                        <span style="font-weight:700;">${en.participant?.name || 'Não identificado'}</span>
                                        <div style="font-size:11px; color:var(--text-light);">${en.participant?.phone || ''}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <strong>${en.edition?.name || 'Edição'}</strong><br>
                                <small style="color:var(--text-light);">${en.edition?.city || ''} – ${en.edition?.state || ''}</small>
                            </td>
                            <td>
                                <span class="reg-type-badge ${en.registrationType || 'free'}">
                                    ${regTypeLabel}
                                </span>
                            </td>
                            <td>
                                <strong style="color:var(--primary)">${amountFormatted}</strong>
                            </td>
                            <td>
                                <span class="status-badge ${en.status === 'Confirmada' ? 'active' : (en.status === 'Pendente' ? 'inactive' : 'status-cancelada')}">
                                    ${en.status || 'Pendente'}
                                </span>
                            </td>
                            <td>
                                <span class="${en.paymentStatus === 'Aprovado' ? 'badge-paid' : (en.paymentStatus === 'Rejeitado' ? 'badge-rejected' : 'badge-pending')}">
                                    ${en.paymentStatus || 'Pendente'}
                                </span>
                            </td>
                            <td>
                                ${hasProof ? `
                                    <button class="btn-sm-action primary" onclick="openProofModal('${en.id}')">
                                        <i class="ph ph-file-text"></i> Ver Comprovante
                                    </button>
                                ` : `<span style="font-size:11px; color:var(--text-light);">Isento</span>`}
                            </td>
                            <td>
                                <div class="table-actions">
                                    <button onclick="quickApproveEnrollment('${en.id}')" title="Aprovar Inscrição" style="color:var(--success);"><i class="ph ph-check"></i></button>
                                    <button class="danger" onclick="deleteEnrollmentConfirm('${en.id}')" title="Excluir"><i class="ph ph-trash"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error('Erro ao carregar inscrições:', err);
            showToast(`Falha ao carregar inscrições: ${err.message || 'erro de leitura'}`);
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state" style="color:red;">Erro ao carregar inscrições.</td></tr>';
        }

        // 2. Carrega Contribuições Espontâneas
        if (contribTbody) {
            try {
                const contribs = await window.db.getContributions();
                if (!contribs || !contribs.length) {
                    contribTbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma contribuição voluntária registrada ainda.</td></tr>';
                } else {
                    contribTbody.innerHTML = contribs.map(c => {
                        const donorName = c.donorName || c.name || 'Doador Anônimo';
                        const amountFormatted = (typeof c.amount === 'number')
                            ? 'R$ ' + c.amount.toFixed(2)
                            : (c.amount ? (String(c.amount).startsWith('R$') ? String(c.amount) : 'R$ ' + c.amount) : 'Não informado');
                        const dateVal = c.date || c.createdAt || null;
                        const dateStr = dateVal ? new Date(dateVal).toLocaleString('pt-BR') : '—';
                        const statusVal = c.status || c.paymentStatus || 'Confirmado';
                        const hasProof = Boolean(c.proofFile);

                        return `
                            <tr>
                                <td>
                                    <div class="user-cell">
                                        <div class="cell-avatar">${initials(donorName)}</div>
                                        <div>
                                            <span style="font-weight:700;">${donorName}</span>
                                            <div style="font-size:11px; color:var(--text-light);">${c.email || c.phone || 'Doação Voluntária'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td><strong style="color:var(--primary)">${amountFormatted}</strong></td>
                                <td><small style="color:var(--text-light)">${dateStr}</small></td>
                                <td>
                                    ${hasProof ? `
                                        <button class="btn-sm-action primary" onclick="openProofModal('${c.id}')">
                                            <i class="ph ph-file-text"></i> Ver Comprovante
                                        </button>
                                    ` : `<span style="font-size:11px; color:var(--text-light);">Sem comprovante</span>`}
                                </td>
                                <td><span class="badge-paid">${statusVal}</span></td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (err) {
                console.error('Erro ao carregar contribuições:', err);
                showToast(`Falha ao carregar contribuições: ${err.message || 'erro de leitura'}`);
                contribTbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="color:red;">Erro ao carregar contribuições.</td></tr>';
            }
        }
    }

    window.openProofModal = async (enrollmentId) => {
        try {
            const enrollments = await window.db.getEnrollments();
            let en = enrollments.find(e => e.id === enrollmentId);
            if (!en) {
                const contribs = await window.db.getContributions();
                const ct = contribs.find(c => c.id === enrollmentId);
                if (ct) {
                    en = {
                        id: ct.id,
                        participant: { name: ct.donorName || ct.name || 'Doador Anônimo' },
                        edition: { name: 'Contribuição Voluntária PIX' },
                        registrationType: 'Doação',
                        shirtSize: '',
                        amount: ct.amount || '0',
                        adminNotes: ct.notes || ct.adminNotes || '',
                        proofFile: ct.proofFile,
                        proofFileName: ct.proofFileName
                    };
                }
            }
            if (!en) {
                alert('Comprovante não encontrado.');
                return;
            }

            document.getElementById('proof-enrollment-id').value = en.id;
            document.getElementById('proof-val-name').textContent = en.participant?.name || '—';
            document.getElementById('proof-val-edition').textContent = en.edition?.name || '—';
            document.getElementById('proof-val-details').textContent = en.registrationType === 'shirt'
                ? `Camisa Tamanho ${en.shirtSize}`
                : (en.registrationType === 'Doação' ? 'Doação Voluntária' : 'Inscrição');
            document.getElementById('proof-val-amount').textContent = (typeof en.amount === 'number')
                ? `R$ ${en.amount.toFixed(2)}`
                : (en.amount ? (String(en.amount).startsWith('R$') ? String(en.amount) : `R$ ${en.amount}`) : 'R$ 0,00');

            const notesEl = document.getElementById('proof-admin-notes');
            if (notesEl) notesEl.value = en.adminNotes || '';

            const imgBox = document.getElementById('proof-image-container');
            if (imgBox) {
                if (en.proofFile) {
                    if (en.proofFile.startsWith('data:image/') || en.proofFile.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
                        imgBox.innerHTML = `<img src="${en.proofFile}" style="max-width:100%; max-height:350px; border-radius:8px; object-fit:contain;">`;
                    } else if (en.proofFile.startsWith('data:application/pdf') || en.proofFile.match(/\.pdf$/i)) {
                        imgBox.innerHTML = `<a href="${en.proofFile}" target="_blank" class="btn-outline"><i class="ph ph-file-pdf"></i> Visualizar Comprovante PDF</a>`;
                    } else {
                        imgBox.innerHTML = `<a href="${en.proofFile}" target="_blank" class="btn-outline"><i class="ph ph-file"></i> Baixar Comprovante Anexo</a>`;
                    }
                } else {
                    imgBox.innerHTML = '<div class="empty-state">Sem comprovante anexado.</div>';
                }
            }

            const modalProof = document.getElementById('modal-proof');
            if (modalProof) modalProof.style.display = 'flex';
        } catch (err) {
            console.error('Erro ao carregar comprovante:', err);
            alert('Erro ao carregar comprovante.');
        }
    };

    function closeProofModal() {
        const modalProof = document.getElementById('modal-proof');
        if (modalProof) modalProof.style.display = 'none';
    }


    if (modalProofClose) modalProofClose.addEventListener('click', closeProofModal);
    if (btnCloseProof) btnCloseProof.addEventListener('click', closeProofModal);

    if (btnApproveEnrollment) {
        btnApproveEnrollment.addEventListener('click', async () => {
            const id = document.getElementById('proof-enrollment-id').value;
            const notes = document.getElementById('proof-admin-notes').value.trim();
            try {
                if (id && (id.startsWith('contrib_') || id.startsWith('cnt_'))) {
                    const db = window.db._read();
                    const ct = (db.contributions || []).find(c => c.id === id);
                    if (ct) {
                        ct.paymentStatus = 'Aprovado';
                        ct.status = 'Confirmada';
                        ct.adminNotes = notes || 'Comprovante validado pelo financeiro.';
                        window.db._save(db);
                        await window.db.addAuditLog('CONTRIBUIÇÃO_APROVADA', ct.donorName || ct.name || 'Anônimo', `Valor: ${ct.amount || 'N/A'}`);
                    }
                    showToast('Comprovante de contribuição validado com sucesso!');
                    closeProofModal();
                    await loadEnrollments();
                    await loadDashboard();
                    return;
                }
                await window.db.updateEnrollmentStatus(id, 'Confirmada', 'Aprovado', notes || 'Comprovante conferido e aprovado.');
                showToast('Inscrição aprovada com sucesso!');
                closeProofModal();
                await loadEnrollments();
                await loadDashboard();
            } catch (err) {
                alert(err.message || 'Erro ao aprovar inscrição.');
            }
        });
    }

    if (btnRejectEnrollment) {
        btnRejectEnrollment.addEventListener('click', async () => {
            const id = document.getElementById('proof-enrollment-id').value;
            const notes = document.getElementById('proof-admin-notes').value.trim();
            if (!confirm('Deseja rejeitar este comprovante?')) return;
            try {
                if (id && (id.startsWith('contrib_') || id.startsWith('cnt_'))) {
                    const db = window.db._read();
                    const ct = (db.contributions || []).find(c => c.id === id);
                    if (ct) {
                        ct.paymentStatus = 'Rejeitado';
                        ct.status = 'Rejeitada';
                        ct.adminNotes = notes || 'Comprovante não localizado no extrato bancário.';
                        window.db._save(db);
                        await window.db.addAuditLog('CONTRIBUIÇÃO_REJEITADA', ct.donorName || ct.name || 'Anônimo', 'Comprovante rejeitado');
                    }
                    showToast('Comprovante rejeitado.');
                    closeProofModal();
                    await loadEnrollments();
                    await loadDashboard();
                    return;
                }
                await window.db.updateEnrollmentStatus(id, 'Cancelada', 'Rejeitado', notes || 'Comprovante não localizado no extrato.');
                showToast('Inscrição rejeitada.');
                closeProofModal();
                await loadEnrollments();
                await loadDashboard();
            } catch (err) {
                alert(err.message || 'Erro ao rejeitar.');
            }
        });
    }

    /* ==========================================================================
       11 & 12. GESTÃO DE LIDERANÇAS E DEPARTAMENTOS
       ========================================================================== */
    const modalLeader = document.getElementById('modal-leader');
    const modalLeaderClose = document.getElementById('modal-leader-close');
    const btnNewLeader = document.getElementById('btn-new-leader');
    const btnCancelLeader = document.getElementById('btn-cancel-leader');
    const btnSaveLeader = document.getElementById('btn-save-leader');
    const formLeaderId = document.getElementById('form-leader-id');
    const formLeaderName = document.getElementById('form-leader-name');
    const formLeaderDept = document.getElementById('form-leader-dept');
    const formLeaderRole = document.getElementById('form-leader-role');
    const formLeaderInstagram = document.getElementById('form-leader-instagram');
    const formLeaderBio = document.getElementById('form-leader-bio');
    const formLeaderBioCounter = document.getElementById('form-leader-bio-counter');
    const formLeaderOrder = document.getElementById('form-leader-order');
    const formLeaderPublished = document.getElementById('form-leader-published');
    const formLeaderActive = document.getElementById('form-leader-active');
    const formLeaderPhotoFile = document.getElementById('form-leader-photo-file');
    const btnBrowseLeaderPhoto = document.getElementById('btn-browse-leader-photo');
    const btnRemoveLeaderPhoto = document.getElementById('btn-remove-leader-photo');
    const leaderPhotoImg = document.getElementById('leader-photo-img');
    const leaderPhotoEmptyText = document.getElementById('leader-photo-empty-text');

    const filterLeaderSearch = document.getElementById('filter-leader-search');
    const filterLeaderDept = document.getElementById('filter-leader-dept');
    const filterLeaderStatus = document.getElementById('filter-leader-status');
    const leadersTableBody = document.getElementById('leaders-table-body');

    const modalDept = document.getElementById('modal-dept');
    const modalDeptClose = document.getElementById('modal-dept-close');
    const btnNewDept = document.getElementById('btn-new-dept');
    const btnCancelDept = document.getElementById('btn-cancel-dept');
    const btnSaveDept = document.getElementById('btn-save-dept');
    const formDeptId = document.getElementById('form-dept-id');
    const formDeptName = document.getElementById('form-dept-name');
    const formDeptDesc = document.getElementById('form-dept-desc');
    const formDeptActive = document.getElementById('form-dept-active');
    const deptsTableBody = document.getElementById('depts-table-body');

    let currentLeaderPhotoData = '';

    async function openLeaderModal(leader = null) {
        // Popula departamentos no select
        const depts = await window.db.getDepartments(false);
        if (formLeaderDept) {
            formLeaderDept.innerHTML = '<option value="">Selecione um departamento...</option>' +
                depts.filter(d => d.isActive !== false || (leader && leader.departmentId === d.id))
                     .map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        }

        const titleEl = document.getElementById('modal-leader-title');

        if (leader) {
            if (titleEl) titleEl.textContent = 'Editar Líder';
            if (formLeaderId) formLeaderId.value = leader.id;
            if (formLeaderName) formLeaderName.value = leader.fullName || '';
            if (formLeaderDept) formLeaderDept.value = leader.departmentId || '';
            if (formLeaderRole) formLeaderRole.value = leader.roleTitle || '';
            if (formLeaderInstagram) formLeaderInstagram.value = leader.instagramUrl || '';
            if (formLeaderBio) formLeaderBio.value = leader.biography || '';
            if (formLeaderOrder) formLeaderOrder.value = leader.displayOrder || 1;
            if (formLeaderPublished) formLeaderPublished.checked = leader.isPublished !== false;
            if (formLeaderActive) formLeaderActive.checked = leader.isActive !== false;

            currentLeaderPhotoData = leader.photoPath || '';
            if (currentLeaderPhotoData) {
                if (leaderPhotoImg) {
                    leaderPhotoImg.src = currentLeaderPhotoData;
                    leaderPhotoImg.style.display = 'block';
                }
                if (leaderPhotoEmptyText) leaderPhotoEmptyText.style.display = 'none';
                if (btnRemoveLeaderPhoto) btnRemoveLeaderPhoto.style.display = 'inline-flex';
            } else {
                if (leaderPhotoImg) {
                    leaderPhotoImg.src = '';
                    leaderPhotoImg.style.display = 'none';
                }
                if (leaderPhotoEmptyText) leaderPhotoEmptyText.style.display = 'block';
                if (btnRemoveLeaderPhoto) btnRemoveLeaderPhoto.style.display = 'none';
            }
        } else {
            if (titleEl) titleEl.textContent = 'Novo Líder';
            if (formLeaderId) formLeaderId.value = '';
            if (formLeaderName) formLeaderName.value = '';
            if (formLeaderDept) formLeaderDept.value = '';
            if (formLeaderRole) formLeaderRole.value = '';
            if (formLeaderInstagram) formLeaderInstagram.value = '';
            if (formLeaderBio) formLeaderBio.value = '';

            const allLeaders = await window.db.getLeaders();
            const nextOrder = allLeaders.length ? Math.max(...allLeaders.map(l => l.displayOrder || 0)) + 1 : 1;
            if (formLeaderOrder) formLeaderOrder.value = nextOrder;

            if (formLeaderPublished) formLeaderPublished.checked = true;
            if (formLeaderActive) formLeaderActive.checked = true;

            currentLeaderPhotoData = '';
            if (formLeaderPhotoFile) formLeaderPhotoFile.value = '';
            if (leaderPhotoImg) {
                leaderPhotoImg.src = '';
                leaderPhotoImg.style.display = 'none';
            }
            if (leaderPhotoEmptyText) leaderPhotoEmptyText.style.display = 'block';
            if (btnRemoveLeaderPhoto) btnRemoveLeaderPhoto.style.display = 'none';
        }

        if (formLeaderBio && formLeaderBioCounter) {
            formLeaderBioCounter.textContent = `${formLeaderBio.value.length} / 400`;
        }

        if (modalLeader) modalLeader.style.display = 'flex';
    }

    function closeLeaderModal() {
        if (modalLeader) modalLeader.style.display = 'none';
    }

    if (btnBrowseLeaderPhoto && formLeaderPhotoFile) {
        btnBrowseLeaderPhoto.addEventListener('click', () => formLeaderPhotoFile.click());
    }

    if (formLeaderPhotoFile) {
        formLeaderPhotoFile.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
                alert('A imagem deve ter no máximo 10MB.');
                return;
            }
            try {
                showToast('Processando foto do líder...');
                const optimized = await compressImageFile(file, 800, 800);
                currentLeaderPhotoData = optimized;
                if (leaderPhotoImg) {
                    leaderPhotoImg.src = optimized;
                    leaderPhotoImg.style.display = 'block';
                }
                if (leaderPhotoEmptyText) leaderPhotoEmptyText.style.display = 'none';
                if (btnRemoveLeaderPhoto) btnRemoveLeaderPhoto.style.display = 'inline-flex';
                showToast('Foto carregada com sucesso!');
            } catch (err) {
                console.error('Erro ao processar foto:', err);
                alert('Erro ao processar imagem.');
            }
        });
    }

    if (btnRemoveLeaderPhoto) {
        btnRemoveLeaderPhoto.addEventListener('click', () => {
            currentLeaderPhotoData = '';
            if (formLeaderPhotoFile) formLeaderPhotoFile.value = '';
            if (leaderPhotoImg) {
                leaderPhotoImg.src = '';
                leaderPhotoImg.style.display = 'none';
            }
            if (leaderPhotoEmptyText) {
                leaderPhotoEmptyText.textContent = 'Sem foto';
                leaderPhotoEmptyText.style.display = 'block';
            }
            btnRemoveLeaderPhoto.style.display = 'none';
        });
    }

    if (formLeaderBio && formLeaderBioCounter) {
        formLeaderBio.addEventListener('input', () => {
            formLeaderBioCounter.textContent = `${formLeaderBio.value.length} / 400`;
        });
    }

    if (btnNewLeader) btnNewLeader.addEventListener('click', () => openLeaderModal());
    if (btnCancelLeader) btnCancelLeader.addEventListener('click', closeLeaderModal);
    if (modalLeaderClose) modalLeaderClose.addEventListener('click', closeLeaderModal);

    if (btnSaveLeader) {
        btnSaveLeader.addEventListener('click', async () => {
            const id = formLeaderId ? formLeaderId.value : '';
            const fullName = formLeaderName ? formLeaderName.value.trim() : '';
            const departmentId = formLeaderDept ? formLeaderDept.value : '';
            const roleTitle = formLeaderRole ? formLeaderRole.value.trim() : '';
            const instagramUrl = formLeaderInstagram ? formLeaderInstagram.value.trim() : '';
            const biography = formLeaderBio ? formLeaderBio.value.trim() : '';
            const displayOrder = formLeaderOrder ? (parseInt(formLeaderOrder.value, 10) || 1) : 1;
            const isPublished = formLeaderPublished ? formLeaderPublished.checked : true;
            const isActive = formLeaderActive ? formLeaderActive.checked : true;
            const photoPath = currentLeaderPhotoData;

            if (!fullName) {
                alert('O nome completo é obrigatório.');
                if (formLeaderName) formLeaderName.focus();
                return;
            }
            if (!departmentId) {
                alert('Selecione um departamento para o líder.');
                if (formLeaderDept) formLeaderDept.focus();
                return;
            }
            if (!biography) {
                alert('A apresentação pessoal / descrição é obrigatória.');
                if (formLeaderBio) formLeaderBio.focus();
                return;
            }

            try {
                if (id) {
                    await window.db.updateLeader(id, {
                        fullName,
                        departmentId,
                        roleTitle,
                        instagramUrl,
                        biography,
                        displayOrder,
                        isPublished,
                        isActive,
                        photoPath
                    });
                    showToast('Líder atualizado com sucesso!');
                } else {
                    await window.db.createLeader({
                        fullName,
                        departmentId,
                        roleTitle,
                        instagramUrl,
                        biography,
                        displayOrder,
                        isPublished,
                        isActive,
                        photoPath
                    });
                    showToast('Líder cadastrado com sucesso!');
                }
                closeLeaderModal();
                await loadLeaders();
            } catch (err) {
                console.error('Erro ao salvar líder:', err);
                alert(err.message || 'Erro ao salvar líder.');
            }
        });
    }

    async function loadLeaders() {
        if (!leadersTableBody) return;

        try {
            const searchTerm = filterLeaderSearch ? filterLeaderSearch.value.trim().toLowerCase() : '';
            const deptFilter = filterLeaderDept ? filterLeaderDept.value : '';
            const statusFilter = filterLeaderStatus ? filterLeaderStatus.value : '';

            let leaders = await window.db.getLeaders();

            if (filterLeaderDept && filterLeaderDept.options.length <= 1) {
                const depts = await window.db.getDepartments();
                filterLeaderDept.innerHTML = '<option value="">Todos os Departamentos</option>' +
                    depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
                if (deptFilter) filterLeaderDept.value = deptFilter;
            }

            if (searchTerm) {
                leaders = leaders.filter(l =>
                    (l.fullName && l.fullName.toLowerCase().includes(searchTerm)) ||
                    (l.roleTitle && l.roleTitle.toLowerCase().includes(searchTerm)) ||
                    (l.departmentName && l.departmentName.toLowerCase().includes(searchTerm)) ||
                    (l.instagramUrl && l.instagramUrl.toLowerCase().includes(searchTerm))
                );
            }

            if (deptFilter) {
                leaders = leaders.filter(l => l.departmentId === deptFilter);
            }

            if (statusFilter === 'published') {
                leaders = leaders.filter(l => l.isPublished === true);
            } else if (statusFilter === 'draft') {
                leaders = leaders.filter(l => !l.isPublished);
            } else if (statusFilter === 'active') {
                leaders = leaders.filter(l => l.isActive !== false);
            } else if (statusFilter === 'inactive') {
                leaders = leaders.filter(l => l.isActive === false);
            }

            if (!leaders.length) {
                leadersTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                            Nenhum líder encontrado com os filtros aplicados.
                        </td>
                    </tr>`;
                return;
            }

            leadersTableBody.innerHTML = leaders.map(l => {
                const photoHtml = l.photoPath
                    ? `<img src="${l.photoPath}" alt="${l.fullName}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.outerHTML='<div style=\\\'width:44px;height:44px;border-radius:8px;background:rgba(0,140,255,0.15);color:#008CFF;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:0.85rem;border:1px solid rgba(0,140,255,0.3);\\\'>${initials(l.fullName)}</div>'">`
                    : `<div style="width: 44px; height: 44px; border-radius: 8px; background: rgba(0, 140, 255, 0.15); color: #008CFF; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; border: 1px solid rgba(0, 140, 255, 0.3);">
                        ${initials(l.fullName)}
                       </div>`;

                const roleHtml = l.roleTitle
                    ? `<div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">${l.roleTitle}</div>`
                    : '';

                const igHtml = l.instagramUrl
                    ? `<div style="font-size: 0.72rem; color: #38BDF8; margin-top: 2px;">${l.instagramUrl}</div>`
                    : '';

                const statusBadge = l.isActive !== false
                    ? '<span class="badge-active">Ativo</span>'
                    : '<span class="badge-inactive">Inativo</span>';

                const pubBadge = l.isPublished
                    ? '<span class="badge-paid" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3);">Publicado</span>'
                    : '<span class="badge-pending" style="background: rgba(148, 163, 184, 0.15); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.3);">Rascunho</span>';

                const togglePubTitle = l.isPublished ? 'Ocultar do site público' : 'Publicar no site público';
                const togglePubIcon = l.isPublished ? 'ph-eye-slash' : 'ph-eye';

                return `
                    <tr>
                        <td>${photoHtml}</td>
                        <td>
                            <strong style="color: var(--text-color); font-size: 0.9rem;">${l.fullName}</strong>
                            ${roleHtml}
                            ${igHtml}
                        </td>
                        <td>
                            <span class="badge-role" style="background: rgba(255, 255, 255, 0.05); color: var(--text-color); border: 1px solid var(--border-color);">
                                ${l.departmentName || '—'}
                            </span>
                        </td>
                        <td style="text-align: center; font-weight: 600; color: var(--text-muted);">${l.displayOrder || 1}</td>
                        <td>${statusBadge}</td>
                        <td>${pubBadge}</td>
                        <td style="text-align: right;">
                            <div style="display: inline-flex; gap: 6px;">
                                <button class="btn-icon" title="${togglePubTitle}" onclick="togglePublishLeader('${l.id}')">
                                    <i class="ph ${togglePubIcon}"></i>
                                </button>
                                <button class="btn-icon" title="Editar líder" onclick="openEditLeader('${l.id}')">
                                    <i class="ph ph-pencil-simple"></i>
                                </button>
                                <button class="btn-icon text-danger" title="Excluir líder" onclick="deleteLeaderConfirm('${l.id}')">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

        } catch (err) {
            console.error('Erro ao carregar tabela de líderes:', err);
            leadersTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 30px; color: #EF4444;">
                        Erro ao carregar líderes: ${err.message || 'Erro inesperado'}
                    </td>
                </tr>`;
        }
    }

    function openDeptModal(dept = null) {
        if (formDeptId) formDeptId.value = dept ? dept.id : '';
        if (formDeptName) formDeptName.value = dept ? dept.name : '';
        if (formDeptDesc) formDeptDesc.value = dept ? (dept.description || '') : '';
        if (formDeptActive) formDeptActive.checked = dept ? (dept.isActive !== false) : true;
        
        const titleEl = document.getElementById('modal-dept-title');
        if (titleEl) titleEl.textContent = dept ? 'Editar Departamento' : 'Novo Departamento';
        if (modalDept) modalDept.style.display = 'flex';
    }

    function closeDeptModal() {
        if (modalDept) modalDept.style.display = 'none';
    }

    if (btnNewDept) btnNewDept.addEventListener('click', () => openDeptModal());
    if (btnCancelDept) btnCancelDept.addEventListener('click', closeDeptModal);
    if (modalDeptClose) modalDeptClose.addEventListener('click', closeDeptModal);

    if (btnSaveDept) {
        btnSaveDept.addEventListener('click', async () => {
            const id = formDeptId ? formDeptId.value : '';
            const name = formDeptName ? formDeptName.value.trim() : '';
            const description = formDeptDesc ? formDeptDesc.value.trim() : '';
            const isActive = formDeptActive ? formDeptActive.checked : true;

            if (!name) {
                alert('O nome do departamento é obrigatório.');
                if (formDeptName) formDeptName.focus();
                return;
            }

            try {
                if (id) {
                    await window.db.updateDepartment(id, { name, description, isActive });
                    showToast('Departamento atualizado com sucesso!');
                } else {
                    await window.db.createDepartment({ name, description, isActive });
                    showToast('Departamento cadastrado com sucesso!');
                }
                closeDeptModal();
                await loadDepartments();
                await loadLeaders();
            } catch (err) {
                console.error('Erro ao salvar departamento:', err);
                alert(err.message || 'Erro ao salvar departamento.');
            }
        });
    }

    async function loadDepartments() {
        if (!deptsTableBody) return;

        try {
            const depts = await window.db.getDepartments();
            const leaders = await window.db.getLeaders();

            if (filterLeaderDept) {
                const currentVal = filterLeaderDept.value;
                filterLeaderDept.innerHTML = '<option value="">Todos os Departamentos</option>' +
                    depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
                filterLeaderDept.value = currentVal;
            }

            if (!depts.length) {
                deptsTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">
                            Nenhum departamento cadastrado.
                        </td>
                    </tr>`;
                return;
            }

            deptsTableBody.innerHTML = depts.map(d => {
                const linkedCount = leaders.filter(l => l.departmentId === d.id).length;
                const statusBadge = d.isActive !== false
                    ? '<span class="badge-active">Ativo</span>'
                    : '<span class="badge-inactive">Inativo</span>';

                return `
                    <tr>
                        <td>
                            <strong style="color: var(--text-color); font-size: 0.9rem;">${d.name}</strong>
                        </td>
                        <td style="color: var(--text-muted); font-size: 0.82rem; max-width: 320px;">
                            ${d.description || '—'}
                        </td>
                        <td style="text-align: center;">
                            <span class="badge-role" style="font-weight: 700;">
                                ${linkedCount} ${linkedCount === 1 ? 'líder' : 'líderes'}
                            </span>
                        </td>
                        <td>${statusBadge}</td>
                        <td style="text-align: right;">
                            <div style="display: inline-flex; gap: 6px;">
                                <button class="btn-icon" title="Editar departamento" onclick="openEditDept('${d.id}')">
                                    <i class="ph ph-pencil-simple"></i>
                                </button>
                                <button class="btn-icon text-danger" title="Excluir departamento" onclick="deleteDeptConfirm('${d.id}')">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');

        } catch (err) {
            console.error('Erro ao carregar departamentos:', err);
            deptsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 30px; color: #EF4444;">
                        Erro ao carregar departamentos: ${err.message || 'Erro inesperado'}
                    </td>
                </tr>`;
        }
    }

    window.openEditLeader = async (id) => {
        const leader = await window.db.getLeaderById(id);
        if (leader) openLeaderModal(leader);
    };

    window.togglePublishLeader = async (id) => {
        try {
            const updated = await window.db.toggleLeaderPublish(id);
            showToast(updated.isPublished ? 'Líder publicado no site público!' : 'Líder alterado para rascunho.');
            await loadLeaders();
        } catch (err) {
            alert(err.message || 'Erro ao alterar visibilidade.');
        }
    };

    window.deleteLeaderConfirm = async (id) => {
        if (!confirm('Deseja realmente remover este líder do sistema?')) return;
        try {
            await window.db.deleteLeader(id);
            showToast('Líder excluído com sucesso.');
            await loadLeaders();
        } catch (err) {
            alert(err.message || 'Erro ao excluir líder.');
        }
    };

    window.openEditDept = async (id) => {
        const dept = await window.db.getDepartmentById(id);
        if (dept) openDeptModal(dept);
    };

    window.deleteDeptConfirm = async (id) => {
        if (!confirm('Deseja realmente excluir este departamento?')) return;
        try {
            await window.db.deleteDepartment(id);
            showToast('Departamento excluído com sucesso.');
            await loadDepartments();
            await loadLeaders();
        } catch (err) {
            alert(err.message || 'Erro ao excluir departamento.');
        }
    };

    if (filterLeaderSearch) filterLeaderSearch.addEventListener('input', () => loadLeaders());
    if (filterLeaderDept) filterLeaderDept.addEventListener('change', () => loadLeaders());
    if (filterLeaderStatus) filterLeaderStatus.addEventListener('change', () => loadLeaders());

    /* ==========================================================================
       13. GESTÃO DE TESTEMUNHOS (GALERIA DE VÍDEOS)
       ========================================================================== */
    const modalTestimonial = document.getElementById('modal-testimonial');
    const modalTestimonialClose = document.getElementById('modal-testimonial-close');
    const btnNewTestimonial = document.getElementById('btn-new-testimonial');
    const btnCancelTestimonial = document.getElementById('btn-cancel-testimonial');
    const btnSaveTestimonial = document.getElementById('btn-save-testimonial');

    const formTestimonialId = document.getElementById('form-testimonial-id');
    const formTestimonialTitle = document.getElementById('form-testimonial-title');
    const formTestimonialName = document.getElementById('form-testimonial-name');
    const formTestimonialDesc = document.getElementById('form-testimonial-desc');
    const formTestimonialDescCounter = document.getElementById('form-testimonial-desc-counter');
    const formTestimonialVideoUrl = document.getElementById('form-testimonial-video-url');
    const formTestimonialVideoFile = document.getElementById('form-testimonial-video-file');
    const btnBrowseTestimonialVideo = document.getElementById('btn-browse-testimonial-video');
    const testimonialVideoFormPreview = document.getElementById('testimonial-video-form-preview');
    const testimonialVideoFormPlayer = document.getElementById('testimonial-video-form-player');
    const testimonialVideoSourceBadge = document.getElementById('testimonial-video-source-badge');

    const formTestimonialThumbFile = document.getElementById('form-testimonial-thumb-file');
    const formTestimonialThumbUrl = document.getElementById('form-testimonial-thumb-url');
    const btnBrowseTestimonialThumb = document.getElementById('btn-browse-testimonial-thumb');
    const btnCaptureTestimonialThumb = document.getElementById('btn-capture-testimonial-thumb');
    const btnRemoveTestimonialThumb = document.getElementById('btn-remove-testimonial-thumb');
    const testimonialThumbImg = document.getElementById('testimonial-thumb-img');
    const testimonialThumbEmptyText = document.getElementById('testimonial-thumb-empty-text');

    const formTestimonialStatus = document.getElementById('form-testimonial-status');
    const formTestimonialOrder = document.getElementById('form-testimonial-order');

    const filterTestimonialSearch = document.getElementById('filter-testimonial-search');
    const filterTestimonialStatus = document.getElementById('filter-testimonial-status');
    const testimonialsTableBody = document.getElementById('testimonials-table-body');

    const modalTestimonialPreview = document.getElementById('modal-testimonial-preview');
    const modalTestimonialPreviewClose = document.getElementById('modal-testimonial-preview-close');
    const btnCloseTestimonialPreview = document.getElementById('btn-close-testimonial-preview');
    const previewTestimonialTitle = document.getElementById('preview-testimonial-title');
    const previewTestimonialPlayer = document.getElementById('preview-testimonial-player');
    const previewTestimonialPerson = document.getElementById('preview-testimonial-person');
    const previewTestimonialDesc = document.getElementById('preview-testimonial-desc');
    const previewTestimonialStatusBadge = document.getElementById('preview-testimonial-status-badge');

    let currentTestimonialThumbData = '';

    function escapeHtmlText(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseVideoSource(rawUrl) {
        const url = (rawUrl || '').trim();
        if (!url) return { type: 'none', url: '', embedUrl: '', label: '' };

        // YouTube (watch, youtu.be, shorts, embed)
        const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        if (ytMatch && ytMatch[1]) {
            const videoId = ytMatch[1];
            return {
                type: 'youtube',
                videoId,
                url,
                embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
                autoThumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                label: 'YouTube'
            };
        }

        // Vimeo
        const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (vimeoMatch && vimeoMatch[1]) {
            const videoId = vimeoMatch[1];
            return {
                type: 'vimeo',
                videoId,
                url,
                embedUrl: `https://player.vimeo.com/video/${videoId}`,
                autoThumb: '',
                label: 'Vimeo'
            };
        }

        // Data URL ou arquivo de vídeo direto (.mp4, .webm, .ogg)
        return {
            type: 'video',
            url,
            embedUrl: url,
            autoThumb: '',
            label: url.startsWith('data:video/') ? 'Arquivo de Vídeo Local' : 'Vídeo Direto (MP4/WebM)'
        };
    }

    function createVideoPlayerElement(videoUrl, posterUrl = '', autoplay = false) {
        const info = parseVideoSource(videoUrl);
        if (info.type === 'youtube' || info.type === 'vimeo') {
            const iframe = document.createElement('iframe');
            const sep = info.embedUrl.includes('?') ? '&' : '?';
            iframe.src = autoplay ? `${info.embedUrl}${sep}autoplay=1` : info.embedUrl;
            iframe.title = 'Reprodutor de vídeo do testemunho';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            iframe.style.cssText = 'width:100%; height:100%; min-height:280px; border:0; border-radius:8px; background:#090D14;';
            return iframe;
        }
        if (info.type === 'video') {
            const video = document.createElement('video');
            video.src = info.url;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            if (posterUrl) video.poster = posterUrl;
            if (autoplay) video.autoplay = true;
            video.style.cssText = 'width:100%; max-height:420px; border-radius:8px; background:#090D14; display:block;';
            return video;
        }
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Vídeo indisponível.';
        return empty;
    }

    function updateTestimonialThumbUI(src) {
        currentTestimonialThumbData = src || '';
        if (currentTestimonialThumbData) {
            if (testimonialThumbImg) {
                testimonialThumbImg.src = currentTestimonialThumbData;
                testimonialThumbImg.style.display = 'block';
            }
            if (testimonialThumbEmptyText) testimonialThumbEmptyText.style.display = 'none';
            if (btnRemoveTestimonialThumb) btnRemoveTestimonialThumb.style.display = 'inline-flex';
        } else {
            if (testimonialThumbImg) {
                testimonialThumbImg.src = '';
                testimonialThumbImg.style.display = 'none';
            }
            if (testimonialThumbEmptyText) {
                testimonialThumbEmptyText.textContent = 'Capa Padrão';
                testimonialThumbEmptyText.style.display = 'block';
            }
            if (btnRemoveTestimonialThumb) btnRemoveTestimonialThumb.style.display = 'none';
        }
    }

    function renderFormVideoPreview() {
        if (!testimonialVideoFormPreview || !testimonialVideoFormPlayer) return;
        const url = formTestimonialVideoUrl ? formTestimonialVideoUrl.value.trim() : '';
        if (!url) {
            testimonialVideoFormPlayer.replaceChildren();
            testimonialVideoFormPreview.style.display = 'none';
            return;
        }
        const info = parseVideoSource(url);
        if (testimonialVideoSourceBadge) {
            testimonialVideoSourceBadge.textContent = info.label;
        }
        testimonialVideoFormPlayer.replaceChildren(
            createVideoPlayerElement(url, currentTestimonialThumbData || info.autoThumb || '', false)
        );
        testimonialVideoFormPreview.style.display = 'block';

        // Se não houver capa definida e o vídeo for do YouTube, preenche a prévia automática
        if (!currentTestimonialThumbData && info.autoThumb) {
            updateTestimonialThumbUI(info.autoThumb);
            if (formTestimonialThumbUrl && !formTestimonialThumbUrl.value.trim()) {
                formTestimonialThumbUrl.value = info.autoThumb;
            }
        }
    }

    async function captureFrameFromVideo(videoUrl) {
        const info = parseVideoSource(videoUrl);
        if (info.autoThumb) return info.autoThumb;
        if (info.type !== 'video' || !info.url) {
            throw new Error('Para links externos sem miniatura automática, envie uma imagem de capa personalizada.');
        }
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';

            const cleanup = () => {
                video.removeAttribute('src');
                video.load();
            };

            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Tempo esgotado ao capturar prévia do vídeo.'));
            }, 6000);

            video.onloadeddata = () => {
                try {
                    video.currentTime = Math.min(1.0, (video.duration || 2) * 0.25);
                } catch {
                    clearTimeout(timeout);
                    cleanup();
                    reject(new Error('Não foi possível posicionar o vídeo para capturar a capa.'));
                }
            };

            video.onseeked = () => {
                clearTimeout(timeout);
                try {
                    const maxW = 800;
                    const rawW = video.videoWidth || 640;
                    const rawH = video.videoHeight || 360;
                    const ratio = Math.min(1, maxW / rawW);
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(rawW * ratio);
                    canvas.height = Math.round(rawH * ratio);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                    cleanup();
                    resolve(dataUrl);
                } catch {
                    cleanup();
                    reject(new Error('O navegador bloqueou a captura automática deste vídeo (CORS). Envie uma imagem de capa.'));
                }
            };

            video.onerror = () => {
                clearTimeout(timeout);
                cleanup();
                reject(new Error('Não foi possível carregar o vídeo para gerar a capa.'));
            };

            video.src = info.url;
        });
    }

    async function openTestimonialModal(testimonial = null) {
        const titleEl = document.getElementById('modal-testimonial-title');
        if (testimonial) {
            if (titleEl) titleEl.textContent = 'Editar Testemunho';
            if (formTestimonialId) formTestimonialId.value = testimonial.id;
            if (formTestimonialTitle) formTestimonialTitle.value = testimonial.title || '';
            if (formTestimonialName) formTestimonialName.value = testimonial.personName || '';
            if (formTestimonialDesc) formTestimonialDesc.value = testimonial.description || '';
            if (formTestimonialVideoUrl) formTestimonialVideoUrl.value = testimonial.videoUrl || '';
            if (formTestimonialStatus) formTestimonialStatus.value = testimonial.isPublished ? 'published' : 'draft';
            if (formTestimonialOrder) formTestimonialOrder.value = testimonial.displayOrder || 1;
            if (formTestimonialThumbUrl) {
                formTestimonialThumbUrl.value = (testimonial.thumbnailUrl && !testimonial.thumbnailUrl.startsWith('data:'))
                    ? testimonial.thumbnailUrl
                    : '';
            }
            updateTestimonialThumbUI(testimonial.thumbnailUrl || '');
        } else {
            if (titleEl) titleEl.textContent = 'Novo Testemunho';
            if (formTestimonialId) formTestimonialId.value = '';
            if (formTestimonialTitle) formTestimonialTitle.value = '';
            if (formTestimonialName) formTestimonialName.value = '';
            if (formTestimonialDesc) formTestimonialDesc.value = '';
            if (formTestimonialVideoUrl) formTestimonialVideoUrl.value = '';
            if (formTestimonialVideoFile) formTestimonialVideoFile.value = '';
            if (formTestimonialThumbFile) formTestimonialThumbFile.value = '';
            if (formTestimonialThumbUrl) formTestimonialThumbUrl.value = '';
            if (formTestimonialStatus) formTestimonialStatus.value = 'published';

            const allTestimonials = await window.db.getTestimonials();
            const nextOrder = allTestimonials.length
                ? Math.max(...allTestimonials.map(t => Number(t.displayOrder) || 0)) + 1
                : 1;
            if (formTestimonialOrder) formTestimonialOrder.value = nextOrder;
            updateTestimonialThumbUI('');
        }

        if (formTestimonialDesc && formTestimonialDescCounter) {
            formTestimonialDescCounter.textContent = `${formTestimonialDesc.value.length} / 400`;
        }
        renderFormVideoPreview();
        if (modalTestimonial) modalTestimonial.style.display = 'flex';
    }

    function closeTestimonialModal() {
        if (testimonialVideoFormPlayer) testimonialVideoFormPlayer.replaceChildren();
        if (modalTestimonial) modalTestimonial.style.display = 'none';
    }

    function closeTestimonialPreviewModal() {
        if (previewTestimonialPlayer) previewTestimonialPlayer.replaceChildren();
        if (modalTestimonialPreview) modalTestimonialPreview.style.display = 'none';
    }

    if (btnNewTestimonial) btnNewTestimonial.addEventListener('click', () => openTestimonialModal());
    if (btnCancelTestimonial) btnCancelTestimonial.addEventListener('click', closeTestimonialModal);
    if (modalTestimonialClose) modalTestimonialClose.addEventListener('click', closeTestimonialModal);
    if (modalTestimonialPreviewClose) modalTestimonialPreviewClose.addEventListener('click', closeTestimonialPreviewModal);
    if (btnCloseTestimonialPreview) btnCloseTestimonialPreview.addEventListener('click', closeTestimonialPreviewModal);

    if (formTestimonialDesc && formTestimonialDescCounter) {
        formTestimonialDesc.addEventListener('input', () => {
            formTestimonialDescCounter.textContent = `${formTestimonialDesc.value.length} / 400`;
        });
    }

    let videoPreviewTimer;
    if (formTestimonialVideoUrl) {
        formTestimonialVideoUrl.addEventListener('input', () => {
            clearTimeout(videoPreviewTimer);
            videoPreviewTimer = setTimeout(renderFormVideoPreview, 300);
        });
    }

    if (btnBrowseTestimonialVideo && formTestimonialVideoFile) {
        btnBrowseTestimonialVideo.addEventListener('click', () => formTestimonialVideoFile.click());
        formTestimonialVideoFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('video/')) {
                alert('Selecione um arquivo de vídeo válido (.mp4, .webm ou .ogg).');
                return;
            }
            if (file.size > 3.5 * 1024 * 1024) {
                alert('Para armazenamento direto no navegador, o vídeo deve ter até 3,5 MB. Para vídeos maiores ou em alta definição, utilize um link do YouTube, Vimeo ou URL direta.');
                formTestimonialVideoFile.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const dataUrl = ev.target.result;
                if (formTestimonialVideoUrl) formTestimonialVideoUrl.value = dataUrl;
                renderFormVideoPreview();
                showToast('Vídeo carregado com sucesso!');
                if (!currentTestimonialThumbData) {
                    try {
                        const frame = await captureFrameFromVideo(dataUrl);
                        if (frame) updateTestimonialThumbUI(frame);
                    } catch {
                        // Mantém capa padrão se não for possível extrair frame
                    }
                }
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnBrowseTestimonialThumb && formTestimonialThumbFile) {
        btnBrowseTestimonialThumb.addEventListener('click', () => formTestimonialThumbFile.click());
        formTestimonialThumbFile.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
                alert('A imagem de capa deve ter no máximo 10MB.');
                return;
            }
            try {
                const compressed = await compressImageFile(file, 960, 540);
                if (formTestimonialThumbUrl) formTestimonialThumbUrl.value = '';
                updateTestimonialThumbUI(compressed);
                showToast('Thumbnail carregada e otimizada!');
            } catch (err) {
                alert(err.message || 'Erro ao processar thumbnail.');
            }
        });
    }

    if (formTestimonialThumbUrl) {
        formTestimonialThumbUrl.addEventListener('input', () => {
            const val = formTestimonialThumbUrl.value.trim();
            if (val) updateTestimonialThumbUI(val);
            else if (!formTestimonialThumbFile?.files?.length) updateTestimonialThumbUI('');
        });
    }

    if (btnCaptureTestimonialThumb) {
        btnCaptureTestimonialThumb.addEventListener('click', async () => {
            const videoUrl = formTestimonialVideoUrl ? formTestimonialVideoUrl.value.trim() : '';
            if (!videoUrl) {
                alert('Informe ou selecione o vídeo primeiro para gerar a prévia da capa.');
                return;
            }
            try {
                const thumb = await captureFrameFromVideo(videoUrl);
                updateTestimonialThumbUI(thumb);
                if (formTestimonialThumbUrl && !thumb.startsWith('data:')) {
                    formTestimonialThumbUrl.value = thumb;
                }
                showToast('Prévia de capa gerada com sucesso!');
            } catch (err) {
                alert(err.message || 'Não foi possível gerar a capa automaticamente.');
            }
        });
    }

    if (btnRemoveTestimonialThumb) {
        btnRemoveTestimonialThumb.addEventListener('click', () => {
            if (formTestimonialThumbFile) formTestimonialThumbFile.value = '';
            if (formTestimonialThumbUrl) formTestimonialThumbUrl.value = '';
            updateTestimonialThumbUI('');
        });
    }

    if (btnSaveTestimonial) {
        btnSaveTestimonial.addEventListener('click', async () => {
            const id = formTestimonialId ? formTestimonialId.value : '';
            const title = formTestimonialTitle ? formTestimonialTitle.value.trim() : '';
            const personName = formTestimonialName ? formTestimonialName.value.trim() : '';
            const description = formTestimonialDesc ? formTestimonialDesc.value.trim() : '';
            const videoUrl = formTestimonialVideoUrl ? formTestimonialVideoUrl.value.trim() : '';
            const status = formTestimonialStatus ? formTestimonialStatus.value : 'published';
            const displayOrder = formTestimonialOrder ? (parseInt(formTestimonialOrder.value, 10) || 1) : 1;
            const thumbnailUrl = currentTestimonialThumbData || (formTestimonialThumbUrl ? formTestimonialThumbUrl.value.trim() : '');

            if (!title) {
                alert('O título do testemunho é obrigatório.');
                formTestimonialTitle?.focus();
                return;
            }
            if (!personName) {
                alert('O nome da pessoa é obrigatório.');
                formTestimonialName?.focus();
                return;
            }
            if (!videoUrl) {
                alert('Informe o link ou arquivo de vídeo do testemunho.');
                formTestimonialVideoUrl?.focus();
                return;
            }

            btnSaveTestimonial.disabled = true;
            try {
                const payload = {
                    title,
                    personName,
                    description,
                    videoUrl,
                    thumbnailUrl,
                    status,
                    isPublished: status === 'published',
                    displayOrder
                };
                if (id) {
                    await window.db.updateTestimonial(id, payload);
                    showToast('Testemunho atualizado com sucesso!');
                } else {
                    await window.db.createTestimonial(payload);
                    showToast('Testemunho cadastrado com sucesso!');
                }
                closeTestimonialModal();
                await loadTestimonials();
            } catch (err) {
                console.error('Erro ao salvar testemunho:', err);
                alert(err.message || 'Erro ao salvar testemunho.');
            } finally {
                btnSaveTestimonial.disabled = false;
            }
        });
    }

    async function loadTestimonials() {
        if (!testimonialsTableBody) return;
        try {
            const search = filterTestimonialSearch ? filterTestimonialSearch.value.trim() : '';
            const status = filterTestimonialStatus ? filterTestimonialStatus.value : '';
            const items = await window.db.getTestimonials({ search, status });

            if (!items.length) {
                testimonialsTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                            Nenhum testemunho encontrado. Clique em "Novo Testemunho" para adicionar vídeos à galeria.
                        </td>
                    </tr>`;
                return;
            }

            testimonialsTableBody.innerHTML = items.map((t, index) => {
                const info = parseVideoSource(t.videoUrl);
                const thumbSrc = t.thumbnailUrl || info.autoThumb || 'assets/images/noite_clamor.jpg';
                const safeTitle = escapeHtmlText(t.title);
                const safePerson = escapeHtmlText(t.personName);
                const safeDesc = escapeHtmlText(t.description || '');
                const formattedDate = t.createdAt
                    ? new Date(t.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '—';
                const formattedTime = t.createdAt
                    ? new Date(t.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '';

                const pubBadge = t.isPublished
                    ? '<span class="badge-paid" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3);">Publicado</span>'
                    : '<span class="badge-pending" style="background: rgba(148, 163, 184, 0.15); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.3);">Rascunho</span>';

                const togglePubTitle = t.isPublished ? 'Desativar publicação (mudar para rascunho)' : 'Ativar publicação no site';
                const togglePubIcon = t.isPublished ? 'ph-eye-slash' : 'ph-eye';

                return `
                    <tr>
                        <td>
                            <button type="button" class="testimonial-admin-thumb-btn" onclick="openPreviewTestimonial('${t.id}')" title="Clique para assistir à prévia do vídeo">
                                <img src="${escapeHtmlText(thumbSrc)}" alt="${safeTitle}" onerror="this.src='assets/images/noite_clamor.jpg'">
                                <span class="testimonial-admin-play-badge"><i class="ph-fill ph-play"></i></span>
                            </button>
                        </td>
                        <td>
                            <strong style="color: var(--text-color); font-size: 0.92rem; display: block;">${safeTitle}</strong>
                            <div style="font-size: 0.8rem; color: var(--primary); font-weight: 700; margin-top: 2px;">
                                <i class="ph ph-user"></i> ${safePerson}
                            </div>
                            ${safeDesc ? `<div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px; max-width: 420px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${safeDesc}</div>` : ''}
                        </td>
                        <td style="text-align: center;">
                            <div style="display: inline-flex; align-items: center; gap: 4px;">
                                <span class="order-badge">#${t.displayOrder || (index + 1)}</span>
                                <div style="display: flex; flex-direction: column; gap: 2px;">
                                    <button type="button" class="btn-icon" style="width:22px;height:20px;font-size:11px;" title="Subir posição" onclick="moveTestimonialOrder('${t.id}', -1)" ${index === 0 ? 'disabled' : ''}>
                                        <i class="ph ph-caret-up"></i>
                                    </button>
                                    <button type="button" class="btn-icon" style="width:22px;height:20px;font-size:11px;" title="Descer posição" onclick="moveTestimonialOrder('${t.id}', 1)" ${index === items.length - 1 ? 'disabled' : ''}>
                                        <i class="ph ph-caret-down"></i>
                                    </button>
                                </div>
                            </div>
                        </td>
                        <td>${pubBadge}</td>
                        <td>
                            <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-color);">${formattedDate}</div>
                            ${formattedTime ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${formattedTime}</div>` : ''}
                        </td>
                        <td style="text-align: right;">
                            <div style="display: inline-flex; gap: 6px;">
                                <button class="btn-icon" title="Visualizar prévia do vídeo" onclick="openPreviewTestimonial('${t.id}')">
                                    <i class="ph ph-play-circle"></i>
                                </button>
                                <button class="btn-icon" title="${togglePubTitle}" onclick="togglePublishTestimonial('${t.id}')">
                                    <i class="ph ${togglePubIcon}"></i>
                                </button>
                                <button class="btn-icon" title="Editar testemunho" onclick="openEditTestimonial('${t.id}')">
                                    <i class="ph ph-pencil-simple"></i>
                                </button>
                                <button class="btn-icon text-danger" title="Excluir testemunho" onclick="deleteTestimonialConfirm('${t.id}')">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        } catch (err) {
            console.error('Erro ao carregar testemunhos:', err);
            testimonialsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 30px; color: #EF4444;">
                        Erro ao carregar testemunhos: ${escapeHtmlText(err.message || 'Erro inesperado')}
                    </td>
                </tr>`;
        }
    }

    window.openPreviewTestimonial = async (id) => {
        const item = await window.db.getTestimonialById(id);
        if (!item || !modalTestimonialPreview) return;
        const info = parseVideoSource(item.videoUrl);
        if (previewTestimonialTitle) previewTestimonialTitle.textContent = item.title || 'Prévia do Testemunho';
        if (previewTestimonialPerson) previewTestimonialPerson.textContent = item.personName || '—';
        if (previewTestimonialDesc) previewTestimonialDesc.textContent = item.description || '';
        if (previewTestimonialStatusBadge) {
            previewTestimonialStatusBadge.innerHTML = item.isPublished
                ? '<span class="badge-paid">Publicado</span>'
                : '<span class="badge-pending">Rascunho</span>';
        }
        if (previewTestimonialPlayer) {
            previewTestimonialPlayer.replaceChildren(
                createVideoPlayerElement(item.videoUrl, item.thumbnailUrl || info.autoThumb || '', true)
            );
        }
        modalTestimonialPreview.style.display = 'flex';
    };

    window.openEditTestimonial = async (id) => {
        const item = await window.db.getTestimonialById(id);
        if (item) openTestimonialModal(item);
    };

    window.togglePublishTestimonial = async (id) => {
        try {
            const updated = await window.db.toggleTestimonialPublish(id);
            showToast(updated.isPublished ? 'Testemunho publicado na galeria!' : 'Testemunho alterado para rascunho.');
            await loadTestimonials();
        } catch (err) {
            alert(err.message || 'Erro ao alterar status de publicação.');
        }
    };

    window.moveTestimonialOrder = async (id, delta) => {
        try {
            const items = await window.db.getTestimonials();
            const idx = items.findIndex(t => t.id === id);
            const swapIdx = idx + delta;
            if (idx === -1 || swapIdx < 0 || swapIdx >= items.length) return;

            const current = items[idx];
            const neighbor = items[swapIdx];
            const currentOrder = Number(current.displayOrder) || (idx + 1);
            let neighborOrder = Number(neighbor.displayOrder) || (swapIdx + 1);
            if (currentOrder === neighborOrder) {
                neighborOrder = currentOrder + delta;
            }

            await window.db.updateTestimonial(current.id, { displayOrder: neighborOrder });
            await window.db.updateTestimonial(neighbor.id, { displayOrder: currentOrder });
            showToast('Ordem de exibição atualizada!');
            await loadTestimonials();
        } catch (err) {
            alert(err.message || 'Erro ao reorganizar ordem.');
        }
    };

    window.deleteTestimonialConfirm = async (id) => {
        const item = await window.db.getTestimonialById(id);
        const label = item ? `"${item.title}" (${item.personName})` : 'este testemunho';
        if (!confirm(`Deseja realmente excluir o testemunho ${label}? Esta ação não pode ser desfeita.`)) return;
        try {
            await window.db.deleteTestimonial(id);
            showToast('Testemunho excluído com sucesso.');
            await loadTestimonials();
        } catch (err) {
            alert(err.message || 'Erro ao excluir testemunho.');
        }
    };

    if (filterTestimonialSearch) filterTestimonialSearch.addEventListener('input', () => loadTestimonials());
    if (filterTestimonialStatus) filterTestimonialStatus.addEventListener('change', () => loadTestimonials());

    /* ==========================================================================
       BUSCA GLOBAL
       ========================================================================== */
    const globalSearchInput = document.getElementById('global-search-input');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const term = globalSearchInput.value.trim();
                if (!term) return;
                const edSearch = document.getElementById('edition-search-input');
                if (edSearch) edSearch.value = term;
                navigateTo('eventos');
                filterAndRenderEditions();
            }
        });
    }

    /* ==========================================================================
       HELPERS & UTILITÁRIOS
       ========================================================================== */
    function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
    function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
    function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }

    function initials(name) {
        if (!name) return 'JC';
        return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }

    function calculateAge(birthDateStr) {
        if (!birthDateStr) return '';
        const dob = new Date(birthDateStr);
        const diff = Date.now() - dob.getTime();
        const ageDate = new Date(diff);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function downloadCsv(headers, rows, fileName) {
        const cell = (value) => {
            let text = value == null ? '' : String(value);
            if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        };
        const csv = [headers, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
        downloadFile(`\uFEFF${csv}`, fileName, 'text/csv;charset=utf-8');
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:28px;right:28px;background:#0F172A;color:#FFFFFF;padding:12px 22px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.25);border-left:4px solid #008CFF;animation:fadeIn .2s ease;`;
        const icon = document.createElement('span');
        icon.style.cssText = 'color:#008CFF;margin-right:8px;';
        icon.textContent = '✓';
        t.append(icon, document.createTextNode(` ${msg}`));
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3200);
    }

    /* ==========================================================================
       INICIALIZAÇÃO DO SISTEMA
       ========================================================================== */
    const isAuthed = await checkAuth();
    if (isAuthed) {
        await loadAllData();
    }
});
