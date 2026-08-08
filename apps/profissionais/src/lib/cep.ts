/**
 * Busca de endereço pelo CEP, usando o ViaCEP (público, sem cadastro).
 *
 * Existe para a pessoa digitar oito números em vez de rua, bairro e cidade —
 * três campos onde se erra acento, abreviação e grafia, e onde cada variação
 * ("R. Sete de Setembro", "Rua 7 de Setembro") vira um endereço diferente aos
 * olhos de quem procura.
 *
 * Falha de rede não é tratada como erro fatal: quem estiver sem sinal ou com
 * o serviço fora do ar continua podendo preencher à mão. O CEP é um atalho,
 * nunca um pedágio.
 */
export interface EnderecoDoCep {
  street: string;
  neighborhood: string;
  city: string;
}

export function formatCep(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export async function buscarCep(cep: string): Promise<EnderecoDoCep | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
    };
    // CEP inexistente vem com `erro: true` e status 200 — não dá para
    // confiar só no código da resposta.
    if (dados.erro) return null;
    return {
      street: dados.logradouro ?? "",
      neighborhood: dados.bairro ?? "",
      city: dados.localidade ?? "",
    };
  } catch {
    return null;
  }
}
