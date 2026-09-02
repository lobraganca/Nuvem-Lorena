import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import { minhasEmpresas, escolherEmpresa, idDaEmpresaEscolhida } from "../../lib/company";
import type { Company } from "../../types/domain";
import { Pagina } from "../../components/ei/Pagina";
import { AvisoPerfilIncompleto } from "../../components/ei/AvisoPerfilIncompleto";

/**
 * Qual empresa você quer abrir agora.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ao escolher a empresa, se o cadastro tiver feito, deve aparecer
 * cards com a foto e nome das empresas cadastradas. Deve ter opção de
 * cadastrar mais de uma empresa. Pode ter um botão ao lado do card escrito
 * +. Nessa tela de escolha da empresa, deve ter o card das empresas
 * cadastradas e o botão do banco de talentos. Ao escolher a empresa, aí sim
 * abre outra tela com opções de vagas disponíveis daquela empresa."
 *
 * ── COM UMA EMPRESA SÓ, ESTA TELA NÃO APARECE ──────────────────────────
 *
 * Ela é uma pergunta, e uma pergunta com uma resposta só é um toque a mais
 * para nada. Quem tem a padaria e nada além dela vai direto ao painel da
 * padaria; a tela existe a partir da segunda.
 *
 * O "+" continua alcançável de lá, pelo botão "trocar" do painel — que é
 * onde a pessoa está quando lembra que quer cadastrar a segunda loja.
 *
 * ── O BANCO DE TALENTOS FICA AQUI ──────────────────────────────────────
 *
 * Ele não pertence a nenhuma das empresas: é a lista de quem está
 * procurando trabalho na cidade, e serve igual para as duas. Por isso é um
 * botão à parte, embaixo dos cartões, e não uma opção dentro de cada um.
 *
 * No laranja da marca, como a dona pediu no item 7.
 */
export function MinhasEmpresasPage() {
  useTituloDaPagina("Suas empresas");
  const navegar = useNavigate();
  const { user, loading } = useAuth();

  const [lista, setLista] = useState<Company[] | null>(null);
  const [erro, setErro] = useState("");

  /* Qual está aberta AGORA. Sem nada guardado, é a primeira — que é
     exatamente o que `empresaAtual` usa para montar o painel. Ler só o
     guardado deixava a tela sem nenhuma marcada na primeira visita, e a
     pessoa entrava no painel da padaria sem que a tela anterior tivesse
     dito que era a padaria. */
  const escolhida = idDaEmpresaEscolhida() ?? lista?.[0]?.id ?? null;

  useEffect(() => {
    if (loading || !user) return;
    let vivo = true;
    minhasEmpresas(user.id)
      .then((empresas) => {
        if (!vivo) return;
        /* Nenhuma empresa: vai para o cadastro, e é decisão da dona —
           "senão ela consegue verificar o banco de talentos e eu não
           consigo ter dados para oferecer planos depois". */
        if (empresas.length === 0) {
          navegar("/cadastro-empresa", { replace: true });
          return;
        }
        /* Uma só: abre direto. Ver o comentário do topo. */
        if (empresas.length === 1) {
          escolherEmpresa(empresas[0].id);
          navegar("/painel-empresa", { replace: true });
          return;
        }
        setLista(empresas);
      })
      .catch((err) => {
        /* Erro NÃO vira "você não tem empresa": esse caminho manda quem
           tem duas para o formulário de cadastro, e o salvamento criaria
           uma terceira por cima. */
        if (vivo) setErro(mensagemDeErro(err, "Não consegui ler os seus cadastros."));
      });
    return () => {
      vivo = false;
    };
  }, [user, loading, navegar]);

  if (erro) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Suas empresas" />
          <p className="ei-campo-erro ei-margem" role="alert">{erro}</p>
        </div>
      </div>
    );
  }

  if (!lista) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Suas empresas" />
          <p className="ei-apoio ei-margem" style={{ paddingTop: 20 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Suas empresas" />

        <p className="ei-apoio ei-margem" style={{ marginTop: 10 }}>
          Escolha qual você quer abrir agora.
        </p>

        <AvisoPerfilIncompleto lado="company" />

        <div className="ei-empresas">
          {lista.map((e) => (
            <button
              key={e.id}
              type="button"
              className={e.id === escolhida ? "ei-empresa-cartao aberta" : "ei-empresa-cartao"}
              onClick={() => {
                escolherEmpresa(e.id);
                navegar("/painel-empresa");
              }}
            >
              <Logo foto={e.photo_url} nome={e.company_name} />
              <span className="ei-empresa-nome">{e.company_name}</span>
              <span className="ei-empresa-onde">
                {[e.neighborhood, e.city].filter(Boolean).join(" · ")}
              </span>
              {/* "Qual está selecionada" — a dona pediu isso duas vezes, no
                  item 4 e no 6. Sem a marca, a pessoa com duas lojas não
                  tem como saber em qual publicou a vaga. */}
              {e.id === escolhida && <span className="ei-empresa-aberta-selo">Aberta agora</span>}
            </button>
          ))}

          {/* O "+" ao lado dos cartões, como ela desenhou. Do mesmo tamanho
              deles, para a fileira não ficar torta — e com a palavra junto,
              porque um "+" sozinho não diz o que vai acontecer. */}
          <Link to="/cadastro-empresa?nova=1" className="ei-empresa-cartao ei-empresa-nova">
            <span className="ei-empresa-mais" aria-hidden="true">+</span>
            <span className="ei-empresa-nome">Cadastrar outra</span>
            <span className="ei-empresa-onde">Uma segunda loja, obra ou serviço</span>
          </Link>
        </div>

        <div className="ei-margem" style={{ marginTop: 18 }}>
          <Link to="/profissionais" className="ei-porta ei-porta-laranja">
            <span className="ei-porta-nome">Banco de talentos</span>
            <span className="ei-porta-nota">
              Quem está procurando trabalho na cidade — vale para as suas empresas
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * A marca da empresa no cartão.
 *
 * Sem logo, a inicial — e não um ícone genérico, que faria todas as
 * empresas sem imagem virarem o mesmo quadrado cinza, justamente na tela
 * em que a pessoa precisa distinguir uma da outra num relance.
 *
 * O `onError` cobre a logo que existe no cadastro mas não abre mais
 * (arquivo apagado do Storage): sem ele o navegador desenha o ícone de
 * imagem quebrada, que lê como app defeituoso.
 */
function Logo({ foto, nome }: { foto: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  const inicial = nome.trim().charAt(0).toLocaleUpperCase("pt-BR");
  return (
    <span className="ei-empresa-logo" aria-hidden="true">
      {foto && !falhou ? (
        <img src={foto} alt="" loading="lazy" onError={() => setFalhou(true)} />
      ) : (
        inicial
      )}
    </span>
  );
}
