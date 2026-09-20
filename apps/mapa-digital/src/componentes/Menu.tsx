import { NavLink } from "react-router-dom";
import { PILARES, caminho } from "../dados/metodo";
import { contarEtapa, contarPilar, contarTudo, porcento } from "../lib/progresso";
import { useRespostas } from "../lib/useRespostas";

type Props = { aberto: boolean; aoFechar: () => void };

export function Menu({ aberto, aoFechar }: Props) {
  const respostas = useRespostas();
  const tudo = contarTudo(respostas);

  return (
    <>
      {/* No celular o menu vira gaveta; o véu atrás dele fecha ao toque. */}
      <div
        className={`veu ${aberto ? "veu-visivel" : ""}`}
        onClick={aoFechar}
        aria-hidden="true"
      />

      <nav
        id="menu-lateral"
        className={`menu ${aberto ? "menu-aberto" : ""}`}
        aria-label="Pilares"
      >
        <div className="menu-resumo">
          <Barra fracao={porcento(tudo)} />
          <p>
            {tudo.feitos} de {tudo.total} perguntas respondidas
          </p>
        </div>

        <ol className="lista-de-pilares">
          {PILARES.map((pilar) => {
            const conta = contarPilar(pilar, respostas);
            return (
              <li key={pilar.numero}>
                <div className="cabeca-do-pilar">
                  <span className="numero">{pilar.numero}</span>
                  <span className="nome-do-pilar">{pilar.nome}</span>
                  <span className="conta" aria-label={`${conta.feitos} de ${conta.total}`}>
                    {conta.feitos}/{conta.total}
                  </span>
                </div>

                <ul className="lista-de-etapas">
                  {pilar.etapas.map((etapa) => {
                    const dela = contarEtapa(pilar, etapa, respostas);
                    const completa = dela.feitos === dela.total;
                    return (
                      <li key={etapa.slug}>
                        <NavLink
                          to={caminho(pilar, etapa)}
                          className={({ isActive }) =>
                            `link-etapa ${isActive ? "link-etapa-atual" : ""}`
                          }
                        >
                          <span
                            className={`visto ${completa ? "visto-cheio" : dela.feitos > 0 ? "visto-meio" : ""}`}
                            aria-hidden="true"
                          />
                          {etapa.nome}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>

        <NavLink to="/relatorio" className="link-relatorio">
          Ver o mapa inteiro
        </NavLink>
      </nav>
    </>
  );
}

export function Barra({ fracao }: { fracao: number }) {
  return (
    <div
      className="barra"
      role="progressbar"
      aria-valuenow={fracao}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="barra-cheia" style={{ width: `${fracao}%` }} />
    </div>
  );
}
