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
  disponibilidade: string[];
  aceitaViajar: boolean;
};

export type CursoEmEdicao = { nome: string; instituicao: string; ano: string };

export const PERFIL_VAZIO: MeuPerfil = {
  id: null,
  name: "",
  phone: "",
  email: "",
  neighborhood: "",
  funcoes: [],
  disponivel: true,
  oculto: false,
  confirmado: false,
  pretensao: "",
  pretensaoCombinar: false,
  disponibilidade: [],
  aceitaViajar: false,
};

/**
 * Lê o cadastro desta pessoa, ou `null` se ela ainda não tem um.
 *
 * Erro SOBE. Devolver `null` num erro de leitura faria a tela abrir em
 * branco e a pessoa preencher tudo de novo por cima de um cadastro que
 * existe — e o `upsert` seguinte apagaria o que estava lá.
 */
export async function lerMeuPerfil(ownerId: string): Promise<MeuPerfil | null> {
  const sb = supabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("professionals")
    .select(
      "id, name, phone, email, neighborhood, areas_de_interesse, disponivel, paused, whatsapp_verified, " +
      "pretensao_centavos, pretensao_combinar, disponibilidade, aceita_viajar"
    )
    .eq("owner_id", ownerId)
    /* `maybeSingle` e não `single`: quem ainda não tem cadastro é o caso
       normal desta tela, e o `single` trataria isso como erro. */
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const linha = data as Partial<Professional> & { disponivel?: boolean };
  return {
    id: linha.id ?? null,
    name: linha.name ?? "",
    phone: linha.phone ?? "",
    email: linha.email ?? "",
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
    disponibilidade: linha.disponibilidade ?? [],
    aceitaViajar: linha.aceita_viajar ?? false,
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
    disponibilidade: perfil.disponibilidade,
    aceita_viajar: perfil.aceitaViajar,
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
    .select("nome, instituicao, ano")
    .eq("professional_id", professionalId)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((c: Record<string, unknown>) => ({
    nome: String(c.nome ?? ""),
    instituicao: String(c.instituicao ?? ""),
    ano: String(c.ano ?? ""),
  }));
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
