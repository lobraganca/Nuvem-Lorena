import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import { lerMeuPerfil } from "../../lib/meuPerfil";
import { meuDesempenho, recadoDoDesempenho, type Desempenho } from "../../lib/desempenho";
import { podeVender } from "../../lib/plataforma";
import { precoDoDestaqueEmTexto, DESTAQUE_DIAS } from "../../lib/destaque";

/**
 * "Como está indo o meu cadastro."
 *
 * ── O pedido ───────────────────────────────────────────────────────────
 *
 * A dona: "dentro do módulo do empregado, ter uma opção de métricas onde
 * mostra por exemplo: seu perfil apareceu para 8 empresas esta semana;
 * você apareceu em 14 buscas; você está entre os profissionais mais
 * compatíveis para 3 oportunidades. Mensagens motivacionais."
 *
 * ── O que esta tela não faz ────────────────────────────────────────────
 *
 * Não promete emprego, não dá nota ao cadastro e não inventa número. Cada
 * um dos três vem de uma coisa que aconteceu de verdade: uma empresa
 * abriu o cadastro, uma busca devolveu a pessoa, uma vaga no ar bate com
 * ela. Onde o número é zero, a tela diz o que fazer — e "zero" também é
 * informação: significa que o problema não é a pessoa não ter sido
 * escolhida, é ela ainda não ter sido vista.
 */
export function MeuDesempenhoPage() {
  useTituloDaPagina("Meu desempenho");
  const navegar = useNavigate();
  const { user, loading } = useAuth();

  const [dados, setDados] = useState<Desempenho | null>(null);
  const [semCadastro, setSemCadastro] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navegar("/login?lado=trabalhar", { replace: true });
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const perfil = await lerMeuPerfil(user.id);
        if (!vivo) return;
        if (!perfil?.id) {
          setSemCadastro(true);
          return;
        }
        const d = await meuDesempenho(user.id, perfil.id);
        if (vivo) setDados(d);
      } catch (err) {
        if (vivo) setErro(mensagemDeErro(err, "Não consegui ler os seus números."));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [user, loading, navegar]);

  const recado = dados ? recadoDoDesempenho(dados) : null;

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Meu desempenho" voltar="/comecar-profissional" />

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {semCadastro && (
          <div className="ei-cartao">
            <h2 className="ei-titulo" style={{ marginTop: 0 }}>
              Você ainda não tem cadastro
            </h2>
            <p className="ei-corpo">
              Os números começam a existir a partir do cadastro: é ele que aparece
              para as empresas.
            </p>
            <Link className="ei-btn-inline" to="/meu-perfil">
              Preencher agora
            </Link>
          </div>
        )}

        {!dados && !erro && !semCadastro && (
          <p className="ei-apoio ei-margem" style={{ marginTop: 20 }}>
            Carregando…
          </p>
        )}

        {dados && recado && (
          <>
            {/* O recado vem ANTES dos números: é ele que diz o que fazer
                com eles. Números sozinhos, para quem está há semanas sem
                resposta, são mais três motivos de desânimo. */}
            <div className="ei-cartao ei-recado">
              <h2 className="ei-recado-titulo">{recado.titulo}</h2>
              <p className="ei-recado-texto">{recado.texto}</p>
            </div>

            <h2 className="ei-secao">Os últimos 7 dias</h2>
            <div className="ei-cartao">
              <div className="ei-resumo" style={{ padding: 0, border: 0, background: "none" }}>
                <div className="ei-resumo-item">
                  <span className="ei-resumo-rotulo">Empresas que te viram</span>
                  <span className="ei-resumo-numero">{dados.empresasNaSemana}</span>
                </div>
                <div className="ei-resumo-item">
                  <span className="ei-resumo-rotulo">Buscas em que apareceu</span>
                  <span className="ei-resumo-numero">{dados.buscasNaSemana}</span>
                </div>
              </div>
            </div>

            <h2 className="ei-secao">As vagas de agora</h2>
            <div className="ei-lista">
              <Link to="/vagas" className="ei-linha-item">
                <span className="ei-linha-nome">
                  Vagas em que você é das que mais combinam
                  <span className="ei-linha-sub">
                    De {dados.vagasNoAr} {dados.vagasNoAr === 1 ? "vaga aberta" : "vagas abertas"} na
                    cidade
                  </span>
                </span>
                <span className="ei-linha-valor">{dados.vagasMuitoCompativeis}</span>
              </Link>

              <Link to="/vagas" className="ei-linha-item">
                <span className="ei-linha-nome">
                  Vagas em que você disse ter interesse
                  <span className="ei-linha-sub">
                    A empresa recebe seu nome e seu telefone
                  </span>
                </span>
                <span className="ei-linha-valor">{dados.interessesEnviados}</span>
              </Link>

              {/* "Quem viu seu cadastro" é uma seção DENTRO do cadastro
                  (ver MeuPerfilPage), e não uma tela própria — por isso o
                  link vai para lá. */}
              <Link to="/meu-perfil" className="ei-linha-item">
                <span className="ei-linha-nome">
                  Empresas que já abriram seu cadastro
                  <span className="ei-linha-sub">Desde que você se cadastrou</span>
                </span>
                <span className="ei-linha-valor">{dados.empresasTotal}</span>
              </Link>
            </div>

            {/* ── O QUE ESTÁ CUSTANDO VAGAS, NAS VAGAS DE HOJE — 04/09 ──
                A tela terminava em três conselhos iguais para todo mundo.
                Todos verdadeiros, nenhum sobre a pessoa que está lendo — e
                quem já tentou os três não tem para onde ir.

                Isto aqui é outra coisa: é contado nas vagas que estão no ar
                AGORA, e diz qual campo do cadastro tirou a pessoa de
                quantas delas. Não é conselho, é o número — a conta de
                compatibilidade sempre soube a resposta e a jogava fora (ver
                `faltou`, em compatibilidade.ts).

                Some inteiro quando não há nada a dizer: uma seção "o que
                está te atrapalhando" vazia, ou com um item inventado para
                não ficar vazia, é pior que seção nenhuma. */}
            {dados.pontosFracos.length > 0 && (
              <>
                <h2 className="ei-secao">O que está custando vagas hoje</h2>
                <div className="ei-lista">
                  {dados.pontosFracos.map((f) => (
                    <Link key={f.campo} to="/meu-perfil" className="ei-linha-item">
                      <span className="ei-linha-nome">
                        {f.titulo}
                        <span className="ei-linha-sub">{f.texto}</span>
                      </span>
                      <span className="ei-linha-valor">{f.vagas}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* O que a pessoa pode fazer HOJE. Uma tela de números sem
                saída é um diagnóstico sem receita. */}
            <h2 className="ei-secao">O que costuma destravar</h2>
            <div className="ei-lista">
              <Link to="/meu-perfil" className="ei-linha-item">
                <span className="ei-linha-nome">
                  Acrescentar funções que você aceita
                  <span className="ei-linha-sub">
                    Cada função a mais é uma porta a mais: a busca procura por elas
                  </span>
                </span>
              </Link>
              <Link to="/vagas?m=cartoes" className="ei-linha-item">
                <span className="ei-linha-nome">
                  Passar pelas vagas abertas, uma por uma
                  <span className="ei-linha-sub">
                    Responder é o que faz a empresa te ver com telefone e tudo
                  </span>
                </span>
              </Link>

              {/* O destaque pago fica DEPOIS das três coisas de graça, e
                  nunca antes: oferecer pagamento a quem está desempregado
                  como primeira resposta para "ninguém me viu" é o jeito
                  mais rápido de perder a confiança da cidade. Dentro do
                  app da loja ele não aparece (`podeVender`). */}
              {podeVender() && (
                <Link to="/destaque" className="ei-linha-item">
                  <span className="ei-linha-nome">
                    Aparecer primeiro na lista
                    <span className="ei-linha-sub">
                      {DESTAQUE_DIAS} dias no topo, com selo “Em alta” — {precoDoDestaqueEmTexto()}
                    </span>
                  </span>
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
