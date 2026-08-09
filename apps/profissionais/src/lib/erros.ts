/**
 * Transforma o que o Supabase devolve em uma frase que a pessoa possa agir.
 *
 * O erro do Supabase não é um `Error` — é um objeto solto com `message`,
 * `code` e `hint`. O código escrevia `err instanceof Error ? err.message :
 * "Erro ao salvar."`, então **todo** erro real do banco caía no genérico:
 * a pessoa via "Erro ao salvar" sem nunca descobrir o que faltava.
 *
 * Os três casos traduzidos aqui são os que aparecem na prática, e nenhum
 * deles se resolve lendo o texto original em inglês.
 */
export function mensagemDeErro(err: unknown, padrao: string): string {
  const bruto =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : "";

  if (!bruto) return padrao;

  // Bucket de fotos ainda não criado no projeto Supabase.
  if (/bucket not found/i.test(bruto)) {
    return "O espaço das fotos ainda não foi criado no Supabase (Storage → New bucket → professional-photos, público). Enquanto isso, o anúncio de empresa salva sem logo.";
  }
  // Política de segurança barrou a gravação.
  if (/row-level security|violates row-level/i.test(bruto)) {
    return "O banco recusou a gravação por segurança. Saia da conta, entre de novo e tente outra vez.";
  }
  if (/duplicate key/i.test(bruto)) {
    return "Já existe um anúncio com esses dados.";
  }
  return `${padrao} (${bruto})`;
}

/**
 * Erro vindo de uma Edge Function, com a mensagem que o servidor escreveu.
 *
 * O cliente do Supabase entrega só "Edge Function returned a non-2xx status
 * code" — a resposta real fica escondida em `error.context`. Isso troca uma
 * frase útil ("MP_ACCESS_TOKEN não configurado no servidor") por uma que não
 * diz nada, e transforma dez minutos de conserto numa caçada aos logs.
 */
export async function erroDaFunction(err: unknown): Promise<Error> {
  const contexto = (err as { context?: unknown })?.context;

  if (contexto instanceof Response) {
    try {
      // O corpo já pode ter sido lido: clone antes, para não estourar aqui e
      // perder também a mensagem genérica.
      const corpo = await contexto.clone().json();
      const detalhe = corpo?.error ?? corpo?.message;
      if (detalhe) return new Error(String(detalhe));
    } catch {
      /* Resposta sem JSON: cai no genérico abaixo. */
    }
  }

  const bruto =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : "";
  return new Error(bruto || "A função do servidor respondeu com erro.");
}
