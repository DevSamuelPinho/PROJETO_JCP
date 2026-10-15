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
    let currentAdmin = window.db.getCurrentAdmin();
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
        currentAdmin = window.db.getCurrentAdmin();
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
        if (targetId === 'lideres') loadLeaders();
        if (targetId === 'departamentos') loadDepartments();
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
        await Promise.all([
            loadDashboard(),
            loadEditions(),
            loadActions(),
            loadVolunteers(),
            loadEnrollments(),
            loadSettings(),
            loadCMS(),
            loadLeaders(),
            loadDepartments()
        ]);

        if (await window.db.hasPermission('users:manage')) {
            await loadUsersAndRoles();
        }
        if (await window.db.hasPermission('logs:read')) {
            await loadLogs();
        }
    }

    /* ==========================================================================
       8. DASHBOARD (MÉTRICAS 100% REAIS)
       ========================================================================== */
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
        const enrollments = await window.db.getEnrollments();
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
        const volunteers = await window.db.getVolunteers();
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
        filterAndRenderEditions();
        // Atualiza selects de edições vinculadas nas outras abas
        populateEditionDropdowns();
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
        const enrollments = await window.db.getEnrollments();
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

    function showToast(msg) {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:28px;right:28px;background:#0F172A;color:#FFFFFF;padding:12px 22px;border-radius:10px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.25);border-left:4px solid #008CFF;animation:fadeIn .2s ease;`;
        t.innerHTML = `<span style="color:#008CFF;margin-right:8px;">✓</span> ${msg}`;
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
