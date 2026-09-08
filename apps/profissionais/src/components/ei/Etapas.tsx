/**
 * A trilha de etapas do cadastro, em cartões.
 *
 * ── POR QUE CARTÃO, E NÃO A BARRINHA ───────────────────────────────────
 *
 * Antes o progresso era um fio de 4px preenchido pela metade. Ele informa,
 * mas não orienta: a pessoa vê que está "no meio" e não sabe de quê nem
 * quanto falta. A dona pediu "em cards por etapas, pra ficar mais
 * dinâmico" — e o que um cartão por etapa acrescenta é justamente o que
 * faltava, o NOME do que vem: "Empresa", "Onde fica", "Contato".
 *
 * Cada etapa é um cartãozinho com número e nome. A de agora fica pintada,
 * as já feitas ganham o visto, as seguintes ficam apagadas. Assim a tela
 * responde de uma vez a "onde estou", "o que já fiz" e "o que ainda vem" —
 * três perguntas que a barra sozinha não respondia.
 *
 * ── DUAS DECISÕES QUE PARECEM DETALHE E NÃO SÃO ────────────────────────
 *
 * 1. A trilha ROLA na horizontal em vez de espremer os nomes. Com quatro
 *    etapas num celular estreito, dividir a largura em quatro dá 80px por
 *    nome — e "Quando receber vaga" vira "Quando rece…". Rolando, o nome
 *    inteiro cabe e a etapa de agora é trazida para a vista.
 *
 * 2. Não dá para PULAR clicando numa etapa à frente. Cada passo valida o
 *    que a pessoa preencheu antes de deixar seguir; um atalho aqui
 *    entregaria o formulário pela metade ao banco, que é o defeito que a
 *    divisão em etapas existe para evitar.
 *
 * ── VOLTAR, SIM: AS ETAPAS FEITAS VIRARAM BOTÃO — 08/09 ────────────────
 *
 * A dona: "quando cadastrar uma vaga dá a opção de voltar nos campos
 * anteriores."
 *
 * A opção existia — o "Voltar" do rodapé — e foi medida: na etapa 1 ela
 * fica logo abaixo do "Continuar", a três pixels de rolagem. Ou seja, não
 * era um problema de achar o botão.
 *
 * Era este desenho aqui. A trilha mostra os cinco nomes no topo, pintados
 * e numerados, com visto nos que já passaram — tudo o que um menu tem.
 * Quem quer arrumar o salário toca em "3 Salário", que é o gesto óbvio, e
 * não acontece nada. Um elemento que PARECE tocável e não é ensina que a
 * tela está quebrada, e a pessoa não vai procurar o botão do rodapé
 * depois disso: ela conclui que não dá.
 *
 * Agora a etapa JÁ FEITA é um botão de verdade e leva de volta a ela. A
 * regra do item 2 continua inteira, e é o que separa os dois casos: para
 * trás o formulário já foi validado uma vez, para a frente não. Por isso
 * a de agora e as seguintes continuam sem toque.
 *
 * Quem não passa `aoVoltar` — o cadastro da empresa, hoje — segue com a
 * trilha só de leitura, exatamente como antes.
 */
import { useEffect, useRef } from "react";

type Props = {
  /** Os nomes das etapas, na ordem. */
  passos: string[];
  /** Qual está acontecendo agora, começando em 1. */
  atual: number;
  /**
   * Chamado ao tocar numa etapa JÁ FEITA. Sem isto a trilha é só um
   * indicador — que é como ela nasceu, e como o cadastro da empresa ainda
   * a usa.
   */
  aoVoltar?: (n: number) => void;
};

export function Etapas({ passos, atual, aoVoltar }: Props) {
  const trilha = useRef<HTMLOListElement>(null);

  /* Traz a etapa de agora para a vista quando ela muda. Sem isto, quem
     chega na etapa 3 de 4 num celular estreito continua vendo as duas
     primeiras, e a tela parece não ter avançado. */
  useEffect(() => {
    const agora = trilha.current?.querySelector<HTMLElement>(".ei-etapa-agora");
    agora?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [atual]);

  return (
    <ol
      className="ei-etapas ei-margem"
      ref={trilha}
      aria-label={`Etapa ${atual} de ${passos.length}`}
    >
      {passos.map((nome, i) => {
        const n = i + 1;
        const estado = n < atual ? "feita" : n === atual ? "agora" : "adiante";
        const podeVoltar = estado === "feita" && !!aoVoltar;

        const dentro = (
          <>
            <span className="ei-etapa-numero" aria-hidden="true">
              {estado === "feita" ? "✓" : n}
            </span>
            <span className="ei-etapa-nome">{nome}</span>
          </>
        );

        /* O cartão continua sendo o mesmo elemento visual — só muda de
           tag. As classes ficam nele, e não num filho, para o toque valer
           no cartão INTEIRO: um botão por dentro da moldura deixaria a
           borda inerte, e é justamente na borda que o dedo cai. */
        return (
          <li key={nome} className="ei-etapa-lugar">
            {podeVoltar ? (
              <button
                type="button"
                className={`ei-etapa ei-etapa-${estado} ei-etapa-toque`}
                onClick={() => aoVoltar(n)}
                /* O nome sozinho ("Salário") não diz o que o toque faz.
                   Quem ouve a tela precisa da frase inteira. */
                aria-label={`Voltar para a etapa ${n}: ${nome}`}
              >
                {dentro}
              </button>
            ) : (
              <div
                className={`ei-etapa ei-etapa-${estado}`}
                aria-current={n === atual ? "step" : undefined}
              >
                {dentro}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
