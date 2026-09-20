import { Link } from "react-router-dom";
import { PILARES, TRILHA, caminho, chaveDoCampo } from "../dados/metodo";
import { contarPilar, contarTudo, porcento } from "../lib/progresso";
import { respondido } from "../lib/guardar";
import { useRespostas } from "../lib/useRespostas";
import { Barra } from "../componentes/Menu";

export function Inicio() {
  const respostas = useRespostas();
  const tudo = contarTudo(respostas);

  // Onde a pessoa parou: a primeira pergunta ainda em branco. Começar pelo
  // começo toda vez é o jeito mais rápido de alguém desistir na terceira
  // visita.
  const proxima =
    TRILHA.find(({ pilar, etapa }) =>
      etapa.campos.some((campo) => !respondido(respostas[chaveDoCampo(pilar, etapa, campo)])),
    ) ?? TRILHA[0];

  const comecou = tudo.feitos > 0;

  return (
    <article className="tela">
      <header className="tela-topo">
        <h1>O que você quer criar no digital, escrito em cinco pilares</h1>
        <p className="chamada">
          Você responde; no fim sai um documento que dá para mandar para alguém,
          ler daqui a três meses e usar para decidir. Nada aqui é enfeite: cada
          pergunta existe porque, sem a resposta dela, a próxima decisão é chute.
        </p>
      </header>

      <div className="cartao-progresso">
        <Barra fracao={porcento(tudo)} />
        <p>
          {comecou
            ? `${tudo.feitos} de ${tudo.total} perguntas respondidas.`
            : "Nenhuma pergunta respondida ainda."}
        </p>
        <Link className="botao" to={caminho(proxima.pilar, proxima.etapa)}>
          {comecou ? "Continuar de onde parei" : "Começar pelo Pilar 1"}
        </Link>
      </div>

      <ol className="cartoes">
        {PILARES.map((pilar) => {
          const conta = contarPilar(pilar, respostas);
          return (
            <li key={pilar.numero} className="cartao">
              <div className="cartao-cabeca">
                <span className="numero numero-grande">{pilar.numero}</span>
                <div>
                  <h2>{pilar.nome}</h2>
                  <p className="cartao-conta">
                    {conta.feitos}/{conta.total} respondidas
                  </p>
                </div>
              </div>
              <p className="proposito">{pilar.proposito}</p>
              <ul className="etapas-do-cartao">
                {pilar.etapas.map((etapa) => (
                  <li key={etapa.slug}>
                    <Link to={caminho(pilar, etapa)}>{etapa.nome}</Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <p className="aviso">
        As respostas ficam salvas neste aparelho, sozinhas, conforme você
        escreve — não tem botão de salvar e não tem conta para criar. Em
        compensação elas vivem só aqui: antes de trocar de celular ou limpar o
        navegador, baixe uma cópia no{" "}
        <Link to="/relatorio">relatório</Link>.
      </p>
    </article>
  );
}
