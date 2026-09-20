// Onde as respostas ficam.
//
// Hoje: no navegador de quem responde (localStorage). Não tem conta, não tem
// servidor, não tem custo — e dá para usar hoje.
//
// O preço disso está dito em voz alta na tela do relatório, porque é o tipo de
// coisa que só se descobre quando some: o que está aqui vive num aparelho só.
// Trocou de celular, limpou o navegador, abriu numa janela anônima — não está
// lá. Por isso existe o "baixar cópia" / "restaurar cópia" no relatório.
//
// Quando houver conta e banco (Supabase), este arquivo é o único lugar que
// muda: as telas só conhecem ler(), salvar() e assinar().

const CHAVE = "mapa-digital.v1";

export type Respostas = Record<string, string>;

// Lista de quem quer ser avisado quando algo muda. Sem isso, a barra de
// progresso do menu só atualizaria ao trocar de tela — e a pessoa digita
// achando que não está salvando nada.
const ouvintes = new Set<() => void>();

let cache: Respostas | null = null;

export function ler(): Respostas {
  if (cache) return cache;
  try {
    const cru = localStorage.getItem(CHAVE);
    cache = cru ? (JSON.parse(cru) as Respostas) : {};
  } catch {
    // Janela anônima, armazenamento bloqueado, JSON estragado. Em nenhum
    // desses casos a tela pode quebrar: segue em branco e o que a pessoa
    // escrever nesta sessão continua valendo enquanto a aba estiver aberta.
    cache = {};
  }
  return cache;
}

/** Devolve se algo mudou de verdade — é o que autoriza a tela a dizer "salvo". */
export function salvar(chave: string, valor: string): boolean {
  const atual = ler();
  // `?? ""`: campo nunca preenchido é `undefined`, campo vazio na tela é `""`.
  // Sem isso, os dois pareciam diferentes e TODO campo em branco se dava por
  // salvo ao abrir a tela — o "salvo" acendia sozinho nos seis de uma vez.
  if ((atual[chave] ?? "") === valor) return false;

  // Objeto novo, e não `atual[chave] = valor`: o React só redesenha o que
  // depende disso (a barra de progresso) se a identidade do objeto mudar.
  const proximo = { ...atual };
  // Campo apagado sai do conjunto, em vez de virar uma chave com texto vazio:
  // a cópia de segurança fica do tamanho do que a pessoa escreveu de verdade.
  if (valor === "") delete proximo[chave];
  else proximo[chave] = valor;
  cache = proximo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(cache));
  } catch {
    // Cota estourada ou armazenamento bloqueado: o cache em memória já foi
    // atualizado, então a tela continua coerente até fechar a aba.
  }
  avisar();
  return true;
}

export function trocarTudo(novas: Respostas): void {
  cache = { ...novas };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(cache));
  } catch {
    /* mesma história do salvar() */
  }
  avisar();
}

export function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}

/** Respondido é o que tem texto de verdade — espaço em branco não conta. */
export function respondido(valor: string | undefined): boolean {
  return !!valor && valor.trim().length > 0;
}
