import { supabase } from "./supabase";
import { DEFAULT_CITY, DEFAULT_UF, type Professional } from "../types/domain";

/**
 * O cadastro de quem procura trabalho: ler e gravar.
 *
 * Isto não existia. A tela "Meu perfil" era uma MAQUETE: mostrava as oito
 * funções, as experiências, os cursos e as duas chaves, e o botão "Salvar"
 * não tinha ação nenhuma — nem `onClick`. A pessoa marcava tudo, tocava em
 * Salvar, recarregava e voltava zerado.
 *
 * Era o defeito mais caro do app, e o mais difícil de ver: a tela parecia
 * funcionar. Todo o resto depende dela — a onda procura por
 * `areas_de_interesse`, o push vai para quem tem função marcada, e a lista
 * de profissionais mostra quem tem cadastro. Com o perfil vazio, o app
 * inteiro é uma casca.
 */

/** O que a tela edita. Um recorte do `Professional`, sem o que ela não mexe. */
export type MeuPerfil = {
  id: string | null;
  name: string;
  phone: string;
  email: string;
  /* A foto pública, na coluna que a lista de profissionais já lê
     (`photo_url`). Faltava aqui — a única tela que enviava foto era a
     `CompletarPerfil`, que grava em `profiles.avatar_url`. Coluna
     diferente, tabela diferente: a foto enviada por ali NUNCA aparecia na
     lista de talentos, porque `ProfissionaisPage` lê `professionals.photo_url`,
     não `profiles.avatar_url`. A dona: "o cadastro deve ser único, onde o
     profissional cadastra tudo de uma vez" — a foto tinha que estar AQUI,
     na coluna que a busca de verdade consulta. */
  photoUrl: string | null;
  /* O "resumo sobre você" que o AvisoPerfilIncompleto cobra desde sempre
     sem que esta tela tivesse onde escrevê-lo. A coluna já existia —
     `bio` é herança do procurô, onde alimentava a busca por texto — mas
     o cadastro do Ei foi reescrito do zero (ver o comentário no topo de
     MeuPerfilPage.tsx) e nunca trouxe o campo de volta. A dona: "aparece
     um aviso dizendo que falta um resumo sobre você, mas não tem onde
     escrever." */
  bio: string;
  neighborhood: string;
  /** As funções que a pessoa aceita ser chamada para fazer. Até 8. */
  funcoes: string[];
  /** Aceitando trabalho agora. Diferente de estar oculto. */
  disponivel: boolean;
  /** Fora da busca pública, mas continua recebendo vaga pelas ondas. */
  oculto: boolean;
  /**
   * O telefone do cadastro foi confirmado por código.
   *
   * A dona: "a confirmação do telefone é item obrigatório no cadastro."
   * Sem ela o cadastro é gravado mas não existe para mais ninguém — a
   * `professionals_public` filtra por esta coluna desde a 0076, e o aviso
   * de vaga também.
   *
   * Não se grava daqui: quem escreve é a função `confirmar_whatsapp`, e um
   * gatilho zera o campo em qualquer outra escrita. Aqui é só leitura.
   */
  confirmado: boolean;
  /* ── O QUE A PESSOA QUER (0101) ────────────────────────────────────
     A dona: "o cadastro do candidato está muito simples. tem que ter
     pretensão salarial, horário melhor, se aceita viajar."

     Os três decidem se o encontro vale a pena, e sem eles os dois lados
     perdiam tempo: a empresa ligava para dez pessoas para descobrir que
     oito não podem no horário dela.

     `pretensao` fica como TEXTO aqui, do jeito que a pessoa digita
     ("1.500", "1500,00"), e vira centavos só na hora de gravar. Guardar
     número no estado obrigaria a formatar a cada tecla, e é assim que se
     perde a vírgula que a pessoa acabou de escrever. */
  pretensao: string;
  /** "A combinar" é resposta, e é diferente de não ter respondido. */
  pretensaoCombinar: boolean;
  /** mes, dia ou hora (0106). Uma diarista pensa em diária; comparar
      "R$ 200" dela com "R$ 2.000 por mês" de uma vaga sem os períodos é
      comparar dois números que não são a mesma coisa. */
  pretensaoPeriodo: string;
  disponibilidade: string[];
  aceitaViajar: boolean;

  /* ── QUEM A PESSOA É (0103) ────────────────────────────────────────
     A dona, no item 14: "data de nascimento / possui CNH? qual
     categoria? / telefones / trabalha em final de semana? /
     disponibilidade pra começar imediato? / modo de trabalho".

     `nascimento` fica como TEXTO no formato do campo de data do
     navegador (aaaa-mm-dd), e vira `null` quando vazio. Guardar `Date`
     no estado obrigaria a converter a cada tecla, e é assim que se perde
     o dia que a pessoa acabou de digitar.

     A tela NUNCA mostra a data de volta para quem contrata: a view
     pública devolve só a idade. Ver a 0103. */
  nascimento: string;
  temCnh: boolean;
  cnhCategorias: string[];
  /** Outros números, digitados à mão. O `phone` é o confirmado por SMS. */
  telefonesExtra: string[];
  modoTrabalho: string;
  fimDeSemana: boolean;
  inicioImediato: boolean;
};

/**
 * Uma linha de formação OU de curso complementar.
 *
 * As duas moram na mesma tabela desde a 0104, separadas pelo `tipo`: os
 * campos que a dona pediu para as duas são os mesmos (instituição, curso,
 * situação, ano), e só o rótulo da tela muda. Duas listas iguais lado a
 * lado seriam duas telas que um dia divergem.
 *
 * `nivel` só existe na formação — um curso de NR-35 não tem escolaridade.
 */
export type CursoEmEdicao = {
  nome: string;
  instituicao: string;
  ano: string;
  tipo: "formacao" | "complementar";
  situacao: string;
  nivel: string;
};

/** Uma competência com o nível que a pessoa se dá. */
export type CompetenciaEmEdicao = { nome: string; nivel: "basico" | "intermediario" | "avancado" };

export const PERFIL_VAZIO: MeuPerfil = {
  id: null,
  name: "",
  phone: "",
  email: "",
  photoUrl: null,
  bio: "",
  neighborhood: "",
  funcoes: [],
  disponivel: true,
  oculto: false,
  confirmado: false,
  pretensao: "",
  pretensaoCombinar: false,
  pretensaoPeriodo: "mes",
  disponibilidade: [],
  aceitaViajar: false,
  nascimento: "",
  temCnh: false,
  cnhCategorias: [],
  telefonesExtra: [],
  modoTrabalho: "",
  fimDeSemana: false,
  inicioImediato: false,
};

/**
 * Lê o cadastro desta pessoa, ou `null` se ela ainda não tem um.
 *
 * Erro SOBE. Devolver `null` num erro de leitura faria a tela abrir em
 * branco e a pessoa preencher tudo de novo por cima de um cadastro que
 * existe — e o `upsert` seguinte apagaria o que estava lá.
 */
/* ══════════════════════════════════════════════════════════════════════
   MAIS DE UM CADASTRO NA MESMA CONTA
   ══════════════════════════════════════════════════════════════════════

   A dona: "ao clicar em cadastro dentro do profissional deve abrir uma
   tela igual a de empresa para a pessoa selecionar o perfil, por mais que
   só tenha 1."

   O banco sempre permitiu até cinco cadastros por conta (o gatilho
   `professionals_evita_repetidos`, herdado do outro app), mas o app só
   sabia do primeiro: `lerMeuPerfil` pegava o mais antigo e pronto. Quem
   criasse um segundo — a diarista que também é cozinheira, e quer dois
   cadastros com ofícios e pretensões diferentes — não tinha como abrir o
   segundo nunca mais.

   A escolha vive no aparelho, como a da empresa (`escolherEmpresa`): é uma
   preferência de navegação, não um dado da pessoa. Guardá-la no banco
   faria o cadastro aberto no celular mudar sozinho o do computador. */
const CHAVE_CADASTRO = "ei-cadastro-escolhido";

export function idDoCadastroEscolhido(): string | null {
  try {
    return localStorage.getItem(CHAVE_CADASTRO);
  } catch {
    /* Aba anônima recusa o armazenamento. Sem a escolha, vale o primeiro
       cadastro — que é o que o app fazia antes de existir escolha. */
    return null;
  }
}

export function escolherCadastro(id: string | null) {
  try {
    if (id) localStorage.setItem(CHAVE_CADASTRO, id);
    else localStorage.removeItem(CHAVE_CADASTRO);
  } catch {
    /* segue sem guardar */
  }
}

/** Um cadastro da conta, na forma que a tela de escolha precisa. */
export type CadastroDaConta = {
  id: string;
  name: string;
  categories: string[];
  photo_url: string | null;
  paused: boolean;
};

/**
 * Todos os cadastros desta conta, do mais antigo para o mais novo.
 *
 * Erro SOBE: devolver lista vazia diria "você não tem cadastro" a quem
 * tem, e a tela seguinte mandaria essa pessoa criar outro por cima.
 */
export async function meusCadastros(ownerId: string): Promise<CadastroDaConta[]> {
  const sb = supabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("professionals")
    .select("id, name, categories, photo_url, paused")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((l) => ({
    id: String(l.id),
    name: String(l.name ?? ""),
    categories: (l.categories as string[]) ?? [],
    photo_url: (l.photo_url as string) ?? null,
    paused: !!l.paused,
  }));
}

export async function lerMeuPerfil(ownerId: string): Promise<MeuPerfil | null> {
  const sb = supabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("professionals")
    .select(
      "id, name, phone, email, photo_url, bio, neighborhood, areas_de_interesse, disponivel, paused, whatsapp_verified, " +
      "pretensao_centavos, pretensao_combinar, pretensao_periodo, disponibilidade, aceita_viajar, " +
      /* As sete da 0103. A lista é escrita à mão, uma a uma: coluna nova
         que ninguém acrescente aqui chega como indefinida, sem erro
         nenhum para avisar — e o campo aparece em branco na tela como se
         a pessoa nunca o tivesse preenchido. */
      "data_nascimento, cnh, cnh_categorias, telefones_extra, modo_trabalho, " +
      "fim_de_semana, inicio_imediato"
    )
    .eq("owner_id", ownerId)
    /* ── NEM `single` NEM `maybeSingle` — 03/09 ────────────────────────
       Os dois DÃO ERRO quando vem mais de uma linha, e mais de uma linha é
       possível: o banco permite até cinco cadastros por conta (o gatilho
       `professionals_evita_repetidos`, herdado do outro app). Quem tivesse
       dois via a leitura falhar e, dependendo da tela, o cadastro sumia
       como se não existisse — é o mesmo defeito que fez "Nova vaga" cair
       na tela de cadastrar empresa, e que só apareceu aqui porque o falso
       do navegador passou a recusar mais de uma linha como o PostgREST
       recusa.

       Ordena pelo mais antigo e pega o primeiro: é o cadastro principal da
       pessoa — o que ela criou quando entrou —, e é ele que as telas de
       "Meu cadastro" sempre mostraram. */
    .order("created_at", { ascending: true });

  if (error) throw error;
  const linhas = (data ?? []) as Array<Partial<Professional> & { disponivel?: boolean }>;
  if (linhas.length === 0) return null;

  /* Qual dos cadastros abrir: o escolhido na tela de seleção, e o mais
     antigo quando não há escolha (ou quando o escolhido foi apagado noutro
     aparelho — aí a escolha aponta para o vazio, e cair no primeiro é
     melhor que abrir uma tela em branco). */
  const escolhido = idDoCadastroEscolhido();
  const linha =
    (escolhido ? linhas.find((l) => l.id === escolhido) : null) ?? linhas[0];
  return {
    id: linha.id ?? null,
    name: linha.name ?? "",
    phone: linha.phone ?? "",
    email: linha.email ?? "",
    photoUrl: linha.photo_url ?? null,
    bio: linha.bio ?? "",
    neighborhood: linha.neighborhood ?? "",
    funcoes: linha.areas_de_interesse ?? [],
    /* `?? true` porque a coluna nasceu com `default true` na 0075: um
       cadastro criado antes dela responde `undefined`, e ler isso como
       "não disponível" tiraria da vitrine gente que nunca disse isso. */
    disponivel: linha.disponivel ?? true,
    oculto: linha.paused ?? false,
    confirmado: linha.whatsapp_verified ?? false,
    pretensao:
      linha.pretensao_centavos == null
        ? ""
        : (linha.pretensao_centavos / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
    pretensaoCombinar: linha.pretensao_combinar ?? false,
    pretensaoPeriodo: linha.pretensao_periodo ?? "mes",
    disponibilidade: linha.disponibilidade ?? [],
    aceitaViajar: linha.aceita_viajar ?? false,
    /* A data vem do banco como "1995-04-10", que é exatamente o formato
       que o campo de data do navegador espera. Nulo vira string vazia —
       `null` num input controlado faz o React reclamar e trocar o campo
       para não controlado no meio da digitação. */
    nascimento: linha.data_nascimento ?? "",
    temCnh: linha.cnh ?? false,
    cnhCategorias: linha.cnh_categorias ?? [],
    telefonesExtra: linha.telefones_extra ?? [],
    modoTrabalho: linha.modo_trabalho ?? "",
    fimDeSemana: linha.fim_de_semana ?? false,
    inicioImediato: linha.inicio_imediato ?? false,
  };
}

/**
 * Grava o cadastro. Cria na primeira vez, atualiza depois.
 *
 * ── Por que `insert` e `update` separados, e não `upsert` ─────────────
 *
 * O `upsert` do PostgREST é um `insert ... on conflict`, então quem manda
 * passa pela policy de INSERT mesmo estando só editando uma linha que já é
 * dele. É o defeito que já impediu a administração de salvar cadastro de
 * outra pessoa neste mesmo projeto. Para editar linha existente, `update`.
 */
export async function salvarMeuPerfil(
  ownerId: string,
  perfil: MeuPerfil
): Promise<string> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");

  const nome = perfil.name.trim();
  if (!nome) throw new Error("Escreva o seu nome — é ele que a empresa vê.");

  const telefone = soDigitos(perfil.phone);
  if (telefone.length < 10) {
    throw new Error("O telefone precisa ter DDD e número, como (31) 99999-8888.");
  }

  /* `categories` anda junto com `areas_de_interesse` de propósito. A busca
     pública e a `professionals_public` consultam `categories`; a onda
     consulta as duas. Gravar só uma faria a pessoa receber vaga e não
     aparecer na lista — ou o contrário, dependendo da tela. */
  const campos = {
    name: nome,
    phone: telefone,
    whatsapp: telefone,
    email: perfil.email.trim() || null,
    /* Vem do próprio estado, que já chegou carregado com a foto que
       existia (`lerMeuPerfil` lê `photo_url`) — mexer noutro campo e
       salvar não apaga a foto, porque `perfil.photoUrl` continua com o
       valor que veio do banco até alguém trocar. */
    photo_url: perfil.photoUrl,
    bio: perfil.bio.trim() || null,
    neighborhood: perfil.neighborhood.trim() || null,
    areas_de_interesse: perfil.funcoes,
    categories: perfil.funcoes,
    category: perfil.funcoes[0] ?? "",
    disponivel: perfil.disponivel,
    paused: perfil.oculto,
    /* Centavos, inteiro: valor com vírgula em ponto flutuante rende
       diferença de um centavo, e é a diferença que a pessoa percebe.
       Campo vazio grava `null` — que quer dizer "não respondeu", e é
       diferente de zero. */
    pretensao_centavos: emCentavos(perfil.pretensao),
    pretensao_combinar: perfil.pretensaoCombinar,
    pretensao_periodo: perfil.pretensaoPeriodo,
    disponibilidade: perfil.disponibilidade,
    aceita_viajar: perfil.aceitaViajar,
    /* Data vazia grava `null`, e não "": o Postgres recusa string vazia
       numa coluna `date` com 22007, e o erro chega na tela como texto
       técnico sem dizer qual campo o causou. */
    data_nascimento: perfil.nascimento.trim() || null,
    cnh: perfil.temCnh,
    /* Sem CNH, a lista de categorias é apagada. Senão, quem marcou "B" e
       depois desmarcou "tenho CNH" ficaria com uma categoria guardada de
       uma habilitação que a pessoa acabou de dizer que não tem — e a
       comparação com a vaga usaria isso. */
    cnh_categorias: perfil.temCnh ? perfil.cnhCategorias : [],
    telefones_extra: perfil.telefonesExtra
      .map((t) => soDigitos(t))
      .filter((t) => t.length >= 10)
      .slice(0, 3),
    modo_trabalho: perfil.modoTrabalho || null,
    fim_de_semana: perfil.fimDeSemana,
    inicio_imediato: perfil.inicioImediato,
    city: DEFAULT_CITY,
    uf: DEFAULT_UF,
  };

  if (perfil.id) {
    const { error } = await sb.from("professionals").update(campos).eq("id", perfil.id);
    if (error) throw error;
    return perfil.id;
  }

  const { data, error } = await sb
    .from("professionals")
    .insert({ ...campos, owner_id: ownerId })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Os cursos deste cadastro. Erro sobe, pelo mesmo motivo das experiências. */
export async function lerCursos(professionalId: string): Promise<CursoEmEdicao[]> {
  const sb = supabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("professional_courses")
    .select("nome, instituicao, ano, tipo, situacao, nivel")
    .eq("professional_id", professionalId)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((c: Record<string, unknown>) => ({
    nome: String(c.nome ?? ""),
    instituicao: String(c.instituicao ?? ""),
    ano: String(c.ano ?? ""),
    /* `?? "complementar"` porque a coluna nasceu com esse default na
       0104: os cursos gravados ANTES dela não tinham tipo nenhum, e ler
       isso como formação transformaria um curso de NR-35 em
       escolaridade. */
    tipo: (c.tipo === "formacao" ? "formacao" : "complementar") as "formacao" | "complementar",
    situacao: String(c.situacao ?? ""),
    nivel: String(c.nivel ?? ""),
  }));
}

/** As competências deste cadastro, na ordem que a pessoa escolheu. */
export async function lerCompetencias(professionalId: string): Promise<CompetenciaEmEdicao[]> {
  const sb = supabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("professional_skills")
    .select("nome, nivel")
    .eq("professional_id", professionalId)
    .order("ordem", { ascending: true });

  /* Erro SOBE, nunca vira lista vazia. Lista vazia diria à pessoa que ela
     não tem competência nenhuma cadastrada, e o salvamento seguinte
     apagaria as que estão lá. */
  if (error) throw error;
  return (data ?? []).map((c: Record<string, unknown>) => ({
    nome: String(c.nome ?? ""),
    nivel: (c.nivel === "avancado" || c.nivel === "intermediario"
      ? c.nivel
      : "basico") as CompetenciaEmEdicao["nivel"],
  }));
}

/**
 * Grava a lista inteira de competências: apaga o que saiu, insere o resto.
 *
 * Mesma escolha dos cursos e das experiências — são poucos itens, nada
 * aponta para eles, e a ordem da tela vira a coluna `ordem`, então ela
 * sobrevive à volta.
 *
 * A repetida é descartada AQUI, e não deixada para o banco: a 0104 tem um
 * índice único por (dono, nome em minúsculas), e deixar o erro subir faria
 * o cadastro inteiro falhar por causa de um "Excel" digitado duas vezes.
 */
export async function salvarCompetencias(
  professionalId: string,
  lista: CompetenciaEmEdicao[]
): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");

  const vistas = new Set<string>();
  const validos = lista
    .map((c) => ({ nome: c.nome.trim(), nivel: c.nivel }))
    .filter((c) => {
      if (!c.nome) return false;
      const chave = c.nome.toLocaleLowerCase("pt-BR");
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });

  const { error: erroApagar } = await sb
    .from("professional_skills")
    .delete()
    .eq("professional_id", professionalId);
  if (erroApagar) throw erroApagar;

  if (validos.length === 0) return;

  const { error } = await sb.from("professional_skills").insert(
    validos.map((c, i) => ({ ...c, professional_id: professionalId, ordem: i }))
  );
  if (error) throw error;
}

/**
 * Grava a lista inteira: apaga o que saiu, insere o que ficou.
 *
 * Mesma escolha das experiências — são poucos itens, nada aponta para
 * eles, e a ordem da tela vira a coluna `ordem`, então ela sobrevive à
 * volta. Curso sem nome é descartado em silêncio: o botão "acrescentar"
 * cria uma linha vazia, e recusar o cadastro inteiro por causa de uma
 * hesitação seria transformar desistência em erro.
 */
export async function salvarCursos(
  professionalId: string,
  lista: CursoEmEdicao[]
): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");

  const validos = lista
    .map((c) => ({
      nome: c.nome.trim(),
      instituicao: c.instituicao.trim() || null,
      ano: c.ano.trim() || null,
      tipo: c.tipo,
      /* Vazio grava `null`, e não "": o `check` da 0104 aceita nulo mas
         recusa string vazia, e a recusa derruba a gravação inteira sem
         dizer qual das linhas estava errada. */
      situacao: c.situacao || null,
      /* Nível só na formação. Num curso complementar ele seria uma
         escolaridade inventada — e a comparação com a exigência da vaga
         passaria a usar esse valor. */
      nivel: c.tipo === "formacao" ? c.nivel || null : null,
    }))
    .filter((c) => c.nome.length > 0);

  const { error: erroApagar } = await sb
    .from("professional_courses")
    .delete()
    .eq("professional_id", professionalId);
  if (erroApagar) throw erroApagar;

  if (validos.length === 0) return;

  const { error } = await sb.from("professional_courses").insert(
    validos.map((c, i) => ({ ...c, professional_id: professionalId, ordem: i }))
  );
  if (error) throw error;
}

/**
 * Confirma o telefone do cadastro.
 *
 * Quem confere tudo é o banco: se a conta é a dona do cadastro, se o Auth
 * já confirmou aquele número por código, e se o número confirmado é o
 * MESMO do cadastro. Nada disso pode ser decidido no navegador — é
 * justamente ali que alguém mexeria para se declarar confirmado.
 *
 * Erro sobe com a mensagem do banco, que é específica ("o número
 * confirmado é diferente do que está no anúncio") e vale mais que
 * qualquer texto genérico escrito aqui.
 */
export async function confirmarMeuTelefone(professionalId: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Banco não configurado");
  const { error } = await sb.rpc("confirmar_whatsapp", {
    p_professional_id: professionalId,
  });
  if (error) throw error;
}

/**
 * "1.500,00", "1500", "R$ 1.500" → 150000 centavos. Vazio → null.
 *
 * Aceita o jeito brasileiro de escrever (ponto de milhar, vírgula de
 * centavo) porque é o que sai do teclado de quem preenche — recusar
 * "1.500,00" seria recusar a forma certa de escrever mil e quinhentos.
 */
function emCentavos(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.]/g, "").trim();
  if (!limpo) return null;
  /* Tira os pontos de milhar e troca a vírgula decimal por ponto. */
  const normal = limpo.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const valor = Number(normal);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

/** "(31) 99999-8888" e "+55 31 99999 8888" viram a mesma coisa. */
function soDigitos(bruto: string): string {
  const n = bruto.replace(/\D/g, "");
  return n.startsWith("55") && n.length > 11 ? n.slice(2) : n;
}
