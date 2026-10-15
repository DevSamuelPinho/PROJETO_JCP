/**
 * ==============================================================================
 * PROJETO JOVENS COM PROPÓSITO — JCP | BANCO DE DADOS & CAMADA DE BACKEND
 * ==============================================================================
 * Sistema relacional completo com controle de acesso (RBAC), auditoria global,
 * validação de permissões no backend/API e persistência em localStorage.
 * ==============================================================================
 */

const JCP_DB_KEY = 'jcp_system_db_v3';
const JCP_SESSION_KEY = 'jcp_admin_session_v3';
const JCP_PARTICIPANT_SESSION_KEY = 'jcp_participant_session_v3';

class DatabaseService {
    constructor() {
        this.supabase = window.supabaseClient || null;
        this._init();
    }

    _getSupabase() {
        if (!this.supabase && window.supabaseClient) {
            this.supabase = window.supabaseClient;
        }
        return this.supabase;
    }

    _delay(ms = 60) {
        return new Promise(r => setTimeout(r, ms));
    }

    /* ==========================================================================
       INICIALIZAÇÃO & SEEDS DO BANCO DE DADOS
       ========================================================================== */
    _init() {
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
                            'leaders:write'
                        ],
                        isSystem: true
                    },
                    {
                        id: 'midia',
                        name: 'Mídia',
                        description: 'Acesso exclusivo a fotos, vídeos, conteúdos editoriais (CMS) e consulta de edições.',
                        permissions: [
                            'dashboard:read',
                            'editions:read',
                            'media:read',
                            'media:write',
                            'content:read',
                            'content:write'
                        ],
                        isSystem: true
                    }
                ],

                // 2. ADMINISTRADORES
                admins: [
                    {
                        id: 'adm_1',
                        name: 'José Samuel Pinho',
                        email: 'admin@jcp.org',
                        password: 'admin123', // Em produção com backend real: hash bcrypt
                        roleId: 'super_admin',
                        status: 'Ativo',
                        avatar: 'JS',
                        createdAt: '2026-01-10T10:00:00Z'
                    },
                    {
                        id: 'adm_2',
                        name: 'Danilo Cândido (Coordenação)',
                        email: 'coordenador@jcp.org',
                        password: 'coord123',
                        roleId: 'coordenador',
                        status: 'Ativo',
                        avatar: 'DC',
                        createdAt: '2026-02-15T14:30:00Z'
                    },
                    {
                        id: 'adm_3',
                        name: 'Ana Silva (Comunicação & Mídia)',
                        email: 'midia@jcp.org',
                        password: 'midia123',
                        roleId: 'midia',
                        status: 'Ativo',
                        avatar: 'AS',
                        createdAt: '2026-03-01T09:00:00Z'
                    }
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
                    {
                        id: 'part_1',
                        name: 'Danilo Cândido dos Santos',
                        birthDate: '1999-05-14',
                        phone: '(83) 98888-0003',
                        email: 'danilo@email.com',
                        address: {
                            street: 'Rua Pedro Firmino',
                            number: '120',
                            neighborhood: 'Brasília',
                            city: 'Patos',
                            state: 'PB'
                        },
                        pastor: 'Pr. Paulo Roberto',
                        church: 'Primeira Igreja Batista de Patos',
                        isVolunteer: true,
                        volunteerAreas: ['Pregação', 'Apoio', 'Logístico'],
                        volunteerOtherDetails: '',
                        status: 'Ativo',
                        createdAt: '2026-09-01T10:00:00Z'
                    },
                    {
                        id: 'part_2',
                        name: 'Ana Silva de Oliveira',
                        birthDate: '2001-08-22',
                        phone: '(83) 99999-0001',
                        email: 'ana.silva@email.com',
                        address: {
                            street: 'Av. Epitácio Pessoa',
                            number: '1540',
                            neighborhood: 'Torre',
                            city: 'João Pessoa',
                            state: 'PB'
                        },
                        pastor: 'Pr. Carlos Eduardo',
                        church: 'Comunidade Cristã Zoe',
                        isVolunteer: true,
                        volunteerAreas: ['Cantor', 'Mídia', 'Serviço Social'],
                        volunteerOtherDetails: '',
                        status: 'Ativo',
                        createdAt: '2026-09-05T11:20:00Z'
                    },
                    {
                        id: 'part_3',
                        name: 'Marcos Dias Ferreira',
                        birthDate: '2000-11-10',
                        phone: '(83) 99999-0002',
                        email: 'marcos.dias@email.com',
                        address: {
                            street: 'Rua Floriano Peixoto',
                            number: '450',
                            neighborhood: 'Centro',
                            city: 'Campina Grande',
                            state: 'PB'
                        },
                        pastor: 'Pr. Roberto Silva',
                        church: 'Igreja Evangélica Assembleia de Deus',
                        isVolunteer: true,
                        volunteerAreas: ['Músico', 'Apoio'],
                        volunteerOtherDetails: 'Baterista e violonista',
                        status: 'Ativo',
                        createdAt: '2026-09-10T14:10:00Z'
                    },
                    {
                        id: 'part_4',
                        name: 'Monique Freitas Santos',
                        birthDate: '2003-04-18',
                        phone: '(83) 98777-1122',
                        email: 'monique.freitas@email.com',
                        address: {
                            street: 'Rua João Carneiro',
                            number: '88',
                            neighborhood: 'Pereiros',
                            city: 'Pombal',
                            state: 'PB'
                        },
                        pastor: 'Pr. Lucas Emanuel',
                        church: 'Igreja Batista Esperança',
                        isVolunteer: false,
                        volunteerAreas: [],
                        volunteerOtherDetails: '',
                        status: 'Ativo',
                        createdAt: '2026-09-15T18:00:00Z'
                    },
                    {
                        id: 'part_5',
                        name: 'Lucas Mendes Arcoverde',
                        birthDate: '2002-02-12',
                        phone: '(83) 99123-4567',
                        email: 'lucas.m@email.com',
                        address: {
                            street: 'Rua Manoel Guedes',
                            number: '310',
                            neighborhood: 'Belo Horizonte',
                            city: 'Patos',
                            state: 'PB'
                        },
                        pastor: 'Pr. Antônio Carlos',
                        church: 'Igreja Presbiteriana do Brasil',
                        isVolunteer: true,
                        volunteerAreas: ['Fiscal', 'Logístico', 'Mídia'],
                        volunteerOtherDetails: '',
                        status: 'Ativo',
                        createdAt: '2026-09-20T09:40:00Z'
                    }
                ],

                // 6. INSCRIÇÕES & COMPROVANTES
                enrollments: [
                    {
                        id: 'enr_1',
                        editionId: 'ed_1',
                        participantId: 'part_1',
                        registrationType: 'shirt',
                        shirtSize: 'G',
                        amount: 45.00,
                        status: 'Confirmada',
                        paymentStatus: 'Aprovado',
                        proofFile: 'assets/brand/jcp_simbolo_isolado.svg',
                        proofFileName: 'comprovante_pix_danilo.pdf',
                        adminNotes: 'Pagamento PIX conferido e validado pela tesouraria.',
                        createdAt: '2026-09-22T10:30:00Z',
                        updatedAt: '2026-09-22T11:00:00Z'
                    },
                    {
                        id: 'enr_2',
                        editionId: 'ed_1',
                        participantId: 'part_4',
                        registrationType: 'shirt',
                        shirtSize: 'M',
                        amount: 45.00,
                        status: 'Pendente',
                        paymentStatus: 'Comprovante Enviado',
                        proofFile: 'assets/brand/jcp_simbolo_isolado.svg',
                        proofFileName: 'comprovante_monique_freitas.jpg',
                        adminNotes: 'Aguardando validação do lote de camisas.',
                        createdAt: '2026-09-28T16:15:00Z',
                        updatedAt: '2026-09-28T16:15:00Z'
                    },
                    {
                        id: 'enr_3',
                        editionId: 'ed_2',
                        participantId: 'part_2',
                        registrationType: 'paid',
                        shirtSize: '',
                        amount: 25.00,
                        status: 'Confirmada',
                        paymentStatus: 'Aprovado',
                        proofFile: 'assets/brand/jcp_simbolo_isolado.svg',
                        proofFileName: 'pix_taxa_palmeira_ana.png',
                        adminNotes: 'Aprovado automaticamente.',
                        createdAt: '2026-09-29T14:00:00Z',
                        updatedAt: '2026-09-29T14:30:00Z'
                    }
                ],

                // 7. CONTRIBUIÇÕES VOLUNTÁRIAS
                contributions: [
                    {
                        id: 'cnt_1',
                        donorName: 'Doador Anônimo Sertão',
                        email: 'contato@apoiojcp.org',
                        phone: '(83) 98888-0000',
                        amount: 150.00,
                        date: '2026-09-28T15:00:00Z',
                        paymentMethod: 'PIX',
                        proofFile: '',
                        proofFileName: '',
                        notes: 'Oferta missionária para alimentação dos voluntários.',
                        status: 'Confirmado'
                    },
                    {
                        id: 'cnt_2',
                        donorName: 'Igreja Batista Parceira',
                        email: 'tesouraria@ibp.org.br',
                        phone: '(83) 99111-2233',
                        amount: 500.00,
                        date: '2026-09-25T11:00:00Z',
                        paymentMethod: 'PIX',
                        proofFile: '',
                        proofFileName: '',
                        notes: 'Apoio ao transporte da caravana de Pombal.',
                        status: 'Confirmado'
                    }
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
                    {
                        id: 'log_1',
                        timestamp: '2026-09-30T13:51:00Z',
                        formattedDate: '30/09/2026',
                        formattedTime: '13:51',
                        userId: 'adm_1',
                        userName: 'José Samuel Pinho',
                        userRole: 'Super Admin',
                        action: 'LOGIN',
                        affectedRecord: 'Painel Administrativo',
                        ip: '127.0.0.1',
                        details: 'Acesso autenticado ao Painel Administrativo'
                    },
                    {
                        id: 'log_2',
                        timestamp: '2026-09-29T21:03:00Z',
                        formattedDate: '29/09/2026',
                        formattedTime: '21:03',
                        userId: 'adm_1',
                        userName: 'José Samuel Pinho',
                        userRole: 'Super Admin',
                        action: 'INSCRIÇÃO_APROVADA',
                        affectedRecord: 'Inscrição #enr_3 (Ana Silva de Oliveira)',
                        ip: '127.0.0.1',
                        details: 'Comprovante verificado e taxa de inscrição aprovada para 13ª Edição'
                    },
                    {
                        id: 'log_3',
                        timestamp: '2026-09-28T16:15:00Z',
                        formattedDate: '28/09/2026',
                        formattedTime: '16:15',
                        userId: 'part_4',
                        userName: 'Monique Freitas Santos',
                        userRole: 'Participante',
                        action: 'NOVA_INSCRIÇÃO',
                        affectedRecord: '2ª Edição — Qual é o Seu Propósito?',
                        ip: '177.18.29.4',
                        details: 'Inscrição com camisa tamanho M realizada com envio de comprovante'
                    },
                    {
                        id: 'log_4',
                        timestamp: '2026-09-20T09:40:00Z',
                        formattedDate: '20/09/2026',
                        formattedTime: '09:40',
                        userId: 'part_5',
                        userName: 'Lucas Mendes Arcoverde',
                        userRole: 'Voluntário',
                        action: 'CADASTRO_VOLUNTÁRIO',
                        affectedRecord: 'Voluntário #part_5',
                        ip: '189.44.12.8',
                        details: 'Cadastro com áreas de voluntariado: Fiscal, Logístico, Mídia'
                    },
                    {
                        id: 'log_5',
                        timestamp: '2026-09-15T10:00:00Z',
                        formattedDate: '15/09/2026',
                        formattedTime: '10:00',
                        userId: 'adm_1',
                        userName: 'José Samuel Pinho',
                        userRole: 'Super Admin',
                        action: 'CONFIG_ATUALIZADA',
                        affectedRecord: 'Configurações Pix',
                        ip: '127.0.0.1',
                        details: 'Chave Pix oficial conferida e confirmada para arrecadação'
                    }
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

        // Migração: garante que o banco existente tenha as tabelas e dados oficiais de líderes e departamentos
        const existing = this._read();
        let needsSave = false;
        
        if (!existing.departments || existing.departments.length === 0) {
            existing.departments = [
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
];
            needsSave = true;
        }
        if (!existing.leaders || existing.leaders.length === 0) {
            existing.leaders = [
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
];
            needsSave = true;
        }

        if (existing.roles) {
            const coordRole = existing.roles.find(r => r.id === 'coordenador');
            if (coordRole && !coordRole.permissions.includes('leaders:read')) {
                coordRole.permissions.push('leaders:read', 'leaders:write');
                needsSave = true;
            }
        }

        // Limpeza definitiva e obrigatória da 1ª Edição (ed_3)
        if (existing.editions && existing.editions.some(e => e.id === 'ed_3')) {
            existing.editions = existing.editions.filter(e => e.id !== 'ed_3');
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
        try {
            return JSON.parse(localStorage.getItem(JCP_DB_KEY)) || {};
        } catch (e) {
            console.error('Erro ao ler DB:', e);
            return {};
        }
    }

    _save(data) {
        try {
            localStorage.setItem(JCP_DB_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Falha ao salvar no localStorage (possivel limite de quota):', e);
            if (data.logs && data.logs.length > 20) {
                data.logs = data.logs.slice(0, 20);
                try {
                    localStorage.setItem(JCP_DB_KEY, JSON.stringify(data));
                    return;
                } catch (e2) {
                    console.error('Segunda tentativa de salvar falhou:', e2);
                }
            }
            throw new Error('Limite de armazenamento do navegador atingido. A imagem enviada ou os dados excederam o espaco local.');
        }
    }

    /* ==========================================================================
       SEGURANÇA & VALIDAÇÃO DE PERMISSÕES NO BACKEND/API
       ========================================================================== */
    getCurrentAdmin() {
        const raw = sessionStorage.getItem(JCP_SESSION_KEY) || localStorage.getItem(JCP_SESSION_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    async getAdminRole(roleId) {
        const db = this._read();
        return db.roles.find(r => r.id === roleId) || null;
    }

    async hasPermission(permission) {
        const admin = this.getCurrentAdmin();
        if (!admin) return false;
        const db = this._read();
        const role = db.roles.find(r => r.id === admin.roleId);
        if (!role) return false;
        if (role.permissions.includes('*')) return true;
        return role.permissions.includes(permission);
    }

    async _requirePermission(permission) {
        const ok = await this.hasPermission(permission);
        if (!ok) {
            const admin = this.getCurrentAdmin();
            const roleName = admin ? admin.roleId : 'Não autenticado';
            throw new Error(`Acesso negado: Perfil "${roleName}" não possui permissão para "${permission}".`);
        }
    }

    async loginAdmin(email, password) {
        await this._delay(100);
        const db = this._read();
        const admin = db.admins.find(a => a.email.toLowerCase() === email.toLowerCase().trim() && a.status === 'Ativo');

        if (!admin || admin.password !== password) {
            await this.addAuditLog('LOGIN_FALHOU', 'Tentativa de Acesso', `Tentativa de login com email: ${email}`);
            throw new Error('E-mail ou senha inválidos.');
        }

        const session = {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            roleId: admin.roleId,
            avatar: admin.avatar || admin.name.substring(0, 2).toUpperCase()
        };

        sessionStorage.setItem(JCP_SESSION_KEY, JSON.stringify(session));
        localStorage.setItem(JCP_SESSION_KEY, JSON.stringify(session));

        await this.addAuditLog('LOGIN', 'Painel Administrativo', `Usuário ${admin.name} autenticado com sucesso`);
        return session;
    }

    async logoutAdmin() {
        const admin = this.getCurrentAdmin();
        if (admin) {
            await this.addAuditLog('LOGOUT', 'Painel Administrativo', `Usuário ${admin.name} encerrou a sessão`);
        }
        sessionStorage.removeItem(JCP_SESSION_KEY);
        localStorage.removeItem(JCP_SESSION_KEY);
    }

    /* ==========================================================================
       AUDITORIA & LOGS GLOBAIS
       ========================================================================== */
    async addAuditLog(action, affectedRecord, details = '') {
        const db = this._read();
        const currentAdmin = this.getCurrentAdmin();
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
            ip: '127.0.0.1',
            details: typeof details === 'object' ? JSON.stringify(details) : String(details)
        };

        db.logs = db.logs || [];
        db.logs.unshift(logItem);

        // Limita a 500 logs para evitar estouro de memória
        if (db.logs.length > 500) {
            db.logs = db.logs.slice(0, 500);
        }

        this._save(db);
        return logItem;
    }

    async getLogs(filter = {}) {
        await this._delay();
        await this._requirePermission('logs:read');
        const db = this._read();
        let logs = db.logs || [];

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
        await this._delay(30);
        const sb = this._getSupabase();
        if (sb) {
            try {
                let query = sb.from('editions').select('*').order('created_at', { ascending: false });
                if (filter.status) query = query.eq('status', filter.status);
                if (filter.type) query = query.eq('type', filter.type);
                const { data, error } = await query;
                if (!error && Array.isArray(data)) {
                    let editions = data.map(d => ({
                        id: d.id,
                        name: d.name,
                        type: d.type,
                        city: d.city,
                        state: d.state,
                        country: d.country || 'Brasil',
                        date: d.date,
                        description: d.description || '',
                        image: d.image || 'assets/images/noite_clamor.jpg',
                        status: d.status || 'Planejamento',
                        registrationType: d.registration_type || 'free',
                        price: Number(d.price) || 0,
                        shirtPrice: Number(d.shirt_price) || 0,
                        shirtSizes: Array.isArray(d.shirt_sizes) ? d.shirt_sizes : (typeof d.shirt_sizes === 'string' ? JSON.parse(d.shirt_sizes || '[]') : []),
                        createdAt: d.created_at,
                        updatedAt: d.updated_at
                    })).filter(e => e.id !== 'ed_3');

                    if (filter.search) {
                        const s = filter.search.toLowerCase();
                        editions = editions.filter(e =>
                            e.name.toLowerCase().includes(s) ||
                            e.city.toLowerCase().includes(s) ||
                            e.state.toLowerCase().includes(s)
                        );
                    }
                    const db = this._read();
                    db.editions = editions;
                    this._save(db);
                    return editions;
                }
            } catch (err) {
                console.warn('Supabase getEditions indisponível, usando cache local:', err);
            }
        }

        const db = this._read();
        let editions = (db.editions || []).filter(e => e.id !== 'ed_3');

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
        await this._delay(20);
        const sb = this._getSupabase();
        if (sb) {
            try {
                const { data, error } = await sb.from('editions').select('*').eq('id', id).maybeSingle();
                if (!error && data) {
                    return {
                        id: data.id,
                        name: data.name,
                        type: data.type,
                        city: data.city,
                        state: data.state,
                        country: data.country || 'Brasil',
                        date: data.date,
                        description: data.description || '',
                        image: data.image || 'assets/images/noite_clamor.jpg',
                        status: data.status || 'Planejamento',
                        registrationType: data.registration_type || 'free',
                        price: Number(data.price) || 0,
                        shirtPrice: Number(data.shirt_price) || 0,
                        shirtSizes: Array.isArray(data.shirt_sizes) ? data.shirt_sizes : (typeof data.shirt_sizes === 'string' ? JSON.parse(data.shirt_sizes || '[]') : []),
                        createdAt: data.created_at,
                        updatedAt: data.updated_at
                    };
                }
            } catch (err) {
                console.warn('Supabase getEditionById falhou:', err);
            }
        }
        const db = this._read();
        return (db.editions || []).find(e => e.id === id) || null;
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

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('editions').insert([{
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
                }]);
            } catch (err) {
                console.warn('Erro ao inserir edição no Supabase:', err);
            }
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
        if (idx === -1) throw new Error('Edição não encontrada.');

        const old = db.editions[idx];
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

        const sb = this._getSupabase();
        if (sb) {
            try {
                const sbPayload = { updated_at: updated.updatedAt };
                if (patch.name !== undefined) sbPayload.name = updated.name;
                if (patch.type !== undefined) sbPayload.type = updated.type;
                if (patch.city !== undefined) sbPayload.city = updated.city;
                if (patch.state !== undefined) sbPayload.state = updated.state;
                if (patch.country !== undefined) sbPayload.country = updated.country;
                if (patch.date !== undefined) sbPayload.date = updated.date;
                if (patch.description !== undefined) sbPayload.description = updated.description;
                if (patch.image !== undefined) sbPayload.image = updated.image;
                if (patch.status !== undefined) sbPayload.status = updated.status;
                if (patch.registrationType !== undefined) sbPayload.registration_type = updated.registrationType;
                if (patch.price !== undefined) sbPayload.price = updated.price;
                if (patch.shirtPrice !== undefined) sbPayload.shirt_price = updated.shirtPrice;
                if (patch.shirtSizes !== undefined) sbPayload.shirt_sizes = updated.shirtSizes;

                await sb.from('editions').update(sbPayload).eq('id', id);
            } catch (err) {
                console.warn('Erro ao atualizar edição no Supabase:', err);
            }
        }

        db.editions[idx] = updated;
        this._save(db);

        await this.addAuditLog('EDIÇÃO_ATUALIZADA', updated.name, `Campos modificados: ${Object.keys(patch).join(', ')}`);
        return updated;
    }

    async deleteEdition(id) {
        await this._delay();
        await this._requirePermission('editions:write');
        const db = this._read();
        const target = (db.editions || []).find(e => e.id === id);
        if (!target) throw new Error('Edição não encontrada.');

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('actions').delete().eq('edition_id', id);
                await sb.from('enrollments').delete().eq('edition_id', id);
                await sb.from('editions').delete().eq('id', id);
            } catch (err) {
                console.warn('Erro ao excluir edição do Supabase:', err);
            }
        }

        // Remove ações vinculadas
        db.actions = (db.actions || []).filter(a => a.editionId !== id);
        // Remove inscrições vinculadas
        db.enrollments = (db.enrollments || []).filter(en => en.editionId !== id);
        // Remove edição
        db.editions = db.editions.filter(e => e.id !== id);

        this._save(db);
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
        await this._delay(20);
        const sb = this._getSupabase();
        if (sb) {
            try {
                let query = sb.from('actions').select('*');
                if (editionId) query = query.eq('edition_id', editionId);
                const { data, error } = await query;
                if (!error && Array.isArray(data)) {
                    const actions = data.map(d => ({
                        id: d.id,
                        editionId: d.edition_id,
                        title: d.title,
                        date: d.date,
                        time: d.time || '',
                        location: d.location || '',
                        leader: d.leader || '',
                        description: d.description || '',
                        status: d.status || 'Confirmada',
                        createdAt: d.created_at
                    }));
                    if (!editionId) {
                        const db = this._read();
                        db.actions = actions;
                        this._save(db);
                    }
                    return actions;
                }
            } catch (err) {
                console.warn('Supabase getActions falhou:', err);
            }
        }
        const db = this._read();
        let actions = db.actions || [];
        if (editionId) {
            actions = actions.filter(a => a.editionId === editionId);
        }
        return actions;
    }

    async addAction(actionData) {
        await this._delay();
        await this._requirePermission('actions:write');
        const db = this._read();

        const edition = (db.editions || []).find(e => e.id === actionData.editionId);
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

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('actions').insert([{
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
                }]);
            } catch (err) {
                console.warn('Erro ao inserir ação no Supabase:', err);
            }
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
        if (idx === -1) throw new Error('Ação não encontrada.');

        const updated = { ...db.actions[idx], ...patch };

        const sb = this._getSupabase();
        if (sb) {
            try {
                const sbPayload = {};
                if (patch.title !== undefined) sbPayload.title = updated.title;
                if (patch.date !== undefined) sbPayload.date = updated.date;
                if (patch.time !== undefined) sbPayload.time = updated.time;
                if (patch.location !== undefined) sbPayload.location = updated.location;
                if (patch.leader !== undefined) sbPayload.leader = updated.leader;
                if (patch.description !== undefined) sbPayload.description = updated.description;
                if (patch.status !== undefined) sbPayload.status = updated.status;
                await sb.from('actions').update(sbPayload).eq('id', id);
            } catch (err) {
                console.warn('Erro ao atualizar ação no Supabase:', err);
            }
        }

        db.actions[idx] = updated;
        this._save(db);

        await this.addAuditLog('AÇÃO_ATUALIZADA', updated.title, `Ação missionária atualizada`);
        return updated;
    }

    async deleteAction(id) {
        await this._delay();
        await this._requirePermission('actions:write');
        const db = this._read();
        const action = (db.actions || []).find(a => a.id === id);
        if (!action) return false;

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('actions').delete().eq('id', id);
            } catch (err) {
                console.warn('Erro ao excluir ação do Supabase:', err);
            }
        }

        db.actions = db.actions.filter(a => a.id !== id);
        this._save(db);

        await this.addAuditLog('AÇÃO_EXCLUÍDA', action.title, `Ação missionária removida da edição`);
        return true;
    }

    /* ==========================================================================
       3. PARTICIPANTES & VOLUNTÁRIOS
       ========================================================================== */
    getCurrentParticipant() {
        const raw = sessionStorage.getItem(JCP_PARTICIPANT_SESSION_KEY) || localStorage.getItem(JCP_PARTICIPANT_SESSION_KEY);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }

    setCurrentParticipant(participant) {
        if (!participant) {
            sessionStorage.removeItem(JCP_PARTICIPANT_SESSION_KEY);
            localStorage.removeItem(JCP_PARTICIPANT_SESSION_KEY);
        } else {
            const data = JSON.stringify(participant);
            sessionStorage.setItem(JCP_PARTICIPANT_SESSION_KEY, data);
            localStorage.setItem(JCP_PARTICIPANT_SESSION_KEY, data);
        }
    }

    async getParticipants(filter = {}) {
        await this._delay();
        const sb = this._getSupabase();
        if (sb) {
            try {
                let query = sb.from('participants').select('*').order('created_at', { ascending: false });
                if (filter.isVolunteer !== undefined) query = query.eq('is_volunteer', filter.isVolunteer);
                const { data, error } = await query;
                if (!error && Array.isArray(data)) {
                    const mapped = data.map(p => ({
                        id: p.id,
                        name: p.name,
                        birthDate: p.birth_date || '',
                        phone: p.phone || '',
                        email: p.email || '',
                        address: { city: p.city || '', state: p.state || '' },
                        isVolunteer: p.is_volunteer,
                        volunteerAreas: p.volunteer_areas || [],
                        status: 'Ativo',
                        createdAt: p.created_at
                    }));
                    const db = this._read();
                    db.participants = mapped;
                    this._save(db);
                }
            } catch (err) {
                console.warn('Supabase getParticipants falhou:', err);
            }
        }

        const db = this._read();
        let participants = db.participants || [];

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
        const db = this._read();
        const cleanPhone = phone.replace(/\D/g, '');
        return (db.participants || []).find(p => p.phone.replace(/\D/g, '') === cleanPhone) || null;
    }

    async getParticipantByEmail(email) {
        const db = this._read();
        return (db.participants || []).find(p => p.email.toLowerCase() === email.toLowerCase().trim()) || null;
    }

    async registerParticipant(data) {
        await this._delay();
        const db = this._read();
        db.participants = db.participants || [];

        const cleanPhone = (data.phone || '').trim();
        const cleanEmail = (data.email || '').trim().toLowerCase();

        // Evitar duplicidade pelo Telefone (ID único do participante)
        let existing = db.participants.find(p => p.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''));
        if (existing) {
            // Atualiza dados cadastrais
            existing.name = data.name.trim();
            existing.birthDate = data.birthDate || existing.birthDate;
            existing.email = cleanEmail || existing.email;
            existing.address = data.address || existing.address;
            existing.pastor = data.pastor || existing.pastor;
            existing.church = data.church || existing.church;
            if (data.isVolunteer !== undefined) existing.isVolunteer = data.isVolunteer;
            if (data.volunteerAreas) existing.volunteerAreas = data.volunteerAreas;
            if (data.volunteerOtherDetails !== undefined) existing.volunteerOtherDetails = data.volunteerOtherDetails;
            existing.updatedAt = new Date().toISOString();

            const sb = this._getSupabase();
            if (sb) {
                try {
                    await sb.from('participants').upsert({
                        id: existing.id,
                        name: existing.name,
                        birth_date: existing.birthDate || null,
                        phone: existing.phone || null,
                        email: existing.email || null,
                        city: typeof existing.address === 'object' ? existing.address.city : '',
                        state: typeof existing.address === 'object' ? existing.address.state : '',
                        is_volunteer: existing.isVolunteer,
                        volunteer_areas: existing.volunteerAreas || [],
                        updated_at: existing.updatedAt
                    });
                } catch (err) {
                    console.warn('Erro ao atualizar participante no Supabase:', err);
                }
            }

            this._save(db);
            this.setCurrentParticipant(existing);
            await this.addAuditLog('CADASTRO_ATUALIZADO', existing.name, `Participante atualizou informações cadastrais`);
            return existing;
        }

        const newPart = {
            id: 'part_' + Date.now(),
            name: data.name.trim(),
            birthDate: data.birthDate || '',
            phone: cleanPhone,
            email: cleanEmail,
            address: data.address || { street: '', number: '', neighborhood: '', city: '', state: '' },
            pastor: data.pastor ? data.pastor.trim() : '',
            church: data.church ? data.church.trim() : '',
            isVolunteer: Boolean(data.isVolunteer),
            volunteerAreas: Array.isArray(data.volunteerAreas) ? data.volunteerAreas : [],
            volunteerOtherDetails: data.volunteerOtherDetails ? data.volunteerOtherDetails.trim() : '',
            status: 'Ativo',
            createdAt: new Date().toISOString()
        };

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('participants').insert([{
                    id: newPart.id,
                    name: newPart.name,
                    birth_date: newPart.birthDate || null,
                    phone: newPart.phone || null,
                    email: newPart.email || null,
                    city: typeof newPart.address === 'object' ? newPart.address.city : '',
                    state: typeof newPart.address === 'object' ? newPart.address.state : '',
                    is_volunteer: newPart.isVolunteer,
                    volunteer_areas: newPart.volunteerAreas || [],
                    created_at: newPart.createdAt,
                    updated_at: newPart.createdAt
                }]);
            } catch (err) {
                console.warn('Erro ao inserir participante no Supabase:', err);
            }
        }

        db.participants.unshift(newPart);
        this._save(db);
        this.setCurrentParticipant(newPart);

        const logAction = newPart.isVolunteer ? 'CADASTRO_VOLUNTÁRIO' : 'CADASTRO_PARTICIPANTE';
        await this.addAuditLog(logAction, newPart.name, `Novo cadastro realizado (Telefone: ${newPart.phone}, Voluntário: ${newPart.isVolunteer ? 'SIM' : 'NÃO'})`);
        return newPart;
    }

    async updateParticipant(id, patch) {
        await this._delay();
        await this._requirePermission('volunteers:write');
        const db = this._read();
        const idx = (db.participants || []).findIndex(p => p.id === id);
        if (idx === -1) throw new Error('Participante não encontrado.');

        const updated = { ...db.participants[idx], ...patch, updatedAt: new Date().toISOString() };
        db.participants[idx] = updated;
        this._save(db);

        await this.addAuditLog('PARTICIPANTE_ATUALIZADO', updated.name, `Registro de participante/voluntário alterado`);
        return updated;
    }

    async deleteParticipant(id) {
        await this._delay();
        await this._requirePermission('volunteers:write');
        const db = this._read();
        const part = (db.participants || []).find(p => p.id === id);
        if (!part) return false;

        db.participants = db.participants.filter(p => p.id !== id);
        // Exclui inscrições vinculadas
        db.enrollments = (db.enrollments || []).filter(en => en.participantId !== id);

        this._save(db);
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
        const sb = this._getSupabase();
        if (sb) {
            try {
                let query = sb.from('enrollments').select('*').order('created_at', { ascending: false });
                if (filter.editionId) query = query.eq('edition_id', filter.editionId);
                if (filter.participantId) query = query.eq('participant_id', filter.participantId);
                if (filter.status) query = query.eq('status', filter.status);
                const { data, error } = await query;
                if (!error && Array.isArray(data)) {
                    const mapped = data.map(en => ({
                        id: en.id,
                        editionId: en.edition_id,
                        participantId: en.participant_id,
                        participantName: en.participant_name,
                        editionName: en.edition_name,
                        shirtSize: en.shirt_size || '',
                        amount: Number(en.amount_paid) || 0,
                        status: en.status || 'Pendente',
                        proofFile: en.proof_url || '',
                        createdAt: en.created_at,
                        updatedAt: en.updated_at
                    }));
                    const db = this._read();
                    db.enrollments = mapped;
                    this._save(db);
                }
            } catch (err) {
                console.warn('Supabase getEnrollments falhou:', err);
            }
        }

        const db = this._read();
        let enrollments = db.enrollments || [];

        if (filter.editionId) {
            enrollments = enrollments.filter(e => e.editionId === filter.editionId);
        }
        if (filter.participantId) {
            enrollments = enrollments.filter(e => e.participantId === filter.participantId);
        }
        if (filter.status) {
            enrollments = enrollments.filter(e => e.status === filter.status);
        }
        if (filter.paymentStatus) {
            enrollments = enrollments.filter(e => e.paymentStatus === filter.paymentStatus);
        }

        // Popula relacionamentos com Participante e Edição
        return enrollments.map(en => {
            const participant = (db.participants || []).find(p => p.id === en.participantId) || null;
            const edition = (db.editions || []).find(e => e.id === en.editionId) || null;
            return {
                ...en,
                participant,
                edition
            };
        });
    }

    async createEnrollment(data) {
        await this._delay();
        const db = this._read();

        const edition = (db.editions || []).find(e => e.id === data.editionId);
        if (!edition) throw new Error('Edição selecionada não foi encontrada.');

        let participant = null;
        if (data.participantId) {
            participant = (db.participants || []).find(p => p.id === data.participantId);
        } else if (data.participantData) {
            participant = await this.registerParticipant(data.participantData);
        }

        if (!participant) throw new Error('Dados do participante inválidos.');

        // Verifica se já está inscrito nesta edição
        const existing = (db.enrollments || []).find(en => en.editionId === edition.id && en.participantId === participant.id && en.status !== 'Cancelada');
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

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('enrollments').insert([{
                    id: newEnrollment.id,
                    edition_id: newEnrollment.editionId,
                    participant_id: newEnrollment.participantId,
                    participant_name: participant.name,
                    participant_phone: participant.phone || '',
                    participant_email: participant.email || '',
                    edition_name: edition.name,
                    shirt_size: newEnrollment.shirtSize,
                    amount_paid: newEnrollment.amount,
                    status: newEnrollment.status,
                    proof_url: newEnrollment.proofFile ? 'comprovante_anexo' : '',
                    created_at: newEnrollment.createdAt,
                    updated_at: newEnrollment.updatedAt
                }]);
            } catch (err) {
                console.warn('Erro ao inserir inscrição no Supabase:', err);
            }
        }

        db.enrollments = db.enrollments || [];
        db.enrollments.unshift(newEnrollment);
        this._save(db);

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
        if (idx === -1) throw new Error('Inscrição não encontrada.');

        const en = db.enrollments[idx];
        en.status = newStatus || en.status;
        if (paymentStatus) en.paymentStatus = paymentStatus;
        if (adminNotes !== undefined) en.adminNotes = adminNotes;
        en.updatedAt = new Date().toISOString();

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('enrollments').update({
                    status: en.status,
                    updated_at: en.updatedAt
                }).eq('id', id);
            } catch (err) {
                console.warn('Erro ao atualizar status de inscrição no Supabase:', err);
            }
        }

        this._save(db);
        await this.addAuditLog('INSCRIÇÃO_ATUALIZADA', en.id, `Status alterado para: ${en.status}`);
        return en;
    }

    async deleteEnrollment(id) {
        await this._delay();
        await this._requirePermission('enrollments:write');
        const db = this._read();
        const en = (db.enrollments || []).find(e => e.id === id);
        if (!en) return false;

        db.enrollments = db.enrollments.filter(e => e.id !== id);
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
        const db = this._read();
        return (db.admins || []).map(a => {
            const role = (db.roles || []).find(r => r.id === a.roleId);
            return {
                id: a.id,
                name: a.name,
                email: a.email,
                roleId: a.roleId,
                roleName: role ? role.name : a.roleId,
                status: a.status || 'Ativo',
                avatar: a.avatar || a.name.substring(0, 2).toUpperCase(),
                createdAt: a.createdAt
            };
        });
    }

    async getRoles() {
        await this._delay();
        const db = this._read();
        return db.roles || [];
    }

    async addAdmin(data) {
        await this._delay();
        await this._requirePermission('users:manage');
        const db = this._read();

        const email = data.email.trim().toLowerCase();
        if (db.admins.find(a => a.email.toLowerCase() === email)) {
            throw new Error('Já existe um administrador cadastrado com este e-mail.');
        }

        const newAdmin = {
            id: 'adm_' + Date.now(),
            name: data.name.trim(),
            email,
            password: data.password || 'jcp123456',
            roleId: data.roleId || 'coordenador',
            status: data.status || 'Ativo',
            avatar: data.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(),
            createdAt: new Date().toISOString()
        };

        db.admins.push(newAdmin);
        this._save(db);

        await this.addAuditLog('ADMIN_CRIADO', newAdmin.name, `Novo usuário administrativo criado com perfil: ${newAdmin.roleId}`);
        return newAdmin;
    }

    async updateAdmin(id, patch) {
        await this._delay();
        await this._requirePermission('users:manage');
        const db = this._read();
        const idx = (db.admins || []).findIndex(a => a.id === id);
        if (idx === -1) throw new Error('Administrador não encontrado.');

        const old = db.admins[idx];
        const updated = { ...old, ...patch };
        if (patch.password === '') delete updated.password;

        db.admins[idx] = updated;
        this._save(db);

        await this.addAuditLog('ADMIN_ATUALIZADO', updated.name, `Dados do administrador atualizados`);
        return updated;
    }

    async deleteAdmin(id) {
        await this._delay();
        await this._requirePermission('users:manage');
        const db = this._read();

        const current = this.getCurrentAdmin();
        if (current && current.id === id) {
            throw new Error('Você não pode excluir sua própria conta de administrador.');
        }

        const admin = (db.admins || []).find(a => a.id === id);
        if (!admin) return false;

        db.admins = db.admins.filter(a => a.id !== id);
        this._save(db);

        await this.addAuditLog('ADMIN_EXCLUÍDO', admin.name, `Administrador removido do sistema`);
        return true;
    }

    async addRole(roleData) {
        await this._delay();
        await this._requirePermission('users:manage');
        const db = this._read();

        const roleId = roleData.id || roleData.name.toLowerCase().replace(/\s+/g, '_');
        if (db.roles.find(r => r.id === roleId)) {
            throw new Error('Já existe um perfil com este identificador.');
        }

        const newRole = {
            id: roleId,
            name: roleData.name.trim(),
            description: roleData.description || '',
            permissions: Array.isArray(roleData.permissions) ? roleData.permissions : [],
            isSystem: false
        };

        db.roles.push(newRole);
        this._save(db);

        await this.addAuditLog('PERFIL_CRIADO', newRole.name, `Novo perfil de permissões criado`);
        return newRole;
    }

    /* ==========================================================================
       6. CONFIGURAÇÕES GLOBAIS
       ========================================================================== */
    async getSettings() {
        await this._delay();
        const sb = this._getSupabase();
        if (sb) {
            try {
                const { data, error } = await sb.from('settings').select('*').eq('id', 'global_settings').maybeSingle();
                if (!error && data) {
                    const mapped = {
                        pixKey: data.pix_key || '',
                        pixKeyType: data.pix_key_type || 'E-mail',
                        pixBeneficiary: data.pix_beneficiary || '',
                        pixBank: data.pix_bank || '',
                        pixCity: data.pix_city || '',
                        pixNotice: data.pix_notice || '',
                        contactEmail: data.contact_email || '',
                        contactPhone: data.contact_phone || '',
                        instagram: data.instagram || ''
                    };
                    const db = this._read();
                    db.settings = { ...(db.settings || {}), ...mapped };
                    this._save(db);
                    return db.settings;
                }
            } catch (err) {
                console.warn('Supabase getSettings falhou, usando cache:', err);
            }
        }
        const db = this._read();
        return db.settings || {
            pixKey: 'projetojovenscomproposito@gmail.com',
            pixKeyType: 'E-mail',
            pixBeneficiary: 'Projeto Jovens com Propósito',
            pixBank: 'Banco do Brasil',
            pixCity: 'Patos - PB',
            pixNotice: 'Sua contribuição sustenta a realização dos encontros e viagens missionárias pelo sertão.'
        };
    }

    async updateSettings(patch) {
        await this._delay();
        await this._requirePermission('settings:write');
        const db = this._read();

        const oldSettings = db.settings || {};
        db.settings = { ...oldSettings, ...patch };

        const sb = this._getSupabase();
        if (sb) {
            try {
                const sbPayload = {
                    updated_at: new Date().toISOString()
                };
                if (patch.pixKey !== undefined) sbPayload.pix_key = patch.pixKey;
                if (patch.pixKeyType !== undefined) sbPayload.pix_key_type = patch.pixKeyType;
                if (patch.pixBeneficiary !== undefined) sbPayload.pix_beneficiary = patch.pixBeneficiary;
                if (patch.pixBank !== undefined) sbPayload.pix_bank = patch.pixBank;
                if (patch.pixCity !== undefined) sbPayload.pix_city = patch.pixCity;
                if (patch.pixNotice !== undefined) sbPayload.pix_notice = patch.pixNotice;
                if (patch.contactEmail !== undefined) sbPayload.contact_email = patch.contactEmail;
                if (patch.contactPhone !== undefined) sbPayload.contact_phone = patch.contactPhone;
                if (patch.instagram !== undefined) sbPayload.instagram = patch.instagram;

                await sb.from('settings').upsert({ id: 'global_settings', ...sbPayload });
            } catch (err) {
                console.warn('Erro ao atualizar configurações no Supabase:', err);
            }
        }

        this._save(db);

        await this.addAuditLog(
            'CONFIG_ATUALIZADA',
            'Configurações Globais',
            `Configurações do sistema atualizadas: ${Object.keys(patch).join(', ')}`
        );
        return db.settings;
    }

    /* ==========================================================================
       7. CONTRIBUIÇÕES VOLUNTÁRIAS
       ========================================================================== */
    async getContributions() {
        await this._delay();
        const sb = this._getSupabase();
        if (sb) {
            try {
                const { data, error } = await sb.from('contributions').select('*').order('created_at', { ascending: false });
                if (!error && Array.isArray(data)) {
                    const list = data.map(c => ({
                        id: c.id,
                        donorName: c.donor_name || 'Doador Anônimo',
                        email: c.donor_email || '',
                        phone: '',
                        amount: Number(c.amount) || 0,
                        date: c.created_at,
                        paymentMethod: 'PIX',
                        notes: c.intent || '',
                        status: c.status || 'Confirmado'
                    }));
                    const db = this._read();
                    db.contributions = list;
                    this._save(db);
                    return list;
                }
            } catch (err) {
                console.warn('Supabase getContributions falhou:', err);
            }
        }
        const db = this._read();
        return db.contributions || [];
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

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('contributions').insert([{
                    id: newContrib.id,
                    donor_name: newContrib.donorName,
                    donor_email: newContrib.email,
                    amount: newContrib.amount,
                    intent: newContrib.notes,
                    status: newContrib.status,
                    created_at: newContrib.date
                }]);
            } catch (err) {
                console.warn('Erro ao inserir contribuição no Supabase:', err);
            }
        }

        db.contributions = db.contributions || [];
        db.contributions.unshift(newContrib);
        this._save(db);

        await this.addAuditLog('CONTRIBUIÇÃO_RECEBIDA', `R$ ${newContrib.amount.toFixed(2)} (${newContrib.donorName})`, `Contribuição voluntária via PIX registrada`);
        return newContrib;
    }

    /* ==========================================================================
       8. CMS & MENSAGENS DO FORMULÁRIO
       ========================================================================== */
    async getContent() {
        await this._delay();
        const db = this._read();
        return db.content || {};
    }

    async updateContent(patch) {
        await this._delay();
        await this._requirePermission('content:write');
        const db = this._read();
        db.content = { ...db.content, ...patch };
        this._save(db);

        await this.addAuditLog('CONTEÚDO_CMS_ATUALIZADO', 'Textos do Site', `Alteração de conteúdo da landing page`);
        return db.content;
    }

    async getMessages() {
        await this._delay();
        const db = this._read();
        return db.messages || [];
    }

    async markMessageAsRead(id) {
        await this._delay();
        const db = this._read();
        const msg = (db.messages || []).find(m => m.id === id);
        if (msg) msg.read = true;
        this._save(db);
    }

    async deleteMessage(id) {
        await this._delay();
        const db = this._read();
        db.messages = (db.messages || []).filter(m => m.id !== id);
        this._save(db);
    }

    /* ==========================================================================
       9. DASHBOARD: ESTATÍSTICAS REAIS DO BANCO DE DADOS
       ========================================================================== */
    async getStats() {
        await this._delay();
        const db = this._read();

        const participants = db.participants || [];
        const volunteers = participants.filter(p => p.isVolunteer);
        const editions = db.editions || [];
        const enrollments = db.enrollments || [];
        const actions = db.actions || [];
        const contributions = db.contributions || [];

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
    getPrayerCount() {
        const db = this._read();
        const prayers = db.prayers || [];
        return prayers.length;
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

        const db = this._read();
        db.prayers = db.prayers || [];

        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const alreadyToday = db.prayers.find(
            p => p.participantId === participant.id && p.date === today
        );

        if (alreadyToday) {
            return { success: false, alreadyDone: true, count: db.prayers.length };
        }

        const prayerEntry = {
            id: 'prayer_' + Date.now(),
            participantId: participant.id,
            participantName: participant.name || 'Anônimo',
            date: today,
            registeredAt: new Date().toISOString()
        };

        db.prayers.unshift(prayerEntry);
        this._save(db);

        await this.addAuditLog(
            'ORAÇÃO_REGISTRADA',
            participant.name || 'Participante',
            `${participant.name} registrou intercession em ${today}`
        );

        return { success: true, alreadyDone: false, count: db.prayers.length };
    }

    /**
     * Verifica se o participante já orou hoje.
     */
    hasParticipantPrayedToday() {
        const participant = this.getCurrentParticipant();
        if (!participant) return false;
        const db = this._read();
        const prayers = db.prayers || [];
        const today = new Date().toISOString().slice(0, 10);
        return !!prayers.find(p => p.participantId === participant.id && p.date === today);
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

        const db = this._read();
        db.contributions = db.contributions || [];

        const newContrib = {
            id: 'contrib_' + Date.now(),
            name: (data.name && data.name.trim()) ? data.name.trim() : 'Anônimo',
            amount: (data.amount && data.amount.trim()) ? data.amount.trim() : '',
            proofFile: data.proofFile,
            proofFileName: data.proofFileName || 'comprovante.png',
            status: 'Confirmada',
            paymentStatus: 'Comprovante Enviado',
            createdAt: new Date().toISOString(),
            adminNotes: ''
        };

        db.contributions.unshift(newContrib);
        this._save(db);

        const detailsText = `Comprovante recebido via PIX${newContrib.amount ? '. Valor: ' + newContrib.amount : ''}. Arquivo: ${newContrib.proofFileName}`;
        await this.addAuditLog(
            'CONTRIBUIÇÃO_RECEBIDA',
            newContrib.name,
            detailsText
        );

        return newContrib;
    }

    /* ==========================================================================
       DEPARTAMENTOS
       ========================================================================== */

    async getDepartments(onlyActive = false) {
        await this._delay(20);
        const sb = this._getSupabase();
        if (sb) {
            try {
                let query = sb.from('departments').select('*').order('order_index');
                if (onlyActive) query = query.eq('active', true);
                const { data, error } = await query;
                if (!error && Array.isArray(data)) {
                    const depts = data.map(d => ({
                        id: d.id,
                        name: d.name,
                        description: d.description || '',
                        isActive: d.active !== false,
                        orderIndex: d.order_index ?? 0,
                        createdAt: d.created_at,
                        updatedAt: d.updated_at
                    }));
                    const db = this._read();
                    db.departments = depts;
                    this._save(db);
                    return depts;
                }
            } catch (err) {
                console.warn('Supabase getDepartments falhou, usando cache local:', err);
            }
        }
        const db = this._read();
        let depts = db.departments || [];
        if (onlyActive) depts = depts.filter(d => d.isActive);
        return depts.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    async getDepartmentById(id) {
        await this._delay(20);
        const sb = this._getSupabase();
        if (sb) {
            try {
                const { data, error } = await sb.from('departments').select('*').eq('id', id).maybeSingle();
                if (!error && data) {
                    return {
                        id: data.id,
                        name: data.name,
                        description: data.description || '',
                        isActive: data.active !== false,
                        orderIndex: data.order_index ?? 0,
                        createdAt: data.created_at,
                        updatedAt: data.updated_at
                    };
                }
            } catch (err) {
                console.warn('Supabase getDepartmentById falhou:', err);
            }
        }
        const db = this._read();
        return (db.departments || []).find(d => d.id === id) || null;
    }

    async createDepartment(data) {
        await this._requirePermission('leaders:write');
        await this._delay();
        if (!data.name || !data.name.trim()) throw new Error('O nome do departamento é obrigatório.');
        const db = this._read();
        db.departments = db.departments || [];
        const exists = db.departments.find(d => d.name.toLowerCase().trim() === data.name.toLowerCase().trim());
        if (exists) throw new Error('Já existe um departamento com este nome.');
        const now = new Date().toISOString();
        const newDept = {
            id: 'dept_' + Date.now(),
            name: data.name.trim(),
            description: (data.description || '').trim(),
            isActive: data.isActive !== false,
            createdAt: now,
            updatedAt: now
        };

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('departments').insert([{
                    id: newDept.id,
                    name: newDept.name,
                    description: newDept.description,
                    active: newDept.isActive,
                    created_at: now,
                    updated_at: now
                }]);
            } catch (err) {
                console.warn('Erro ao inserir departamento no Supabase:', err);
            }
        }

        db.departments.push(newDept);
        this._save(db);
        await this.addAuditLog('DEPARTAMENTO_CRIADO', newDept.name, `Departamento "${newDept.name}" cadastrado`);
        return newDept;
    }

    async updateDepartment(id, data) {
        await this._requirePermission('leaders:write');
        await this._delay();
        const db = this._read();
        db.departments = db.departments || [];
        const idx = db.departments.findIndex(d => d.id === id);
        if (idx === -1) throw new Error('Departamento não encontrado.');
        const now = new Date().toISOString();
        const updated = { ...db.departments[idx], ...data, updatedAt: now };

        const sb = this._getSupabase();
        if (sb) {
            try {
                const sbData = { updated_at: now };
                if (data.name !== undefined) sbData.name = data.name;
                if (data.description !== undefined) sbData.description = data.description;
                if (data.isActive !== undefined) sbData.active = data.isActive;
                await sb.from('departments').update(sbData).eq('id', id);
            } catch (err) {
                console.warn('Erro ao atualizar departamento no Supabase:', err);
            }
        }

        db.departments[idx] = updated;
        this._save(db);
        await this.addAuditLog('DEPARTAMENTO_ATUALIZADO', updated.name, `Departamento "${updated.name}" atualizado`);
        return updated;
    }

    async deleteDepartment(id) {
        await this._requirePermission('leaders:write');
        await this._delay();
        const db = this._read();
        const dept = (db.departments || []).find(d => d.id === id);
        if (!dept) throw new Error('Departamento não encontrado.');
        const hasLeaders = (db.leaders || []).some(l => l.departmentId === id);
        if (hasLeaders) throw new Error('Este departamento possui líderes vinculados. Reassine-os antes de excluir.');

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('departments').delete().eq('id', id);
            } catch (err) {
                console.warn('Erro ao excluir departamento do Supabase:', err);
            }
        }

        db.departments = db.departments.filter(d => d.id !== id);
        this._save(db);
        await this.addAuditLog('DEPARTAMENTO_EXCLUÍDO', dept.name, `Departamento "${dept.name}" excluído`);
        return true;
    }

    /* ==========================================================================
       LÍDERES
       ========================================================================== */

    async getLeaders(filters = {}) {
        await this._delay(30);
        const sb = this._getSupabase();
        if (sb) {
            try {
                let query = sb.from('leaders').select('*').order('order_index');
                if (filters.onlyPublished) query = query.eq('published', true).eq('active', true);
                if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
                if (filters.status === 'active') query = query.eq('active', true);
                if (filters.status === 'inactive') query = query.eq('active', false);
                if (filters.status === 'published') query = query.eq('published', true);
                if (filters.status === 'draft') query = query.eq('published', false);

                const { data, error } = await query;
                if (!error && Array.isArray(data)) {
                    let leaders = data.map(d => ({
                        id: d.id,
                        fullName: d.full_name,
                        departmentId: d.department_id,
                        departmentName: d.department_name || '',
                        roleTitle: d.role_title || '',
                        biography: d.biography || '',
                        photoPath: d.photo_url || '',
                        instagramUrl: d.instagram_url || '',
                        displayOrder: d.order_index ?? 999,
                        isActive: d.active !== false,
                        isPublished: d.published !== false,
                        createdAt: d.created_at,
                        updatedAt: d.updated_at
                    }));

                    if (filters.search) {
                        const q = filters.search.toLowerCase();
                        leaders = leaders.filter(l => l.fullName.toLowerCase().includes(q) || (l.departmentName && l.departmentName.toLowerCase().includes(q)));
                    }

                    const db = this._read();
                    db.leaders = leaders;
                    this._save(db);
                    return leaders;
                }
            } catch (err) {
                console.warn('Supabase getLeaders falhou, usando cache local:', err);
            }
        }

        const db = this._read();
        let leaders = db.leaders || [];
        const depts = db.departments || [];

        // Enrich with department name
        leaders = leaders.map(l => ({
            ...l,
            departmentName: (depts.find(d => d.id === l.departmentId) || {}).name || '—'
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
        await this._delay(20);
        const sb = this._getSupabase();
        if (sb) {
            try {
                const { data, error } = await sb.from('leaders').select('*').eq('id', id).maybeSingle();
                if (!error && data) {
                    return {
                        id: data.id,
                        fullName: data.full_name,
                        departmentId: data.department_id,
                        departmentName: data.department_name || '—',
                        roleTitle: data.role_title || '',
                        biography: data.biography || '',
                        photoPath: data.photo_url || '',
                        instagramUrl: data.instagram_url || '',
                        displayOrder: data.order_index ?? 999,
                        isActive: data.active !== false,
                        isPublished: data.published !== false,
                        createdAt: data.created_at,
                        updatedAt: data.updated_at
                    };
                }
            } catch (err) {
                console.warn('Supabase getLeaderById falhou:', err);
            }
        }
        const db = this._read();
        const leader = (db.leaders || []).find(l => l.id === id);
        if (!leader) return null;
        const dept = (db.departments || []).find(d => d.id === leader.departmentId);
        return { ...leader, departmentName: dept ? dept.name : '—' };
    }

    async createLeader(data) {
        await this._requirePermission('leaders:write');
        await this._delay();
        if (!data.fullName || !data.fullName.trim()) throw new Error('O nome completo é obrigatório.');
        if (!data.departmentId) throw new Error('O departamento é obrigatório.');
        if (!data.biography || !data.biography.trim()) throw new Error('A apresentação é obrigatória.');
        const now = new Date().toISOString();
        const db = this._read();
        const dept = (db.departments || []).find(d => d.id === data.departmentId);
        const deptName = dept ? dept.name : (data.departmentName || '');

        const newLeader = {
            id: 'leader_' + Date.now(),
            fullName: data.fullName.trim(),
            departmentId: data.departmentId,
            departmentName: deptName,
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

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('leaders').insert([{
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
                    created_at: now,
                    updated_at: now
                }]);
            } catch (err) {
                console.warn('Erro ao inserir líder no Supabase:', err);
            }
        }

        db.leaders = db.leaders || [];
        db.leaders.push(newLeader);
        this._save(db);
        await this.addAuditLog('LÍDER_CRIADO', newLeader.fullName, `Líder "${newLeader.fullName}" cadastrado`);
        return newLeader;
    }

    async updateLeader(id, data) {
        await this._requirePermission('leaders:write');
        await this._delay();
        const db = this._read();
        db.leaders = db.leaders || [];
        const idx = db.leaders.findIndex(l => l.id === id);
        if (idx === -1) throw new Error('Líder não encontrado.');
        const cleanData = { ...data };
        Object.keys(cleanData).forEach(k => { if (cleanData[k] === undefined) delete cleanData[k]; });
        const now = new Date().toISOString();

        let deptName = db.leaders[idx].departmentName;
        if (cleanData.departmentId) {
            const d = (db.departments || []).find(dep => dep.id === cleanData.departmentId);
            if (d) deptName = d.name;
        }

        const updated = {
            ...db.leaders[idx],
            ...cleanData,
            departmentName: deptName,
            displayOrder: cleanData.displayOrder !== undefined ? Number(cleanData.displayOrder) : db.leaders[idx].displayOrder,
            updatedAt: now
        };

        const sb = this._getSupabase();
        if (sb) {
            try {
                const sbPayload = { updated_at: now };
                if (cleanData.fullName !== undefined) sbPayload.full_name = updated.fullName;
                if (cleanData.departmentId !== undefined) {
                    sbPayload.department_id = updated.departmentId;
                    sbPayload.department_name = deptName;
                }
                if (cleanData.roleTitle !== undefined) sbPayload.role_title = updated.roleTitle;
                if (cleanData.biography !== undefined) sbPayload.biography = updated.biography;
                if (cleanData.photoPath !== undefined) sbPayload.photo_url = updated.photoPath;
                if (cleanData.instagramUrl !== undefined) sbPayload.instagram_url = updated.instagramUrl;
                if (cleanData.displayOrder !== undefined) sbPayload.order_index = updated.displayOrder;
                if (cleanData.isActive !== undefined) sbPayload.active = updated.isActive;
                if (cleanData.isPublished !== undefined) sbPayload.published = updated.isPublished;

                await sb.from('leaders').update(sbPayload).eq('id', id);
            } catch (err) {
                console.warn('Erro ao atualizar líder no Supabase:', err);
            }
        }

        db.leaders[idx] = updated;
        this._save(db);
        await this.addAuditLog('LÍDER_ATUALIZADO', updated.fullName, `Líder "${updated.fullName}" atualizado`);
        return updated;
    }

    async toggleLeaderPublish(id) {
        await this._requirePermission('leaders:write');
        const db = this._read();
        const idx = (db.leaders || []).findIndex(l => l.id === id);
        if (idx === -1) throw new Error('Líder não encontrado.');
        const leader = db.leaders[idx];
        leader.isPublished = !leader.isPublished;
        leader.updatedAt = new Date().toISOString();

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('leaders').update({ published: leader.isPublished, updated_at: leader.updatedAt }).eq('id', id);
            } catch (err) {
                console.warn('Erro ao atualizar publicação do líder no Supabase:', err);
            }
        }

        db.leaders[idx] = leader;
        this._save(db);
        const action = leader.isPublished ? 'LÍDER_PUBLICADO' : 'LÍDER_DESPUBLICADO';
        await this.addAuditLog(action, leader.fullName, `Status de publicação alterado para "${leader.isPublished ? 'Publicado' : 'Rascunho'}"`);
        return leader;
    }

    async deleteLeader(id) {
        await this._requirePermission('leaders:write');
        await this._delay();
        const db = this._read();
        const leader = (db.leaders || []).find(l => l.id === id);
        if (!leader) throw new Error('Líder não encontrado.');

        const sb = this._getSupabase();
        if (sb) {
            try {
                await sb.from('leaders').delete().eq('id', id);
            } catch (err) {
                console.warn('Erro ao excluir líder do Supabase:', err);
            }
        }

        db.leaders = db.leaders.filter(l => l.id !== id);
        this._save(db);
        await this.addAuditLog('LÍDER_EXCLUÍDO', leader.fullName, `Líder "${leader.fullName}" excluído do sistema`);
        return true;
    }

    /** Retorna líderes publicados e ativos para exibição no site público */
    async getPublicLeaders() {
        return this.getLeaders({ onlyPublished: true });
    }
}

// Instância global disponível como window.db
window.db = new DatabaseService();
