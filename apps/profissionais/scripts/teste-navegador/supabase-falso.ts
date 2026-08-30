/* Cliente Supabase de mentira, só para rodar o app nesta máquina e
   exercitar a navegação. Implementa o pedaço do PostgREST que o app usa:
   from().select().order().range().eq().or().contains().gte().in().neq()
   e os finalizadores single()/maybeSingle(), tudo encadeável e "thenable". */

type Linha = Record<string, unknown>;

const AGORA = Date.now();
const emDias = (d: number) => new Date(AGORA + d * 86400000).toISOString();

/** Ligado pelo teste: o perfil já vem preenchido, com foto. */
const perfilCompleto = () =>
  typeof localStorage !== "undefined" && localStorage.getItem("falso-perfil-completo") === "1";

const CATS = ["Encanador", "Eletricista", "Pedreiro", "Pintor", "Marceneiro", "Serralheiro", "Vidraceiro", "Gesseiro", "Marido de aluguel", "Montador de móveis", "Chaveiro", "Jardineiro", "Piscineiro", "Dedetizador", "Diarista", "Passadeira", "Cuidador de idosos", "Babá", "Técnico em informática", "Técnico em celulares", "Refrigeração e ar-condicionado", "Conserto de eletrodomésticos", "Mecânico", "Borracheiro", "Lavagem de carros", "Funilaria e pintura automotiva", "Cabeleireiro", "Barbeiro", "Manicure", "Depilação", "Maquiadora", "Estética e sobrancelhas", "Massagista", "Personal trainer", "Nutricionista", "Fisioterapeuta", "Psicólogo", "Professor particular", "Professor de inglês", "Professor de música"];

/* Quantos cadastros o banco falso tem. Trocar para 3 exercita a cidade
   quase vazia, que é onde a tela inicial em prateleiras pode ficar feia. */
const QUANTOS = Number(new URLSearchParams(location.search).get("falsos") ?? 60);

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
  owner_id: i < 2 ? DONO_FALSO : `dono-${i}`,
  name: `Profissional ${i}`,
  category: CATS[i % CATS.length],
  categories: [CATS[i % CATS.length]],
  /* A coluna do Ei: é por ela que a tela de profissionais filtra e monta a
     fileira de ofícios. Faltava, e a fileira nascia sempre vazia. */
  areas_de_interesse: [CATS[i % CATS.length], CATS[(i + 7) % CATS.length]],
  neighborhood: ["Centro", "Praia", "Vila Rica", "Nossa Senhora do Carmo"][i % 4],
  city: "Itabirito",
  /* Faltava, e a tela de profissionais filtra por cidade E estado: sem
     `uf` a lista voltava VAZIA e o teste fotografava a tela de "ainda não
     há ninguém" achando que era a lista. */
  uf: "MG",
  bio: `Faz ${CATS[i % CATS.length]} há anos.`,
  especialidade: "",
  phone: "31999990000",
  whatsapp: "31999990000",
  entity_type: i % 5 === 0 ? "pj" : "pf",
  company_name: i % 5 === 0 ? `Empresa ${i}` : null,
  responsible_name: i % 5 === 0 ? `Responsável ${i}` : null,
  /* Foto de mentira em `data:` para uns e nenhuma para outros. Sem
     nenhuma foto, a grade de cartões só era vista com iniciais — e o
     desenho que se estava julgando era justamente o com foto. */
  photo_url: i % 3 === 0 ? null : fotoFalsa(i),
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
  return new URLSearchParams(location.search).get("lado") === "empresa"
    ? "company"
    : "professional";
}

/* `?plano=nao` exercita a empresa SEM plano — que é o estado em que ela
   chega, e o único em que o cartão do plano tem trabalho a fazer. */
const planoFalso = () => new URLSearchParams(location.search).get("plano") !== "nao";

/* `?vagas=0` esvazia a lista: o estado vazio é uma tela de verdade, com
   texto próprio, e sem isso ele nunca era aberto no navegador. */
const QUANTAS_VAGAS = Number(new URLSearchParams(location.search).get("vagas") ?? 3);

const VAGAS: Linha[] = [
  {
    title: "Pedreiro para obra no Centro",
    profession: "Pedreiro",
    specialty: "Alvenaria",
    description:
      "Obra de reforma numa casa no Centro. Serviço de alvenaria e reboco, com material no local.",
    required_experience: "2 anos",
    work_modality: "presencial",
    available_immediately: true,
  },
  {
    title: "Ajudante de cozinha",
    profession: "Cozinheiro",
    specialty: "",
    description: "Padaria no Centro, de segunda a sábado, das 6h às 14h.",
    required_experience: "",
    work_modality: "presencial",
    available_immediately: false,
  },
  {
    title: "Motorista entregador",
    profession: "Motorista",
    specialty: "Entregas",
    description: "Entregas na cidade com carro da empresa. CNH B.",
    required_experience: "1 ano",
    work_modality: "presencial",
    available_immediately: true,
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
  favorites: [0, 7, 9].map((i) => ({ user_id: DONO_FALSO, professional_id: `pro-${i}` })),
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
              new URLSearchParams(location.search).get("foto") === "nao"
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
  user_onboarding: [{ user_id: DONO_FALSO, user_type: ladoFalso(), created_at: emDias(-30) }],

  companies: [
    {
      id: EMPRESA_FALSA,
      owner_id: DONO_FALSO,
      company_name: "Padaria Pão de Minas",
      cnpj_cpf: "12.345.678/0001-90",
      phone: "5531999998888",
      /* Confirmado só quando o teste pede o contrário: o cartão de
         "confirme o telefone" é um estado, e testar sempre o mesmo lado
         deixa metade da tela sem nunca ter sido aberta. */
      phone_verified: new URLSearchParams(location.search).get("telefone") !== "nao",
      phone_verified_at: emDias(-20),
      email: "contato@exemplo.com",
      address: "Rua Direita, 120",
      neighborhood: "Centro",
      city: "Itabirito",
      uf: "MG",
      description: "",
      photo_url: fotoFalsa(2),
      plano: planoFalso() ? "pro3" : null,
      plano_ate: planoFalso() ? emDias(20) : null,
      plano_recorrente: true,
      created_at: emDias(-60),
    },
  ],

  job_listings: VAGAS,
  job_responses: [],
  job_dispatches: [],

  /* Avisos com a vaga JÁ embutida, como o PostgREST devolve o `select`
     com tabela filha. A tela lê `n.job_listings.companies.company_name`,
     então o aninhamento vai até o segundo nível. */
  job_notifications: VAGAS.slice(0, 3).map((v, i) => ({
    id: `aviso-${i}`,
    professional_id: DONO_FALSO,
    job_listing_id: v.id,
    criado_em: emDias(-i),
    /* A primeira nunca foi vista: é ela que carrega o selo "Nova", e sem
       uma assim o selo não aparece em teste nenhum. */
    visto_em: i === 0 ? null : emDias(-i),
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

class Consulta implements PromiseLike<{ data: Linha[] | Linha | null; error: unknown; count?: number }> {
  private filtros: Filtro[] = [];
  private ordens: { coluna: string; asc: boolean }[] = [];
  private faixa: [number, number] | null = null;
  private limite: number | null = null;
  private unico: "single" | "maybe" | null = null;
  private gravar: Linha | null = null;
  private inserir: Linha[] | null = null;
  private apagar = false;

  constructor(private tabela: string) {}

  select() { return this; }
  eq(c: string, v: unknown) { this.filtros.push((l) => valorEm(l, c) === v); return this; }
  neq(c: string, v: unknown) { this.filtros.push((l) => valorEm(l, c) !== v); return this; }
  /* `is(coluna, null)` é como o PostgREST pergunta "está vazio?" — e é o
     que separa "vaga que ainda não foi vista" de todas as outras. Sem ele,
     o falso ignorava o filtro e a lista voltava inteira. */
  is(c: string, v: unknown) { this.filtros.push((l) => (valorEm(l, c) ?? null) === v); return this; }
  gte(c: string, v: string) { this.filtros.push((l) => String(l[c] ?? "") >= v); return this; }
  lte(c: string, v: string) { this.filtros.push((l) => String(l[c] ?? "") <= v); return this; }
  in(c: string, vs: unknown[]) { this.filtros.push((l) => vs.includes(l[c])); return this; }
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
    const tabela = (TABELAS[this.tabela] ??= []);

    if (this.inserir) {
      const novas = this.inserir.map((l) => ({
        id: l.id ?? `${this.tabela}-${tabela.length + 1}`,
        created_at: new Date().toISOString(),
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
    if (this.gravar) { for (const l of linhas) Object.assign(l, this.gravar); }
    for (const { coluna, asc } of [...this.ordens].reverse()) {
      linhas = [...linhas].sort((a, b) => {
        const x = a[coluna] as never, y = b[coluna] as never;
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      });
    }
    if (this.faixa) linhas = linhas.slice(this.faixa[0], this.faixa[1] + 1);
    if (this.limite !== null) linhas = linhas.slice(0, this.limite);
    if (this.unico) return { data: linhas[0] ?? null, error: null, count: linhas.length };
    return { data: linhas, error: null, count: linhas.length };
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
    user_metadata: peloGoogle
      ? { full_name: "Pessoa do Google", avatar_url: "" }
      : {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
}

const auth = {
  getSession: async () => {
    const user = usuarioFalso();
    return { data: { session: user ? { user } : null }, error: null };
  },
  getUser: async () => ({ data: { user: usuarioFalso() }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  signOut: async () => {
    localStorage.removeItem("falso-usuario");
    return { error: null };
  },
  /* Guarda o que teria sido pedido ao Google, em vez de sair do app.
     É o que permite conferir no navegador se o pedido de "escolha a
     conta" está sendo feito depois de sair — sem isso, a única forma de
     testar seria fazendo login de verdade. */
  signInWithOAuth: async (opcoes: unknown) => {
    localStorage.setItem("ultimo-login-pedido", JSON.stringify(opcoes));
    return { data: null, error: null };
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
  rpc: async (nome: string) => {
    if (nome === "mais_vistos") {
      // os quatro primeiros, como se fossem os mais vistos da semana
      return { data: professionals.slice(0, 4).map((p) => ({ professional_id: p.id })), error: null };
    }
    /* O plano da empresa. Zero é "sem plano" e -1 é "sem teto" — os dois
       números que o painel escreve por extenso, e que só aparecem na tela
       se o falso souber devolvê-los. */
    if (nome === "limite_de_vagas_do_plano") return { data: planoFalso() ? 3 : 0, error: null };
    if (nome === "vagas_ativas_agora") return { data: VAGAS.length, error: null };
    return { data: 0, error: null };
  },
  auth,
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; }, track: async () => {}, untrack: async () => {}, unsubscribe: async () => {}, presenceState: () => ({}) }),
  removeChannel: async () => {},
};

export function problemaDeConfiguracao(): string | null { return null; }
export function credenciaisSupabase() { return { url: "https://falso.supabase.co", key: "x".repeat(40) }; }
export function hasDatabase(): boolean { return true; }
export function supabase() { return clienteFalso as never; }
