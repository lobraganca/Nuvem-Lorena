/**
 * De que lado a pessoa disse que está, na primeira tela.
 *
 * ── O defeito que isto conserta ───────────────────────────────────────
 *
 * A dona: "quero que o app seja intuitivo e de fácil para ambas as partes."
 *
 * A tela de abertura tem duas portas — "Procuro trabalho" e "Estou
 * contratando" — e as duas eram `<Link to="/login">`. O MESMO endereço. A
 * pessoa dizia de que lado estava, o app jogava a resposta fora, e na tela
 * seguinte perguntava de novo, com outras palavras ("Qual é seu tipo de
 * conta?") e com outra aparência.
 *
 * Percorrendo os dois caminhos de ponta a ponta, era o passo em que os dois
 * travavam igual: quem contrata tocava em "Estou contratando" e chegava a
 * uma tela chamada "Entrar" que não mencionava contratar em lugar nenhum.
 * Não dá para saber se você está no caminho certo.
 *
 * ── Por que passa pelo localStorage e não só pela URL ─────────────────
 *
 * Porque o Google leva o navegador para FORA do app e o traz de volta num
 * endereço que o app não escolheu — qualquer coisa na consulta da URL se
 * perde na viagem. Entrar pelo telefone termina na própria tela e a URL
 * bastaria; escrever dois caminhos para a mesma coisa é como se perde um
 * deles.
 *
 * A chave é apagada assim que o lado vira dado da conta. Ela é uma intenção
 * em trânsito, não um registro: quem já tem cadastro de empresa é empresa
 * porque tem a empresa, não porque tocou num botão há três semanas.
 */

const CHAVE = "ei-lado-escolhido";

export type Lado = "professional" | "company";

/** O que vem na URL (`?lado=contratar`) traduzido para o nome do banco. */
export function ladoDaUrl(busca: string): Lado | null {
  const v = new URLSearchParams(busca).get("lado");
  if (v === "contratar") return "company";
  if (v === "trabalhar") return "professional";
  return null;
}

/** O nome curto que vai na URL. Em português, porque aparece para a pessoa. */
export function urlDoLado(lado: Lado): string {
  return lado === "company" ? "contratar" : "trabalhar";
}

export function guardarLado(lado: Lado): void {
  try {
    localStorage.setItem(CHAVE, lado);
  } catch {
    /* Navegador com armazenamento bloqueado: o app segue funcionando e a
       pessoa cai na pergunta do tipo de conta, que é o que acontecia antes
       deste arquivo existir. Perder o atalho não pode impedir de entrar. */
  }
}

export function lerLado(): Lado | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "company" || v === "professional" ? v : null;
  } catch {
    return null;
  }
}

export function esquecerLado(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer, e nada que justifique atrapalhar quem está entrando */
  }
}

/** Para onde cada lado vai depois de entrar. */
export function destinoDoLado(lado: Lado): string {
  return lado === "company" ? "/cadastro-empresa" : "/meu-perfil";
}
