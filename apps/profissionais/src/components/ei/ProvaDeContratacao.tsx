import { useContratados } from "../../lib/numerosDoEi";

/**
 * "🤝 37 pessoas já foram contratadas."
 *
 * ── De onde vem o número ──────────────────────────────────────────────
 *
 * Da pergunta que o app já faz há semanas ao encerrar uma vaga em "Já
 * contratei": "a pessoa que você contratou veio do Ei Emprego?" e
 * "quantas pessoas você contratou por esta vaga?". As respostas ficavam
 * gravadas em `job_listings` e só o painel da administração as lia — o
 * dado mais valioso do app, guardado numa gaveta.
 *
 * ── Onde ele aparece, e por que só em dois lugares ────────────────────
 *
 * É a resposta para "isto funciona?", então ele vale nos dois momentos em
 * que essa pergunta é feita de verdade:
 *
 *   . a tela de LOGIN, que é a primeira que quem não tem conta vê (`/`
 *     manda para lá) — é onde se decide dar o telefone e esperar um SMS;
 *   . a tela de PLANOS, onde se decide gastar dinheiro. Ali ele vem antes
 *     dos preços: depois deles a pessoa já decidiu.
 *
 * NÃO fica na tela inicial de cada lado, e isso foi decidido depois de
 * escrever: aquela tela vem logo depois do login, e a mesma frase em duas
 * telas seguidas lê como repetição, não como reforço.
 *
 * ── Some sozinho, de dois jeitos ──────────────────────────────────────
 *
 * `useContratados` devolve `null` quando o número está abaixo do piso e
 * quando o banco ainda não sabe responder (a 0125 não aplicada). Nos dois
 * casos a tela fica exatamente como era antes — que é o certo: este bloco
 * é um argumento a mais, e nenhuma tela depende dele para funcionar.
 */
export function ProvaDeContratacao({ className = "" }: { className?: string }) {
  const quantos = useContratados();
  if (quantos === null) return null;

  return (
    <p className={`ei-ja-contratou ${className}`.trim()}>
      <span aria-hidden="true">🤝</span>
      {/* "já foram contratadas", e não "conseguiram emprego": o app sabe
          que a contratação aconteceu, não sabe se a pessoa continua lá. A
          frase menor é a que dá para provar. */}
      {/* ── SEM O "PELO EI EMPREGO" — 06/09 ───────────────────────
          A dona: "onde tá escrito 37 pessoas já foram contratadas no Ei
          Emprego, ficar só 37 pessoas já foram contratadas."

          Ela tem razão, e o motivo é o lugar: a frase aparece na tela de
          entrar e na de planos, as duas com o nome do app na barra de
          cima. Repetir "pelo Ei Emprego" ali é dizer duas vezes onde a
          pessoa já está — e a frase encurtada cabe numa linha só no
          celular, em vez de quebrar em duas. */}
      <span>
        <strong>{quantos}</strong>{" "}
        {quantos === 1 ? "pessoa já foi contratada" : "pessoas já foram contratadas"}
      </span>
    </p>
  );
}
