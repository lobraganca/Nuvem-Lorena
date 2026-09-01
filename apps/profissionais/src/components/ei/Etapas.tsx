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
 *    divisão em etapas existe para evitar. Voltar, sim — o botão de voltar
 *    do rodapé faz isso.
 */
import { useEffect, useRef } from "react";

type Props = {
  /** Os nomes das etapas, na ordem. */
  passos: string[];
  /** Qual está acontecendo agora, começando em 1. */
  atual: number;
};

export function Etapas({ passos, atual }: Props) {
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
        return (
          <li
            key={nome}
            className={`ei-etapa ei-etapa-${estado}`}
            aria-current={n === atual ? "step" : undefined}
          >
            <span className="ei-etapa-numero" aria-hidden="true">
              {estado === "feita" ? "✓" : n}
            </span>
            <span className="ei-etapa-nome">{nome}</span>
          </li>
        );
      })}
    </ol>
  );
}
