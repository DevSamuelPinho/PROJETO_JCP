/**
 * ==============================================================================
 * PROJETO JOVENS COM PROPÓSITO — JCP | LANDING PAGE SCRIPT OFICIAL
 * ==============================================================================
 * Integração dinâmica ponta a ponta com o banco de dados (window.db):
 * - Edições e ações sincronizadas em tempo real com o painel administrativo
 * - Cadastro único de participante e voluntário com áreas de atuação
 * - Fluxo de inscrição pública com seleção obrigatória de camisa e envio de comprovante PIX
 * - Chave PIX e dados de contribuição alimentados pelas configurações do sistema
 * ==============================================================================
 */

let pendingEnrollmentEditionId = null;

document.addEventListener('DOMContentLoaded', async () => {
  initProgressBar();
  initHeaderAndMenu();
  initScrollSpy();
  initScrollReveal();
  initModals();
  initPixCopy();

  // Inicializa dados conectados ao banco
  await initSettingsData();
  await initCMSData();
  await initEditionsFromDB();
  updateParticipantHeader();
  initParticipantAuthForms();

  // Novos módulos — auditoria set/2026
  initPrayerCounter();
  initContribuicaoForm();

  // Módulo Lideranças
  await renderPublicLeaders();
});

/* ==============================================================================
   1. BARRA DE PROGRESSO DE SCROLL NO TOPO
   ============================================================================== */
function initProgressBar() {
  const progressBar = document.getElementById('scroll-progress');
  if (!progressBar) return;

  window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (window.scrollY / totalHeight) * 100;
    progressBar.style.width = `${progress}%`;
  }, { passive: true });
}

/* ==============================================================================
   2. HEADER & MENU RESPONSIVO (DRAWER MOBILE + DESKTOP)
   ============================================================================== */
function initHeaderAndMenu() {
  const header = document.querySelector('.site-header');
  const toggleBtn = document.getElementById('mobile-toggle');
  const drawer = document.getElementById('mobile-drawer');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');

  const handleScroll = () => {
    if (window.scrollY > 30) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  if (toggleBtn && drawer) {
    const toggleMenu = (open) => {
      const isOpen = open !== undefined ? open : !drawer.classList.contains('open');
      if (isOpen) {
        drawer.classList.add('open');
        toggleBtn.classList.add('active');
        toggleBtn.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
      } else {
        drawer.classList.remove('open');
        toggleBtn.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    };

    toggleBtn.addEventListener('click', () => toggleMenu());
    mobileLinks.forEach(link => link.addEventListener('click', () => toggleMenu(false)));
  }
}

/* ==============================================================================
   3. SCROLL SPY (INDICADOR DE SEÇÃO ATIVA NO MENU)
   ============================================================================== */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const onScroll = () => {
    const scrollPos = window.scrollY + 120;
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ==============================================================================
   4. REVEAL SUAVE NO SCROLL
   ============================================================================== */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal-on-scroll, .reveal-left, .reveal-right');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
  );

  elements.forEach(el => {
    if (!el.classList.contains('reveal-left') && !el.classList.contains('reveal-right')) {
      el.classList.add('reveal-init');
    }
    observer.observe(el);
  });
}

/* ==============================================================================
   5. CONTROLE DE MODAIS (ABRIR, FECHAR, ESC)
   ============================================================================== */
function initModals() {
  // Botão "SEJA VOLUNTÁRIO" da seção Contribua
  const btnIndo = document.getElementById('btn-indo');
  if (btnIndo) {
    btnIndo.addEventListener('click', (e) => {
      e.preventDefault();
      openParticipantModal({ asVolunteer: true });
    });
  }

  const modalButtons = document.querySelectorAll('[data-open-modal]');
  const closeButtons = document.querySelectorAll('[data-close-modal]');
  const modals = document.querySelectorAll('.jcp-modal');

  modalButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute('data-open-modal');
      const targetModal = document.getElementById(modalId);
      if (targetModal) openModal(targetModal);
    });
  });

  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.jcp-modal');
      if (modal) closeModal(modal);
    });
  });

  modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.jcp-modal.active');
      if (activeModal) closeModal(activeModal);
    }
  });

  // Nota: formulário de oração é gerenciado por initPrayerCounter()

  // Botão CTA Header "SEJA VOLUNTÁRIO"
  const headerCtaBtn = document.getElementById('header-cta-btn');
  if (headerCtaBtn) {
    headerCtaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openParticipantModal({ asVolunteer: true });
    });
  }

  // Botão Hero "QUERO PARTICIPAR"
  const heroBtnParticipar = document.getElementById('hero-btn-participar');
  if (heroBtnParticipar) {
    heroBtnParticipar.addEventListener('click', (e) => {
      e.preventDefault();
      openParticipantModal({ asVolunteer: false });
    });
  }

  // Botão CTA de Encerramento "QUERO PARTICIPAR DO JCP"
  const closingCtaBtn = document.getElementById('closing-cta-btn');
  if (closingCtaBtn) {
    closingCtaBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openParticipantModal({ asVolunteer: false });
    });
  }

  // Botão Drawer Mobile "SEJA VOLUNTÁRIO"
  const mobileDrawerBtn = document.getElementById('mobile-drawer-btn');
  if (mobileDrawerBtn) {
    mobileDrawerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const drawer = document.getElementById('mobile-drawer');
      const toggleBtn = document.getElementById('mobile-toggle');
      if (drawer) drawer.classList.remove('open');
      if (toggleBtn) {
        toggleBtn.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
      document.body.style.overflow = '';
      openParticipantModal({ asVolunteer: true });
    });
  }
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Abre o modal de cadastro de participante com estado correto.
 * @param {Object} options - { asVolunteer: boolean }
 */
function openParticipantModal({ asVolunteer = false } = {}) {
  const modal = document.getElementById('modal-cadastro-participante');
  if (!modal) return;
  openModal(modal);

  // Verifica se o participante já está logado
  const participant = window.db?.getCurrentParticipant?.();
  if (participant) {
    // Já logado: exibe aba "Já sou cadastrado" ativa
    const tabLogin = document.getElementById('tab-btn-ja-cadastrado');
    if (tabLogin) tabLogin.click();
    return;
  }

  // Não logado: abre aba de novo cadastro
  const tabNovo = document.getElementById('tab-btn-novocadastro');
  if (tabNovo) tabNovo.click();

  const selectVol = document.getElementById('cad-part-isvolunteer');
  const boxVolAreas = document.getElementById('box-areas-voluntario-publico');
  if (selectVol) {
    selectVol.value = asVolunteer ? 'true' : 'false';
    if (boxVolAreas) boxVolAreas.style.display = asVolunteer ? 'block' : 'none';
  }
}

/* ==============================================================================
   6. CÓPIA DE CHAVE PIX
   ============================================================================== */
function initPixCopy() {
  function bindCopy(btnId, valId) {
    const btn = document.getElementById(btnId);
    const valEl = document.getElementById(valId);
    if (!btn || !valEl) return;

    btn.addEventListener('click', () => {
      const key = valEl.textContent.trim();
      navigator.clipboard.writeText(key).then(() => {
        const originalText = btn.textContent;
        btn.textContent = 'COPIADO!';
        showToast('Chave PIX copiada para a área de transferência.');
        setTimeout(() => { btn.textContent = originalText; }, 3000);
      }).catch(err => {
        console.error('Falha ao copiar:', err);
      });
    });
  }

  bindCopy('btn-copy-pix', 'pix-key-val');
  bindCopy('btn-insc-copy-pix', 'insc-pix-key-val');
}

/* ==============================================================================
   7. CONFIGURAÇÕES GLOBAIS (SINCRONIZAÇÃO AUTOMÁTICA DE PIX E CONTRIBUIÇÃO)
   ============================================================================== */
async function initSettingsData() {
  if (!window.db) return;
  try {
    const s = await window.db.getSettings();
    if (!s) return;

    const setT = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
    setT('pix-key-val', s.pixKey);
    setT('insc-pix-key-val', s.pixKey);
    setT('pix-type-val', s.pixKeyType || 'E-mail');
    setT('pix-beneficiary-val', s.pixBeneficiary || 'Projeto Jovens com Propósito');
    setT('pix-bank-val', s.pixBank || 'Banco do Brasil');
    setT('pix-city-val', s.pixCity || 'Patos - PB');
    setT('modal-pix-notice', s.pixNotice);
  } catch (e) {
    console.warn('Erro ao carregar configurações do DB:', e);
  }
}

/* ==============================================================================
   8. CMS / CONTEÚDOS EDITORIAL
   ============================================================================== */
async function initCMSData() {
  if (!window.db) return;
  try {
    const content = await window.db.getContent();
    if (!content) return;

    const heroTitleEl = document.querySelector('.hero-title-main');
    const heroSubtitleEl = document.querySelector('.hero-lead-text');
    const aboutTextEl = document.querySelector('#historia .text-editorial-lead');

    if (heroTitleEl && content.heroTitle) heroTitleEl.textContent = content.heroTitle;
    if (heroSubtitleEl && content.heroSubtitle) heroSubtitleEl.textContent = content.heroSubtitle;
    if (aboutTextEl && content.aboutText) aboutTextEl.textContent = content.aboutText;
  } catch (e) {
    console.warn('Erro ao carregar CMS:', e);
  }
}

/* ==============================================================================
   9. EDIÇÕES & AÇÕES (ALIMENTADAS DIRETAMENTE PELO BANCO DE DADOS)
   ============================================================================== */
async function initEditionsFromDB() {
  if (!window.db) return;

  const upcomingWrapper = document.getElementById('proximas-edicoes-wrapper');
  const pastWrapper = document.getElementById('edicoes-finalizadas-wrapper');

  try {
    const allEditions = await window.db.getEditions();
    const allActions = await window.db.getActions();

    // Separa edições abertas/futuras das finalizadas
    const openEditions = allEditions.filter(e =>
      e.status === 'Inscrições Abertas' || e.status === 'Planejamento' || e.status === 'Em Andamento'
    );

    const pastEditions = allEditions.filter(e =>
      e.status === 'Finalizada' || e.status === 'Cancelada' || e.status === 'Inscrições Encerradas'
    );

    if (upcomingWrapper) {
      if (openEditions.length > 0) {
        renderUpcomingEditions(openEditions, allActions);
      } else {
        upcomingWrapper.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px;">
            <p style="color: #94A3B8; font-size: 0.95rem;">Nenhuma edição com inscrições abertas no momento. Acompanhe nossas novidades!</p>
          </div>
        `;
      }
    }

    if (pastWrapper && pastEditions.length > 0) {
      renderPastEditions(pastEditions, allActions);
    }
  } catch (e) {
    console.error('Falha ao renderizar edições:', e);
  }
}

/**
 * Renderiza edições em aberto / futuras
 */
function renderUpcomingEditions(editions, allActions = []) {
  const container = document.getElementById('proximas-edicoes-wrapper');
  if (!container) return;

  const regBadgeMap = {
    none: { label: 'Livre / Sem Inscrição', class: 'neutral' },
    free: { label: 'Inscrição Gratuita', class: 'green' },
    paid: { label: 'Inscrição com Taxa', class: 'blue' },
    shirt: { label: 'Inscrição com Camisa Oficial', class: 'blue' }
  };

  container.innerHTML = editions.map(ed => {
    const actions = allActions.filter(a => a.editionId === ed.id);
    const regInfo = regBadgeMap[ed.registrationType] || { label: 'Inscrições', class: 'blue' };
    const priceText = ed.registrationType === 'shirt'
      ? `Camisa: R$ ${Number(ed.shirtPrice || 45).toFixed(2)}`
      : (ed.registrationType === 'paid' ? `Taxa: R$ ${Number(ed.price || 0).toFixed(2)}` : 'Gratuito');

    const isOpen = ed.status === 'Inscrições Abertas';

    return `
      <div class="edition-card-editorial reveal-on-scroll">
        <div class="edition-image-side">
          <img src="${ed.image || 'assets/images/noite_clamor.jpg'}" alt="${ed.name}" loading="lazy" onerror="this.src='assets/images/noite_clamor.jpg'" />
          <div class="edition-image-badge-floating">
            <span class="status-pulse-dot"></span>
            <span>${ed.status}</span>
          </div>
        </div>
        <div class="edition-content-side">
          <div class="edition-status-badge">
            <span class="status-pulse-dot"></span>
            ${ed.type.toUpperCase()} • ${ed.city} – ${ed.state}
          </div>
          <h3 class="edition-title">${ed.name}</h3>
          
          <div class="edition-meta-row">
            <div class="edition-meta-item">
              <span class="edition-meta-label">Data</span>
              <span class="edition-meta-value">${ed.date}</span>
            </div>
            <div class="edition-meta-item">
              <span class="edition-meta-label">Local</span>
              <span class="edition-meta-value">${ed.city} – ${ed.state} (${ed.country || 'Brasil'})</span>
            </div>
            <div class="edition-meta-item">
              <span class="edition-meta-label">Modalidade</span>
              <span class="edition-meta-value" style="color:var(--color-primary); font-weight:750;">${regInfo.label} (${priceText})</span>
            </div>
          </div>

          <p class="text-editorial" style="margin-bottom: 14px;">
            ${ed.description || 'Uma convocação missionária para a juventude no sertão da Paraíba.'}
          </p>

          <!-- AÇÕES VINCULADAS À EDIÇÃO (ITEM 4) -->
          ${actions.length > 0 ? `
            <div class="edition-actions-preview">
              <h5><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Ações Programadas nesta Edição:</h5>
              <div class="edition-actions-list-inline">
                ${actions.map(a => `
                  <div class="action-chip">
                    <span style="color:#38BDF8;">•</span>
                    <strong>${a.title}</strong>
                    ${a.time ? `<span style="font-size:0.7rem; color:#64748B;">(${a.time} em ${a.location || 'Local'})</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div style="margin-top: 20px;">
            ${isOpen ? `
              <button class="btn-primary" onclick="window.startEnrollmentFlow('${ed.id}')">
                INSCREVER-SE NA EDIÇÃO
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
              </button>
            ` : `
              <button class="btn-secondary" style="opacity: 0.7; cursor: not-allowed;" disabled>
                ${ed.status.toUpperCase()}
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Reativa o reveal observer para novos elementos
  initScrollReveal();
}

/**
 * Renderiza edições finalizadas
 */
function renderPastEditions(editions, allActions = []) {
  const container = document.getElementById('edicoes-finalizadas-wrapper');
  if (!container) return;

  container.innerHTML = editions.map(ed => {
    const actions = allActions.filter(a => a.editionId === ed.id);
    return `
      <div class="edition-card-editorial reveal-on-scroll" style="margin-bottom: 24px;">
        <div class="edition-image-side">
          <img src="${ed.image || 'assets/images/comunhao_roda.jpg'}" alt="${ed.name}" loading="lazy" onerror="this.src='assets/images/comunhao_roda.jpg'" />
          <div class="edition-image-badge-floating past">
            <span class="status-check-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
            <span>STATUS: ${ed.status.toUpperCase()}</span>
          </div>
        </div>
        <div class="edition-content-side">
          <div class="past-edition-badge-status">
            <span class="status-check-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
            ${ed.status === 'Cancelada' ? 'EDIÇÃO CANCELADA' : 'EDIÇÃO CONCLUÍDA'}
          </div>
          <h3 class="edition-title">${ed.name}</h3>
          
          <div class="edition-meta-row">
            <div class="edition-meta-item">
              <span class="edition-meta-label">Data</span>
              <span class="edition-meta-value">${ed.date}</span>
            </div>
            <div class="edition-meta-item">
              <span class="edition-meta-label">Local</span>
              <span class="edition-meta-value">${ed.city} – ${ed.state}</span>
            </div>
            <div class="edition-meta-item">
              <span class="edition-meta-label">Tipo</span>
              <span class="edition-meta-value">${ed.type}</span>
            </div>
          </div>

          <p class="text-editorial" style="margin-bottom: 14px;">
            ${ed.description || 'Uma jornada inesquecível de serviço, quebrantamento e proclamação do Evangelho.'}
          </p>

          ${actions.length > 0 ? `
            <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 10px;">
              <strong style="color:#CBD5E1;">Ações realizadas:</strong> ${actions.map(a => a.title).join(' • ')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  initScrollReveal();
}

/* ==============================================================================
   10. IDENTIFICAÇÃO DO PARTICIPANTE NO HEADER
   ============================================================================== */
function updateParticipantHeader() {
  const slot = document.getElementById('header-participant-slot');
  if (!slot) return;

  const participant = window.db.getCurrentParticipant();
  if (participant) {
    slot.innerHTML = `
      <div class="participant-auth-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg>
        <span>Olá, ${participant.name.split(' ')[0]}</span>
        <button id="btn-part-header-logout" style="background:none; border:none; color:#EF4444; font-size:0.72rem; cursor:pointer; font-weight:700; margin-left:4px;" title="Sair da identificação">✕</button>
      </div>
    `;

    document.getElementById('btn-part-header-logout')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.db.setCurrentParticipant(null);
      updateParticipantHeader();
      showToast('Sessão de participante finalizada.');
    });
  } else {
    slot.innerHTML = '';
  }
}

/* ==============================================================================
   11. FLUXO DE INSCRIÇÃO NAS EDIÇÕES (REQUISITOS 2 & 3)
   ============================================================================== */
window.startEnrollmentFlow = async (editionId) => {
  pendingEnrollmentEditionId = editionId;
  const participant = window.db.getCurrentParticipant();

  if (!participant) {
    // Se não cadastrado / não logado: abre tela de cadastro com tab
    openModal(document.getElementById('modal-cadastro-participante'));
  } else {
    // Se já cadastrado: abre direto a tela de inscrição na edição escolhida
    await openEditionEnrollmentModal(editionId, participant);
  }
};

/**
 * Abre o modal de inscrição na edição específica
 */
async function openEditionEnrollmentModal(editionId, participant) {
  const edition = await window.db.getEditionById(editionId);
  if (!edition) {
    alert('Edição não encontrada.');
    return;
  }

  // Preenche dados da edição
  document.getElementById('insc-hidden-edition-id').value = edition.id;
  document.getElementById('insc-ed-name').textContent = edition.name;
  document.getElementById('insc-ed-loc').textContent = `Local: ${edition.city} – ${edition.state} (${edition.country || 'Brasil'})`;
  document.getElementById('insc-ed-date').textContent = `Data: ${edition.date}`;

  // Nome do participante identificado
  document.getElementById('insc-participant-name').textContent = `${participant.name} (${participant.phone})`;

  // Botão trocar participante
  document.getElementById('btn-trocar-participante').onclick = () => {
    closeModal(document.getElementById('modal-inscricao-edicao'));
    window.db.setCurrentParticipant(null);
    updateParticipantHeader();
    openModal(document.getElementById('modal-cadastro-participante'));
  };

  // Reseta campos do formulário
  document.getElementById('form-concluir-inscricao').reset();
  document.getElementById('insc-proof-file-data').value = '';
  document.getElementById('selected-shirt-size').value = '';
  document.getElementById('proof-status-msg').style.display = 'none';

  const blocoCamisa = document.getElementById('bloco-inscricao-camisa');
  const blocoPagamento = document.getElementById('bloco-inscricao-pagamento');
  const blocoGratuito = document.getElementById('bloco-inscricao-gratuita');
  const typeBadge = document.getElementById('insc-ed-type-badge');

  if (edition.registrationType === 'shirt') {
    typeBadge.textContent = 'Modelo: Inscrição com Camisa Oficial Obrigatória';
    blocoCamisa.style.display = 'block';
    blocoPagamento.style.display = 'block';
    blocoGratuito.style.display = 'none';

    document.getElementById('label-valor-pagamento').textContent = 'Valor da Camisa Oficial:';
    document.getElementById('val-taxa-inscricao').textContent = `R$ ${Number(edition.shirtPrice || 45).toFixed(2)}`;

    // Renderiza tamanhos disponíveis configurados pelo ADM
    const sizes = edition.shirtSizes && edition.shirtSizes.length > 0
      ? edition.shirtSizes
      : ['P', 'M', 'G', 'GG'];

    const sizesContainer = document.getElementById('shirt-sizes-options-container');
    sizesContainer.innerHTML = sizes.map((s, idx) => `
      <label class="shirt-size-pill ${idx === 0 ? 'active' : ''}">
        <input type="radio" name="radio_shirt_size" value="${s}" ${idx === 0 ? 'checked' : ''}>
        ${s}
      </label>
    `).join('');

    document.getElementById('selected-shirt-size').value = sizes[0] || 'M';

    // Interatividade dos pills de tamanho
    sizesContainer.querySelectorAll('.shirt-size-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        sizesContainer.querySelectorAll('.shirt-size-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const input = pill.querySelector('input');
        if (input) {
          input.checked = true;
          document.getElementById('selected-shirt-size').value = input.value;
        }
      });
    });

  } else if (edition.registrationType === 'paid') {
    typeBadge.textContent = 'Modelo: Inscrição com Taxa de Participação';
    blocoCamisa.style.display = 'none';
    blocoPagamento.style.display = 'block';
    blocoGratuito.style.display = 'none';

    document.getElementById('label-valor-pagamento').textContent = 'Valor da Taxa de Inscrição:';
    document.getElementById('val-taxa-inscricao').textContent = `R$ ${Number(edition.price || 0).toFixed(2)}`;

  } else {
    // Gratuita ou Sem Inscrição
    typeBadge.textContent = 'Modelo: Inscrição Gratuita';
    blocoCamisa.style.display = 'none';
    blocoPagamento.style.display = 'none';
    blocoGratuito.style.display = 'block';
  }

  // Prepara input de comprovante
  const proofInput = document.getElementById('insc-proof-file-input');
  if (proofInput) {
    proofInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('O comprovante deve ter no máximo 5MB.');
        proofInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('insc-proof-file-data').value = ev.target.result;
        document.getElementById('proof-status-msg').style.display = 'block';
      };
      reader.readAsDataURL(file);
    };
  }

  openModal(document.getElementById('modal-inscricao-edicao'));
}

/* ==============================================================================
   12. FORMULÁRIOS DE AUTENTICAÇÃO DO PARTICIPANTE & VOLUNTÁRIO
   ============================================================================== */
function initParticipantAuthForms() {
  const tabNovo = document.getElementById('tab-btn-novocadastro');
  const tabLogin = document.getElementById('tab-btn-ja-cadastrado');
  const formNovo = document.getElementById('form-participante-novo');
  const formLogin = document.getElementById('form-participante-login');

  if (tabNovo && tabLogin) {
    tabNovo.addEventListener('click', () => {
      tabNovo.classList.add('active');
      tabLogin.classList.remove('active');
      formNovo.style.display = 'block';
      formLogin.style.display = 'none';
    });

    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabNovo.classList.remove('active');
      formLogin.style.display = 'block';
      formNovo.style.display = 'none';
    });
  }

  // Toggle áreas de voluntário no cadastro público
  const selectVol = document.getElementById('cad-part-isvolunteer');
  const boxVolAreas = document.getElementById('box-areas-voluntario-publico');
  if (selectVol && boxVolAreas) {
    selectVol.addEventListener('change', () => {
      boxVolAreas.style.display = selectVol.value === 'true' ? 'block' : 'none';
    });
  }

  // Toggle "Outros"
  const cbOutros = document.querySelector('input[name="pub_vol_area"][value="Outros"]');
  const boxOtherArea = document.getElementById('box-other-area-public');
  if (cbOutros && boxOtherArea) {
    cbOutros.addEventListener('change', () => {
      boxOtherArea.style.display = cbOutros.checked ? 'block' : 'none';
    });
  }

  // SUBMIT: LOGIN DO PARTICIPANTE ("JÁ SOU CADASTRADO")
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputVal = document.getElementById('login-part-phone').value.trim();
      const errEl = document.getElementById('login-part-error');
      errEl.style.display = 'none';

      let participant = await window.db.getParticipantByPhone(inputVal);
      if (!participant) {
        participant = await window.db.getParticipantByEmail(inputVal);
      }

      if (!participant) {
        errEl.textContent = 'Cadastro não localizado com este telefone/e-mail. Por favor, crie um novo cadastro ao lado.';
        errEl.style.display = 'block';
        return;
      }

      window.db.setCurrentParticipant(participant);
      updateParticipantHeader();
      closeModal(document.getElementById('modal-cadastro-participante'));
      showToast(`Bem-vindo de volta, ${participant.name.split(' ')[0]}!`);

      // Se havia uma edição pendente, avança automaticamente para ela
      if (pendingEnrollmentEditionId) {
        await openEditionEnrollmentModal(pendingEnrollmentEditionId, participant);
      }
    });
  }

  // SUBMIT: NOVO CADASTRO DO PARTICIPANTE & VOLUNTÁRIO
  if (formNovo) {
    formNovo.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('cad-part-nome').value.trim();
      const birthDate = document.getElementById('cad-part-nascimento').value;
      const phone = document.getElementById('cad-part-telefone').value.trim();
      const email = document.getElementById('cad-part-email').value.trim();
      const isVolunteer = document.getElementById('cad-part-isvolunteer').value === 'true';

      if (!name || !phone || !email || !birthDate) {
        alert('Por favor, preencha todos os campos obrigatórios (*).');
        return;
      }

      const selectedAreas = [];
      if (isVolunteer) {
        document.querySelectorAll('input[name="pub_vol_area"]:checked').forEach(cb => {
          selectedAreas.push(cb.value);
        });
      }

      const participantPayload = {
        name,
        birthDate,
        phone,
        email,
        address: {
          street: document.getElementById('cad-part-rua').value.trim(),
          neighborhood: document.getElementById('cad-part-bairro').value.trim(),
          city: document.getElementById('cad-part-cidade').value.trim(),
          state: document.getElementById('cad-part-estado').value.trim().toUpperCase()
        },
        pastor: document.getElementById('cad-part-pastor').value.trim(),
        church: document.getElementById('cad-part-igreja').value.trim(),
        isVolunteer,
        volunteerAreas: selectedAreas,
        volunteerOtherDetails: document.getElementById('cad-part-other-area')?.value.trim() || ''
      };

      try {
        const participant = await window.db.registerParticipant(participantPayload);
        updateParticipantHeader();
        closeModal(document.getElementById('modal-cadastro-participante'));
        showToast('Cadastro realizado com sucesso!');

        // Se havia uma edição pendente, avança para ela
        if (pendingEnrollmentEditionId) {
          await openEditionEnrollmentModal(pendingEnrollmentEditionId, participant);
        }
      } catch (err) {
        alert(err.message || 'Falha ao registrar cadastro.');
      }
    });
  }

  // SUBMIT: FINALIZAR INSCRIÇÃO NA EDIÇÃO ESCOLHIDA
  const formInscricao = document.getElementById('form-concluir-inscricao');
  if (formInscricao) {
    formInscricao.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editionId = document.getElementById('insc-hidden-edition-id').value;
      const participant = window.db.getCurrentParticipant();

      if (!editionId || !participant) {
        alert('Sessão expirada. Por favor, identifique-se novamente.');
        return;
      }

      const edition = await window.db.getEditionById(editionId);
      if (!edition) return;

      const shirtSize = document.getElementById('selected-shirt-size').value;
      const proofFile = document.getElementById('insc-proof-file-data').value;
      const proofFileInput = document.getElementById('insc-proof-file-input');

      // VALIDAÇÕES REQUISITO 2:
      if (edition.registrationType === 'shirt') {
        if (!shirtSize) {
          alert('Por favor, selecione obrigatoriamente o tamanho da sua camisa.');
          return;
        }
        if (!proofFile) {
          alert('O comprovante de pagamento é obrigatório para inscrição com camisa.');
          return;
        }
      }

      if (edition.registrationType === 'paid') {
        if (!proofFile) {
          alert('O comprovante de pagamento da taxa de inscrição é obrigatório.');
          return;
        }
      }

      const fileName = proofFileInput?.files?.[0]?.name || 'comprovante_pix.png';

      try {
        await window.db.createEnrollment({
          editionId,
          participantId: participant.id,
          shirtSize,
          proofFile,
          proofFileName: fileName
        });

        closeModal(document.getElementById('modal-inscricao-edicao'));
        pendingEnrollmentEditionId = null;

        showToast(`Glória a Deus! Inscrição confirmada para ${edition.name}.`);

        // Recarrega edições para atualizar contadores
        await initEditionsFromDB();
      } catch (err) {
        alert(err.message || 'Erro ao concluir inscrição.');
      }
    });
  }
}

/* ==============================================================================
   13. NOTIFICAÇÃO TOAST
   ============================================================================== */
function showToast(message) {
  let toast = document.querySelector('.jcp-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'jcp-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span style="color:#008CFF; font-weight:800;">✓</span> <span>${message}</span>`;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

/* ==============================================================================
   14. CONTADOR DE ORAÇÃO
   ============================================================================== */
function initPrayerCounter() {
  // Atualiza o número no card público e no modal
  function updatePrayerCountDisplay() {
    const count = window.db.getPrayerCount();
    const displayEls = [
      document.getElementById('prayer-counter-num'),
      document.getElementById('prayer-counter-modal-num')
    ];
    displayEls.forEach(el => { if (el) el.textContent = count; });
  }

  // Configura estado do modal ao abrir
  const btnOrando = document.getElementById('btn-orando');
  if (btnOrando) {
    btnOrando.addEventListener('click', () => {
      updatePrayerCountDisplay();
      const participant = window.db.getCurrentParticipant();
      const authRequired = document.getElementById('prayer-auth-required');
      const alreadyDone = document.getElementById('prayer-already-done');
      const formOrando = document.getElementById('form-orando');

      if (!participant) {
        // Não logado: mostra aviso de login
        if (authRequired) authRequired.style.display = 'block';
        if (alreadyDone) alreadyDone.style.display = 'none';
        if (formOrando) formOrando.style.display = 'none';
      } else if (window.db.hasParticipantPrayedToday()) {
        // Já orou hoje
        if (authRequired) authRequired.style.display = 'none';
        if (alreadyDone) alreadyDone.style.display = 'block';
        if (formOrando) formOrando.style.display = 'none';
      } else {
        // Pode orar
        if (authRequired) authRequired.style.display = 'none';
        if (alreadyDone) alreadyDone.style.display = 'none';
        if (formOrando) formOrando.style.display = 'block';
      }
    });
  }

  // Submit do formulário de oração
  const formOrando = document.getElementById('form-orando');
  if (formOrando) {
    formOrando.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const result = await window.db.registerPrayer();
        if (result.alreadyDone) {
          const alreadyDone = document.getElementById('prayer-already-done');
          const form = document.getElementById('form-orando');
          if (alreadyDone) alreadyDone.style.display = 'block';
          if (form) form.style.display = 'none';
        } else {
          updatePrayerCountDisplay();
          closeModal(document.getElementById('modal-orando'));
          showToast(`🙏 Obrigado! Você é o ${result.count}º intercessor registrado!`);
        }
      } catch (err) {
        // Precisa de login
        closeModal(document.getElementById('modal-orando'));
        openModal(document.getElementById('modal-cadastro-participante'));
        showToast('Faça seu cadastro para registrar sua oração.');
      }
    });
  }

  // Atualiza o contador inicial ao carregar
  updatePrayerCountDisplay();
}


/* ==============================================================================
   UTILITÁRIO: PROCESSAMENTO E VALIDAÇÃO DE COMPROVANTES (SEM CORRUPÇÃO)
   ============================================================================== */
function processProofFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Nenhum arquivo selecionado.'));

    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/');
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';

    if (!isImage && !isPdf) {
      return reject(new Error('Formato inválido. Por favor, anexe um arquivo JPG, PNG, WebP ou PDF.'));
    }

    if (file.size > 8 * 1024 * 1024) {
      return reject(new Error('O arquivo excede o limite máximo permitido de 8MB.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo do comprovante.'));

    if (isPdf) {
      if (file.size > 3.5 * 1024 * 1024) {
        return reject(new Error('O arquivo PDF deve ter no máximo 3.5MB.'));
      }
      reader.onload = (e) => {
        let result = e.target.result;
        if (!result.startsWith('data:application/pdf')) {
          result = result.replace(/^data:[^;]*/, 'data:application/pdf');
        }
        resolve({ dataUrl: result, fileName: file.name, isPdf: true });
      };
      reader.readAsDataURL(file);
    } else {
      // Para imagens: redimensiona suavemente caso ultrapasse 1600px para garantir nitidez cristalina
      // sem estourar o armazenamento local (localStorage).
      reader.onload = (e) => {
        const rawData = e.target.result;
        const img = new Image();
        img.onerror = () => {
          let mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
          let normalized = rawData.replace(/^data:[^;]*/, 'data:' + mime);
          resolve({ dataUrl: normalized, fileName: file.name, isPdf: false });
        };
        img.onload = () => {
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim || file.size > 800 * 1024) {
            if (w > h && w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            resolve({ dataUrl: compressed, fileName: file.name.replace(/\.[^.]+$/, '.jpg'), isPdf: false });
          } else {
            let mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
            let normalized = rawData.replace(/^data:[^;]*/, 'data:' + mime);
            resolve({ dataUrl: normalized, fileName: file.name, isPdf: false });
          }
        };
        img.src = rawData;
      };
      reader.readAsDataURL(file);
    }
  });
}

/* ==============================================================================
   15. FORMULÁRIO DE CONTRIBUIÇÃO COM COMPROVANTE (PÚBLICO)
   ============================================================================== */
function initContribuicaoForm() {
  const contribProofInput = document.getElementById('contrib-proof-input');
  const contribUploadArea = document.getElementById('contrib-upload-area');
  const formContrib = document.getElementById('form-contribuicao');
  if (!formContrib) return;

  if (contribProofInput) {
    contribProofInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (contribUploadArea) {
        contribUploadArea.innerHTML = `
          <div class="contrib-upload-icon">⏳</div>
          <div class="contrib-upload-text">Processando arquivo...</div>
          <div class="contrib-upload-hint">Verificando integridade</div>
        `;
      }

      try {
        const processed = await processProofFile(file);
        document.getElementById('contrib-proof-data').value = processed.dataUrl;
        const fnInput = document.getElementById('contrib-proof-filename');
        if (fnInput) fnInput.value = processed.fileName;

        const statusEl = document.getElementById('contrib-proof-status');
        if (statusEl) {
          statusEl.textContent = `✅ ${processed.fileName} pronto para envio!`;
          statusEl.style.display = 'block';
        }
        if (contribUploadArea) {
          contribUploadArea.innerHTML = `
            <div class="contrib-upload-icon">${processed.isPdf ? '📄' : '🖼️'}</div>
            <div class="contrib-upload-text">${processed.fileName}</div>
            <div class="contrib-upload-hint">Clique para trocar de arquivo</div>
          `;
        }
      } catch (err) {
        alert(err.message || 'Erro ao processar comprovante.');
        contribProofInput.value = '';
        if (contribUploadArea) {
          contribUploadArea.innerHTML = `
            <div class="contrib-upload-icon">📎</div>
            <div class="contrib-upload-text">Clique para anexar o comprovante</div>
            <div class="contrib-upload-hint">JPG, PNG, WebP ou PDF — até 5MB</div>
          `;
        }
      }
    });
  }

  // Submit do formulário
  formContrib.addEventListener('submit', async (e) => {
    e.preventDefault();
    const proofFile = document.getElementById('contrib-proof-data')?.value;
    const errorEl = document.getElementById('contrib-form-error');

    if (!proofFile) {
      if (errorEl) {
        errorEl.textContent = '⚠ O comprovante é obrigatório. Anexe um arquivo JPG, PNG, WebP ou PDF.';
        errorEl.style.display = 'block';
      }
      return;
    }
    if (errorEl) errorEl.style.display = 'none';

    const name = document.getElementById('contrib-nome')?.value?.trim() || '';
    const amount = document.getElementById('contrib-valor')?.value?.trim() || '';
    const proofFileName = document.getElementById('contrib-proof-filename')?.value || contribProofInput?.files?.[0]?.name || 'comprovante.png';

    const submitBtn = document.getElementById('btn-submit-contribuicao') || formContrib.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
    }

    try {
      await window.db.createPublicContribution({ name, amount, proofFile, proofFileName });
      closeModal(document.getElementById('modal-contribuicao'));
      showToast('🙌 Contribuição e comprovante registrados com sucesso! Que Deus abençoe!');

      // Reset do formulário
      formContrib.reset();
      document.getElementById('contrib-proof-data').value = '';
      const fnInput = document.getElementById('contrib-proof-filename');
      if (fnInput) fnInput.value = '';

      if (contribUploadArea) {
        contribUploadArea.innerHTML = `
          <div class="contrib-upload-icon" id="contrib-upload-icon">📎</div>
          <div class="contrib-upload-text" id="contrib-upload-text">Clique para anexar o comprovante</div>
          <div class="contrib-upload-hint" id="contrib-upload-hint">JPG, PNG, WebP ou PDF — até 5MB</div>
        `;
      }
      const statusEl = document.getElementById('contrib-proof-status');
      if (statusEl) statusEl.style.display = 'none';
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Erro ao registrar contribuição.';
        errorEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'CONFIRMAR CONTRIBUIÇÃO';
      }
    }
  });
}

/* ==============================================================================
   NOSSAS LIDERANÇAS — RENDERIZAÇÃO PÚBLICA
   ============================================================================== */
async function renderPublicLeaders() {
  const grid = document.getElementById('leaders-grid-public');
  const emptyState = document.getElementById('leaders-empty-state');
  if (!grid) return;

  try {
    const leaders = await window.db.getPublicLeaders();

    // Remove spinner
    grid.innerHTML = '';

    if (!leaders || leaders.length === 0) {
      grid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    grid.style.display = 'grid';

    leaders.forEach(leader => {
      const card = document.createElement('div');
      card.className = 'leader-card';

      // Foto ou placeholder
      let photoHTML;
      const initials = (leader.fullName || 'JC').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
      if (leader.photoPath) {
        photoHTML = `<img src="${leader.photoPath}" alt="Foto de ${leader.fullName}" class="leader-photo" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="leader-photo-placeholder" style="display:none;" aria-label="Foto de ${leader.fullName}">${initials}</div>`;
      } else {
        photoHTML = `<div class="leader-photo-placeholder" aria-label="Foto de ${leader.fullName}">${initials}</div>`;
      }

      // Cargo opcional
      const roleHTML = leader.roleTitle
        ? `<p class="leader-role-title">${leader.roleTitle}</p>`
        : '';

      // Instagram opcional
      const igURL = leader.instagramUrl ? leader.instagramUrl.trim() : '';
      let igLink = '';
      if (igURL) {
        const handle = igURL.startsWith('@') ? igURL : (igURL.includes('instagram.com/') ? '@' + igURL.split('instagram.com/')[1].replace(/\/+$/, '') : igURL);
        const href = igURL.startsWith('http') ? igURL : `https://instagram.com/${handle.replace('@', '')}`;
        igLink = `<a href="${href}" target="_blank" rel="noopener" class="leader-instagram">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          ${handle}
        </a>`;
      }

      card.innerHTML = `
        <div class="leader-photo-wrap">${photoHTML}</div>
        <span class="leader-dept-line"></span>
        <p class="leader-dept">${leader.departmentName}</p>
        <h3 class="leader-name">${leader.fullName}</h3>
        ${roleHTML}
        <p class="leader-bio">${leader.biography}</p>
        ${igLink}
      `;

      grid.appendChild(card);
    });

  } catch (err) {
    grid.innerHTML = `<div class="leaders-loading" style="color:#EF4444;">⚠️ Erro ao carregar lideranças.</div>`;
    console.error('[JCP] Erro ao carregar líderes públicos:', err);
  }
}
