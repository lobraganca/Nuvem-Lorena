import { Link, useParams } from "react-router-dom";
import {
  TRILHA,
  acharEtapa,
  acharPilar,
  caminho,
  chaveDoCampo,
} from "../dados/metodo";
import { CampoDeTexto } from "../componentes/CampoDeTexto";
import { Barra } from "../componentes/Menu";
import { contarEtapa, porcento } from "../lib/progresso";
import { useRespostas } from "../lib/useRespostas";
import { NaoAchei } from "./NaoAchei";

export function TelaDaEtapa() {
  const { numero, slug } = useParams();
  const pilar = acharPilar(numero);
  const etapa = acharEtapa(pilar, slug);
  const respostas = useRespostas();

  // Endereço editado à mão, ou etapa que mudou de nome depois de alguém
  // guardar o link. Melhor dizer que não existe do que abrir uma tela vazia.
  if (!pilar || !etapa) return <NaoAchei />;

  const onde = TRILHA.findIndex(
    (passo) => passo.pilar.numero === pilar.numero && passo.etapa.slug === etapa.slug,
  );
  const anterior = onde > 0 ? TRILHA[onde - 1] : undefined;
  const proxima = onde < TRILHA.length - 1 ? TRILHA[onde + 1] : undefined;
  const conta = contarEtapa(pilar, etapa, respostas);

  return (
    <article className="tela">
      <header className="tela-topo">
        <p className="sobrenome">
          Pilar {pilar.numero} · {pilar.nome}
        </p>
        <h1>{etapa.nome}</h1>
        <p className="chamada">{etapa.resumo}</p>
        <div className="progresso-da-etapa">
          <Barra fracao={porcento(conta)} />
          <span>
            {conta.feitos}/{conta.total}
          </span>
        </div>
      </header>

      <form
        className="formulario"
        onSubmit={(evento) => evento.preventDefault()}
        // Não tem botão de enviar: o que a pessoa escreve já está salvo. O
        // onSubmit existe só para o Enter de um teclado de celular não
        // recarregar a página e dar a impressão de que algo se perdeu.
      >
        {etapa.campos.map((campo) => {
          const chave = chaveDoCampo(pilar, etapa, campo);
          // key = chave: ao trocar de etapa, o React monta campos novos em vez
          // de reaproveitar os antigos com o texto da etapa anterior dentro.
          return <CampoDeTexto key={chave} chave={chave} campo={campo} />;
        })}
      </form>

      <nav className="pe-da-pagina">
        {anterior ? (
          <Link className="botao-vazado" to={caminho(anterior.pilar, anterior.etapa)}>
            ← {anterior.etapa.nome}
          </Link>
        ) : (
          <Link className="botao-vazado" to="/">
            ← Início
          </Link>
        )}

        {proxima ? (
          <Link className="botao" to={caminho(proxima.pilar, proxima.etapa)}>
            {proxima.etapa.nome} →
          </Link>
        ) : (
          <Link className="botao" to="/relatorio">
            Ver o mapa inteiro →
          </Link>
        )}
      </nav>
    </article>
  );
}
