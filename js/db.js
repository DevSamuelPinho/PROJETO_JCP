/**
 * ==============================================================================
 * PROJETO JOVENS COM PROPÓSITO — JCP | BANCO DE DADOS & CAMADA DE BACKEND
 * ==============================================================================
 * Sistema relacional completo com controle de acesso (RBAC), auditoria global,
 * validação de permissões no backend/API e persistência remota no Supabase.
 * ==============================================================================
 */

const JCP_DB_KEY = 'jcp_system_db_v4'; // v4 = reset limpo (out/2026)
const JCP_SESSION_KEY = 'jcp_admin_session_v4';
const JCP_PARTICIPANT_SESSION_KEY = 'jcp_participant_session_v4';
const JCP_MEDIA_BUCKET = 'jcp-media';

class DatabaseService {
    constructor() {
        this.supabase = this._createSupabaseClient();
        this.participantAuth = this._createParticipantAuthClient();
        this._currentAdmin = null;
        this._currentParticipant = null;
        this._pendingParticipantSignup = null;
        this._lastAdminAuthIssue = null;
        this._lastAdminAuthEmail = null;
        this._init();
    }

    _createSupabaseClient() {
        const config = window.JCP_SUPABASE_CONFIG;
        if (!config?.url || !config?.publishableKey) {
            throw new Error('Configuração do Supabase ausente. O sistema não pode iniciar sem o banco remoto.');
        }
        if (!window.supabase?.createClient) {
            throw new Error('Cliente Supabase indisponível. Verifique se o SDK foi carregado antes do sistema.');
        }
        const isAdminPage = /(?:^|\/)admin\.html$/i.test(window.location.pathname);
        return window.supabase.createClient(config.url, config.publishableKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: isAdminPage }
        });
    }

    _createParticipantAuthClient() {
        const config = window.JCP_SUPABASE_CONFIG;
        if (!config?.url || !config?.publishableKey || !window.supabase?.createClient) return null;
        const isAdminPage = /(?:^|\/)admin\.html$/i.test(window.location.pathname);
        return window.supabase.createClient(config.url, config.publishableKey, {
            auth: {
                storageKey: 'jcp_participant_auth_v1',
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: !isAdminPage
            }
        });
    }

    _delay(ms = 60) {
        return new Promise(r => setTimeout(r, ms));
    }

    /* ==========================================================================
       INICIALIZAÇÃO & SEEDS DO BANCO DE DADOS
       ========================================================================== */
    _init() {
        if (this._hasRemoteDataSource()) return;
        if (!localStorage.getItem(JCP_DB_KEY)) {
            const seed = {
                // 1. PERFIS E PERMISSÕES (RBAC)
                roles: [
                    {
                        id: 'super_admin',
                        name: 'Super Admin',
                        description: 'Acesso irrestrito a todos os módulos, configurações, usuários e logs do sistema.',
                        permissions: ['*'],
                        isSystem: true
                    },
                    {
                        id: 'coordenador',
                        name: 'Coordenador',
                        description: 'Acesso a edições, ações, inscrições e voluntários. Sem acesso a logs e usuários.',
                        permissions: [
                            'dashboard:read',
                            'editions:read',
                            'editions:write',
                            'actions:read',
                            'actions:write',
                            'volunteers:read',
                            'volunteers:write',
                            'enrollments:read',
                            'enrollments:write',
                            'contributions:read',
                            'leaders:read',
                            'leaders:write',
                            'testimonials:read',
                            'testimonials:write'
                        ],
                        isSystem: true
                    },
                    {
                        id: 'midia',
                        name: 'Mídia',
                        description: 'Acesso exclusivo a fotos, vídeos, testemunhos, conteúdos editoriais (CMS) e consulta de edições.',
                        permissions: [
                            'dashboard:read',
                            'editions:read',
                            'media:read',
                            'media:write',
                            'testimonials:read',
                            'testimonials:write',
                            'content:read',
                            'content:write'
                        ],
                        isSystem: true
                    }
                ],

                // 2. ADMINISTRADORES
                admins: [
                ],

                // 3. EDIÇÕES
                editions: [
                    {
                        id: 'ed_1',
                        name: '2ª Edição — Qual é o Seu Propósito?',
                        type: 'Encontro', // 'Encontro' ou 'Ação Evangelística'
                        city: 'Pombal',
                        state: 'PB',
                        country: 'Brasil',
                        date: '10 a 12 de Outubro de 2026',
                        description: 'A segunda edição do JCP convoca toda a juventude cristã a discernir o seu chamado específico no Reino. Teremos oficinas ministeriais práticas de Louvor, Mídia, Ação Social e Missões no Sertão, vigílias e evangelismo.',
                        image: 'assets/images/noite_clamor.jpg',
                        status: 'Inscrições Abertas', // 'Planejamento', 'Inscrições Abertas', 'Inscrições Encerradas', 'Em Andamento', 'Finalizada', 'Cancelada'
                        registrationType: 'shirt', // 'none', 'free', 'paid', 'shirt'
                        price: 45.00,
                        shirtPrice: 45.00,
                        shirtSizes: ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
                        createdAt: '2026-08-01T10:00:00Z',
                        updatedAt: '2026-09-30T14:00:00Z'
                    },
                    {
                        id: 'ed_2',
                        name: '13ª Edição – Dia com Deus',
                        type: 'Ação Evangelística',
                        city: 'Palmeira',
                        state: 'PB',
                        country: 'Brasil',
                        date: '31 de Outubro de 2026',
                        description: 'Cruzada de oração, evangelização ao ar livre, assistência humanitária e culto de celebração com as famílias sertanejas.',
                        image: 'assets/images/evangelismo_rua.jpg',
                        status: 'Inscrições Abertas',
                        registrationType: 'paid',
                        price: 25.00,
                        shirtPrice: 0,
                        shirtSizes: [],
                        createdAt: '2026-08-15T12:00:00Z',
                        updatedAt: '2026-09-30T14:00:00Z'
                    },
                    {
                        id: 'ed_4',
                        name: '12ª Edição – 2ª Viagem Missionária ao Paraguai',
                        type: 'Ação Evangelística',
                        city: 'San Lorenzo',
                        state: 'Central',
                        country: 'Paraguai',
                        date: 'Agosto de 2026',
                        description: 'Ação transcultural em apoio às comunidades e crianças paraguaias com apoio médico-social e bíblico.',
                        image: 'assets/images/sertao_mission.jpg',
                        status: 'Finalizada',
                        registrationType: 'none',
                        price: 0,
                        shirtPrice: 0,
                        shirtSizes: [],
                        createdAt: '2026-06-01T10:00:00Z',
                        updatedAt: '2026-08-25T18:00:00Z'
                    }
                ],

                // 4. AÇÕES VINCULADAS ÀS EDIÇÕES
                actions: [
                    {
                        id: 'act_1',
                        editionId: 'ed_1',
                        title: 'Vigília de Abertura & Quebrantamento',
                        date: '2026-10-10',
                        time: '22:00',
                        location: 'Tenda Central - Pombal',
                        leader: 'Pr. Marcos Dias',
                        description: 'Momento de clamor inicial com todos os participantes e líderes da região.',
                        status: 'Confirmada'
                    },
                    {
                        id: 'act_2',
                        editionId: 'ed_1',
                        title: 'Oficinas Vocacionais (Louvor, Mídia, Ação Social)',
                        date: '2026-10-11',
                        time: '14:00',
                        location: 'Escola Municipal de Pombal',
                        leader: 'José Samuel & Ana Silva',
                        description: 'Treinamento prático por ministérios com divisão de equipes em salas temáticas.',
                        status: 'Confirmada'
                    },
                    {
                        id: 'act_3',
                        editionId: 'ed_1',
                        title: 'Evangelismo de Impacto & Oração nas Ruas',
                        date: '2026-10-11',
                        time: '16:30',
                        location: 'Praça do Comércio e Ruas Centrais',
                        leader: 'Danilo Cândido',
                        description: 'Saída dos grupos para pregação face a face, distribuição de bíblias e oração por enfermos.',
                        status: 'Confirmada'
                    },
                    {
                        id: 'act_4',
                        editionId: 'ed_2',
                        title: 'Distribuição de Alimentos & Sopão Solidário',
                        date: '2026-10-31',
                        time: '11:00',
                        location: 'Comunidade Novo Horizonte - Palmeira',
                        leader: 'Equipe de Ação Social JCP',
                        description: 'Entrega de cestas básicas e atendimento às famílias carentes cadastradas.',
                        status: 'Confirmada'
                    }
                ],

                // 5. PARTICIPANTES & VOLUNTÁRIOS
                participants: [
                ],

                // 6. INSCRIÇÕES & COMPROVANTES
                enrollments: [
                ],

                // 7. CONTRIBUIÇÕES VOLUNTÁRIAS
                contributions: [
                ],

                // 8. CONFIGURAÇÕES GLOBAIS
                settings: {
                    pixKey: 'projetojovenscomproposito@gmail.com',
                    pixKeyType: 'E-mail',
                    pixBeneficiary: 'Projeto Jovens com Propósito',
                    pixBank: 'Banco do Brasil',
                    pixCity: 'Patos - PB',
                    pixNotice: 'Sua contribuição sustenta a realização dos encontros, viagens missionárias pelo sertão e o apoio a jovens e comunidades locais.',
                    contactEmail: 'projetojovenscomproposito@gmail.com',
                    contactPhone: '(83) 99999-9999',
                    instagram: '@jovenscomproposito',
                    churchPartnerCount: 14,
                    missionImpactLives: 450
                },

                // 9. AUDITORIA / LOGS
                logs: [
                ],

                // 10. CMS / CONTEÚDO EDITORIAL
                content: {
                    heroTitle: 'Existe vida no sertão da Paraíba.',
                    heroSubtitle: 'Uma comunidade de jovens conectada por valores, inspirando uma geração a viver de forma autêntica pelo Reino.',
                    aboutText: 'O Jovens com Propósito (JCP) nasceu para inspirar e equipar uma nova geração a viver com intencionalidade. Nossa visão é transformar o ordinário em extraordinário, guiados por princípios cristãos, comunhão genuína e serviço ao próximo.'
                },

                // 11. DEPARTAMENTOS
                departments: [
                              {
                                        "id": "dept_coord",
                                        "name": "Coordenação Geral",
                                        "description": "Supervisão ministerial, pastoreio e liderança geral do Projeto JCP.",
                                        "isActive": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "dept_midia",
                                        "name": "Mídia & Comunicação",
                                        "description": "Produção audiovisual, cobertura de missões, fotografia e redes sociais.",
                                        "isActive": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "dept_apoio",
                                        "name": "Equipe de Apoio",
                                        "description": "Suporte operacional, logística de acolhimento e estrutura das edições.",
                                        "isActive": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "dept_fiscais",
                                        "name": "Equipe de Fiscais",
                                        "description": "Organização, ordem das atividades, fluxo e zelo pelos participantes.",
                                        "isActive": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "dept_financeiro",
                                        "name": "Financeiro",
                                        "description": "Gestão de recursos, prestação de contas e transparência das contribuições.",
                                        "isActive": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "dept_devocional",
                                        "name": "Devocional & Intercessão",
                                        "description": "Direção espiritual, momentos de oração, vigílias e edificação da fé.",
                                        "isActive": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              }
                    ],

                // 12. LÍDERES
                leaders: [
                              {
                                        "id": "leader_1",
                                        "fullName": "Pr. Dayrson",
                                        "departmentId": "dept_coord",
                                        "roleTitle": "Coordenador Geral",
                                        "biography": "Sirvo ao Senhor na coordenação geral do JCP, pastoreando corações e guiando esta geração no cumprimento da Grande Comissão no sertão.",
                                        "photoPath": "assets/images/leader_danilo.jpg",
                                        "instagramUrl": "",
                                        "displayOrder": 1,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "leader_2",
                                        "fullName": "Miss. Vânia",
                                        "departmentId": "dept_coord",
                                        "roleTitle": "Coordenadora Geral",
                                        "biography": "Dedico minha vida ao serviço missionário e ao pastoreio dos jovens no JCP, ensinando o amor de Cristo e o poder da oração e perseverança.",
                                        "photoPath": "",
                                        "instagramUrl": "",
                                        "displayOrder": 2,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "leader_3",
                                        "fullName": "Esther Késsia",
                                        "departmentId": "dept_midia",
                                        "roleTitle": "Liderança de Mídia",
                                        "biography": "Atuo na comunicação e mídia do JCP, compartilhando o evangelho através da criatividade e registrando o agir de Deus em cada edição.",
                                        "photoPath": "assets/images/leader_sarah.jpg",
                                        "instagramUrl": "@estherkessia",
                                        "displayOrder": 3,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "leader_4",
                                        "fullName": "Ezequiel Jonatas",
                                        "departmentId": "dept_midia",
                                        "roleTitle": "Liderança de Mídia & Audiovisual",
                                        "biography": "Uso as ferramentas audiovisuais para amplificar a mensagem do Reino e eternizar as memórias missionárias do Jovens com Propósito.",
                                        "photoPath": "assets/images/leader_joao.jpg",
                                        "instagramUrl": "@ezequieljonatass",
                                        "displayOrder": 4,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "leader_5",
                                        "fullName": "Pedro Lopes",
                                        "departmentId": "dept_apoio",
                                        "roleTitle": "Líder da Equipe de Apoio",
                                        "biography": "Lidero a equipe de apoio garantindo suporte operacional e zelo em cada detalhe, servindo aos irmãos com dedicação e espírito voluntário.",
                                        "photoPath": "",
                                        "instagramUrl": "@slpeedro",
                                        "displayOrder": 5,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "leader_6",
                                        "fullName": "Guilherme",
                                        "departmentId": "dept_fiscais",
                                        "roleTitle": "Líder da Equipe de Fiscais",
                                        "biography": "Sirvo coordenando a fiscalização e a ordem das atividades, zelando para que cada momento do projeto ocorra em paz, respeito e harmonia.",
                                        "photoPath": "",
                                        "instagramUrl": "@guilermi77",
                                        "displayOrder": 6,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "leader_7",
                                        "fullName": "Kelyane Moura",
                                        "departmentId": "dept_fiscais",
                                        "roleTitle": "Líder da Equipe de Fiscais",
                                        "biography": "Atuo na coordenação dos fiscais com cuidado, carinho e firmeza, zelando pelo bem-estar e organização de todos os participantes.",
                                        "photoPath": "",
                                        "instagramUrl": "@kelyane_moura",
                                        "displayOrder": 7,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "leader_8",
                                        "fullName": "Gilmara Bandeira",
                                        "departmentId": "dept_financeiro",
                                        "roleTitle": "Gestão Financeira",
                                        "biography": "Administro os recursos do JCP com integridade, transparência e responsabilidade, para que cada oferta frutifique na obra de Deus.",
                                        "photoPath": "",
                                        "instagramUrl": "@jubandeirasjp",
                                        "displayOrder": 8,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              },
                              {
                                        "id": "leader_9",
                                        "fullName": "Leticia Rodrigues",
                                        "departmentId": "dept_devocional",
                                        "roleTitle": "Dirigente do Devocional",
                                        "biography": "Conduzo os momentos de devocional e busca pelo Espírito Santo, edificando a fé dos jovens e cultivando uma intimidade viva com o Pai.",
                                        "photoPath": "",
                                        "instagramUrl": "@lericiarovieira",
                                        "displayOrder": 9,
                                        "isActive": true,
                                        "isPublished": true,
                                        "createdAt": "2026-01-10T10:00:00Z",
                                        "updatedAt": "2026-01-10T10:00:00Z"
                              }
                    ]
            };
            this._save(seed);
        }

        // ==========================================================================
        // RESET CANÔNICO v4 — Garante dados oficiais em QUALQUER estado do banco
        // ==========================================================================
        const existing = this._read();
        let needsSave = false;

        // Remove credentials left by older local seeds without dropping admin data.
        if (Array.isArray(existing.admins)) {
            let removedLegacyPasswords = false;
            existing.admins = existing.admins.map(admin => {
                if (!admin || typeof admin !== 'object' || !Object.prototype.hasOwnProperty.call(admin, 'password')) {
                    return admin;
                }
                const sanitizedAdmin = { ...admin };
                delete sanitizedAdmin.password;
                removedLegacyPasswords = true;
                return sanitizedAdmin;
            });
            if (removedLegacyPasswords) needsSave = true;
        }

        // --- Departamentos oficiais (sobrescreve sempre) ---
        const canonicalDepartments = [
            { id: 'dept_coord',      name: 'Coordenação Geral',      description: 'Supervisão ministerial, pastoreio e liderança geral do Projeto JCP.',                                isActive: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'dept_midia',      name: 'Mídia & Comunicação',     description: 'Produção audiovisual, cobertura de missões, fotografia e redes sociais.',                          isActive: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'dept_apoio',      name: 'Equipe de Apoio',         description: 'Suporte operacional, logística de acolhimento e estrutura das edições.',                           isActive: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'dept_fiscais',    name: 'Equipe de Fiscais',       description: 'Organização, ordem das atividades, fluxo e zelo pelos participantes.',                             isActive: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'dept_financeiro', name: 'Financeiro',              description: 'Gestão de recursos, prestação de contas e transparência das contribuições.',                        isActive: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'dept_devocional', name: 'Devocional & Intercessão',description: 'Direção espiritual, momentos de oração, vigílias e edificação da fé.',                            isActive: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' }
        ];
        existing.departments = canonicalDepartments;
        needsSave = true;

        // --- Líderes oficiais (sobrescreve sempre) ---
        const canonicalLeaders = [
            { id: 'leader_1', fullName: 'Pr. Dayrson',       departmentId: 'dept_coord',      roleTitle: 'Coordenador Geral',              biography: 'Sirvo ao Senhor na coordenação geral do JCP, pastoreando corações e guiando esta geração no cumprimento da Grande Comissão no sertão.',                                         photoPath: 'assets/images/leader_danilo.jpg', instagramUrl: '',               displayOrder: 1, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'leader_2', fullName: 'Miss. Vânia',       departmentId: 'dept_coord',      roleTitle: 'Coordenadora Geral',             biography: 'Dedico minha vida ao serviço missionário e ao pastoreio dos jovens no JCP, ensinando o amor de Cristo e o poder da oração e perseverança.',                                   photoPath: '',                               instagramUrl: '',               displayOrder: 2, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'leader_3', fullName: 'Esther Késsia',     departmentId: 'dept_midia',      roleTitle: 'Liderança de Mídia',             biography: 'Atuo na comunicação e mídia do JCP, compartilhando o evangelho através da criatividade e registrando o agir de Deus em cada edição.',                                         photoPath: 'assets/images/leader_sarah.jpg', instagramUrl: '@estherkessia',  displayOrder: 3, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'leader_4', fullName: 'Ezequiel Jonatas',  departmentId: 'dept_midia',      roleTitle: 'Liderança de Mídia & Audiovisual',biography: 'Uso as ferramentas audiovisuais para amplificar a mensagem do Reino e eternizar as memórias missionárias do Jovens com Propósito.',                                       photoPath: 'assets/images/leader_joao.jpg',  instagramUrl: '@ezequieljonatass', displayOrder: 4, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'leader_5', fullName: 'Pedro Lopes',       departmentId: 'dept_apoio',      roleTitle: 'Líder da Equipe de Apoio',       biography: 'Lidero a equipe de apoio garantindo suporte operacional e zelo em cada detalhe, servindo aos irmãos com dedicação e espírito voluntário.',                                    photoPath: '',                               instagramUrl: '@slpeedro',      displayOrder: 5, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'leader_6', fullName: 'Guilherme',         departmentId: 'dept_fiscais',    roleTitle: 'Líder da Equipe de Fiscais',     biography: 'Sirvo coordenando a fiscalização e a ordem das atividades, zelando para que cada momento do projeto ocorra em paz, respeito e harmonia.',                                  photoPath: '',                               instagramUrl: '@guilermi77',     displayOrder: 6, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'leader_7', fullName: 'Kelyane Moura',     departmentId: 'dept_fiscais',    roleTitle: 'Líder da Equipe de Fiscais',     biography: 'Atuo na coordenação dos fiscais com cuidado, carinho e firmeza, zelando pelo bem-estar e organização de todos os participantes.',                                         photoPath: '',                               instagramUrl: '@kelyane_moura', displayOrder: 7, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'leader_8', fullName: 'Gilmara Bandeira',  departmentId: 'dept_financeiro', roleTitle: 'Gestão Financeira',              biography: 'Administro os recursos do JCP com integridade, transparência e responsabilidade, para que cada oferta frutifique na obra de Deus.',                                       photoPath: '',                               instagramUrl: '@jubandeirasjp', displayOrder: 8, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' },
            { id: 'leader_9', fullName: 'Leticia Rodrigues', departmentId: 'dept_devocional', roleTitle: 'Dirigente do Devocional',        biography: 'Conduzo os momentos de devocional e busca pelo Espírito Santo, edificando a fé dos jovens e cultivando uma intimidade viva com o Pai.',                                   photoPath: '',                               instagramUrl: '@lericiarovieira',displayOrder: 9, isActive: true, isPublished: true, createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-01-10T10:00:00Z' }
        ];
        existing.leaders = canonicalLeaders;

        // --- Edições: remove ed_3 e garante apenas as 3 oficiais ---
        if (existing.editions) {
            existing.editions = existing.editions.filter(e => e.id !== 'ed_3');
        }

        // --- Permissões do coordenador e mídia ---
        if (existing.roles) {
            const coordRole = existing.roles.find(r => r.id === 'coordenador');
            if (coordRole && !coordRole.permissions.includes('leaders:read')) {
                coordRole.permissions.push('leaders:read', 'leaders:write');
                needsSave = true;
            }
            if (coordRole && !coordRole.permissions.includes('testimonials:read')) {
                coordRole.permissions.push('testimonials:read', 'testimonials:write');
                needsSave = true;
            }
            const midiaRole = existing.roles.find(r => r.id === 'midia');
            if (midiaRole && !midiaRole.permissions.includes('testimonials:read')) {
                midiaRole.permissions.push('testimonials:read', 'testimonials:write');
                needsSave = true;
            }
        }

        if (existing.editions && existing.editions.some(e => e.id === 'ed_3')) {
            existing.editions = existing.editions.filter(e => e.id !== 'ed_3');
            needsSave = true;
        }

        if (!Array.isArray(existing.media)) {
            existing.media = [
                { id: 'media_seed_1', title: 'Noite de Clamor', src: 'assets/images/noite_clamor.jpg', alt: 'Vigília de oração', createdAt: '2026-09-01T00:00:00.000Z' },
                { id: 'media_seed_2', title: 'Roda de Oração', src: 'assets/images/comunhao_roda.jpg', alt: 'Jovens em comunhão e oração', createdAt: '2026-09-02T00:00:00.000Z' },
                { id: 'media_seed_3', title: 'Evangelismo de Rua', src: 'assets/images/evangelismo_rua.jpg', alt: 'Ação de evangelismo de rua', createdAt: '2026-09-03T00:00:00.000Z' },
                { id: 'media_seed_4', title: 'Louvor e Adoração', src: 'assets/images/hero_worship.jpg', alt: 'Momento de louvor', createdAt: '2026-09-04T00:00:00.000Z' },
                { id: 'media_seed_5', title: 'Missão Sertaneja', src: 'assets/images/sertao_mission.jpg', alt: 'Equipe em missão no sertão', createdAt: '2026-09-05T00:00:00.000Z' }
            ];
            needsSave = true;
        }

        if (!Array.isArray(existing.testimonials)) {
            existing.testimonials = [];
            needsSave = true;
        }

        if (needsSave) this._save(existing);

        // Se não houver administrador logado no session, seta padrão Super Admin
        if (!sessionStorage.getItem(JCP_SESSION_KEY) && !localStorage.getItem(JCP_SESSION_KEY)) {
            const db = this._read();
            const defaultAdmin = db.admins.find(a => a.roleId === 'super_admin') || db.admins[0];
            if (defaultAdmin) {
                const sessionData = {
                    id: defaultAdmin.id,
                    name: defaultAdmin.name,
                    email: defaultAdmin.email,
                    roleId: defaultAdmin.roleId,
                    avatar: defaultAdmin.avatar
                };
                sessionStorage.setItem(JCP_SESSION_KEY, JSON.stringify(sessionData));
            }
        }
    }

    _read() {
        if (this._hasRemoteDataSource()) return {};
        throw new Error('Supabase não está configurado. A leitura local de dados foi desativada.');
    }

    _hasRemoteDataSource() {
        return Boolean(this.supabase && window.JCP_SUPABASE_CONFIG?.url);
    }

    async _selectRemoteRows(table, client = this.supabase) {
        if (!this._hasRemoteDataSource() || !client) throw new Error('Supabase não está configurado. Os dados não foram carregados.');
        const { data, error } = await client.from(table).select('*');
        if (error) {
            const message = error.code === '42501'
                ? 'Acesso negado pelas políticas RLS.'
                : (error.message || 'Erro de consulta.');
            throw new Error(`Não foi possível carregar public.${table}: ${message}`);
        }
        return Array.isArray(data) ? data : [];
    }

    _mapRemoteEdition(row) {
        return {
            id: row.id,
            name: row.name || '',
            type: row.type || 'Encontro',
            city: row.city || '',
            state: row.state || '',
            country: row.country || 'Brasil',
            date: row.date || '',
            description: row.description || '',
            image: row.image || '',
            status: row.status || '',
            registrationType: row.registration_type || 'free',
            price: Number(row.price || 0),
            shirtPrice: Number(row.shirt_price || 0),
            shirtSizes: Array.isArray(row.shirt_sizes) ? row.shirt_sizes : [],
            createdAt: row.created_at || '',
            updatedAt: row.updated_at || ''
        };
    }

    _mapRemoteParticipant(row) {
        return {
            id: row.id,
            name: row.name || '',
            birthDate: row.birth_date || '',
            phone: row.phone || '',
            email: row.email || '',
            address: {
                city: row.city || '',
                state: row.state || '',
                street: row.street || '',
                neighborhood: row.neighborhood || ''
            },
            pastor: row.pastor || '',
            church: row.church || '',
            isVolunteer: Boolean(row.is_volunteer),
            volunteerAreas: Array.isArray(row.volunteer_areas) ? row.volunteer_areas : [],
            volunteerOtherDetails: row.volunteer_other_details || '',
            status: row.status || 'Ativo',
            createdAt: row.created_at || '',
            updatedAt: row.updated_at || ''
        };
    }

    _mapRemoteEnrollment(row, participant = null, edition = null) {
        return {
            id: row.id,
            editionId: row.edition_id || '',
            participantId: row.participant_id || '',
            participantName: row.participant_name || participant?.name || '',
            participantPhone: row.participant_phone || participant?.phone || '',
            participantEmail: row.participant_email || participant?.email || '',
            editionName: row.edition_name || edition?.name || '',
            registrationType: row.registration_type || edition?.registrationType || '',
            shirtSize: row.shirt_size || '',
            amount: Number(row.amount_paid ?? row.amount ?? 0),
            status: row.status || 'Pendente',
            paymentStatus: row.payment_status || (row.proof_url ? 'Comprovante Enviado' : 'Pendente'),
            proofFile: row.proof_url || '',
            proofFileName: row.proof_file_name || '',
            adminNotes: row.admin_notes || '',
            createdAt: row.created_at || '',
            updatedAt: row.updated_at || '',
            participant,
            edition
        };
    }

    _mapRemoteContribution(row) {
        return {
            id: row.id,
            donorName: row.donor_name || 'Doador Anônimo',
            email: row.donor_email || '',
            phone: row.donor_phone || '',
            amount: Number(row.amount || 0),
            intent: row.intent || '',
            notes: row.intent || '',
            date: row.created_at || '',
            createdAt: row.created_at || '',
            paymentMethod: row.payment_method || 'PIX',
            proofFile: row.proof_url || '',
            proofFileName: row.proof_file_name || '',
            status: row.status || ''
        };
    }

    _save(data) {
        if (this._hasRemoteDataSource()) return;
        throw new Error('Supabase não está configurado. A gravação local de dados foi desativada.');
    }

    /* ==========================================================================
       SEGURANÇA & VALIDAÇÃO DE PERMISSÕES NO BACKEND/API
       ========================================================================== */
    async getCurrentAdmin() {
        if (!this.supabase) {
            this._lastAdminAuthIssue = 'supabase_not_configured';
            return null;
        }
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (error || !user) {
                this._currentAdmin = null;
                this._lastAdminAuthEmail = null;
                this._lastAdminAuthIssue = error ? 'auth_verification_failed' : 'unauthenticated';
                return null;
            }
            this._lastAdminAuthEmail = user.email || null;
            const { data: profiles, error: profileError } = await this.supabase.rpc('jcp_get_current_admin_profile');
            if (profileError) {
                this._currentAdmin = null;
                this._lastAdminAuthIssue = 'profile_query_failed';
                console.error('[JCP Auth] Admin profile query failed:', profileError.code || profileError.name || 'unknown');
                return null;
            }
            const profile = Array.isArray(profiles) ? profiles[0] : null;
            if (!profile) {
                this._currentAdmin = null;
                this._lastAdminAuthIssue = 'profile_missing';
                return null;
            }
            if (profile.status !== 'Ativo') {
                this._currentAdmin = null;
                this._lastAdminAuthIssue = 'profile_inactive';
                return null;
            }
            this._currentAdmin = {
                id: user.id,
                name: profile.display_name,
                email: user.email,
                roleId: profile.role_id,
                avatar: profile.avatar || (profile.display_name || '').substring(0, 2).toUpperCase()
            };
            this._lastAdminAuthIssue = null;
            return this._currentAdmin;
        } catch (error) {
            this._currentAdmin = null;
            this._lastAdminAuthIssue = 'profile_check_failed';
            console.error('[JCP Auth] Admin profile check failed:', error?.name || 'unknown');
            return null;
        }
    }

    async getAdminRole(roleId) {
        const { data, error } = await this.supabase
            .from('jcp_admin_roles')
            .select('id, name, description, permissions')
            .eq('id', roleId)
            .maybeSingle();
        if (error) throw new Error(`Não foi possível carregar o perfil de acesso no Supabase: ${error.message}`);
        return data ? { ...data, isSystem: ['super_admin', 'coordenador', 'midia'].includes(data.id) } : null;
    }

    async hasPermission(permission) {
        if (!this.supabase || !(await this.getCurrentAdmin())) return false;
        const { data, error } = await this.supabase.rpc('jcp_has_permission', {
            requested_permission: permission
        });
        if (!error && data === true) return true;
        if (permission === 'testimonials:read') {
            return (await this.hasPermission('media:read')) || (await this.hasPermission('leaders:read'));
        }
        if (permission === 'testimonials:write') {
            return (await this.hasPermission('media:write')) || (await this.hasPermission('leaders:write'));
        }
        return false;
    }

    async _requirePermission(permission) {
        const ok = await this.hasPermission(permission);
        if (!ok) {
            const admin = await this.getCurrentAdmin();
            const roleName = admin ? admin.roleId : 'Não autenticado';
            throw new Error(`Acesso negado: Perfil "${roleName}" não possui permissão para "${permission}".`);
        }
    }

    async loginAdmin(email, password) {
        if (!this.supabase) throw new Error('Autenticação segura indisponível: configure o projeto Supabase.');
        const { error } = await this.supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(), password
        });
        if (error) {
            if (error.code === 'email_not_confirmed') {
                throw new Error('Confirme o endereço de e-mail pelo convite do Supabase antes de entrar.');
            }
            if (error.name === 'AuthRetryableFetchError' || !error.status) {
                throw new Error('Não foi possível conectar ao Supabase. Verifique a conexão e tente novamente.');
            }
            throw new Error('E-mail ou senha inválidos.');
        }
        const admin = await this.getCurrentAdmin();
        if (!admin) {
            await this.supabase.auth.signOut();
            const messages = {
                profile_query_failed: 'O login foi aceito, mas não foi possível consultar o perfil. Verifique a migração e as políticas RLS.',
                profile_missing: `O login foi aceito, mas não existe perfil administrativo vinculado à conta ${this._lastAdminAuthEmail || 'autenticada'}. Confira se esse é o e-mail provisionado e se o vínculo foi feito no mesmo projeto Supabase.`,
                profile_inactive: 'A conta administrativa está inativa. Ative o perfil no banco antes de entrar.',
                auth_verification_failed: 'O Supabase não conseguiu validar a sessão. Tente entrar novamente.'
            };
            throw new Error(messages[this._lastAdminAuthIssue] || 'Conta sem perfil administrativo ativo.');
        }
        return admin;
    }

    async logoutAdmin() {
        this._currentAdmin = null;
        if (this.supabase) await this.supabase.auth.signOut();
        sessionStorage.removeItem(JCP_SESSION_KEY);
        localStorage.removeItem(JCP_SESSION_KEY);
    }

    async loginParticipant(email, password) {
        if (!this.participantAuth) throw new Error('Autenticacao indisponivel: configure o Supabase.');
        const { data, error } = await this.participantAuth.auth.signInWithPassword({ email, password });
        if (error || !data?.user?.email) {
            if (error?.name === 'AuthRetryableFetchError' || !error?.status) {
                throw new Error('Nao foi possivel conectar ao servico de autenticacao. Tente novamente.');
            }
            throw new Error('E-mail ou senha incorretos. Se ainda nao criou a conta, use Novo Cadastro.');
        }
        return data.user;
    }

    async createParticipantAccount(email, password, participantData) {
        if (!this.participantAuth) throw new Error('Autenticacao indisponivel: configure o Supabase.');
        const siteUrl = window.JCP_SUPABASE_CONFIG?.siteUrl;
        if (!siteUrl) throw new Error('URL pública do site não configurada para confirmação de cadastro.');
        const redirectTo = new URL('index.html', `${siteUrl.replace(/\/+$/, '')}/`).href;
        const { data, error } = await this.participantAuth.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: redirectTo,
                data: { jcp_participant_profile: participantData }
            }
        });
        if (error) {
            if (error.name === 'AuthRetryableFetchError' || !error.status) {
                throw new Error('Nao foi possivel conectar ao servico de autenticacao. Tente novamente.');
            }
            if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
                throw new Error('Limite de e-mails de confirmacao atingido. Aguarde antes de tentar novamente.');
            }
            throw new Error('Nao foi possivel criar a conta. Confira o e-mail e tente novamente.');
        }

        if (data?.session) return { user: data.user, session: data.session };

        // An already-confirmed account can complete a participant profile from
        // the registration form after authenticating with its existing password.
        const existingLogin = await this.participantAuth.auth.signInWithPassword({ email, password });
        if (existingLogin.data?.session && existingLogin.data?.user?.email) {
            return { user: existingLogin.data.user, session: existingLogin.data.session };
        }

        if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
            throw new Error('Já existe uma conta com este e-mail. Entre pela aba Já sou cadastrado usando a senha da conta.');
        }
        return { user: data?.user || null, session: null, requiresEmailConfirmation: true };
    }

    async requestParticipantPasswordReset(email) {
        if (!this.participantAuth) throw new Error('Autenticacao indisponivel: configure o Supabase.');
        const siteUrl = window.JCP_SUPABASE_CONFIG?.siteUrl;
        if (!siteUrl) throw new Error('URL pública do site não configurada para recuperação de senha.');
        const redirectTo = new URL('index.html?participantRecovery=1', `${siteUrl.replace(/\/+$/, '')}/`).href;
        const { error } = await this.participantAuth.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
            if (error.status === 429) throw new Error('Limite de solicitações atingido. Aguarde e tente novamente.');
            throw new Error('Nao foi possivel solicitar a redefinicao de senha. Tente novamente.');
        }
    }

    async updateParticipantPassword(password) {
        if (!this.participantAuth) throw new Error('Autenticacao indisponivel: configure o Supabase.');
        const { data, error } = await this.participantAuth.auth.updateUser({ password });
        if (error || !data?.user) throw new Error('Nao foi possivel salvar a nova senha. Solicite outro link de recuperacao.');
        return data.user;
    }

    setPendingParticipantSignup(participant) {
        if (!participant?.email) throw new Error('Cadastro pendente sem e-mail.');
        this._pendingParticipantSignup = participant;
    }

    getPendingParticipantSignup() {
        return this._pendingParticipantSignup;
    }

    async completePendingParticipantSignup() {
        if (!this.participantAuth) throw new Error('Autenticacao indisponivel: configure o Supabase.');
        const { data, error } = await this.participantAuth.auth.getUser();
        const user = data?.user;
        const authEmail = user?.email;
        if (error || !authEmail) return null;
        const participantData = this.getPendingParticipantSignup() || user.user_metadata?.jcp_participant_profile;
        if (!participantData) {
            const existing = await this.getParticipantByEmail(authEmail);
            if (existing) this.setCurrentParticipant(existing);
            return existing;
        }
        if (this._normalizeParticipantEmail(authEmail) !== this._normalizeParticipantEmail(participantData.email)) {
            throw new Error('O e-mail autenticado nao corresponde ao cadastro pendente.');
        }

        const participant = await this.registerParticipant(participantData);
        this._pendingParticipantSignup = null;
        const { error: metadataError } = await this.participantAuth.auth.updateUser({
            data: { jcp_participant_profile: null }
        });
        if (metadataError) console.error('Não foi possível limpar os metadados temporários do cadastro:', metadataError.message);
        return participant;
    }

    async logoutParticipant() {
        this.setCurrentParticipant(null);
        if (this.participantAuth) await this.participantAuth.auth.signOut();
    }

    async restoreParticipantSession() {
        if (!this.participantAuth) {
            this.setCurrentParticipant(null);
            return null;
        }

        const { data, error } = await this.participantAuth.auth.getUser();
        const authEmail = data?.user?.email;
        if (error || !authEmail) {
            this.setCurrentParticipant(null);
            return null;
        }
        const participant = await this.completePendingParticipantSignup();
        if (!participant) {
            const isPasswordRecovery = new URLSearchParams(window.location.search).get('participantRecovery') === '1';
            if (!isPasswordRecovery) {
                await this.participantAuth.auth.signOut();
            }
            return null;
        }
        if (this._normalizeParticipantEmail(authEmail) !== this._normalizeParticipantEmail(participant.email)) {
            this.setCurrentParticipant(null);
            await this.participantAuth.auth.signOut();
            return null;
        }
        this.setCurrentParticipant(participant);
        return participant;
    }

    /* ==========================================================================
       AUDITORIA & LOGS GLOBAIS
       ========================================================================== */
    async addAuditLog(action, affectedRecord, details = '') {
        const currentAdmin = await this.getCurrentAdmin();
        const currentParticipant = this.getCurrentParticipant();

        let userId = 'SISTEMA';
        let userName = 'Sistema';
        let userRole = 'Sistema';

        if (currentAdmin) {
            userId = currentAdmin.id;
            userName = currentAdmin.name;
            userRole = currentAdmin.roleId === 'super_admin' ? 'Super Admin' : (currentAdmin.roleId === 'coordenador' ? 'Coordenador' : 'Mídia');
        } else if (currentParticipant) {
            userId = currentParticipant.id;
            userName = currentParticipant.name;
            userRole = currentParticipant.isVolunteer ? 'Voluntário' : 'Participante';
        }

        const now = new Date();
        const logItem = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            timestamp: now.toISOString(),
            formattedDate: now.toLocaleDateString('pt-BR'),
            formattedTime: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            userId,
            userName,
            userRole,
            action,
            affectedRecord: affectedRecord || 'Sistema',
            details: typeof details === 'object' ? JSON.stringify(details) : String(details)
        };

        if (currentAdmin || currentParticipant) {
            const client = currentAdmin ? this.supabase : this.participantAuth;
            const { error } = await client.from('jcp_audit_logs').insert({
                id: logItem.id,
                actor_id: userId,
                actor_name: userName,
                actor_role: userRole,
                action: logItem.action,
                affected_record: logItem.affectedRecord,
                details: logItem.details,
                created_at: logItem.timestamp
            });
            if (error) throw new Error(`Não foi possível registrar a auditoria no Supabase: ${error.message}`);
        }
        return logItem;
    }

    async getLogs(filter = {}) {
        await this._delay();
        await this._requirePermission('logs:read');
        const rows = await this._selectRemoteRows('jcp_audit_logs');
        let logs = rows.map(row => ({
            id: row.id,
            userId: row.actor_id || '',
            userName: row.actor_name || '',
            userRole: row.actor_role || '',
            action: row.action || '',
            affectedRecord: row.affected_record || '',
            details: row.details || '',
            timestamp: row.created_at || ''
        }));

        if (filter.action) {
            logs = logs.filter(l => l.action.toLowerCase().includes(filter.action.toLowerCase()));
        }
        if (filter.search) {
            const s = filter.search.toLowerCase();
            logs = logs.filter(l =>
                l.userName.toLowerCase().includes(s) ||
                l.action.toLowerCase().includes(s) ||
                l.affectedRecord.toLowerCase().includes(s) ||
                (l.details && l.details.toLowerCase().includes(s))
            );
        }
        return logs;
    }

    /* ==========================================================================
       1. EDIÇÕES (CRUD COMPLETO)
       ========================================================================== */
    async getEditions(filter = {}) {
        await this._delay();
        const remoteRows = await this._selectRemoteRows('editions');
        let editions = remoteRows.map(row => this._mapRemoteEdition(row));

        if (filter.status) {
            editions = editions.filter(e => e.status === filter.status);
        }
        if (filter.type) {
            editions = editions.filter(e => e.type === filter.type);
        }
        if (filter.search) {
            const s = filter.search.toLowerCase();
            editions = editions.filter(e =>
                e.name.toLowerCase().includes(s) ||
                e.city.toLowerCase().includes(s) ||
                e.state.toLowerCase().includes(s)
            );
        }
        return editions;
    }

    async getEditionById(id) {
        const editions = await this.getEditions();
        return editions.find(edition => edition.id === id) || null;
    }

    async addEdition(editionData) {
        await this._delay();
        await this._requirePermission('editions:write');
        const db = this._read();

        const newEdition = {
            id: 'ed_' + Date.now(),
            name: editionData.name.trim(),
            type: editionData.type || 'Encontro',
            city: editionData.city.trim(),
            state: editionData.state.trim().toUpperCase(),
            country: editionData.country ? editionData.country.trim() : 'Brasil',
            date: editionData.date.trim(),
            description: editionData.description ? editionData.description.trim() : '',
            image: editionData.image || 'assets/images/noite_clamor.jpg',
            status: editionData.status || 'Planejamento',
            registrationType: editionData.registrationType || 'free',
            price: Number(editionData.price) || 0,
            shirtPrice: Number(editionData.shirtPrice) || 0,
            shirtSizes: Array.isArray(editionData.shirtSizes) ? editionData.shirtSizes : (editionData.shirtSizes ? editionData.shirtSizes.split(',').map(s => s.trim()) : []),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('editions').insert({
                id: newEdition.id,
                name: newEdition.name,
                type: newEdition.type,
                city: newEdition.city,
                state: newEdition.state,
                country: newEdition.country,
                date: newEdition.date,
                description: newEdition.description,
                image: newEdition.image,
                status: newEdition.status,
                registration_type: newEdition.registrationType,
                price: newEdition.price,
                shirt_price: newEdition.shirtPrice,
                shirt_sizes: newEdition.shirtSizes,
                created_at: newEdition.createdAt,
                updated_at: newEdition.updatedAt
            });
            if (error) throw new Error(`Não foi possível salvar a edição no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        db.editions = db.editions || [];
        db.editions.unshift(newEdition);
        this._save(db);

        await this.addAuditLog('EDIÇÃO_CRIADA', newEdition.name, `Edição criada com status: ${newEdition.status} e tipo de inscrição: ${newEdition.registrationType}`);
        return newEdition;
    }

    async updateEdition(id, patch) {
        await this._delay();
        await this._requirePermission('editions:write');
        const db = this._read();
        const idx = (db.editions || []).findIndex(e => e.id === id);
        const old = idx !== -1 ? db.editions[idx] : await this.getEditionById(id);
        if (!old) throw new Error('Edição não encontrada.');

        const updated = {
            ...old,
            ...patch,
            updatedAt: new Date().toISOString()
        };

        if (patch.price !== undefined) updated.price = Number(patch.price) || 0;
        if (patch.shirtPrice !== undefined) updated.shirtPrice = Number(patch.shirtPrice) || 0;
        if (patch.shirtSizes !== undefined && !Array.isArray(patch.shirtSizes)) {
            updated.shirtSizes = patch.shirtSizes ? patch.shirtSizes.split(',').map(s => s.trim()) : [];
        }

        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('editions').upsert({
                id: updated.id,
                name: updated.name,
                type: updated.type,
                city: updated.city,
                state: updated.state,
                country: updated.country || 'Brasil',
                date: updated.date,
                description: updated.description || '',
                image: updated.image || 'assets/images/noite_clamor.jpg',
                status: updated.status,
                registration_type: updated.registrationType || 'free',
                price: Number(updated.price) || 0,
                shirt_price: Number(updated.shirtPrice) || 0,
                shirt_sizes: Array.isArray(updated.shirtSizes) ? updated.shirtSizes : [],
                created_at: updated.createdAt || new Date().toISOString(),
                updated_at: updated.updatedAt
            }, { onConflict: 'id' });
            if (error) throw new Error(`Não foi possível atualizar a edição no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        db.editions = db.editions || [];
        if (idx !== -1) {
            db.editions[idx] = updated;
        } else {
            db.editions.unshift(updated);
        }
        this._save(db);

        await this.addAuditLog('EDIÇÃO_ATUALIZADA', updated.name, `Campos modificados: ${Object.keys(patch).join(', ')}`);
        return updated;
    }

    async deleteEdition(id) {
        await this._delay();
        await this._requirePermission('editions:write');
        const target = await this.getEditionById(id);
        if (!target) throw new Error('Edição não encontrada.');

        const { error: actionError } = await this.supabase.from('actions').delete().eq('edition_id', id);
        if (actionError) throw new Error(`Não foi possível excluir as ações vinculadas no Supabase: ${actionError.message}`);
        const { error: enrollmentError } = await this.supabase.from('enrollments').delete().eq('edition_id', id);
        if (enrollmentError) throw new Error(`Não foi possível excluir as inscrições vinculadas no Supabase: ${enrollmentError.message}`);
        const { error } = await this.supabase.from('editions').delete().eq('id', id);
        if (error) throw new Error(`Não foi possível excluir a edição no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        await this.addAuditLog('EDIÇÃO_EXCLUÍDA', target.name, `Edição e todas as suas ações e inscrições foram excluídas`);
        return true;
    }

    /* Compatibilidade com código legado que chamava getEvents/addEvent/deleteEvent */
    async getEvents() { return this.getEditions(); }
    async addEvent(ev) { return this.addEdition(ev); }
    async deleteEvent(id) { return this.deleteEdition(id); }

    /* ==========================================================================
       2. AÇÕES VINCULADAS ÀS EDIÇÕES
       ========================================================================== */
    async getActions(editionId = null) {
        await this._delay();
        const remoteRows = await this._selectRemoteRows('actions');
        let actions = remoteRows.map(row => ({
            id: row.id,
            editionId: row.edition_id || '',
            title: row.title || '',
            date: row.date || '',
            time: row.time || '',
            location: row.location || '',
            leader: row.leader || '',
            description: row.description || '',
            status: row.status || '',
            createdAt: row.created_at || ''
        }));
        if (editionId) {
            actions = actions.filter(a => a.editionId === editionId);
        }
        return actions;
    }

    async addAction(actionData) {
        await this._delay();
        await this._requirePermission('actions:write');
        const db = this._read();

        const edition = (db.editions || []).find(e => e.id === actionData.editionId) || await this.getEditionById(actionData.editionId);
        if (!edition) throw new Error('A edição vinculada não existe.');

        const newAction = {
            id: 'act_' + Date.now(),
            editionId: actionData.editionId,
            title: actionData.title.trim(),
            date: actionData.date ? actionData.date.trim() : '',
            time: actionData.time ? actionData.time.trim() : '',
            location: actionData.location ? actionData.location.trim() : '',
            leader: actionData.leader ? actionData.leader.trim() : '',
            description: actionData.description ? actionData.description.trim() : '',
            status: actionData.status || 'Planejada',
            createdAt: new Date().toISOString()
        };

        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('actions').insert({
                id: newAction.id,
                edition_id: newAction.editionId,
                title: newAction.title,
                date: newAction.date,
                time: newAction.time,
                location: newAction.location,
                leader: newAction.leader,
                description: newAction.description,
                status: newAction.status,
                created_at: newAction.createdAt
            });
            if (error) throw new Error(`Não foi possível salvar a ação no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        db.actions = db.actions || [];
        db.actions.push(newAction);
        this._save(db);

        await this.addAuditLog('AÇÃO_CRIADA', `${newAction.title} (${edition.name})`, `Nova ação missionária cadastrada na edição`);
        return newAction;
    }

    async updateAction(id, patch) {
        await this._delay();
        await this._requirePermission('actions:write');
        const db = this._read();
        const idx = (db.actions || []).findIndex(a => a.id === id);
        let existing = idx !== -1 ? db.actions[idx] : null;
        if (!existing) {
            const allActions = await this.getActions();
            existing = allActions.find(a => a.id === id) || null;
        }
        if (!existing) throw new Error('Ação não encontrada.');

        const updated = { ...existing, ...patch };

        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('actions').upsert({
                id: updated.id,
                edition_id: updated.editionId,
                title: updated.title,
                date: updated.date || '',
                time: updated.time || '',
                location: updated.location || '',
                leader: updated.leader || '',
                description: updated.description || '',
                status: updated.status || 'Planejada',
                created_at: updated.createdAt || new Date().toISOString()
            }, { onConflict: 'id' });
            if (error) throw new Error(`Não foi possível atualizar a ação no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        db.actions = db.actions || [];
        if (idx !== -1) {
            db.actions[idx] = updated;
        } else {
            db.actions.push(updated);
        }
        this._save(db);

        await this.addAuditLog('AÇÃO_ATUALIZADA', updated.title, `Ação missionária atualizada`);
        return updated;
    }

    async deleteAction(id) {
        await this._delay();
        await this._requirePermission('actions:write');
        const db = this._read();
        let action = (db.actions || []).find(a => a.id === id);
        if (!action) {
            const allActions = await this.getActions();
            action = allActions.find(a => a.id === id);
        }
        if (!action) return false;

        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('actions').delete().eq('id', id);
            if (error) throw new Error(`Não foi possível excluir a ação no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        db.actions = (db.actions || []).filter(a => a.id !== id);
        this._save(db);

        await this.addAuditLog('AÇÃO_EXCLUÍDA', action.title, `Ação missionária removida da edição`);
        return true;
    }

    /* ==========================================================================
       3. PARTICIPANTES & VOLUNTÁRIOS
       ========================================================================== */
    getCurrentParticipant() {
        return this._currentParticipant;
    }

    setCurrentParticipant(participant) {
        this._currentParticipant = participant || null;
        sessionStorage.removeItem(JCP_PARTICIPANT_SESSION_KEY);
        localStorage.removeItem(JCP_PARTICIPANT_SESSION_KEY);
    }

    async getParticipants(filter = {}) {
        await this._delay();
        const admin = await this.getCurrentAdmin();
        let client = this.supabase;
        let participantEmail = '';
        if (admin) {
            await this._requirePermission('volunteers:read');
        } else {
            const { data: authData, error: authError } = await this.participantAuth.auth.getUser();
            const email = authData?.user?.email;
            if (authError || !email) return [];
            client = this.participantAuth;
            participantEmail = email;
        }
        let query = client.from('participants').select('*');
        if (participantEmail) query = query.eq('email', participantEmail);
        const { data, error } = await query;
        if (error) throw new Error(`Não foi possível carregar participantes do Supabase: ${error.message}`);
        let participants = (data || []).map(row => this._mapRemoteParticipant(row));

        if (filter.isVolunteer !== undefined) {
            participants = participants.filter(p => p.isVolunteer === filter.isVolunteer);
        }
        if (filter.status) {
            participants = participants.filter(p => p.status === filter.status);
        }
        if (filter.search) {
            const s = filter.search.toLowerCase();
            participants = participants.filter(p =>
                p.name.toLowerCase().includes(s) ||
                p.phone.includes(s) ||
                p.email.toLowerCase().includes(s) ||
                (p.church && p.church.toLowerCase().includes(s))
            );
        }
        return participants;
    }

    async getVolunteers(filter = {}) {
        return this.getParticipants({ ...filter, isVolunteer: true });
    }

    async getParticipantByPhone(phone) {
        const cleanPhone = this._normalizeBrazilPhone(phone);
        return (await this.getParticipants()).find(p => this._normalizeBrazilPhone(p.phone) === cleanPhone) || null;
    }

    _normalizeBrazilPhone(phone) {
        const digits = String(phone || '').replace(/\D/g, '');
        return digits.startsWith('55') && (digits.length === 12 || digits.length === 13)
            ? digits.slice(2)
            : digits;
    }

    async getParticipantByEmail(email) {
        const normalizedEmail = this._normalizeParticipantEmail(email);
        const matches = (await this.getParticipants()).filter(p => this._normalizeParticipantEmail(p.email) === normalizedEmail);
        return matches.length === 1 ? matches[0] : null;
    }

    _normalizeParticipantEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    async registerParticipant(data) {
        await this._delay();
        const cleanPhone = (data.phone || '').trim();
        const cleanEmail = (data.email || '').trim().toLowerCase();
        if (!this.participantAuth) throw new Error('Autenticação de participante não está configurada.');
        const { data: authData, error: authError } = await this.participantAuth.auth.getUser();
        if (authError || this._normalizeParticipantEmail(authData?.user?.email) !== cleanEmail) {
            throw new Error('Entre com a conta do participante antes de salvar o cadastro.');
        }
        const existing = await this.getParticipantByEmail(cleanEmail);
        const targetParticipant = {
            ...(existing || {}),
            id: existing?.id || `part_${authData.user.id}`,
            name: data.name.trim(),
            birthDate: data.birthDate || existing?.birthDate || '',
            phone: cleanPhone || existing?.phone || '',
            email: cleanEmail,
            address: data.address || existing?.address || { street: '', number: '', neighborhood: '', city: '', state: '' },
            pastor: data.pastor || existing?.pastor || '',
            church: data.church || existing?.church || '',
            isVolunteer: data.isVolunteer !== undefined ? Boolean(data.isVolunteer) : Boolean(existing?.isVolunteer),
            volunteerAreas: data.volunteerAreas || existing?.volunteerAreas || [],
            volunteerOtherDetails: data.volunteerOtherDetails !== undefined ? data.volunteerOtherDetails : (existing?.volunteerOtherDetails || ''),
            status: existing?.status || 'Ativo',
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const addr = targetParticipant.address || {};
        const { data: saved, error } = await this.participantAuth.from('participants').upsert({
            id: targetParticipant.id,
            name: targetParticipant.name,
            birth_date: targetParticipant.birthDate || null,
            phone: targetParticipant.phone,
            email: targetParticipant.email,
            city: addr.city || '',
            state: addr.state || '',
            street: addr.street || '',
            neighborhood: addr.neighborhood || '',
            pastor: targetParticipant.pastor || '',
            church: targetParticipant.church || '',
            is_volunteer: Boolean(targetParticipant.isVolunteer),
            volunteer_areas: Array.isArray(targetParticipant.volunteerAreas) ? targetParticipant.volunteerAreas : [],
            volunteer_other_details: targetParticipant.volunteerOtherDetails || '',
            status: targetParticipant.status,
            created_at: targetParticipant.createdAt,
            updated_at: targetParticipant.updatedAt
        }, { onConflict: 'id' }).select('*').single();
        if (error) throw new Error(`Não foi possível salvar o cadastro no Supabase: ${error.message}`);
        const participant = this._mapRemoteParticipant(saved);
        this.setCurrentParticipant(participant);

        const logAction = existing ? 'CADASTRO_ATUALIZADO' : (participant.isVolunteer ? 'CADASTRO_VOLUNTÁRIO' : 'CADASTRO_PARTICIPANTE');
        await this.addAuditLog(logAction, participant.name, 'Cadastro de participante salvo no Supabase.');
        return participant;
    }

    async updateParticipant(id, patch) {
        await this._delay();
        await this._requirePermission('volunteers:write');
        const db = this._read();
        const idx = (db.participants || []).findIndex(p => p.id === id);
        let existing = idx !== -1 ? db.participants[idx] : null;
        if (!existing) {
            const allParts = await this.getParticipants();
            existing = allParts.find(p => p.id === id) || null;
        }
        if (!existing) throw new Error('Participante não encontrado.');

        const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };

        if (this._hasRemoteDataSource()) {
            const addr = updated.address || {};
            const { error } = await this.supabase.from('participants').upsert({
                id: updated.id,
                name: updated.name,
                birth_date: updated.birthDate || null,
                phone: updated.phone || '',
                email: updated.email || '',
                city: addr.city || '',
                state: addr.state || '',
                street: addr.street || '',
                neighborhood: addr.neighborhood || '',
                pastor: updated.pastor || '',
                church: updated.church || '',
                is_volunteer: Boolean(updated.isVolunteer),
                volunteer_areas: Array.isArray(updated.volunteerAreas) ? updated.volunteerAreas : [],
                volunteer_other_details: updated.volunteerOtherDetails || '',
                status: updated.status || 'Ativo',
                created_at: updated.createdAt || new Date().toISOString(),
                updated_at: updated.updatedAt
            }, { onConflict: 'id' });
            if (error) throw new Error(`Não foi possível atualizar o participante no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        db.participants = db.participants || [];
        if (idx !== -1) {
            db.participants[idx] = updated;
        } else {
            db.participants.unshift(updated);
        }
        this._save(db);

        await this.addAuditLog('PARTICIPANTE_ATUALIZADO', updated.name, `Registro de participante/voluntário alterado`);
        return updated;
    }

    async deleteParticipant(id) {
        await this._delay();
        await this._requirePermission('volunteers:write');
        const part = (await this.getParticipants()).find(p => p.id === id);
        if (!part) return false;

        const { error: enrollmentError } = await this.supabase.from('enrollments').delete().eq('participant_id', id);
        if (enrollmentError) throw new Error(`Não foi possível excluir as inscrições vinculadas no Supabase: ${enrollmentError.message}`);
        const { error } = await this.supabase.from('participants').delete().eq('id', id);
        if (error) throw new Error(`Não foi possível excluir o participante no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        await this.addAuditLog('PARTICIPANTE_EXCLUÍDO', part.name, `Participante e suas inscrições foram removidos`);
        return true;
    }

    /* Compatibilidade para voluntários no admin antigo */
    async getMembers() {
        const parts = await this.getParticipants();
        return parts.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            city: typeof p.address === 'object' ? `${p.address.city || ''} – ${p.address.state || ''}` : (p.address || ''),
            date: p.createdAt ? p.createdAt.split('T')[0] : '',
            status: p.status || 'Ativo',
            isVolunteer: p.isVolunteer,
            volunteerAreas: p.volunteerAreas || []
        }));
    }
    async addMember(m) {
        return this.registerParticipant({
            name: m.name,
            email: m.email,
            phone: m.phone || '(83) 99999-0000',
            address: { city: m.city || 'Patos', state: 'PB' },
            isVolunteer: true,
            volunteerAreas: ['Apoio']
        });
    }
    async deleteMember(id) {
        return this.deleteParticipant(id);
    }

    /* ==========================================================================
       4. INSCRIÇÕES (ENROLLMENTS) & COMPROVANTES
       ========================================================================== */
    async getEnrollments(filter = {}) {
        await this._delay();
        const isAdmin = this._hasRemoteDataSource() && await this.getCurrentAdmin();
        if (isAdmin) await this._requirePermission('enrollments:read');
        if (!isAdmin) {
            const { data: authData, error: authError } = await this.participantAuth.auth.getUser();
            if (authError || !authData?.user?.email) return [];
        }
        const remoteRows = await this._selectRemoteRows(
            'enrollments',
            isAdmin ? this.supabase : this.participantAuth
        );
        const editions = await this.getEditions();
        let enrollments = remoteRows.map(row => {
            const participant = row.participant_name || row.participant_phone || row.participant_email
                ? { id: row.participant_id || '', name: row.participant_name || '', phone: row.participant_phone || '', email: row.participant_email || '' }
                : null;
            const edition = editions.find(item => item.id === row.edition_id)
                || (row.edition_name ? { id: row.edition_id || '', name: row.edition_name } : null);
            return this._mapRemoteEnrollment(row, participant, edition);
        });
        if (filter.editionId) enrollments = enrollments.filter(item => item.editionId === filter.editionId);
        if (filter.participantId) enrollments = enrollments.filter(item => item.participantId === filter.participantId);
        if (filter.status) enrollments = enrollments.filter(item => item.status === filter.status);
        if (filter.paymentStatus) enrollments = enrollments.filter(item => item.paymentStatus === filter.paymentStatus);
        return enrollments;
    }

    async createEnrollment(data) {
        await this._delay();

        const edition = await this.getEditionById(data.editionId);
        if (!edition) throw new Error('Edição selecionada não foi encontrada.');

        let participant = null;
        if (data.participantId) {
            participant = this.getCurrentParticipant();
            if (!participant || participant.id !== data.participantId) {
                participant = await this.getParticipantByEmail((await this.participantAuth.auth.getUser()).data?.user?.email);
            }
        } else if (data.participantData) {
            participant = await this.registerParticipant(data.participantData);
        }

        if (!participant) throw new Error('Dados do participante inválidos.');
        const { data: authData, error: authError } = await this.participantAuth.auth.getUser();
        if (authError || this._normalizeParticipantEmail(authData?.user?.email) !== this._normalizeParticipantEmail(participant.email)) {
            throw new Error('Entre com a conta do participante antes de realizar a inscrição.');
        }

        const existing = (await this.getEnrollments({ editionId: edition.id, participantId: participant.id }))
            .find(en => en.status !== 'Cancelada');
        if (existing) {
            throw new Error(`O participante ${participant.name} já possui uma inscrição ativa nesta edição.`);
        }

        // Validação da Inscrição com Camisa
        if (edition.registrationType === 'shirt') {
            if (!data.shirtSize) {
                throw new Error('É obrigatório selecionar o tamanho da camisa.');
            }
            if (!data.proofFile) {
                throw new Error('O comprovante de pagamento é obrigatório para inscrição com camisa.');
            }
        }

        // Validação da Inscrição com Taxa
        if (edition.registrationType === 'paid') {
            if (!data.proofFile) {
                throw new Error('O comprovante de pagamento da taxa é obrigatório.');
            }
        }

        const isPaid = edition.registrationType === 'paid' || edition.registrationType === 'shirt';
        const amount = edition.registrationType === 'shirt' ? (edition.shirtPrice || 45) : (edition.registrationType === 'paid' ? (edition.price || 0) : 0);

        const newEnrollment = {
            id: 'enr_' + Date.now(),
            editionId: edition.id,
            participantId: participant.id,
            registrationType: edition.registrationType,
            shirtSize: data.shirtSize || '',
            amount,
            status: isPaid ? 'Pendente' : 'Confirmada',
            paymentStatus: isPaid ? 'Comprovante Enviado' : 'Isento',
            proofFile: data.proofFile || '',
            proofFileName: data.proofFileName || (data.proofFile ? 'comprovante_pagamento.png' : ''),
            adminNotes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const { error } = await this.participantAuth.from('enrollments').insert({
            id: newEnrollment.id,
            edition_id: edition.id,
            edition_name: edition.name,
            participant_id: participant.id,
            participant_name: participant.name,
            participant_phone: participant.phone,
            participant_email: participant.email,
            registration_type: newEnrollment.registrationType,
            shirt_size: newEnrollment.shirtSize,
            amount_paid: newEnrollment.amount,
            status: newEnrollment.status,
            payment_status: newEnrollment.paymentStatus,
            proof_url: newEnrollment.proofFile,
            proof_file_name: newEnrollment.proofFileName,
            admin_notes: '',
            created_at: newEnrollment.createdAt,
            updated_at: newEnrollment.updatedAt
        });
        if (error) throw new Error(`Não foi possível salvar a inscrição no Supabase: ${error.message}`);

        await this.addAuditLog(
            'INSCRIÇÃO_REALIZADA',
            `${participant.name} — ${edition.name}`,
            `Inscrição criada. Tipo: ${edition.registrationType}${newEnrollment.shirtSize ? ', Camisa: ' + newEnrollment.shirtSize : ''}, Valor: R$ ${amount.toFixed(2)}`
        );

        return {
            ...newEnrollment,
            participant,
            edition
        };
    }

    async updateEnrollmentStatus(id, newStatus, paymentStatus, adminNotes = '') {
        await this._delay();
        await this._requirePermission('enrollments:write');
        const db = this._read();
        const idx = (db.enrollments || []).findIndex(e => e.id === id);
        let en = idx !== -1 ? db.enrollments[idx] : null;
        if (!en) {
            const allEn = await this.getEnrollments();
            en = allEn.find(e => e.id === id) || null;
        }
        if (!en) throw new Error('Inscrição não encontrada.');

        en.status = newStatus || en.status;
        if (paymentStatus) en.paymentStatus = paymentStatus;
        if (adminNotes) en.adminNotes = adminNotes;
        en.updatedAt = new Date().toISOString();

        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('enrollments').update({
                status: en.status,
                payment_status: en.paymentStatus,
                admin_notes: en.adminNotes || '',
                updated_at: en.updatedAt
            }).eq('id', id);
            if (error) throw new Error(`Não foi possível atualizar a inscrição no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        db.enrollments = db.enrollments || [];
        if (idx !== -1) {
            db.enrollments[idx] = en;
        } else {
            db.enrollments.unshift(en);
        }
        this._save(db);

        const participant = (db.participants || []).find(p => p.id === en.participantId) || en.participant;
        const pName = participant ? participant.name : (en.participantName || 'Participante');

        await this.addAuditLog(
            'INSCRIÇÃO_ATUALIZADA',
            `Inscrição #${id} (${pName})`,
            `Status alterado para "${en.status}", Pagamento: "${en.paymentStatus}". ${adminNotes ? 'Obs: ' + adminNotes : ''}`
        );

        return en;
    }

    async deleteEnrollment(id) {
        await this._delay();
        await this._requirePermission('enrollments:write');
        const db = this._read();
        let en = (db.enrollments || []).find(e => e.id === id);
        if (!en) {
            const allEn = await this.getEnrollments();
            en = allEn.find(e => e.id === id);
        }
        if (!en) return false;

        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('enrollments').delete().eq('id', id);
            if (error) throw new Error(`Não foi possível excluir a inscrição no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        db.enrollments = (db.enrollments || []).filter(e => e.id !== id);
        this._save(db);

        await this.addAuditLog('INSCRIÇÃO_EXCLUÍDA', `Inscrição #${id}`, `Inscrição cancelada e excluída pelo administrador`);
        return true;
    }

    /* ==========================================================================
       5. ADMINISTRADORES & PERMISSÕES
       ========================================================================== */
    async getAdmins() {
        await this._delay();
        await this._requirePermission('users:manage');
        const result = await this._invokeAdminManagement('list');
        return result.admins || [];
    }

    async getRoles() {
        await this._delay();
        await this._requirePermission('users:manage');
        if (!this.supabase) throw new Error('Supabase não está configurado.');
        const { data, error } = await this.supabase
            .from('jcp_admin_roles')
            .select('id, name, description, permissions')
            .order('name');
        if (error) throw new Error('Não foi possível carregar os perfis de acesso no Supabase.');
        return (data || []).map(role => ({ ...role, isSystem: ['super_admin', 'coordenador', 'midia'].includes(role.id) }));
    }

    async addAdmin(data) {
        await this._delay();
        await this._requirePermission('users:manage');
        const siteUrl = window.JCP_SUPABASE_CONFIG?.siteUrl;
        if (!siteUrl) throw new Error('URL pública do site não configurada para envio de convites.');
        const result = await this._invokeAdminManagement('invite', {
            name: data.name,
            email: data.email,
            roleId: data.roleId,
            status: data.status || 'Ativo',
            redirectTo: new URL('admin.html', `${siteUrl.replace(/\/+$/, '')}/`).href
        });
        await this.addAuditLog('ADMIN_CONVIDADO', result.admin?.name || data.name, `Convite administrativo enviado com perfil: ${data.roleId}`);
        return { ...result.admin, invited: result.invited === true };
    }

    async updateAdmin(id, patch) {
        await this._delay();
        await this._requirePermission('users:manage');
        const result = await this._invokeAdminManagement('set-status', { userId: id, status: patch.status });
        await this.addAuditLog('ADMIN_STATUS_ATUALIZADO', result.admin?.display_name || id, `Status atualizado para ${patch.status}`);
        return result.admin;
    }

    async deleteAdmin(id) {
        await this._delay();
        await this._requirePermission('users:manage');
        throw new Error('Contas Auth não são excluídas pelo painel. Inative o perfil para remover o acesso.');
    }

    async addRole(roleData) {
        await this._delay();
        await this._requirePermission('users:manage');
        if (!this.supabase) throw new Error('Supabase não está configurado.');
        const name = String(roleData.name || '').trim();
        if (name.length < 2 || name.length > 80) throw new Error('Informe um nome de perfil entre 2 e 80 caracteres.');
        const id = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64);
        const allowedPermissions = new Set([
            'dashboard:read', 'editions:read', 'editions:write', 'actions:read', 'actions:write',
            'volunteers:read', 'volunteers:write', 'enrollments:read', 'enrollments:write',
            'contributions:read', 'leaders:read', 'leaders:write', 'media:read', 'media:write',
            'content:read', 'content:write', 'logs:read', 'settings:write', 'users:manage'
        ]);
        const permissions = [...new Set((Array.isArray(roleData.permissions) ? roleData.permissions : [])
            .filter(permission => allowedPermissions.has(permission)))];
        const { data: role, error } = await this.supabase
            .from('jcp_admin_roles')
            .insert({ id, name, description: String(roleData.description || '').trim().slice(0, 500), permissions })
            .select('id, name, description, permissions')
            .single();
        if (error) throw new Error(error.code === '23505' ? 'Já existe um perfil com este nome.' : 'Não foi possível criar o perfil no Supabase.');
        const newRole = { ...role, isSystem: false };
        await this.addAuditLog('PERFIL_CRIADO', name, 'Novo perfil de permissões criado no Supabase');
        return newRole;
    }

    async _invokeAdminManagement(action, payload = {}) {
        if (!this.supabase) throw new Error('Supabase não está configurado.');
        const { data, error } = await this.supabase.functions.invoke('jcp-admin-management', {
            body: { action, ...payload }
        });
        if (error) {
            let detail = '';
            try { detail = (await error.context?.json())?.error || ''; } catch { /* gateway response may not be JSON */ }
            throw new Error(detail || 'A Edge Function de gestão não está disponível. Confira o deploy e os secrets do projeto de teste.');
        }
        if (data?.error) throw new Error(data.error);
        return data || {};
    }
    /* ==========================================================================
       6. CONFIGURAÃ‡Ã•ES GLOBAIS
       ========================================================================== */
    async getSettings() {
        await this._delay();
        const remoteRows = await this._selectRemoteRows('settings');
        const row = remoteRows[0];
        if (!row) return {};
        return {
            id: row.id,
            pixKey: row.pix_key || '',
            pixKeyType: row.pix_key_type || '',
            pixBeneficiary: row.pix_beneficiary || '',
            pixBank: row.pix_bank || '',
            pixCity: row.pix_city || '',
            pixNotice: row.pix_notice || '',
            contactEmail: row.contact_email || '',
            contactPhone: row.contact_phone || '',
            instagram: row.instagram || '',
            updatedAt: row.updated_at || ''
        };
    }

    async updateSettings(patch) {
        await this._delay();
        await this._requirePermission('settings:write');
        const currentRemote = await this.getSettings();

        const oldSettings = currentRemote || {};
        const updatedSettings = {
            ...oldSettings,
            ...patch,
            id: oldSettings.id || 'global_settings',
            updatedAt: new Date().toISOString()
        };

        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('settings').upsert({
                id: updatedSettings.id,
                pix_key: updatedSettings.pixKey || '',
                pix_key_type: updatedSettings.pixKeyType || 'E-mail',
                pix_beneficiary: updatedSettings.pixBeneficiary || '',
                pix_bank: updatedSettings.pixBank || '',
                pix_city: updatedSettings.pixCity || '',
                pix_notice: updatedSettings.pixNotice || '',
                contact_email: updatedSettings.contactEmail || '',
                contact_phone: updatedSettings.contactPhone || '',
                instagram: updatedSettings.instagram || '',
                updated_at: updatedSettings.updatedAt
            }, { onConflict: 'id' });
            if (error) throw new Error(`Não foi possível atualizar as configurações no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }

        await this.addAuditLog(
            'CONFIG_ATUALIZADA',
            'Configurações Globais',
            `Configurações do sistema atualizadas: ${Object.keys(patch).join(', ')}`
        );
        return updatedSettings;
    }

    /* ==========================================================================
       7. CONTRIBUIÇÕES VOLUNTÁRIAS
       ========================================================================== */
    async getContributions() {
        await this._delay();
        if (this._hasRemoteDataSource() && await this.getCurrentAdmin()) {
            await this._requirePermission('contributions:read');
            const remoteRows = await this._selectRemoteRows('contributions');
            return (remoteRows || []).map(row => this._mapRemoteContribution(row));
        }
        return [];
    }

    async addContribution(contrib) {
        await this._delay();
        const db = this._read();
        const newContrib = {
            id: 'cnt_' + Date.now(),
            donorName: contrib.donorName ? contrib.donorName.trim() : 'Doador Anônimo',
            email: contrib.email ? contrib.email.trim() : '',
            phone: contrib.phone ? contrib.phone.trim() : '',
            amount: Number(contrib.amount) || 0,
            date: new Date().toISOString(),
            paymentMethod: contrib.paymentMethod || 'PIX',
            proofFile: contrib.proofFile || '',
            proofFileName: contrib.proofFileName || '',
            notes: contrib.notes || '',
            status: 'Confirmado'
        };

        const { error } = await this.supabase.from('contributions').insert({
            id: newContrib.id,
            donor_name: newContrib.donorName,
            donor_email: newContrib.email,
            donor_phone: newContrib.phone,
            amount: newContrib.amount,
            payment_method: newContrib.paymentMethod,
            proof_url: newContrib.proofFile,
            proof_file_name: newContrib.proofFileName,
            intent: newContrib.notes,
            status: newContrib.status,
            created_at: newContrib.date
        });
        if (error) throw new Error(`Não foi possível registrar a contribuição no Supabase: ${error.message}`);

        await this.addAuditLog('CONTRIBUIÇÃO_RECEBIDA', `R$ ${newContrib.amount.toFixed(2)} (${newContrib.donorName})`, `Contribuição voluntária via PIX registrada`);
        return newContrib;
    }

    /* ==========================================================================
       8. CMS & MENSAGENS DO FORMULÁRIO
       ========================================================================== */
    async getContent() {
        await this._delay();
        const rows = await this._selectRemoteRows('cms_content');
        const content = {};
        for (const row of rows) {
            const key = row.content_key || row.key || row.slug || row.section;
            const value = row.content_value ?? row.value ?? row.content ?? row.text;
            if (key && value !== undefined) content[key] = value;
        }
        const first = rows[0] || {};
        if (first.hero_title ?? first.heroTitle ?? content.hero_title ?? content.heroTitle) {
            content.heroTitle = first.hero_title ?? first.heroTitle ?? content.hero_title ?? content.heroTitle;
        }
        if (first.hero_subtitle ?? first.heroSubtitle ?? content.hero_subtitle ?? content.heroSubtitle) {
            content.heroSubtitle = first.hero_subtitle ?? first.heroSubtitle ?? content.hero_subtitle ?? content.heroSubtitle;
        }
        if (first.about_text ?? first.aboutText ?? content.about_text ?? content.aboutText) {
            content.aboutText = first.about_text ?? first.aboutText ?? content.about_text ?? content.aboutText;
        }
        return content;
    }

    async updateContent(patch) {
        await this._delay();
        await this._requirePermission('content:write');
        const currentContent = await this.getContent();
        const nextContent = { ...currentContent, ...patch };
        const keyMap = {
            heroTitle: 'hero_title',
            heroSubtitle: 'hero_subtitle',
            aboutText: 'about_text'
        };
        for (const [jsKey, val] of Object.entries(patch)) {
            const snakeKey = keyMap[jsKey] || jsKey;
            const { error } = await this.supabase.from('cms_content').upsert({
                id: snakeKey,
                key: snakeKey,
                value: String(val ?? ''),
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
            if (error) throw new Error(`Não foi possível salvar conteúdo no Supabase: ${error.message}`);
        }

        await this.addAuditLog('CONTEÚDO_CMS_ATUALIZADO', 'Textos do Site', `Alteração de conteúdo da landing page`);
        return nextContent;
    }

    async getMessages() {
        await this._delay();
        await this._requirePermission('logs:read');
        const rows = await this._selectRemoteRows('jcp_messages');
        return rows.map(row => ({
            id: row.id,
            name: row.name || '',
            email: row.email || '',
            subject: row.subject || '',
            message: row.message || '',
            read: Boolean(row.read),
            createdAt: row.created_at || ''
        }));
    }

    async markMessageAsRead(id) {
        await this._delay();
        await this._requirePermission('logs:read');
        const { error } = await this.supabase.from('jcp_messages').update({ read: true }).eq('id', id);
        if (error) throw new Error(`Não foi possível atualizar a mensagem no Supabase: ${error.message}`);
    }

    async deleteMessage(id) {
        await this._delay();
        await this._requirePermission('logs:read');
        const { error } = await this.supabase.from('jcp_messages').delete().eq('id', id);
        if (error) throw new Error(`Não foi possível excluir a mensagem no Supabase: ${error.message}`);
    }

    /* ==========================================================================
       9. DASHBOARD: ESTATÍSTICAS REAIS DO BANCO DE DADOS
       ========================================================================== */
    async getMedia() {
        await this._delay();
        await this._requirePermission('media:read');
        const rows = await this._selectRemoteRows('jcp_media');
        return rows.map(row => ({
            id: row.id,
            title: row.title,
            alt: row.alt,
            src: this.supabase.storage.from(JCP_MEDIA_BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
            createdAt: row.created_at
        }));
    }

    async addMedia(item) {
        await this._delay();
        await this._requirePermission('media:write');
        if (!item?.title?.trim() || !item?.src) throw new Error('Informe um título e selecione uma imagem.');
        const media = {
            id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: item.title.trim(),
            alt: (item.alt || item.title).trim(),
            createdAt: new Date().toISOString()
        };
        const blob = await fetch(item.src).then(response => {
            if (!response.ok) throw new Error('Não foi possível processar a imagem selecionada.');
            return response.blob();
        });
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
            throw new Error('Formato de imagem inválido para envio.');
        }
        const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
        const storagePath = `${media.id}.${extension}`;
        const { error: uploadError } = await this.supabase.storage.from(JCP_MEDIA_BUCKET)
            .upload(storagePath, blob, { contentType: blob.type, upsert: false });
        if (uploadError) throw new Error(`Não foi possível enviar a imagem ao Supabase Storage: ${uploadError.message}`);
        const { error: insertError } = await this.supabase.from('jcp_media').insert({
            id: media.id,
            title: media.title,
            alt: media.alt,
            storage_path: storagePath,
            created_at: media.createdAt
        });
        if (insertError) {
            const { error: cleanupError } = await this.supabase.storage.from(JCP_MEDIA_BUCKET).remove([storagePath]);
            if (cleanupError) console.error('Não foi possível remover arquivo após falha do registro de mídia:', cleanupError.message);
            throw new Error(`Não foi possível registrar a mídia no Supabase: ${insertError.message}`);
        }
        await this.addAuditLog('MÍDIA_ADICIONADA', media.title, 'Imagem adicionada à galeria administrativa');
        return { ...media, src: this.supabase.storage.from(JCP_MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl };
    }

    async deleteMedia(id) {
        await this._delay();
        await this._requirePermission('media:write');
        const { data: item, error: selectError } = await this.supabase.from('jcp_media')
            .select('id, title, storage_path').eq('id', id).maybeSingle();
        if (selectError) throw new Error(`Não foi possível localizar a mídia no Supabase: ${selectError.message}`);
        if (!item) return false;
        const { error: deleteError } = await this.supabase.from('jcp_media').delete().eq('id', id);
        if (deleteError) throw new Error(`Não foi possível excluir a mídia do Supabase: ${deleteError.message}`);
        const { error: storageError } = await this.supabase.storage.from(JCP_MEDIA_BUCKET).remove([item.storage_path]);
        if (storageError) throw new Error(`Registro excluído, mas o arquivo não foi removido do Storage: ${storageError.message}`);
        await this.addAuditLog('MÍDIA_EXCLUÍDA', item.title, 'Imagem removida da galeria administrativa');
        return true;
    }

    async getStats() {
        await this._delay();
        await this._requirePermission('dashboard:read');
        const [canReadParticipants, canReadEnrollments, canReadContributions] = await Promise.all([
            this.hasPermission('volunteers:read'),
            this.hasPermission('enrollments:read'),
            this.hasPermission('contributions:read')
        ]);
        const [participants, editions, enrollments, actions, contributions] = await Promise.all([
            canReadParticipants ? this.getParticipants() : Promise.resolve([]),
            this.getEditions(),
            canReadEnrollments ? this.getEnrollments() : Promise.resolve([]),
            this.getActions(),
            canReadContributions ? this.getContributions() : Promise.resolve([])
        ]);

        const volunteers = participants.filter(p => p.isVolunteer);

        // Cidades atendidas distintas (reúne cidades das edições e dos participantes)
        const citySet = new Set();
        editions.forEach(e => { if (e.city) citySet.add(e.city.trim().toLowerCase()); });
        participants.forEach(p => {
            if (p.address && p.address.city) citySet.add(p.address.city.trim().toLowerCase());
        });

        // Total arrecadado em R$ (contribuições confirmadas + inscrições aprovadas)
        let totalRaised = contributions.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
        enrollments.forEach(en => {
            if (en.paymentStatus === 'Aprovado' && en.amount) {
                totalRaised += Number(en.amount);
            }
        });

        const activeEditions = editions.filter(e => e.status === 'Inscrições Abertas' || e.status === 'Em Andamento');
        const pendingEnrollments = enrollments.filter(e => e.status === 'Pendente' || e.paymentStatus === 'Comprovante Enviado');

        return {
            totalParticipants: participants.length,
            totalVolunteers: volunteers.length,
            totalEditions: editions.length,
            activeEditions: activeEditions.length,
            totalEnrollments: enrollments.length,
            pendingEnrollments: pendingEnrollments.length,
            totalActions: actions.length,
            citiesCovered: citySet.size || 1,
            totalRaised: totalRaised,
            totalContributions: contributions.length
        };
    }

    /* ==========================================================================
       CONTADOR DE ORAÇÃO (PÚBLICO — REQUER PARTICIPANTE LOGADO)
       ========================================================================== */

    /**
     * Retorna o total de intercessores únicos que registraram oração.
     */
    async getPrayerCount() {
        const { data, error } = await this.supabase.rpc('jcp_public_prayer_count');
        if (error) throw new Error(`Não foi possível carregar o contador de orações: ${error.message}`);
        return Number(data) || 0;
    }

    /**
     * Registra a oração de um participante (uma vez por dia por participante).
     * Retorna { success, count, alreadyDone }.
     */
    async registerPrayer() {
        await this._delay();
        const participant = this.getCurrentParticipant();
        if (!participant) {
            throw new Error('É necessário estar logado para registrar sua oração.');
        }

        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const prayerEntry = {
            id: 'prayer_' + Date.now(),
            participantId: participant.id,
            participantName: participant.name || 'Anônimo',
            date: today,
            registeredAt: new Date().toISOString()
        };

        const { error } = await this.participantAuth.from('jcp_prayers').insert({
            id: prayerEntry.id,
            participant_id: prayerEntry.participantId,
            participant_name: prayerEntry.participantName,
            prayer_date: prayerEntry.date,
            created_at: prayerEntry.registeredAt
        });
        if (error?.code === '23505') {
            return { success: false, alreadyDone: true, count: await this.getPrayerCount() };
        }
        if (error) throw new Error(`Não foi possível registrar a oração no Supabase: ${error.message}`);

        await this.addAuditLog(
            'ORAÇÃO_REGISTRADA',
            participant.name || 'Participante',
            `${participant.name} registrou intercession em ${today}`
        );

        return { success: true, alreadyDone: false, count: await this.getPrayerCount() };
    }

    /**
     * Verifica se o participante já orou hoje.
     */
    async hasParticipantPrayedToday() {
        const participant = this.getCurrentParticipant();
        if (!participant) return false;
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await this.participantAuth.from('jcp_prayers')
            .select('id').eq('participant_id', participant.id).eq('prayer_date', today).maybeSingle();
        if (error) throw new Error(`Não foi possível verificar a oração no Supabase: ${error.message}`);
        return Boolean(data);
    }

    /* ==========================================================================
       CONTRIBUIÇÕES PÚBLICAS (SEM NECESSIDADE DE LOGIN)
       ========================================================================== */

    /**
     * Registra uma contribuição pública com comprovante.
     * Não requer autenticação de participante.
     */
    async createPublicContribution(data) {
        await this._delay();
        if (!data.proofFile) {
            throw new Error('O comprovante é obrigatório.');
        }

        const newContrib = {
            id: 'contrib_' + Date.now(),
            name: (data.name && data.name.trim()) ? data.name.trim() : 'Anônimo',
            donorName: (data.name && data.name.trim()) ? data.name.trim() : 'Anônimo',
            amount: (data.amount && data.amount.trim()) ? data.amount.trim() : '',
            proofFile: data.proofFile,
            proofFileName: data.proofFileName || 'comprovante.png',
            status: 'Confirmada',
            paymentStatus: 'Comprovante Enviado',
            createdAt: new Date().toISOString(),
            adminNotes: ''
        };

        const numericAmount = Number(String(newContrib.amount || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        const { error } = await this.supabase.from('contributions').insert({
            id: newContrib.id,
            donor_name: newContrib.name,
            amount: numericAmount,
            payment_method: 'PIX',
            proof_url: newContrib.proofFile,
            proof_file_name: newContrib.proofFileName,
            status: newContrib.status,
            created_at: newContrib.createdAt
        });
        if (error) throw new Error(`Não foi possível enviar o comprovante ao Supabase: ${error.message}`);

        return newContrib;
    }

    /* ==========================================================================
       DEPARTAMENTOS
       ========================================================================== */

    async getDepartments(onlyActive = false) {
        await this._delay(40);
        const remoteRows = await this._selectRemoteRows('departments');
        let depts = remoteRows.map(row => ({
            id: row.id,
            name: row.name || '',
            description: row.description || '',
            isActive: row.active !== false,
            displayOrder: row.order_index ?? 0,
            createdAt: row.created_at || '',
            updatedAt: row.updated_at || ''
        }));
        if (onlyActive) depts = depts.filter(d => d.isActive);
        return depts.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    async getDepartmentById(id) {
        const departments = await this.getDepartments();
        return departments.find(department => department.id === id) || null;
    }

    async createDepartment(data) {
        await this._requirePermission('leaders:write');
        await this._delay();
        if (!data.name || !data.name.trim()) throw new Error('O nome do departamento é obrigatório.');
        const allDepts = await this.getDepartments();
        const exists = allDepts.find(d => d.name.toLowerCase().trim() === data.name.toLowerCase().trim());
        if (exists) throw new Error('Já existe um departamento com este nome.');
        const now = new Date().toISOString();
        const newDept = {
            id: 'dept_' + Date.now(),
            name: data.name.trim(),
            description: (data.description || '').trim(),
            isActive: data.isActive !== false,
            displayOrder: data.displayOrder !== undefined ? Number(data.displayOrder) : (allDepts.length + 1),
            createdAt: now,
            updatedAt: now
        };
        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('departments').insert({
                id: newDept.id,
                name: newDept.name,
                description: newDept.description,
                active: newDept.isActive,
                order_index: newDept.displayOrder,
                created_at: newDept.createdAt,
                updated_at: newDept.updatedAt
            });
            if (error) throw new Error(`Não foi possível criar o departamento no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }
        await this.addAuditLog('DEPARTAMENTO_CRIADO', newDept.name, `Departamento "${newDept.name}" cadastrado`);
        return newDept;
    }

    async updateDepartment(id, data) {
        await this._requirePermission('leaders:write');
        await this._delay();
        const existing = await this.getDepartmentById(id);
        if (!existing) throw new Error('Departamento não encontrado.');
        const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('departments').upsert({
                id: updated.id,
                name: updated.name,
                description: updated.description || '',
                active: updated.isActive !== false,
                order_index: Number(updated.displayOrder ?? 0),
                created_at: updated.createdAt || new Date().toISOString(),
                updated_at: updated.updatedAt
            }, { onConflict: 'id' });
            if (error) throw new Error(`Não foi possível atualizar o departamento no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }
        await this.addAuditLog('DEPARTAMENTO_ATUALIZADO', updated.name, `Departamento "${updated.name}" atualizado`);
        return updated;
    }

    async deleteDepartment(id) {
        await this._requirePermission('leaders:write');
        await this._delay();
        const dept = await this.getDepartmentById(id);
        if (!dept) throw new Error('Departamento não encontrado.');
        const linkedLeaders = await this.getLeaders({ departmentId: id });
        if (linkedLeaders.length > 0) throw new Error('Este departamento possui líderes vinculados. Reassine-os antes de excluir.');
        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('departments').delete().eq('id', id);
            if (error) throw new Error(`Não foi possível excluir o departamento no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }
        await this.addAuditLog('DEPARTAMENTO_EXCLUÍDO', dept.name, `Departamento "${dept.name}" excluído`);
        return true;
    }

    /* ==========================================================================
       LÍDERES
       ========================================================================== */

    async getLeaders(filters = {}) {
        await this._delay(40);
        const remoteRows = await this._selectRemoteRows('leaders');
        const depts = await this.getDepartments();
        let leaders = remoteRows.map(row => ({
            id: row.id,
            fullName: row.full_name || '',
            departmentId: row.department_id || '',
            departmentName: row.department_name || '',
            roleTitle: row.role_title || '',
            biography: row.biography || '',
            photoPath: row.photo_url || '',
            instagramUrl: row.instagram_url || '',
            displayOrder: row.order_index ?? 999,
            isActive: row.active !== false,
            isPublished: row.published !== false,
            createdAt: row.created_at || '',
            updatedAt: row.updated_at || ''
        }));

        // Enrich with department name
        leaders = leaders.map(l => ({
            ...l,
            departmentName: (depts.find(d => d.id === l.departmentId) || {}).name || l.departmentName || '—'
        }));

        if (filters.onlyPublished) leaders = leaders.filter(l => l.isPublished && l.isActive);
        if (filters.departmentId) leaders = leaders.filter(l => l.departmentId === filters.departmentId);
        if (filters.status === 'active') leaders = leaders.filter(l => l.isActive);
        if (filters.status === 'inactive') leaders = leaders.filter(l => !l.isActive);
        if (filters.status === 'published') leaders = leaders.filter(l => l.isPublished);
        if (filters.status === 'draft') leaders = leaders.filter(l => !l.isPublished);
        if (filters.search) {
            const q = filters.search.toLowerCase();
            leaders = leaders.filter(l => l.fullName.toLowerCase().includes(q) || l.departmentName.toLowerCase().includes(q));
        }

        // Sort by displayOrder then name
        return leaders.sort((a, b) => {
            const oa = a.displayOrder ?? 999;
            const ob = b.displayOrder ?? 999;
            if (oa !== ob) return oa - ob;
            return a.fullName.localeCompare(b.fullName, 'pt-BR');
        });
    }

    async getLeaderById(id) {
        const leader = (await this.getLeaders()).find(item => item.id === id);
        return leader || null;
    }

    async createLeader(data) {
        await this._requirePermission('leaders:write');
        await this._delay();
        if (!data.fullName || !data.fullName.trim()) throw new Error('O nome completo é obrigatório.');
        if (!data.departmentId) throw new Error('O departamento é obrigatório.');
        if (!data.biography || !data.biography.trim()) throw new Error('A apresentação é obrigatória.');
        const now = new Date().toISOString();
        const dept = await this.getDepartmentById(data.departmentId);
        if (!dept) throw new Error('Departamento selecionado não foi encontrado.');
        const newLeader = {
            id: 'leader_' + Date.now(),
            fullName: data.fullName.trim(),
            departmentId: data.departmentId,
            departmentName: dept?.name || data.departmentName || '',
            roleTitle: (data.roleTitle || '').trim(),
            biography: data.biography.trim(),
            photoPath: data.photoPath || '',
            instagramUrl: (data.instagramUrl || '').trim(),
            displayOrder: data.displayOrder !== undefined ? Number(data.displayOrder) : 999,
            isActive: data.isActive !== false,
            isPublished: data.isPublished === true,
            createdAt: now,
            updatedAt: now
        };
        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('leaders').insert({
                id: newLeader.id,
                full_name: newLeader.fullName,
                department_id: newLeader.departmentId,
                department_name: newLeader.departmentName,
                role_title: newLeader.roleTitle,
                biography: newLeader.biography,
                photo_url: newLeader.photoPath,
                instagram_url: newLeader.instagramUrl,
                order_index: newLeader.displayOrder,
                active: newLeader.isActive,
                published: newLeader.isPublished,
                created_at: newLeader.createdAt,
                updated_at: newLeader.updatedAt
            });
            if (error) throw new Error(`Não foi possível cadastrar o líder no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }
        await this.addAuditLog('LÍDER_CRIADO', newLeader.fullName, `Líder "${newLeader.fullName}" cadastrado`);
        return newLeader;
    }

    async updateLeader(id, data) {
        await this._requirePermission('leaders:write');
        await this._delay();
        const existing = await this.getLeaderById(id);
        if (!existing) throw new Error('Líder não encontrado.');
        const cleanData = { ...data };
        Object.keys(cleanData).forEach(k => { if (cleanData[k] === undefined) delete cleanData[k]; });
        const dept = cleanData.departmentId ? await this.getDepartmentById(cleanData.departmentId) : null;
        if (cleanData.departmentId && !dept) throw new Error('Departamento selecionado não foi encontrado.');
        const updated = {
            ...existing,
            ...cleanData,
            departmentName: dept?.name || cleanData.departmentName || existing.departmentName || '',
            displayOrder: cleanData.displayOrder !== undefined ? Number(cleanData.displayOrder) : existing.displayOrder,
            updatedAt: new Date().toISOString()
        };
        if (this._hasRemoteDataSource()) {
            const { error } = await this.supabase.from('leaders').upsert({
                id: updated.id,
                full_name: updated.fullName,
                department_id: updated.departmentId,
                department_name: updated.departmentName,
                role_title: updated.roleTitle || '',
                biography: updated.biography || '',
                photo_url: updated.photoPath || '',
                instagram_url: updated.instagramUrl || '',
                order_index: Number(updated.displayOrder ?? 999),
                active: updated.isActive !== false,
                published: Boolean(updated.isPublished),
                created_at: updated.createdAt || new Date().toISOString(),
                updated_at: updated.updatedAt
            }, { onConflict: 'id' });
            if (error) throw new Error(`Não foi possível atualizar o líder no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        }
        await this.addAuditLog('LÍDER_ATUALIZADO', updated.fullName, `Líder "${updated.fullName}" atualizado`);
        return updated;
    }

    async toggleLeaderPublish(id) {
        await this._requirePermission('leaders:write');
        const leader = await this.getLeaderById(id);
        if (!leader) throw new Error('Líder não encontrado.');
        const nextPublished = !leader.isPublished;
        const updated = await this.updateLeader(id, { isPublished: nextPublished });
        const action = updated.isPublished ? 'LÍDER_PUBLICADO' : 'LÍDER_DESPUBLICADO';
        await this.addAuditLog(action, updated.fullName, `Status de publicação alterado para "${updated.isPublished ? 'Publicado' : 'Rascunho'}"`);
        return updated;
    }

    async deleteLeader(id) {
        await this._requirePermission('leaders:write');
        await this._delay();
        const leader = await this.getLeaderById(id);
        if (!leader) throw new Error('Líder não encontrado.');
        const { error } = await this.supabase.from('leaders').delete().eq('id', id);
        if (error) throw new Error(`Não foi possível excluir o líder no Supabase: ${error.message || 'Erro de permissão/banco'}`);
        await this.addAuditLog('LÍDER_EXCLUÍDO', leader.fullName, `Líder "${leader.fullName}" excluído do sistema`);
        return true;
    }

    /** Retorna líderes publicados e ativos para exibição no site público */
    async getPublicLeaders() {
        return this.getLeaders({ onlyPublished: true });
    }

    /* ==========================================================================
       13. TESTEMUNHOS — GALERIA DE VÍDEOS
       ========================================================================== */

    _normalizeTestimonial(row) {
        if (!row || typeof row !== 'object') return null;
        const isPublished = row.status === 'published'
            ? true
            : (row.status === 'draft' ? false : (row.published !== undefined ? Boolean(row.published) : Boolean(row.isPublished !== false)));
        const status = isPublished ? 'published' : 'draft';
        const videoUrl = (row.videoUrl || row.video_url || '').trim();
        let thumbnailUrl = (row.thumbnailUrl || row.thumbnail_url || '').trim();

        // Gera capa automática para vídeos do YouTube quando não houver thumbnail personalizada
        if (!thumbnailUrl && videoUrl) {
            const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
            if (ytMatch && ytMatch[1]) {
                thumbnailUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
            }
        }

        const personName = (row.personName || row.person_name || row.name || '').trim();
        const displayOrder = Number.isFinite(Number(row.displayOrder ?? row.order_index))
            ? Number(row.displayOrder ?? row.order_index)
            : 999;

        return {
            id: String(row.id || `test_${Date.now()}`),
            title: (row.title || '').trim(),
            personName,
            name: personName,
            description: (row.description || '').trim(),
            videoUrl,
            thumbnailUrl,
            status,
            isPublished,
            isActive: row.active !== undefined ? Boolean(row.active) : (row.isActive !== false),
            displayOrder,
            createdAt: row.createdAt || row.created_at || new Date().toISOString(),
            updatedAt: row.updatedAt || row.updated_at || new Date().toISOString()
        };
    }

    async _syncTestimonialRemote(action, payload) {
        if (!this._hasRemoteDataSource()) throw new Error('Supabase não está configurado.');
        if (action === 'upsert') {
            const row = {
                id: payload.id,
                title: payload.title,
                person_name: payload.personName,
                description: payload.description || '',
                video_url: payload.videoUrl,
                thumbnail_url: payload.thumbnailUrl || '',
                status: payload.isPublished ? 'published' : 'draft',
                published: Boolean(payload.isPublished),
                active: payload.isActive !== false,
                order_index: Number(payload.displayOrder || 1),
                created_at: payload.createdAt,
                updated_at: payload.updatedAt
            };
            const { error } = await this.supabase.from('testimonials').upsert(row, { onConflict: 'id' });
            if (error) throw new Error(`Não foi possível salvar o testemunho no Supabase: ${error.message}`);
            return true;
        }
        if (action === 'delete') {
            const { error } = await this.supabase.from('testimonials').delete().eq('id', payload.id);
            if (error) throw new Error(`Não foi possível excluir o testemunho no Supabase: ${error.message}`);
            return true;
        }
        throw new Error(`Operação de testemunho não suportada: ${action}`);
    }

    async getTestimonials(filters = {}) {
        await this._delay(40);
        const rows = await this._selectRemoteRows('testimonials');
        let items = rows.map(row => this._normalizeTestimonial(row)).filter(Boolean);

        if (filters.onlyPublished) {
            items = items.filter(t => t.isPublished && t.isActive !== false);
        }
        if (filters.status === 'published') {
            items = items.filter(t => t.isPublished);
        } else if (filters.status === 'draft') {
            items = items.filter(t => !t.isPublished);
        }
        if (filters.search) {
            const q = filters.search.trim().toLowerCase();
            if (q) {
                items = items.filter(t =>
                    t.title.toLowerCase().includes(q) ||
                    t.personName.toLowerCase().includes(q) ||
                    (t.description && t.description.toLowerCase().includes(q))
                );
            }
        }

        return items.sort((a, b) => {
            const oa = a.displayOrder ?? 999;
            const ob = b.displayOrder ?? 999;
            if (oa !== ob) return oa - ob;
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
    }

    async getPublicTestimonials() {
        return this.getTestimonials({ onlyPublished: true });
    }

    async getTestimonialById(id) {
        const list = await this.getTestimonials();
        return list.find(item => item.id === id) || null;
    }

    async createTestimonial(data) {
        await this._requirePermission('testimonials:write');
        await this._delay();

        const title = (data?.title || '').trim();
        const personName = (data?.personName || data?.name || '').trim();
        const videoUrl = (data?.videoUrl || '').trim();
        const description = (data?.description || '').trim();

        if (!title) throw new Error('O título do testemunho é obrigatório.');
        if (!personName) throw new Error('O nome da pessoa é obrigatório.');
        if (!videoUrl) throw new Error('O vídeo do testemunho é obrigatório.');

        const isPublished = data.status
            ? data.status === 'published'
            : (data.isPublished !== false);
        const now = new Date().toISOString();

        const normalized = this._normalizeTestimonial({
            id: 'test_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            title,
            personName,
            description,
            videoUrl,
            thumbnailUrl: (data.thumbnailUrl || '').trim(),
            status: isPublished ? 'published' : 'draft',
            isPublished,
            isActive: true,
            displayOrder: data.displayOrder !== undefined && data.displayOrder !== '' ? Number(data.displayOrder) : 1,
            createdAt: now,
            updatedAt: now
        });

        await this._syncTestimonialRemote('upsert', normalized);

        await this.addAuditLog(
            'TESTEMUNHO_CRIADO',
            `${normalized.title} (${normalized.personName})`,
            `Testemunho cadastrado com status "${normalized.isPublished ? 'Publicado' : 'Rascunho'}" (Ordem: ${normalized.displayOrder})`
        );
        return normalized;
    }

    async updateTestimonial(id, data) {
        await this._requirePermission('testimonials:write');
        await this._delay();

        const existingItem = await this.getTestimonialById(id);
        if (!existingItem) throw new Error('Testemunho não encontrado.');

        const title = data.title !== undefined ? String(data.title).trim() : existingItem.title;
        const personName = (data.personName !== undefined || data.name !== undefined)
            ? String(data.personName ?? data.name).trim()
            : existingItem.personName;
        const videoUrl = data.videoUrl !== undefined ? String(data.videoUrl).trim() : existingItem.videoUrl;
        const description = data.description !== undefined ? String(data.description).trim() : (existingItem.description || '');
        const thumbnailUrl = data.thumbnailUrl !== undefined ? String(data.thumbnailUrl).trim() : (existingItem.thumbnailUrl || '');

        if (!title) throw new Error('O título do testemunho é obrigatório.');
        if (!personName) throw new Error('O nome da pessoa é obrigatório.');
        if (!videoUrl) throw new Error('O vídeo do testemunho é obrigatório.');

        const isPublished = data.status !== undefined
            ? data.status === 'published'
            : (data.isPublished !== undefined ? Boolean(data.isPublished) : Boolean(existingItem.isPublished));

        const displayOrder = data.displayOrder !== undefined && data.displayOrder !== ''
            ? Number(data.displayOrder)
            : Number(existingItem.displayOrder || 1);

        const updated = this._normalizeTestimonial({
            ...existingItem,
            id,
            title,
            personName,
            description,
            videoUrl,
            thumbnailUrl,
            status: isPublished ? 'published' : 'draft',
            isPublished,
            displayOrder,
            updatedAt: new Date().toISOString()
        });

        await this._syncTestimonialRemote('upsert', updated);

        await this.addAuditLog(
            'TESTEMUNHO_ATUALIZADO',
            `${updated.title} (${updated.personName})`,
            `Testemunho atualizado (Ordem: ${updated.displayOrder}, Status: ${updated.isPublished ? 'Publicado' : 'Rascunho'})`
        );
        return updated;
    }

    async toggleTestimonialPublish(id) {
        await this._requirePermission('testimonials:write');
        const existing = await this.getTestimonialById(id);
        if (!existing) throw new Error('Testemunho não encontrado.');
        const nextPublished = !existing.isPublished;
        const updated = await this.updateTestimonial(id, {
            isPublished: nextPublished,
            status: nextPublished ? 'published' : 'draft'
        });
        const action = updated.isPublished ? 'TESTEMUNHO_PUBLICADO' : 'TESTEMUNHO_DESPUBLICADO';
        await this.addAuditLog(
            action,
            `${updated.title} (${updated.personName})`,
            `Status de publicação alterado para "${updated.isPublished ? 'Publicado' : 'Rascunho'}"`
        );
        return updated;
    }

    async deleteTestimonial(id) {
        await this._requirePermission('testimonials:write');
        await this._delay();
        const existing = await this.getTestimonialById(id);
        if (!existing) throw new Error('Testemunho não encontrado.');

        await this._syncTestimonialRemote('delete', { id });

        await this.addAuditLog(
            'TESTEMUNHO_EXCLUÍDO',
            `${existing.title} (${existing.personName})`,
            `Testemunho de "${existing.personName}" excluído do sistema`
        );
        return true;
    }
}

// Instância global disponível como window.db
if (typeof window !== 'undefined') {
    window.db = new DatabaseService();
}
