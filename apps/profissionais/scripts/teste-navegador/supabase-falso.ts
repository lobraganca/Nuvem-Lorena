/* Cliente Supabase de mentira, só para rodar o app nesta máquina e
   exercitar a navegação. Implementa o pedaço do PostgREST que o app usa:
   from().select().order().range().eq().or().contains().gte().in().neq()
   e os finalizadores single()/maybeSingle(), tudo encadeável e "thenable". */

type Linha = Record<string, unknown>;

/**
 * Um ajuste do teste: `?lado=empresa` na URL, ou guardado no navegador.
 *
 * A URL continua mandando — é como os testes de Playwright dirigem tudo.
 * O armazenamento existe para a DEMONSTRAÇÃO publicada, que roda num
 * endereço fixo onde não dá para acrescentar `?lado=`: lá o seletor do topo
 * grava a escolha e recarrega.
 */
function ajuste(nome: string): string | null {
  const daUrl = new URLSearchParams(location.search).get(nome);
  if (daUrl !== null) return daUrl;
  try {
    return localStorage.getItem("falso-" + nome);
  } catch {
    return null;
  }
}

const AGORA = Date.now();
const emDias = (d: number) => new Date(AGORA + d * 86400000).toISOString();

/** Ligado pelo teste: o perfil já vem preenchido, com foto. */
const perfilCompleto = () =>
  typeof localStorage !== "undefined" && localStorage.getItem("falso-perfil-completo") === "1";

const CATS = ["Encanador", "Eletricista", "Pedreiro", "Pintor", "Marceneiro", "Serralheiro", "Vidraceiro", "Gesseiro", "Marido de aluguel", "Montador de móveis", "Chaveiro", "Jardineiro", "Piscineiro", "Dedetizador", "Diarista", "Passadeira", "Cuidador de idosos", "Babá", "Técnico em informática", "Técnico em celulares", "Refrigeração e ar-condicionado", "Conserto de eletrodomésticos", "Mecânico", "Borracheiro", "Lavagem de carros", "Funilaria e pintura automotiva", "Cabeleireiro", "Barbeiro", "Manicure", "Depilação", "Maquiadora", "Estética e sobrancelhas", "Massagista", "Personal trainer", "Nutricionista", "Fisioterapeuta", "Psicólogo", "Professor particular", "Professor de inglês", "Professor de música"];

/* Quantos cadastros o banco falso tem. Trocar para 3 exercita a cidade
   quase vazia, que é onde a tela inicial em prateleiras pode ficar feia. */
const QUANTOS = Number(ajuste("falsos") ?? 60);

/* O dono da sessão de mentira. Os dois primeiros cadastros são dele, senão
   o painel abre vazio e não dá para conferir nada do que ele mostra. */
export const DONO_FALSO = "00000000-0000-4000-8000-000000000001";

/* Retângulo colorido em SVG, embutido no próprio endereço. Não sai para
   a rede — a política deste container bloqueia domínio de fora, e uma foto
   que não carrega deixa a grade toda cinza no exato teste em que se quer
   ver a grade com foto. */
function fotoFalsa(i: number): string {
  const cores = ["#8aa0b8", "#b89a8a", "#8ab89c", "#b8a88a", "#a08ab8", "#b88a9c"];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">` +
    `<rect width="200" height="200" fill="${cores[i % cores.length]}"/>` +
    `<circle cx="100" cy="78" r="34" fill="#ffffff" opacity=".85"/>` +
    `<path d="M40 200a60 60 0 0 1 120 0z" fill="#ffffff" opacity=".85"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const professionals: Linha[] = Array.from({ length: QUANTOS }, (_, i) => ({
  id: `pro-${i}`,
  /* Numa conta nova nenhum cadastro é da pessoa: a cidade continua cheia
     (senão não há o que olhar), mas ela não é dona de nada. */
  owner_id: i < 2 && !contaNova() ? DONO_FALSO : `dono-${i}`,
  name: i === 0 ? "Mariaeduardadesouzaeoliveira Nascimento" : `Profissional ${i}`,
  category: CATS[i % CATS.length],
  categories: [CATS[i % CATS.length]],
  /* A coluna do Ei: é por ela que a tela de profissionais filtra e monta a
     fileira de ofícios. Faltava, e a fileira nascia sempre vazia. */
  areas_de_interesse: [CATS[i % CATS.length], CATS[(i + 7) % CATS.length]],
  neighborhood: ["Centro", "Praia", "Vila Rica", "Nossa Senhora do Carmo"][i % 4],
  /* ── NEM TODO MUNDO É DE ITABIRITO — 05/09 ───────────────────────────
     Eram todos, e por isso o seletor de cidade (que só aparece quando há
     mais de uma) nunca era exercitado aqui: o teste dizia "não apareceu"
     e não havia como saber se era a regra funcionando ou a peça quebrada.

     Um em cada sete de Ouro Preto e um em cada onze de Congonhas: chega
     para o seletor existir, e pouco o bastante para Itabirito continuar
     sendo a lista que quase todo teste vê. */
  city: i % 7 === 3 ? "Ouro Preto" : i % 11 === 5 ? "Congonhas" : "Itabirito",
  /* Faltava, e a tela de profissionais filtra por cidade E estado: sem
     `uf` a lista voltava VAZIA e o teste fotografava a tela de "ainda não
     há ninguém" achando que era a lista. */
  uf: "MG",
  bio: `Faz ${CATS[i % CATS.length]} há anos.`,
  /* `email` existe na tabela de verdade e faltava aqui. Sem ela, o modo
     estrito de colunas (ver `modoEstritoDeColunas`) acusava falta numa
     coluna que existe no banco — um alarme falso que fazia a tela do
     cadastro abrir como se a pessoa não tivesse nada preenchido. */
  email: "",
  /* As duas da 0114, já aplicada no banco de verdade. Ficam aqui para o
     modo estrito representar o banco de HOJE: assim ele acusa só o que
     de fato ainda não existe (hoje, `genero` e `pcd`, das 0115 e 0116) —
     que é o que faz a conferência valer alguma coisa. */
  primeiro_emprego: i % 9 === 0,
  aceita_freela: i % 4 === 0,
  /* As duas de 04/09: `pcd` (0115) e `genero` (0116). O gênero fica fora
     da view pública no banco de verdade — aqui as duas tabelas são o
     mesmo array, então o modo estrito não separa uma da outra; quem
     garante a regra é a SQL, e o teste dela é o `select` da 0116. */
  pcd: i % 11 === 0,
  genero: ["feminino", "masculino", "outro"][i % 3],
  especialidade: "",
  /* As colunas da 0101 e da 0103, que os filtros do banco de talentos
     leem. Sem elas TODO filtro devolvia zero pessoas — e o teste diria
     que o filtro funciona, quando na verdade ele só não achava nada.

     Os restos de divisão são propositais e diferentes entre si: se todos
     seguissem o mesmo, marcar dois filtros devolveria sempre o mesmo
     grupo, e o teste nunca exercitaria a combinação. */
  disponivel: i % 5 !== 0,
  aceita_viajar: i % 3 === 0,
  fim_de_semana: i % 4 === 0,
  inicio_imediato: i % 2 === 0,
  cnh: i % 3 === 1,
  cnh_categorias: i % 3 === 1 ? ["B"] : [],
  disponibilidade: i % 2 === 0 ? ["Manhã", "Tarde"] : ["Horário comercial"],
  modo_trabalho: "presencial",
  telefones_extra: [],
  data_nascimento: "1990-01-01",
  idade: 36,
  pretensao_centavos: i % 3 === 0 ? null : 180000 + i * 1000,
  pretensao_combinar: i % 3 === 0,
  pretensao_periodo: "mes",
  phone: "31999990000",
  whatsapp: "31999990000",
  entity_type: i % 5 === 0 ? "pj" : "pf",
  company_name: i % 5 === 0 ? `Empresa ${i}` : null,
  responsible_name: i % 5 === 0 ? `Responsável ${i}` : null,
  /* Foto de mentira em `data:` para uns e nenhuma para outros. Sem
     nenhuma foto, a grade de cartões só era vista com iniciais — e o
     desenho que se estava julgando era justamente o com foto. */
  photo_url: i % 3 === 0 ? null : fotoFalsa(i),
  /* Sem telefone confirmado o cadastro não aparece na lista desde a 0076,
     então o falso precisa nascer confirmado — senão a tela de
     profissionais abre vazia e o teste fotografa o estado errado.
     `?confirmado=nao` exercita o outro lado. */
  whatsapp_verified: ajuste("confirmado") !== "nao",
  disponivel: true,
  verified: i % 7 === 0,
  verified_until: i % 7 === 0 ? emDias(30) : null,
  boosted: i % 6 === 0,
  boosted_until: i % 6 === 0 ? emDias(30) : null,
  suspended: false,
  paused: false,
  // O índice 0 é o mais ANTIGO: created_at cresce com i, e a ordenação do
  // app é `created_at desc`. É exatamente a queixa — quem entrou primeiro
  // fica por último.
  created_at: emDias(-100 + i),
}));

/* A empresa de mentira, dona das vagas. */
export const EMPRESA_FALSA = "00000000-0000-4000-8000-000000000002";

/** De que lado o teste está: `?lado=empresa` abre o app pelo painel da empresa. */
function ladoFalso(): "professional" | "company" {
  return ajuste("lado") === "empresa"
    ? "company"
    : "professional";
}

/**
 * `?lado=novo` deixa a pessoa SEM lado registrado.
 *
 * É o estado de quem acabou de criar a conta — e era o único estado do app
 * que o falso não sabia produzir: ele sempre devolvia uma linha em
 * `user_onboarding`, então "profissional" ou "empresa", nunca "ainda não
 * disse". Por causa disso um teste mostrou a empresa com a barra de baixo
 * do trabalhador e eu quase "consertei" um defeito que não existia: era o
 * falso respondendo "profissional" por omissão.
 *
 * É também o único estado em que a tela de escolher o tipo de conta abre,
 * e onde o atalho que aproveita o botão da tela de abertura é exercitado.
 */
const semLadoAinda = () => ajuste("lado") === "novo" || contaNova();

/**
 * `?conta=nova` — a conta RECÉM-CRIADA, com tudo em branco.
 *
 * O `?lado=novo` já tirava a linha de `user_onboarding`, mas só ela: a
 * pessoa continuava dona de dois cadastros profissionais e de uma padaria
 * com três vagas no ar. Ou seja, "acabei de criar a conta" nunca podia ser
 * aberto no navegador — e é justamente o estado por onde TODO MUNDO passa
 * uma vez, o único em que a tela de escolher o lado e a de "falta pouco"
 * aparecem de verdade, uma atrás da outra.
 *
 * Aqui a conta não tem: lado escolhido, nome, e-mail, foto, cadastro
 * profissional, empresa, vaga nem favorito. Só o login.
 *
 * O telefone é a exceção, e não é descuido: quem entra pelo SMS entra COM
 * o número — é o que a porta entrega. Zerá-lo produziria uma conta que o
 * app de verdade não sabe criar.
 */
/* `function`, e não `const`: a lista `professionals` é montada lá em cima,
   antes desta linha, e uma seta em `const` ainda não existe naquele ponto —
   a página inteira morria com "ei is not a function" e o corpo em branco.
   Declaração de função sobe; atribuição a `const`, não. */
function contaNova(): boolean {
  return ajuste("conta") === "nova";
}

/* `?plano=nao` exercita a empresa SEM plano — que é o estado em que ela
   chega, e o único em que o cartão do plano tem trabalho a fazer. */
const planoFalso = () => ajuste("plano") !== "nao";

/* `?vagas=0` esvazia a lista: o estado vazio é uma tela de verdade, com
   texto próprio, e sem isso ele nunca era aberto no navegador. */
const QUANTAS_VAGAS = Number(ajuste("vagas") ?? 3);

const VAGAS: Linha[] = [
  {
    /* Texto COMPRIDO de proposito. Os dados falsos eram todos curtos
       ("Padaria", "Centro"), e texto curto nunca estoura — entao a
       varredura de layout passava limpa e a dona via a tela "sobrando pra
       fora" com os dados dela. Uma palavra sem espaco (um e-mail, um
       endereco de site, um nome emendado) e o que empurra a coluna. */
    title: "Pedreiro para obra no Centro",
    profession: "Pedreiro",
    specialty: "Alvenaria",
    description:
      "Obra de reforma numa casa no Centro. Fale pelo site www.construtoraexemplodeitabirito.com.br ou pelo e-mail contato.recursos.humanos@construtoraexemplodeitabirito.com.br",
    required_experience: "2 anos",
    work_modality: "presencial",
    available_immediately: true,
    /* As colunas da 0080, com os TRÊS casos de salário na mesma lista:
       faixa, valor fixo e "a combinar". Sem os três, o teste exercitaria um
       caminho só e diria que está tudo certo. */
    tipo_contrato: "diaria",
    jornada: "integral",
    beneficios: ["Almoço no local", "Vale-transporte"],
    salario_a_combinar: false,
    salary_range_min: 18000,
    salary_range_max: 25000,
  },
  {
    title: "Ajudante de cozinha",
    profession: "Cozinheiro",
    specialty: "",
    description: "Padaria no Centro, de segunda a sábado, das 6h às 14h.",
    required_experience: "",
    work_modality: "presencial",
    available_immediately: false,
    tipo_contrato: "clt",
    jornada: "turnos",
    beneficios: ["Vale-transporte"],
    salario_a_combinar: false,
    salary_range_min: 180000,
    salary_range_max: 180000,
  },
  {
    /* Uma vaga PAGA, para a área de destaque do banco de vagas aparecer
       nos testes de navegador. Sem ela, a área simplesmente não existe na
       tela e o teste passa sem ter olhado nada. */
    destaque_ate: new Date(Date.now() + 5 * 86400000).toISOString(),
    title: "Motorista entregador",
    profession: "Motorista",
    specialty: "Entregas",
    description: "Entregas na cidade com carro da empresa. CNH B.",
    required_experience: "1 ano",
    work_modality: "presencial",
    available_immediately: true,
    tipo_contrato: "clt",
    jornada: "integral",
    beneficios: [],
    salario_a_combinar: true,
  },
].slice(0, QUANTAS_VAGAS).map((v, i) => ({
  id: `vaga-${i}`,
  company_id: EMPRESA_FALSA,
  skills: [],
  salary_range_min: null,
  salary_range_max: null,
  city: "Itabirito",
  uf: "MG",
  neighborhood: "Centro",
  anunciada_ate: null,
  status: "active",
  created_at: emDias(-i - 1),
  closed_at: null,
  /* A empresa vem EMBUTIDA, como o PostgREST devolve o `select` com tabela
     filha. O banco de vagas lê `v.companies.company_name` — sem isto, cada
     cartão da lista aparecia sem nome e sem logo de empresa, que é
     exatamente a informação que decide se alguém responde. É o mesmo
     aninhamento que `job_notifications` já fazia. */
  companies: { company_name: "Padaria Pão de Minas", photo_url: fotoFalsa(2) },
  /* As colunas da 0105. Sem elas a tela da vaga aberta esconde justamente
     as linhas novas, e o teste diria que está tudo certo por não ter o que
     mostrar. */
  quantidade_vagas: i === 0 ? 2 : 1,
  data_inicio: "2026-10-01",
  prazo_candidatura: "2026-09-20",
  horario: "8h às 17h",
  escala: i === 0 ? "6x1" : null,
  aceita_outras_cidades: i !== 1,
  comissao: i === 2 ? "R$ 50 por entrega" : null,
  outros_beneficios: i === 0 ? "Café da manhã" : null,
  escolaridade_minima: i === 1 ? "medio" : null,
  curso_especifico: i === 0 ? "NR-35" : null,
  cnh_exigida: i === 2,
  cnh_categorias: i === 2 ? ["B"] : [],
  exige_viagem: false,
  idiomas: [],
  observacoes: i === 0 ? "Ferramenta é por conta da obra." : null,
  campos_compatibilidade: i === 0 ? ["profissao", "cidade", "cnh"] : [],
  aceita_sem_compatibilidade: i !== 1,
  /* As colunas das 0114, 0115 e 0116, todas já aplicadas no banco de
     verdade. Ficam aqui para o modo estrito de colunas representar o
     banco de HOJE — sem elas ele acusaria falta onde não há. */
  /* Da 0106, e faltava aqui: a tela lê o período junto do valor, e sem a
     coluna o modo estrito acusava falta numa coluna que existe. */
  salario_periodo: "mes",
  aceita_primeiro_emprego: i === 1,
  vaga_para_pcd: i === 2,
  destaque_ate: null,
  ...v,
}));

const TABELAS: Record<string, Linha[]> = {
  professionals,
  professionals_public: professionals,
  professional_ratings: professionals.map((p, i) => ({
    professional_id: p.id,
    average_rating: i % 3 === 0 ? null : 3 + (i % 3),
    review_count: i % 3 === 0 ? 0 : i % 7,
  })),
  reviews_public: professionals.slice(0, 8).flatMap((p, i) =>
    Array.from({ length: (i % 3) + 1 }, (_, j) => ({
      id: `av-${i}-${j}`, professional_id: p.id, user_id: `u-${j}`,
      rating: 4 + (j % 2), contratou: true, comment: "", tags: [],
      created_at: emDias(-i),
    }))
  ),
  profile_views: [],
  contact_requests: [],
  banners: [],
  subscriptions: [],
  /* Três favoritos do dono falso — um deles com selo, para exercitar o
     "Chamar no WhatsApp" que só aparece em cadastro verificado. Vazio,
     a tela de favoritos nunca era testada de verdade. */
  favorites: contaNova()
    ? []
    : [0, 7, 9].map((i) => ({ user_id: DONO_FALSO, professional_id: `pro-${i}` })),
  contatos_registrados: [],
  app_visits: [],
  /* O perfil do dono falso nasce como nasce uma conta de SMS: só o
     telefone, sem nome, sem e-mail, sem foto. É esse o estado que a tela
     de completar o perfil existe para pegar — com um perfil já cheio, o
     teste passaria sem nunca ter aberto a tela.

     `falso-perfil-completo` no localStorage vira o outro caso: perfil
     preenchido, com foto. Ele existe porque a tentativa óbvia — mexer nas
     linhas pelo `window.__TABELAS` e recarregar — não funciona: o falso
     mora na memória do módulo, e recarregar zera tudo. Isso já custou um
     teste que parecia rodar e não testava nada. */
  profiles: [
    {
      id: DONO_FALSO,
      ...(perfilCompleto()
        ? {
            full_name: "Joana Ferreira",
            email: "joana@exemplo.com",
            /* `?foto=nao` é o caso de quem entrou pelo SMS — a maioria —,
               que não tem foto nenhuma e vê as iniciais. Sem esta chave o
               teste só conseguia fotografar o outro caso, e o desenho do
               círculo com as iniciais nunca era olhado. */
            avatar_url:
              ajuste("foto") === "nao"
                ? null
                : "https://exemplo.invalido/joana.jpg",
          }
        : { full_name: null, email: null, avatar_url: null }),
      phone: "5531999998888",
      is_admin: false,
      created_at: emDias(-30),
    },
  ],

  /* ─── O Ei Itabirito ───────────────────────────────────────────────
     Daqui para baixo é o app novo: empresa, vaga, onda e aviso. Estava
     tudo faltando, e o efeito não era um erro na tela — era cada tela do
     Ei aparecendo VAZIA no teste, que é exatamente o estado em que ela
     não prova nada. */
  user_onboarding: semLadoAinda()
    ? []
    : [{ user_id: DONO_FALSO, user_type: ladoFalso(), created_at: emDias(-30) }],

  companies: [
    {
      id: EMPRESA_FALSA,
      /* Numa conta nova a padaria continua na cidade — as vagas precisam
         de uma empresa, senão a lista sai com o nome em branco —, mas ela
         não é mais desta pessoa. */
      owner_id: contaNova() ? "dono-empresa" : DONO_FALSO,
      company_name: "Construtora e Empreendimentos Imobiliários Itabirito",
      cnpj_cpf: "12.345.678/0001-90",
      phone: "5531999998888",
      /* Confirmado só quando o teste pede o contrário: o cartão de
         "confirme o telefone" é um estado, e testar sempre o mesmo lado
         deixa metade da tela sem nunca ter sido aberta. */
      phone_verified: ajuste("telefone") !== "nao",
      phone_verified_at: emDias(-20),
      email: "contato.recursos.humanos@construtoraexemplodeitabirito.com.br",
      address: "Rua Direita, 120",
      neighborhood: "Centro",
      city: "Itabirito",
      uf: "MG",
      description: "",
      /* A coluna da 0115, já aplicada no banco de verdade. */
      contrata_pcd: false,
      photo_url: fotoFalsa(2),
      /* "tres" (o Premium), e não "pro3": o banco só aceita 'pro', 'tres'
         e 'ilimitado' (check da 0072), e um valor fora da lista fazia o
         painel escrever "Plano pro3" na tela — o nome cru da coluna, que
         no banco de verdade nunca poderia chegar ali. */
      plano: planoFalso() ? "tres" : null,
      plano_ate: planoFalso() ? emDias(20) : null,
      plano_recorrente: true,
      created_at: emDias(-60),
    },
    /* Uma SEGUNDA empresa, para a tela de escolha (item 4) ter o que
       escolher. Com uma só ela desvia sozinha para o painel, e o teste
       nunca exercitaria os cartões nem o botao "trocar". */
    {
      id: "empresa-2",
      owner_id: DONO_FALSO,
      company_name: "Lanchonete da Praça",
      cnpj: "",
      city: "Itabirito",
      uf: "MG",
      neighborhood: "Praça da Estação",
      address: "",
      phone: "31988224938",
      phone_verified: true,
      email: "",
      website: "",
      responsible_name: "Lorena",
      description: "Lanches e salgados.",
      /* A coluna da 0115, já aplicada no banco de verdade. */
      contrata_pcd: false,
      photo_url: fotoFalsa(3),
      plano: null,
      plano_ate: null,
      plano_recorrente: false,
      created_at: emDias(-10),
    },
  ],

  /* Duas empresas viram o cadastro desta pessoa (0106). Sem estas linhas
     a seção "Quem viu seu cadastro" nunca aparece no teste — e ela só
     aparece quando há alguém, então o teste diria que está tudo certo por
     não ter o que mostrar. */
  profile_views: contaNova()
    ? []
    : [
        {
          professional_id: "pro-0",
          company_id: EMPRESA_FALSA,
          viewed_at: emDias(0),
          vezes: 3,
          companies: { company_name: "Padaria Pão de Minas", photo_url: fotoFalsa(2) },
        },
        {
          professional_id: "pro-0",
          company_id: "empresa-2",
          viewed_at: emDias(-4),
          vezes: 1,
          companies: { company_name: "Lanchonete da Praça", photo_url: fotoFalsa(3) },
        },
      ],

  /* Um favorito de cada tipo. Sem eles a tela de favoritos so exercita o
     estado vazio — e e nas duas listas cheias que o desenho pode quebrar. */
  favoritos: contaNova()
    ? []
    : [
        { id: "fav-1", user_id: DONO_FALSO, company_id: EMPRESA_FALSA, professional_id: null, created_at: emDias(-1) },
        { id: "fav-2", user_id: DONO_FALSO, company_id: null, professional_id: "pro-3", created_at: emDias(-2) },
      ],

  job_listings: VAGAS,

  /* ── DUAS DENÚNCIAS, PARA O PAINEL TER O QUE MOSTRAR — 05/09 ────────
     A dona: "a situação de denunciar o perfil deve ser direcionado ao
     painel administrativo... para que eu veja e tenha a possibilidade de
     tirar a vaga ou o usuário do ar."

     Uma de VAGA e uma de CADASTRO, porque os dois cartões da seção são
     diferentes: o da vaga tem "tirar a vaga do ar" e o do cadastro tem o
     campo de motivo e o bloqueio de documento. Sem estas linhas, o painel
     abria dizendo "nenhuma denúncia recebida ainda" e nada daquela tela
     era exercitado.

     Os objetos aninhados (`professionals`, `job_listings`) vêm PRONTOS: o
     falso não faz junção, e é assim que o PostgREST devolveria. */
  reports: [
    {
      id: "den-1",
      professional_id: null,
      job_id: VAGAS[0]?.id ?? "vaga-0",
      reporter_id: DONO_FALSO,
      reason: "Pediram dinheiro para me candidatar",
      details: "Pediram 50 reais de taxa de cadastro pelo WhatsApp.",
      status: "pending",
      created_at: emDias(-1),
      professionals: null,
      /* Um GETTER, e não um objeto congelado: o falso não faz junção, e
         uma cópia parada faria o painel continuar dizendo "no ar" depois
         de o botão tirar a vaga do ar — o teste passaria no "tirei" e
         nunca no "voltou". Lido a cada vez, ele reflete a vaga de
         verdade, que é o que o PostgREST devolveria. */
      get job_listings() {
        const v = VAGAS[0];
        return {
          title: v?.title ?? "Vaga",
          status: v?.status ?? "active",
          companies: { company_name: "Padaria Pão de Minas" },
        };
      },
    },
    {
      id: "den-2",
      professional_id: "pro-3",
      job_id: null,
      reporter_id: DONO_FALSO,
      reason: "Perfil falso ou se passando por outra pessoa",
      details: "Usou a foto de outra pessoa.",
      status: "pending",
      created_at: emDias(-3),
      professionals: { name: "Pessoa Três", suspended: false },
      job_listings: null,
    },
  ],

  /* O que o perfil público passou a mostrar em 04/09 (a dona: "ao clicar
     no pedido de um candidato tem que ter todas as informações que ele
     preencheu"). Sem estas três tabelas no falso, a tela abria com as
     seções novas vazias — e o teste diria que está tudo certo. */
  professional_experiences: professionals.slice(0, 6).flatMap((pro, i) =>
    Array.from({ length: (i % 2) + 1 }, (_, j) => ({
      id: `exp-${i}-${j}`,
      professional_id: pro.id,
      cargo: j === 0 ? "Ajudante geral" : "Atendente",
      onde: j === 0 ? "Obra no Centro" : "Loja da praça",
      periodo: j === 0 ? "2 anos" : "1 ano",
      ordem: j,
    }))
  ),
  professional_courses: professionals.slice(0, 6).flatMap((pro, i) => [
    {
      professional_id: pro.id,
      nome: "Ensino médio",
      instituicao: "Escola Estadual de Itabirito",
      ano: "2012",
      tipo: "formacao",
      nivel: "medio",
      situacao: "concluido",
      ordem: 0,
    },
    ...(i % 2 === 0
      ? [
          {
            professional_id: pro.id,
            nome: "NR-35 — trabalho em altura",
            instituicao: "SENAI",
            ano: "2023",
            tipo: "complementar",
            nivel: null,
            situacao: null,
            ordem: 1,
          },
        ]
      : []),
  ]),
  professional_skills: professionals.slice(0, 6).flatMap((pro, i) =>
    [
      { professional_id: pro.id, nome: "Atendimento", nivel: "avancado", ordem: 0 },
      { professional_id: pro.id, nome: "Caixa", nivel: "intermediario", ordem: 1 },
    ].slice(0, (i % 2) + 1)
  ),

  /* A conta é da administração quando o teste pede (`?admin=1` ou a chave
     `falso-admin`). Sem esta tabela o painel administrativo abria dizendo
     "sem permissão" no falso, e a seção do Ei Emprego — que é onde a dona
     liga plano — nunca era exercitada. */
  admins: (() => {
    try {
      return localStorage.getItem("falso-admin") === "1"
        ? [{ user_id: DONO_FALSO }]
        : [];
    } catch {
      return [];
    }
  })(),

  /* A face pública da empresa (view da 0100). O app lê daqui, e não de
     `companies`, porque a tabela só tem policy de leitura do próprio dono
     — quem procura trabalho lê zero linhas nela. Sem esta entrada, a tela
     da vaga aberta abria sem nome nem foto de empresa no falso, escondendo
     justamente o defeito que a 0100 existe para consertar. */
  /* A view pública da empresa. As duas últimas colunas entraram na 0115:
     `description` é a frase que a empresa escreve sobre si (ela faltava
     na view de verdade, e a tela da vaga que a pedia derrubava a consulta
     inteira — o nome e a foto da empresa sumiam da tela), e
     `contrata_pcd` é a marcação nova. */
  companies_public: [
    {
      id: EMPRESA_FALSA,
      company_name: "Padaria Pão de Minas",
      photo_url: fotoFalsa(2),
      city: "Itabirito",
      uf: "MG",
      neighborhood: "Centro",
      description: "Padaria de bairro, aberta desde 1998.",
      contrata_pcd: false,
    },
  ],

  /* Respostas de verdade na PRIMEIRA vaga e nenhuma na segunda.
     ───────────────────────────────────────────────────────────
     Vazio, o painel da empresa mostrava "Ninguém respondeu ainda" em todas
     as vagas — que é justamente o estado em que a contagem nova não prova
     nada. Com as duas situações lado a lado dá para ver, numa tela só, que
     o número aparece, que ele conta certo e que o zero tem frase própria. */
  /* Conta nova não respondeu nada ainda: as abas "Novas" e "Já respondi"
     precisam abrir zeradas, que é como a pessoa de verdade as encontra. */
  /* ── O TETO DE 5 POR DIA PRECISA PODER SER TESTADO — 05/09 ──────────
     Duas faltas aqui impediam isso:

     1. `created_at` não existia. `limiteDeHoje` conta por ela, e o falso
        não valida coluna que falta — o filtro passava com `undefined` e o
        teste "passava" sem nunca ter contado nada.
     2. Só havia 3 respostas, e o teto é 5. Com `?cheio=hoje` (ou a chave
        `falso-cheio-hoje`) elas viram 6, todas de hoje: é o estado em que
        a folha "Por hoje, chega" tem de aparecer. */
  job_responses: contaNova() ? [] : VAGAS.slice(0, 1).flatMap((v) =>
    (ajuste("cheio") === "hoje" ? [0, 1, 2, 3, 4, 5] : [0, 1, 2]).map((i) => ({
      id: `resposta-${i}`,
      job_listing_id: v.id,
      professional_id: DONO_FALSO,
      responded_at: emDias(-i),
      created_at: ajuste("cheio") === "hoje" ? new Date().toISOString() : emDias(-i),
      status: "new",
      /* `interessado` PRECISA estar aqui. No banco a coluna nasce `true`
         (migration 0078), e o painel da empresa filtra por ela. Sem o
         campo, o filtro derrubava as três respostas e a tela dizia que
         ninguém tinha se interessado — parecia defeito do painel, era o
         falso não tendo a coluna.

         A terceira é um NÃO de propósito: sem ela o teste nunca exercitaria
         o filtro, só a ausência dele. */
      interessado: ajuste("cheio") === "hoje" ? true : i < 2,
    }))
  ),
  job_dispatches: [],

  /* Avisos com a vaga JÁ embutida, como o PostgREST devolve o `select`
     com tabela filha. A tela lê `n.job_listings.companies.company_name`,
     então o aninhamento vai até o segundo nível. */
  job_notifications: VAGAS.slice(0, 3).map((v, i) => ({
    id: `aviso-${i}`,
    professional_id: DONO_FALSO,
    job_listing_id: v.id,
    /* A onda: a 1 é a exceção do teto de candidaturas (ver
       `podeSeCandidatar`). Sem esta coluna o falso respondia `undefined`,
       a exceção nunca era exercitada, e o teste não sabia distinguir "a
       regra passou" de "a regra nem rodou". A primeira vaga é de onda 1;
       as outras, de onda 2. */
    wave: i === 0 ? 1 : 2,
    criado_em: emDias(-i),
    /* A primeira nunca foi vista: é ela que carrega o selo "Nova", e sem
       uma assim o selo não aparece em teste nenhum. */
    visto_em: i === 0 ? null : emDias(-i),
    /* A coluna da 0122: o app filtra por ela ("os avisos de mais de 15
       dias somem") e a exclusão a escreve. */
    escondido_em: null,
    job_listings: {
      ...v,
      companies: { company_name: "Padaria Pão de Minas", photo_url: fotoFalsa(2) },
    },
  })),
};

type Filtro = (l: Linha) => boolean;

/**
 * Lê `"job_listings.status"` dentro da linha.
 *
 * O PostgREST filtra por tabela embutida com o nome pontuado, e o falso
 * guarda o embutido como objeto dentro da própria linha. Sem andar pelo
 * ponto, `l["job_listings.status"]` é `undefined`, o filtro nunca casa e a
 * lista volta VAZIA — que nesta tela é a mentira mais cara que existe, a de
 * dizer a quem procura emprego que não há vaga nenhuma.
 */
function valorEm(l: Linha, caminho: string): unknown {
  return caminho
    .split(".")
    .reduce<unknown>((atual, parte) => (atual as Linha | undefined)?.[parte], l);
}

/**
 * O modo estrito de colunas está ligado?
 *
 * `?colunas=estrito` na URL liga e guarda; `?colunas=solto` desliga. É o
 * mesmo mecanismo dos outros ajustes do falso.
 */
function modoEstritoDeColunas(): boolean {
  try {
    const busca = new URLSearchParams(location.search);
    const pedido = busca.get("colunas");
    if (pedido === "estrito") localStorage.setItem("falso-colunas-estrito", "1");
    if (pedido === "solto") localStorage.removeItem("falso-colunas-estrito");
    return localStorage.getItem("falso-colunas-estrito") === "1";
  } catch {
    return false;
  }
}

class Consulta implements PromiseLike<{ data: Linha[] | Linha | null; error: unknown; count?: number }> {
  private filtros: Filtro[] = [];
  private ordens: { coluna: string; asc: boolean }[] = [];
  private faixa: [number, number] | null = null;
  private limite: number | null = null;
  private unico: "single" | "maybe" | null = null;
  private gravar: Linha | null = null;
  private inserir: Linha[] | null = null;
  private apagar = false;
  private colunas: string | null = null;

  constructor(private tabela: string) {}

  /* ── O FALSO PASSOU A OLHAR A LISTA DE COLUNAS — 04/09 ────────────
     Ele ignorava o que era pedido no `select()`, e por isso NÃO PEGOU um
     defeito que estava em produção: a tela da vaga pedia `description` na
     view `companies_public`, que não tem essa coluna. O PostgREST recusa
     a consulta INTEIRA quando falta uma coluna pedida — o nome e a foto
     da empresa sumiam da tela para todo mundo, e aqui tudo aparecia
     bonitinho.

     A conferência é OPCIONAL (`?colunas=estrito` na URL, ou a chave no
     armazenamento) porque os dados de mentira não têm todas as colunas
     que o banco de verdade tem: ligada por padrão, ela acusaria falta em
     coluna que existe lá. Ligada de propósito, ela é uma varredura: abre
     as telas com o modo estrito e vê onde o app pede o que não existe. */
  select(colunas?: string) {
    this.colunas = typeof colunas === "string" ? colunas : null;
    return this;
  }
  eq(c: string, v: unknown) { this.filtros.push((l) => valorEm(l, c) === v); return this; }
  neq(c: string, v: unknown) { this.filtros.push((l) => valorEm(l, c) !== v); return this; }
  /* `is(coluna, null)` é como o PostgREST pergunta "está vazio?" — e é o
     que separa "vaga que ainda não foi vista" de todas as outras. Sem ele,
     o falso ignorava o filtro e a lista voltava inteira. */
  is(c: string, v: unknown) { this.filtros.push((l) => (valorEm(l, c) ?? null) === v); return this; }
  /* `not(coluna, "is", null)` é o contrário do `is` — o app usa isso para
     mostrar só quem preencheu as áreas de interesse. Sem este método a tela
     de profissionais caía com "not is not a function", e o defeito só
     aparecia na demonstração, nunca na conferência de tipos. */
  not(c: string, op: string, v: unknown) {
    this.filtros.push((l) => {
      const valor = valorEm(l, c) ?? null;
      return op === "is" ? valor !== v : valor !== v;
    });
    return this;
  }
  gte(c: string, v: string) { this.filtros.push((l) => String(l[c] ?? "") >= v); return this; }
  lte(c: string, v: string) { this.filtros.push((l) => String(l[c] ?? "") <= v); return this; }
  in(c: string, vs: unknown[]) { this.filtros.push((l) => vs.includes(l[c])); return this; }
  /* Uma porta para o teste pôr um filtro que o falso não tem método para
     exprimir — hoje, a especialidade da onda 1. */
  filtroExtra(f: Filtro) { this.filtros.push(f); return this; }

  overlaps(c: string, vs: unknown[]) {
    this.filtros.push((l) => vs.some((v) => (l[c] as unknown[] | undefined)?.includes(v)));
    return this;
  }
  contains(c: string, vs: unknown[]) {
    this.filtros.push((l) => vs.every((v) => (l[c] as unknown[] | undefined)?.includes(v)));
    return this;
  }
  or(expr: string) {
    // "name.ilike.%x%,bio.ilike.%x%" → casa se qualquer um bater
    const partes = expr.split(",").map((p) => {
      const [coluna, , valor] = p.split(".");
      return { coluna, alvo: (valor ?? "").replace(/%/g, "").toLowerCase() };
    });
    this.filtros.push((l) =>
      partes.some(({ coluna, alvo }) => String(l[coluna] ?? "").toLowerCase().includes(alvo))
    );
    return this;
  }
  order(coluna: string, opts?: { ascending?: boolean }) {
    this.ordens.push({ coluna, asc: opts?.ascending ?? true });
    return this;
  }
  range(de: number, ate: number) { this.faixa = [de, ate]; return this; }
  limit(n: number) { this.limite = n; return this; }
  single() { this.unico = "single"; return this; }
  maybeSingle() { this.unico = "maybe"; return this; }
  /* `insert` GRAVA de verdade. Antes devolvia `this` e não escrevia nada:
     um teste de "salvar" passava sempre, porque o falso respondia "deu
     certo" para qualquer coisa — inclusive para um botão sem `onClick`,
     que foi exatamente o defeito que passou meses despercebido. */
  insert(linhas: Linha | Linha[]) {
    this.inserir = Array.isArray(linhas) ? linhas : [linhas];
    return this;
  }
  update(mudancas: Linha) { this.gravar = mudancas; return this; }
  upsert(linhas: Linha | Linha[]) { return this.insert(linhas); }
  delete() { this.apagar = true; return this; }

  private resolver() {
    /* `professionals_public` é uma VIEW, e view tem `where`.
       ───────────────────────────────────────────────────────
       O falso apontava para o mesmo array de `professionals`, então
       mostrava todo mundo — inclusive quem está suspenso, oculto ou sem
       telefone confirmado. Um teste de "quem não confirmou não aparece"
       passava com a regra apagada, porque o falso nunca a teve.

       As três condições são as mesmas da migration 0076. Se um dia elas
       mudarem lá, mudam aqui — e é por isso que estão escritas por
       extenso, e não escondidas atrás de um `filter` genérico. */
    if (this.tabela === "professionals_public") {
      TABELAS.professionals_public = (TABELAS.professionals ?? []).filter(
        (l) =>
          l.suspended === false && l.paused === false && l.whatsapp_verified === true
      );
    }

    const tabela = (TABELAS[this.tabela] ??= []);

    if (this.inserir) {
      /* A conferência de colunas na GRAVAÇÃO vem ANTES de a linha ser
         criada: é esse o caso que derrubou o cadastro da cidade quando a
         coluna `uf` chegou ao app antes de chegar ao banco. Depois de
         gravar, a linha já teria a coluna nova e a conferência acharia
         que estava tudo certo — foi o primeiro jeito que tentei, e ele
         passava sem testar nada. */
      const faltaNoInsert = this.chavesQueFaltam(this.inserir[0] ?? {}, tabela[0]);
      if (faltaNoInsert) {
        console.warn(
          `[colunas estrito] ${this.tabela}: a gravação manda "${faltaNoInsert}", que não existe`
        );
        return {
          data: null,
          error: {
            code: "PGRST204",
            message: `Could not find the '${faltaNoInsert}' column of '${this.tabela}' in the schema cache`,
          },
          count: 0,
        };
      }
      this.anotarGravacao(this.inserir[0] ?? {});
      const novas = this.inserir.map((l) => ({
        id: l.id ?? `${this.tabela}-${tabela.length + 1}`,
        created_at: new Date().toISOString(),
        /* As colunas com `default now()` no banco de verdade. Sem elas o
           falso devolvia a linha sem data e a tela escrevia "Invalid
           Date" — defeito do falso que parecia do app. */
        sent_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
        ...l,
      }));
      tabela.push(...novas);
      return this.unico
        ? { data: novas[0] ?? null, error: null, count: novas.length }
        : { data: novas, error: null, count: novas.length };
    }

    let linhas = tabela.filter((l) => this.filtros.every((f) => f(l)));

    if (this.apagar) {
      for (const l of linhas) {
        const i = tabela.indexOf(l);
        if (i >= 0) tabela.splice(i, 1);
      }
      return { data: linhas, error: null, count: linhas.length };
    }
    /* Um `update` que não altera nada faz o teste passar sem testar: a tela
       chama, o falso responde "deu certo", e a lista volta igual. Foi
       exatamente o que aconteceu com o botão de pausar. */
    if (this.gravar) {
      const faltaNoUpdate = this.chavesQueFaltam(this.gravar, linhas[0] ?? tabela[0]);
      if (faltaNoUpdate) {
        console.warn(
          `[colunas estrito] ${this.tabela}: a gravação manda "${faltaNoUpdate}", que não existe`
        );
        return {
          data: null,
          error: {
            code: "PGRST204",
            message: `Could not find the '${faltaNoUpdate}' column of '${this.tabela}' in the schema cache`,
          },
          count: 0,
        };
      }
      this.anotarGravacao(this.gravar);
      for (const l of linhas) Object.assign(l, this.gravar);
    }
    /* ── ORDENAR POR COLUNA QUE NÃO EXISTE TAMBÉM É ERRO — 05/09 ─────
       O modo estrito já recusava coluna inexistente no `select`, mas não
       no `order` — e ali o silêncio é pior: ordenar por `undefined`
       devolve a lista NA ORDEM QUE VEIO, sem erro nenhum. O app parece
       funcionar e a ordem está errada, que é o defeito mais difícil de
       ver numa lista.

       Foi o que quase deixou passar a tolerância da 0121: o código pede
       `order("em_destaque")`, o falso ignorava, e o teste passava sem
       nunca exercitar a volta para a ordem antiga. O PostgREST de verdade
       responde 42703 aqui, igual ao `select`. */
    if (this.ordens.length > 0 && linhas[0] && modoEstritoDeColunas()) {
      const semColuna = this.ordens.find((o) => !(o.coluna in (linhas[0] as object)));
      if (semColuna) {
        console.warn(
          `[colunas estrito] ${this.tabela}: pediram para ordenar por "${semColuna.coluna}", que não existe`
        );
        return {
          data: null,
          error: {
            code: "42703",
            message: `column ${this.tabela}.${semColuna.coluna} does not exist`,
          },
          count: 0,
        };
      }
    }

    for (const { coluna, asc } of [...this.ordens].reverse()) {
      linhas = [...linhas].sort((a, b) => {
        const x = a[coluna] as never, y = b[coluna] as never;
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      });
    }
    /* A conferência de colunas roda depois dos filtros e antes de cortar
       páginas: ela precisa de uma linha qualquer da tabela para saber
       quais colunas existem. Sem nenhuma linha, não há o que conferir —
       e é o certo: uma tabela vazia não prova que a coluna falta. */
    const faltando = this.colunasQueFaltam(linhas[0]);
    if (faltando) {
      /* Escrito no console SEMPRE, e não só devolvido como erro: quase
         todo lugar do app trata erro de leitura como "não veio nada" e
         segue — que é justamente o que faz este defeito passar. */
      console.warn(`[colunas estrito] ${this.tabela}: a coluna "${faltando}" foi pedida e não existe`);
      return {
        data: null,
        error: {
          code: "42703",
          message: `column ${this.tabela}.${faltando} does not exist`,
        },
        count: 0,
      };
    }

    if (this.faixa) linhas = linhas.slice(this.faixa[0], this.faixa[1] + 1);
    if (this.limite !== null) linhas = linhas.slice(0, this.limite);
    /* `single()` DÁ ERRO com mais de uma linha, e é assim no PostgREST.
       ─────────────────────────────────────────────────────────────────
       O falso devolvia a primeira, e com isso um defeito real passou
       despercebido: `obterMinhaEmpresa` usava `.single()` em `companies`,
       e depois da 0102 (mais de uma empresa por conta) ela passou a falhar
       para quem tinha duas — as telas liam o `null` como "não tem empresa"
       e mandavam para o cadastro. "Nova vaga" caía na tela de cadastrar
       empresa, e o teste aqui continuava passando.

       `maybeSingle()` também recusa mais de uma no PostgREST; o que ele
       aceita, e `single()` não, é NENHUMA. */
    if (this.unico) {
      if (linhas.length > 1) {
        return {
          data: null,
          error: {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
          },
          count: linhas.length,
        };
      }
      if (linhas.length === 0 && this.unico === "single") {
        return {
          data: null,
          error: {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
          },
          count: 0,
        };
      }
      return { data: linhas[0] ?? null, error: null, count: linhas.length };
    }
    return { data: linhas, error: null, count: linhas.length };
  }

  /* Qual coluna pedida não existe na linha — ou `null` quando está tudo
     certo, quando a conferência está desligada, ou quando não há linha
     para comparar.

     O que é pedido dentro de parênteses (as relações, tipo
     `companies:companies_public!inner ( company_name )`) é ignorado: são
     colunas de OUTRA tabela, e o falso resolve relação de outro jeito. */
  private colunasQueFaltam(exemplo: Linha | undefined): string | null {
    if (!this.colunas || !exemplo) return null;
    if (!modoEstritoDeColunas()) return null;

    const semRelacoes = this.colunas.replace(/\([^)]*\)/g, "");
    const nomes = semRelacoes
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      /* Nomes com apelido, contagem e o `*` não são coluna simples. */
      .filter((p) => !p.includes(":") && !p.includes("*") && !p.includes("!"));

    for (const nome of nomes) {
      if (!(nome in exemplo)) return nome;
    }
    return null;
  }

  /* Deixa o teste do navegador enxergar as gravações: sem isso, a única
     forma de saber se uma tela salvou de verdade é procurar uma mensagem
     na tela, que às vezes some sozinha antes de a foto ser tirada. Vive
     só no falso, que nunca vai para o site. */
  private anotarGravacao(escrito: Linha) {
    const g = globalThis as Record<string, unknown>;
    const lista = (g.__falsoGravacoes as unknown[]) ?? [];
    lista.push({ tabela: this.tabela, chaves: Object.keys(escrito) });
    g.__falsoGravacoes = lista;
    g.__falsoUltimaGravacao = { tabela: this.tabela, chaves: Object.keys(escrito) };
  }

  /* Qual chave gravada não existe na tabela — mesma ideia da conferência
     de leitura, do outro lado. */
  private chavesQueFaltam(escrito: Linha, exemplo: Linha | undefined): string | null {
    if (!exemplo) return null;
    if (!modoEstritoDeColunas()) return null;
    for (const chave of Object.keys(escrito)) {
      if (!(chave in exemplo)) return chave;
    }
    return null;
  }

  then<R1 = unknown, R2 = never>(
    ok?: ((v: { data: Linha[] | Linha | null; error: unknown; count?: number }) => R1 | PromiseLike<R1>) | null,
    falha?: ((r: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.resolver()).then(ok, falha);
  }
}

/**
 * Sessão de mentira, ligada pelo `localStorage`.
 *
 * Sem isto o falso só sabia representar visitante deslogado, e as telas de
 * conta ficavam fora de alcance do teste — foi assim que a barreira do
 * número confirmado quase entrou sem nunca ter sido aberta no navegador.
 *
 * `falso-usuario` vale "google" (entrou pelo Google, sem número — é quem a
 * barreira precisa parar) ou "telefone" (entrou pelo SMS, número já
 * confirmado — é quem ela precisa deixar passar).
 */
function usuarioFalso() {
  const tipo = typeof localStorage === "undefined" ? null : localStorage.getItem("falso-usuario");
  if (!tipo) return null;
  /* Cada porta traz metade do contato, e o falso precisa mentir do mesmo
     jeito que o real — senão a tela que completa o perfil aparece sempre
     com tudo preenchido e o teste não prova nada. O Google traz e-mail,
     nome e foto e nenhum telefone; o SMS traz telefone e mais nada. */
  const peloGoogle = tipo === "google";
  return {
    id: DONO_FALSO,
    email: peloGoogle ? "pessoa@exemplo.com" : "",
    phone: peloGoogle ? "" : "5531999998888",
    phone_confirmed_at: peloGoogle ? null : new Date().toISOString(),
    app_metadata: {},
    /* `tem_senha` é a marca que a barreira `ExigirSenha` procura — sem
       ela, TODA tela do app fica atrás do "Agora crie sua senha", e a
       demonstração para na primeira barreira sem conseguir chegar em
       nenhuma das telas que se quer olhar. Aqui ela é ligada pelo mesmo
       mecanismo do resto do falso: uma chave no armazenamento, para que o
       teste possa exercitar os dois estados (com senha e sem). */
    user_metadata: {
      ...(peloGoogle ? { full_name: "Pessoa do Google", avatar_url: "" } : {}),
      ...(localStorage.getItem("falso-tem-senha") === "1" ? { tem_senha: true } : {}),
    },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
}

/* Quem quer ser avisado quando a sessão muda. Ver `onAuthStateChange`. */
const OUVINTES: Array<(evento: string, sessao: unknown) => void> = [];

/* De que lado a pessoa disse que estava, na tela inicial.
   ──────────────────────────────────────────────────────
   A tela de entrar recebe `?lado=trabalhar` ou `?lado=contratar` — é a
   escolha feita nas duas portas da tela inicial. Sem ler isso, quem tocava
   em "Estou contratando" e entrava caía no lado de quem PROCURA trabalho,
   porque o falso gravava sempre "trabalhador". A demonstração mostraria o
   app errado para metade de quem a abrisse.

   Lê do `hash` porque a demonstração roda com o roteador de `#`. */
function ladoEscolhido(): "trabalhador" | "empresa" {
  try {
    return /lado=contratar/.test(location.hash) ? "empresa" : "trabalhador";
  } catch {
    return "trabalhador";
  }
}

/* Cria a sessão de mentira. Os dois caminhos de entrada — SMS e Google —
   terminam aqui.

   ── POR QUE RECARREGA ──────────────────────────────────────────────────
   As tabelas falsas são montadas UMA VEZ, quando o arquivo carrega, e a
   linha de `user_onboarding` (a que diz se a pessoa é profissional ou
   empresa) sai dali. Gravar `falso-lado` depois disso não muda tabela
   nenhuma: quem escolhia "Estou contratando" e entrava caía na lista de
   vagas de quem PROCURA trabalho, porque a tabela ainda dizia
   "professional".

   É o mesmo motivo, e a mesma saída, da barra preta da demonstração (ver
   `escolher`, em main.demo.tsx). O `setTimeout` de 0ms também não é
   desleixo: mexer no `#` agenda uma navegação, e um `reload()` chamado na
   mesma linha é engolido por ela. */
function entrar(porta: "sms" | "google") {
  const lado = ladoEscolhido();
  localStorage.setItem("falso-usuario", porta);
  localStorage.setItem("falso-lado", lado);
  const sessao = { user: usuarioFalso() };
  /* De propósito NÃO avisa os ouvintes aqui.
     ────────────────────────────────────────
     Avisar fazia a tela de entrar reagir na hora — ela via a sessão nascer
     e navegava sozinha para o destino padrão, /vagas-para-mim — e essa
     navegação atropelava o endereço escrito duas linhas abaixo. Efeito
     visível: quem escolhia "Estou contratando" entrava e caía na lista de
     vagas de quem procura trabalho, mesmo com o lado gravado certo.

     Quem avisa a tela é a recarga, que vem logo em seguida e refaz tudo do
     zero — inclusive as tabelas, que é o motivo de ela existir. */
  try {
    location.hash = lado === "empresa" ? "#/painel-empresa" : "#/vagas-para-mim";
    setTimeout(() => location.reload(), 0);
  } catch {
    /* sem `location` (teste fora do navegador): a sessão já está criada */
  }
  return sessao;
}

const auth = {
  getSession: async () => {
    const user = usuarioFalso();
    return { data: { session: user ? { user } : null }, error: null };
  },
  getUser: async () => ({ data: { user: usuarioFalso() }, error: null }),
  /* Os ouvintes ficam guardados, e o login por SMS avisa todos eles.
     ─────────────────────────────────────────────────────────────────
     Isto era um no-op que devolvia uma inscrição vazia. Bastava enquanto o
     único jeito de "entrar" era a barra preta da demonstração, que recarrega
     a página inteira. Com o login por SMS de mentira funcionando, não
     basta: o `verifyOtp` criava a sessão e NADA na tela mudava — a pessoa
     digitava o código certo, o app aceitava em silêncio e continuava na
     tela de entrar, que é exatamente o defeito que o app de verdade já
     teve ("quem entra tem que sair da tela de login"). */
  onAuthStateChange: (retorno: (evento: string, sessao: unknown) => void) => {
    OUVINTES.push(retorno);
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = OUVINTES.indexOf(retorno);
            if (i >= 0) OUVINTES.splice(i, 1);
          },
        },
      },
    };
  },
  signOut: async () => {
    localStorage.removeItem("falso-usuario");
    return { error: null };
  },
  /* Guarda o que teria sido pedido ao Google, em vez de sair do app.
     É o que permite conferir no navegador se o pedido de "escolha a
     conta" está sendo feito depois de sair — sem isso, a única forma de
     testar seria fazendo login de verdade. */
  /* No app de verdade este botão SAI para o navegador e volta depois. Na
     demonstração não há para onde sair, e um botão que não faz nada é lido
     como quebrado — então ele entra na hora, pela conta do Google (que traz
     nome, e-mail e foto, e nenhum telefone).

     O pedido continua sendo guardado: é o que permite conferir no navegador
     se o "escolha a conta" está sendo pedido depois de sair. */
  signInWithOAuth: async (opcoes: unknown) => {
    localStorage.setItem("ultimo-login-pedido", JSON.stringify(opcoes));
    const sessao = entrar("google");
    return { data: { user: sessao.user, session: sessao }, error: null };
  },

  /* ── O login por SMS, de mentira ────────────────────────────────────
     Estas duas faltavam, e o buraco aparecia da pior forma possível: quem
     abria a demonstração, escolhia "Procuro trabalho", digitava o número e
     tocava em "Receber código por SMS" recebia, na tela, o texto

         "Não foi possível continuar. (t.auth.signInWithOtp is not a
          function)"

     — jargão em inglês, com nome de função e tudo, na primeira tela em que
     alguém tenta usar a demonstração. A pessoa conclui que o app está
     quebrado, e não que aquela porta simplesmente não existe aqui.

     Agora entra de verdade: qualquer celular válido é aceito e QUALQUER
     código de 6 dígitos serve — não há SMS nenhum para conferir contra. A
     demonstração deixa de precisar da barra preta de cima para chegar ao
     lado de quem procura trabalho, que é o caminho que as pessoas de
     verdade fazem.

     Note que isto NÃO existe no cliente de verdade: este arquivo só é
     usado pela montagem da demonstração, e o `vite.demo.ts` recusa montar
     se o cliente real estiver no lugar dele. */
  signInWithOtp: async ({ phone }: { phone?: string }) => {
    localStorage.setItem("falso-telefone-pedido", phone ?? "");
    return { data: { user: null, session: null }, error: null };
  },

  verifyOtp: async ({ token }: { token?: string }) => {
    /* Seis dígitos, como o código de verdade. Aceitar qualquer coisa
       esconderia a tela de "código incorreto", que também é uma tela. */
    if (!/^\d{6}$/.test((token ?? "").trim())) {
      return { data: { user: null, session: null }, error: { message: "Token has expired or is invalid" } };
    }
    const sessao = entrar("sms");
    return { data: { user: sessao.user, session: sessao }, error: null };
  },
};

/* As tabelas ficam visíveis ao teste. Sem isto, a única forma de saber o
   que uma tela gravou é olhar outra tela — e aí se testa a leitura junto
   com a escrita, sem saber qual das duas quebrou. Foi assim que um
   telefone com código de país ("5531999998888" virando "(55) 31999-9988")
   passou por um teste que só perguntava se a barreira tinha sumido. */
if (typeof window !== "undefined") {
  (window as unknown as { __TABELAS?: unknown }).__TABELAS = TABELAS;
}

const clienteFalso = {
  from: (tabela: string) => new Consulta(tabela),
  rpc: (nome: string, args?: Record<string, unknown>) => {
    /* `candidatos_da_onda` devolve um CONJUNTO, e o cliente de verdade
       devolve um construtor de consulta para ele — com `.range()`, que é o
       que a `lerTudo` chama para ler em páginas.

       O falso devolvia uma promessa simples para todo `rpc`, e o efeito era
       "fazerConsulta(...).range is not a function" na tela de criar vaga.
       Parecia defeito do app; era o falso não sabendo imitar essa metade do
       cliente. */
    /* A função da 0113, que alimenta as ondas por faixa de
       compatibilidade: os candidatos da cidade com os campos da conta.
       Devolve um construtor de consulta, como o cliente de verdade — a
       `lerTudo` chama `.range()` nele. */
    if (nome === "candidatos_para_compatibilidade") {
      return new Consulta("professionals")
        .eq("city", args?.p_cidade)
        .eq("suspended", false)
        .eq("whatsapp_verified", true);
    }

    if (nome === "candidatos_da_onda") {
      const oficios = (args?.p_oficios as string[]) ?? [];
      const coluna = (args?.p_coluna as string) ?? "categories";
      const especialidade = ((args?.p_especialidade as string) ?? "").toLowerCase();
      const q = new Consulta("professionals");
      /* O que a função do banco faz: mesma cidade, não suspenso, telefone
         confirmado — e SEM filtrar `paused`, que é a regra inteira da
         migration 0077. */
      return q
        .eq("city", args?.p_cidade)
        .eq("suspended", false)
        .eq("whatsapp_verified", true)
        .overlaps(coluna, oficios)
        .filtroExtra((l: Linha) =>
          !especialidade ||
          String((l as Record<string, unknown>).especialidade ?? "")
            .toLowerCase()
            .includes(especialidade)
        );
    }
    return clienteFalso.rpcSimples(nome);
  },

  rpcSimples: async (nome: string) => {
    if (nome === "mais_vistos") {
      // os quatro primeiros, como se fossem os mais vistos da semana
      return { data: professionals.slice(0, 4).map((p) => ({ professional_id: p.id })), error: null };
    }
    /* O plano da empresa. Zero é "sem plano" e -1 é "sem teto" — os dois
       números que o painel escreve por extenso, e que só aparecem na tela
       se o falso souber devolvê-los. */
    /* A confirmação do telefone. `?confirmado=nao` deixa o cadastro sem
       confirmar, que é o estado em que toda pessoa nova começa — e o
       único em que o aviso obrigatório do topo aparece. */
    if (nome === "confirmar_whatsapp") {
      for (const l of TABELAS.professionals ?? []) {
        if (l.owner_id === DONO_FALSO) l.whatsapp_verified = true;
      }
      return { data: true, error: null };
    }
    if (nome === "limite_de_vagas_do_plano") return { data: planoFalso() ? 3 : 0, error: null };
    if (nome === "vagas_ativas_agora") return { data: VAGAS.length, error: null };
    return { data: 0, error: null };
  },
  auth,
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
  /* ── O CANAL DE PRESENÇA PASSOU A RESPONDER — 05/09 ─────────────────
     Ele era um casco: `on` e `subscribe` devolviam `this` sem nunca
     chamar ninguém de volta, e `presenceState` devolvia `{}`. Serviu
     enquanto o único uso era não deixar a tela cair no ErrorBoundary.

     Só que a dona pediu "quantas pessoas e empresas estão on-line ao
     vivo", e um canal que nunca avisa faz a linha inteira sumir da tela —
     o teste passaria dizendo que está tudo certo por não ter o que
     mostrar. É o mesmo tipo de mentira calma que este projeto persegue.

     Agora ele guarda o que o app anuncia (`track`), inventa alguns
     vizinhos dos dois lados, e chama o `sync` logo depois de assinar. O
     número é de mentira; o CAMINHO que a tela percorre é o de verdade. */
  channel: () => {
    let aoSincronizar: null | (() => void) = null;
    let eu: Record<string, unknown> = {};
    /* ── SOZINHA NO APP — 05/09 ──────────────────────────────────────
       A dona: "não consegui ver os on-line."

       O motivo era este caso, e ele não era testável: o falso SEMPRE
       inventava vizinhos, então a única situação em que a linha some —
       estar sozinha — nunca aparecia em teste nenhum. Com `?sozinha=1`
       (ou a chave `falso-sozinha`) o canal devolve só a própria aba. */
    const vizinhos = ajuste("sozinha") === "1" ? {} : {
      "falso-prof-1": [{ lado: "professional" }],
      "falso-prof-2": [{ lado: "professional" }],
      "falso-prof-3": [{ lado: "professional" }],
      "falso-empresa-1": [{ lado: "company" }],
      "falso-empresa-2": [{ lado: "company" }],
      /* Uma aba que ainda não escolheu lado: ela conta no total e em
         nenhum dos dois — é o caso que a conta precisa saber ignorar. */
      "falso-sem-lado": [{ lado: null }],
    };
    const canal = {
      on(_tipo: string, _filtro: unknown, retorno: () => void) {
        aoSincronizar = retorno;
        return canal;
      },
      subscribe(retorno?: (status: string) => void) {
        setTimeout(() => {
          retorno?.("SUBSCRIBED");
          aoSincronizar?.();
        }, 60);
        return canal;
      },
      track: async (dados: Record<string, unknown>) => {
        eu = dados;
        setTimeout(() => aoSincronizar?.(), 20);
      },
      untrack: async () => {},
      unsubscribe: async () => {},
      presenceState: () => ({ ...vizinhos, eu: [eu] }),
    };
    return canal;
  },
  removeChannel: async () => {},
};

export function problemaDeConfiguracao(): string | null { return null; }
export function credenciaisSupabase() { return { url: "https://falso.supabase.co", key: "x".repeat(40) }; }
export function hasDatabase(): boolean { return true; }
export function supabase() { return clienteFalso as never; }
