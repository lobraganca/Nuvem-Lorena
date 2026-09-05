import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pagina } from "../../components/ei/Pagina";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import { lerMeuPerfil } from "../../lib/meuPerfil";
import { meuDesempenho, recadoDoDesempenho, type Desempenho } from "../../lib/desempenho";
import { podeVender } from "../../lib/plataforma";
import { IconeInicio } from "../../components/IconesInicio";
import { IconeFogo } from "../../components/ei/IconeFogo";
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
/* Zero não grita. Um "0" do mesmo tamanho e da mesma cor do "20" ao lado
   dá a um número que não aconteceu o mesmo peso do que aconteceu — e numa
   tela que a pessoa abre para saber se está sendo vista, isso lê como
   acusação. Apagado, ele continua legível e para de ser a primeira coisa
   que o olho encontra. */
function valorApagado(n: number): string {
  return n === 0 ? "ei-numero-valor ei-numero-vazio" : "ei-numero-valor";
}

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
            {/* ── REFEITA: NÚMEROS, UM RECADO CURTO, UM BOTÃO — 04/09 ───
                A dona: "a tela de desempenho está muito ruim. Faça mais
                clean e mais atrativa. Muita confusão e escrita extensa.
                Refaça e quando oferecer pra aparecer na frente, ter o
                botão pra assinar o plano."

                O que ela viu: cinco seções, dez linhas, e quase toda
                linha com duas linhas de explicação embaixo. Três dessas
                seções eram conselho ("o que costuma destravar") — as
                mesmas frases para todo mundo, que quem já tentou não tem
                o que fazer com elas. Saíram.

                Agora a tela responde três perguntas, nesta ordem: quantos
                me viram, o que fazer com isso, e como aparecer mais.

                Os números vêm primeiro porque é o que a pessoa vem ver —
                e todos com a MESMA forma (número grande, o que ele é, uma
                linha miúda do que conta). Antes eram duas seções e cinco
                medidas em dois formatos diferentes, uma embaixo da outra:
                era isso que fazia a tela parecer cheia sem dizer muito.

                E sumiu uma medida: "empresas que já abriram seu cadastro
                (desde sempre)" era a MESMA coisa que "empresas que te
                viram (7 dias)" com outro prazo — duas linhas quase iguais
                com números diferentes é o convite mais fácil para achar
                que o app se contradiz. O total virou a linha miúda do
                próprio quadrado. */}
            {/* ── OS QUADRADOS GANHARAM ROSTO — 05/09 ──────────────────
                A dona: "essa tela também está bem feia, simples."

                Eram quatro retângulos brancos iguais, com um número preto
                grande em cada um. Nada distinguia "buscas" de "empresas"
                a não ser ler as duas linhas de texto — e o olho, que
                escolhe onde parar antes de ler, não tinha por onde
                escolher. Um desenho pequeno e uma cor por assunto resolvem
                isso sem acrescentar uma palavra à tela.

                As cores não são enfeite, elas classificam: azul é o que
                ACONTECEU com a pessoa (apareceu, foi vista), laranja é o
                que ESPERA por ela (vagas que combinam), verde é o que ela
                JÁ FEZ (respondeu). */}
            <div className="ei-numeros">
              <div className="ei-numero-caixa ei-numero-azul">
                <span className="ei-numero-marca" aria-hidden="true">
                  <IconeInicio nome="lupa" tamanho={18} />
                </span>
                <span className={valorApagado(dados.buscasNaSemana)}>{dados.buscasNaSemana}</span>
                <span className="ei-numero-nome">Buscas em que apareceu</span>
                <span className="ei-numero-nota">nos últimos 7 dias</span>
              </div>

              <Link to="/meu-perfil" className="ei-numero-caixa ei-numero-azul">
                <span className="ei-numero-marca" aria-hidden="true">
                  <IconeInicio nome="olho" tamanho={18} />
                </span>
                <span className={valorApagado(dados.empresasNaSemana)}>{dados.empresasNaSemana}</span>
                <span className="ei-numero-nome">Empresas que te viram</span>
                <span className="ei-numero-nota">
                  abriram seu cadastro · {dados.empresasTotal} desde o começo
                </span>
              </Link>

              <Link to="/vagas" className="ei-numero-caixa ei-numero-laranja">
                <span className="ei-numero-marca" aria-hidden="true">
                  <IconeInicio nome="alvo" tamanho={18} />
                </span>
                <span className={valorApagado(dados.vagasMuitoCompativeis)}>
                  {dados.vagasMuitoCompativeis}
                </span>
                <span className="ei-numero-nome">Vagas que combinam com você</span>
                <span className="ei-numero-nota">
                  de {dados.vagasNoAr} {dados.vagasNoAr === 1 ? "aberta" : "abertas"} na cidade
                </span>
              </Link>

              <Link to="/vagas-para-mim" className="ei-numero-caixa ei-numero-verde">
                <span className="ei-numero-marca" aria-hidden="true">
                  <IconeInicio nome="visto" tamanho={18} />
                </span>
                <span className={valorApagado(dados.interessesEnviados)}>
                  {dados.interessesEnviados}
                </span>
                <span className="ei-numero-nome">Vagas que você respondeu</span>
                <span className="ei-numero-nota">a empresa recebeu seu telefone</span>
              </Link>
            </div>

            {/* ── O RECADO VIRA UM CONVITE, E NÃO UM AVISO — 05/09 ─────
                A dona, sobre "Você é das que mais combinam em 1 vaga /
                Abra e toque em 'tenho interesse'…": "ficou horrível."

                Ela tem razão em duas frentes.

                A FORMA: era um quadro branco com uma barra azul grossa na
                esquerda — a mesma gramática de um aviso de erro. A única
                boa notícia da tela estava vestida de problema.

                O CONTEÚDO: o recado MANDAVA fazer uma coisa e não tinha
                como fazê-la. "Abra e toque em tenho interesse" é um manual
                de duas linhas para um botão que devia estar ali. Agora o
                botão está, e a frase encolheu para o que sobra depois
                dele (ver `recadoDoDesempenho`).

                O fundo é um azul de leve, o desenho fica num disco à
                esquerda, e a barra saiu: azul claro já diz "olhe aqui" sem
                dizer "deu errado". */}
            <div className="ei-recado-cartao">
              <span className="ei-recado-marca" aria-hidden="true">
                <IconeInicio nome={recado.icone} tamanho={22} />
              </span>
              <div className="ei-recado-corpo">
                <h2 className="ei-recado-titulo">{recado.titulo}</h2>
                <p className="ei-recado-texto">{recado.texto}</p>
                {recado.acao && (
                  <Link to={recado.acao.para} className="ei-btn ei-btn-cheio ei-recado-botao">
                    {recado.acao.texto}
                  </Link>
                )}
              </div>
            </div>

            {/* ── APARECER PRIMEIRO, COM BOTÃO — 04/09 ──────────────────
                A dona: "quando oferecer pra aparecer na frente, ter o
                botão pra assinar o plano."

                Era um link escrito no meio do recado. A decisão anterior
                de deixá-lo como texto tinha um motivo bom (não empurrar
                pagamento para quem está desempregado), mas ela pediu o
                botão com todas as letras — e o cuidado continua onde
                importa: o cartão vem DEPOIS dos números e do recado, nunca
                como primeira resposta a "ninguém me viu", e só nos recados
                que falam de ser vista (`ofereceDestaque`).

                Dentro do app da Play Store ele não existe (`podeVender`):
                vender por fora da cobrança do Google é infração, e
                apontar o caminho é a mesma infração que vender. */}
            {recado.ofereceDestaque && podeVender() && (
              <div className="ei-cartao ei-destaque-oferta">
                <span className="ei-destaque-titulo">
                  {/* O mesmo foguinho da seção "Em destaque" das duas
                      listas: o que se compra aqui é justamente entrar
                      naquela seção, e o desenho é o que liga uma coisa à
                      outra sem precisar explicar. */}
                  <IconeFogo tamanho={16} />
                  Aparecer primeiro na lista
                </span>
                <span className="ei-destaque-nota">
                  {DESTAQUE_DIAS} dias no topo, com selo “Em alta”
                </span>
                <span className="ei-destaque-preco">{precoDoDestaqueEmTexto()}</span>
                <Link to="/destaque" className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto">
                  Assinar
                </Link>
              </div>
            )}

            {/* O que o cadastro está custando HOJE, nas vagas que estão no
                ar. É o único conselho que é sobre esta pessoa, e por isso
                é o único que ficou. Some inteiro quando não há nada a
                dizer. */}
            {dados.pontosFracos.length > 0 && (
              <>
                <h2 className="ei-secao">O que está custando vagas</h2>
                <div className="ei-lista">
                  {dados.pontosFracos.map((f) => (
                    <Link key={f.campo} to="/meu-perfil" className="ei-linha-item">
                      <span className="ei-linha-nome">{f.titulo}</span>
                      <span className="ei-linha-valor">{f.vagas}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* Uma saída, e uma só: responder vaga é o que põe o nome e o
                telefone da pessoa na mão da empresa. As outras duas que
                estavam aqui ("acrescente funções", "escreva um resumo")
                já são ditas pelo bloco de cima, quando são o caso dela.

                Com título próprio: sem ele esta linha encostava na lista
                de "o que está custando vagas" e era lida como mais um item
                dela — dois assuntos opostos (o que atrapalha, o que
                fazer) no mesmo bloco. */}
            <h2 className="ei-secao">O caminho mais curto</h2>
            <div className="ei-lista">
              <Link to="/vagas-para-mim" className="ei-linha-item">
                <span className="ei-linha-nome">Ver as vagas que combinam comigo</span>
                <span className="ei-linha-valor">{dados.vagasNoAr}</span>
              </Link>

              {/* Quando o recado do topo NÃO ofereceu destaque, a opção
                  continua existindo aqui embaixo, discreta. Se ele já
                  ofereceu, não repete: duas ofertas iguais numa tela curta
                  leem como insistência, não como opção. */}
              {podeVender() && !recado.ofereceDestaque && (
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
