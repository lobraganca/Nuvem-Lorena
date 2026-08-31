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
  const codigo =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";

  if (!bruto) return padrao;

  /* Frase que nós mesmos escrevemos dentro do banco passa inteira.
     Os gatilhos do projeto usam `raise exception` com o texto já em
     português e já pensado para quem vai ler ("Você já enviou um pedido
     para este profissional agora há pouco"). Isso chega aqui com o código
     P0001, que é o do `raise` de pl/pgsql — os erros do próprio Postgres
     têm códigos próprios e vêm em inglês.

     Sem isto, a frase boa chegava embrulhada no genérico: "Não foi
     possível enviar. (Você já enviou um pedido…)". */
  if (codigo === "P0001") return bruto;

  // Bucket de fotos ainda não criado no projeto Supabase.
  if (/bucket not found/i.test(bruto)) {
    return "O espaço das fotos ainda não foi criado no Supabase (Storage → New bucket → professional-photos, público). Enquanto isso, o cadastro de empresa salva sem logo.";
  }
  /* Política de segurança barrou a gravação.
     A frase de antes mandava sair da conta e entrar de novo. É conselho
     errado quase sempre: a recusa não vem de sessão vencida — sessão
     vencida dá outro erro —, vem de a conta não ter permissão para
     escrever naquela linha. Sair e entrar não muda permissão nenhuma, e
     quem seguia a instrução voltava para o mesmo erro achando que tinha
     feito algo errado. */
  if (/row-level security|violates row-level/i.test(bruto)) {
    return "O banco não deixou salvar: esta conta não tem permissão para alterar este cadastro. Se ele é seu, avise a administração — é falha nossa, não sua.";
  }
  if (/duplicate key/i.test(bruto)) {
    return "Já existe um cadastro com esses dados.";
  }

  /* A parte do banco ainda não foi criada.
     ──────────────────────────────────────
     `42P01` é tabela que não existe, `42703` é coluna que não existe, e
     `PGRST205` é o PostgREST não achando a tabela no cache do schema. Os
     três significam a mesma coisa para quem está olhando a tela: falta
     aplicar uma migration.

     Sem esta tradução, a pessoa lia
     `relation "public.job_notifications" does not exist` — que não diz
     nada para ela e faz o app parecer defeituoso. Foi visto exatamente
     assim ao simular o banco no estado em que ele está hoje.

     A frase não pede nada a quem lê: quem aplica migration é a dona, e
     mandar um profissional "avisar o suporte" sobre uma tabela é jogar
     nas costas dele um problema que não é dele. */
  if (
    codigo === "42P01" ||
    codigo === "42703" ||
    codigo === "PGRST205" ||
    /does not exist|schema cache/i.test(bruto)
  ) {
    return "Esta parte do app ainda não está ligada. Já estamos preparando — tente de novo mais tarde.";
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
