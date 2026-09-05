import { supabase } from "./supabase";

/**
 * A denúncia, escrita no banco e não mandada pelo WhatsApp.
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "a situação de denunciar o perfil deve ser direcionado ao painel
 * administrativo, com a solicitação e descrição para que eu veja e tenha a
 * possibilidade de tirar a vaga ou o usuário do ar."
 *
 * ── O que havia ────────────────────────────────────────────────────────
 *
 * Os dois botões de denunciar abriam o WhatsApp com um texto pronto. A
 * tabela `reports` existe desde a 0007 e a seção "Denúncias" existe no
 * painel desde a 0008 — só que nada no app escrevia nela. O painel dizia
 * "nenhuma denúncia recebida ainda" não porque ninguém denunciou, e sim
 * porque a denúncia ia para outro lugar.
 *
 * Uma conversa de WhatsApp não é uma fila: não tem data confiável, não tem
 * estado (apurei? descartei?), some no meio das outras mensagens, e não
 * tem o botão de tirar do ar do lado do caso. Aqui tem.
 *
 * ── Duas travas que continuam sendo do banco ──────────────────────────
 *
 * Só denuncia quem está logado (0035) e confirmou o número (0045). O
 * motivo está escrito lá e vale repetir: denúncia anônima é a ferramenta
 * mais barata que existe para tirar um concorrente do ar, e do outro lado
 * tem alguém cujo anúncio é o ganha-pão. A tela avisa antes; o banco
 * recusa mesmo que alguém passe por cima da tela.
 */

/** O que se denuncia: uma pessoa cadastrada, ou uma vaga. */
export type AlvoDaDenuncia = "perfil" | "vaga";

/**
 * Os motivos, escritos como a pessoa fala.
 *
 * Lista fechada e não campo aberto: motivo digitado à mão vira "não
 * gostei" e "sei lá", e depois não dá para separar o golpe do
 * desentendimento. A descrição livre continua existindo abaixo dele — é lá
 * que a história cabe.
 */
export const MOTIVOS_DA_VAGA = [
  "Pediram dinheiro para me candidatar",
  "A vaga não existe / é enganosa",
  "Empresa falsa ou se passando por outra",
  "Conteúdo ofensivo ou discriminatório",
  "Outro motivo",
] as const;

export const MOTIVOS_DO_PERFIL = [
  "Perfil falso ou se passando por outra pessoa",
  "Dados de outra pessoa sem autorização",
  "Conteúdo ofensivo ou discriminatório",
  "Aplicou um golpe",
  "Outro motivo",
] as const;

/**
 * Grava a denúncia.
 *
 * `reporter_id` vai explícito porque a policy o compara com `auth.uid()`:
 * sem ele a gravação é recusada com uma mensagem de permissão que não
 * explica nada — e o defeito pareceria "o banco não deixa denunciar".
 */
export async function enviarDenuncia(entrada: {
  alvo: AlvoDaDenuncia;
  alvoId: string;
  motivo: string;
  descricao: string;
  denuncianteId: string;
}): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Sem conexão com o banco.");

  /* Tipado à mão: com o espalhamento condicional, o TypeScript monta uma
     união de duas formas e o cliente do Supabase recusa a segunda por não
     ter a coluna da primeira. A trava de verdade — uma coisa e só uma —
     é a `reports_uma_coisa_so`, no banco (0121). */
  const linha: {
    reporter_id: string;
    reason: string;
    details: string | null;
    job_id?: string;
    professional_id?: string;
  } = {
    reporter_id: entrada.denuncianteId,
    reason: entrada.motivo,
    details: entrada.descricao.trim() || null,
  };
  if (entrada.alvo === "vaga") linha.job_id = entrada.alvoId;
  else linha.professional_id = entrada.alvoId;

  const { error } = await sb.from("reports").insert(linha);
  if (error) throw error;
}

/**
 * O banco recusou porque a 0121 ainda não foi aplicada?
 *
 * Mesma família de `colunasNovas.ts`: 42703 é "coluna não existe" do
 * Postgres e PGRST204 é a mesma coisa vista pelo PostgREST. Serve para a
 * tela dizer a verdade — "ainda não dá para denunciar vaga por aqui, me
 * chame no WhatsApp" — em vez de um erro cru que faz a pessoa desistir de
 * denunciar um golpe.
 */
export function faltaAMigracaoDaDenuncia(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42703" || e.code === "PGRST204") return true;
  return typeof e.message === "string" && /job_id/.test(e.message);
}

/**
 * Já denunciou esta mesma coisa e ainda está em apuração?
 *
 * O índice único parcial (0013 para cadastro, 0121 para vaga) recusa a
 * segunda denúncia pendente da mesma pessoa sobre o mesmo alvo, com o
 * código 23505. Sem tratar, a tela diria "não consegui gravar" para quem
 * já fez tudo certo — e a pessoa denunciaria de novo, e de novo.
 */
export function jaDenunciou(err: unknown): boolean {
  const e = err as { code?: string } | null;
  return e?.code === "23505";
}
