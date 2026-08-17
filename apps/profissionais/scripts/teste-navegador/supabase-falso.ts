/* Cliente Supabase de mentira, só para rodar o app nesta máquina e
   exercitar a navegação. Implementa o pedaço do PostgREST que o app usa:
   from().select().order().range().eq().or().contains().gte().in().neq()
   e os finalizadores single()/maybeSingle(), tudo encadeável e "thenable". */

type Linha = Record<string, unknown>;

const AGORA = Date.now();
const emDias = (d: number) => new Date(AGORA + d * 86400000).toISOString();

const CATS = ["Encanador", "Eletricista", "Pedreiro", "Pintor", "Marceneiro", "Serralheiro", "Vidraceiro", "Gesseiro", "Marido de aluguel", "Montador de móveis", "Chaveiro", "Jardineiro", "Piscineiro", "Dedetizador", "Diarista", "Passadeira", "Cuidador de idosos", "Babá", "Técnico em informática", "Técnico em celulares", "Refrigeração e ar-condicionado", "Conserto de eletrodomésticos", "Mecânico", "Borracheiro", "Lavagem de carros", "Funilaria e pintura automotiva", "Cabeleireiro", "Barbeiro", "Manicure", "Depilação", "Maquiadora", "Estética e sobrancelhas", "Massagista", "Personal trainer", "Nutricionista", "Fisioterapeuta", "Psicólogo", "Professor particular", "Professor de inglês", "Professor de música"];

/* Quantos cadastros o banco falso tem. Trocar para 3 exercita a cidade
   quase vazia, que é onde a tela inicial em prateleiras pode ficar feia. */
const QUANTOS = Number(new URLSearchParams(location.search).get("falsos") ?? 60);

const professionals: Linha[] = Array.from({ length: QUANTOS }, (_, i) => ({
  id: `pro-${i}`,
  owner_id: `dono-${i}`,
  name: `Profissional ${i}`,
  category: CATS[i % CATS.length],
  categories: [CATS[i % CATS.length]],
  city: "Itabirito",
  bio: `Faz ${CATS[i % CATS.length]} há anos.`,
  especialidade: "",
  phone: "31999990000",
  whatsapp: "31999990000",
  entity_type: i % 5 === 0 ? "pj" : "pf",
  company_name: i % 5 === 0 ? `Empresa ${i}` : null,
  responsible_name: i % 5 === 0 ? `Responsável ${i}` : null,
  photo_url: null,
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
  favorites: [],
  contatos_registrados: [],
  app_visits: [],
};

type Filtro = (l: Linha) => boolean;

class Consulta implements PromiseLike<{ data: Linha[] | Linha | null; error: unknown; count?: number }> {
  private filtros: Filtro[] = [];
  private ordens: { coluna: string; asc: boolean }[] = [];
  private faixa: [number, number] | null = null;
  private limite: number | null = null;
  private unico: "single" | "maybe" | null = null;

  constructor(private tabela: string) {}

  select() { return this; }
  eq(c: string, v: unknown) { this.filtros.push((l) => l[c] === v); return this; }
  neq(c: string, v: unknown) { this.filtros.push((l) => l[c] !== v); return this; }
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
  insert() { return this; }
  update() { return this; }
  upsert() { return this; }
  delete() { return this; }

  private resolver() {
    let linhas = (TABELAS[this.tabela] ?? []).filter((l) => this.filtros.every((f) => f(l)));
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

const auth = {
  getSession: async () => ({ data: { session: null }, error: null }),
  getUser: async () => ({ data: { user: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  signOut: async () => ({ error: null }),
};

const clienteFalso = {
  from: (tabela: string) => new Consulta(tabela),
  rpc: async (nome: string) => {
    if (nome === "mais_vistos") {
      // os quatro primeiros, como se fossem os mais vistos da semana
      return { data: professionals.slice(0, 4).map((p) => ({ professional_id: p.id })), error: null };
    }
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
