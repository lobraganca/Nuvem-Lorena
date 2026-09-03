import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { mensagemDeErro } from "../../lib/erros";
import {
  meusCadastros,
  idDoCadastroEscolhido,
  escolherCadastro,
  type CadastroDaConta,
} from "../../lib/meuPerfil";
import { Pagina } from "../../components/ei/Pagina";
import { AvisoPerfilIncompleto } from "../../components/ei/AvisoPerfilIncompleto";

/**
 * "Seus cadastros" — a tela de escolher qual perfil abrir.
 *
 * ── O pedido ──────────────────────────────────────────────────────────
 *
 * A dona: "ao clicar em cadastro dentro do profissional deve abrir uma
 * tela igual a de empresa para a pessoa selecionar o perfil, por mais que
 * só tenha 1."
 *
 * "Por mais que só tenha 1" é a parte que decide o desenho: a tela aparece
 * sempre, com um cadastro ou com quatro. Pular a escolha quando só há um
 * pareceria conveniência, mas esconderia justamente a informação de que
 * dá para ter outro — e ninguém procura um caminho que nunca viu.
 *
 * ── Por que alguém teria dois ─────────────────────────────────────────
 *
 * A diarista que também cozinha para festas: são ofícios diferentes,
 * pretensões diferentes e horários diferentes, e num cadastro só isso vira
 * uma sopa que não casa com vaga nenhuma. O banco sempre permitiu até
 * cinco por conta; o app é que só sabia do primeiro.
 *
 * A escolha vive no aparelho, como a das empresas — ver `escolherCadastro`.
 */
export function MeusCadastrosPage() {
  useTituloDaPagina("Seus cadastros");
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [lista, setLista] = useState<CadastroDaConta[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(idDoCadastroEscolhido());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (carregandoConta) return;
    if (!user) {
      navegar("/login", { replace: true });
      return;
    }

    meusCadastros(user.id)
      .then((cadastros) => {
        setLista(cadastros);
        /* Quem ainda não tem cadastro nenhum não passa por esta tela: vai
           direto ao formulário. Uma tela de escolha com zero opções e um
           "+" solto é um degrau a mais entre a pessoa e o que ela veio
           fazer. */
        if (cadastros.length === 0) {
          navegar("/painel", { replace: true });
          return;
        }
        /* Sem escolha anterior, o principal é o primeiro — o mesmo que
           `lerMeuPerfil` abre. A tela e o formulário têm de concordar,
           senão o selo "Selecionado" apontaria para um cadastro e o toque
           abriria outro. */
        if (!idDoCadastroEscolhido()) setEscolhido(cadastros[0].id);
      })
      /* Erro SOBE até a tela: lista vazia diria "você não tem cadastro" a
         quem tem, e o caminho seguinte é criar outro por cima. */
      .catch((err) => setErro(mensagemDeErro(err, "Não consegui ler seus cadastros.")))
      .finally(() => setCarregando(false));
  }, [user, carregandoConta, navegar]);

  if (carregandoConta || carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <p className="ei-apoio ei-margem" style={{ paddingTop: 24 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Seus cadastros" />

        <p className="ei-apoio ei-margem" style={{ marginTop: 10 }}>
          Escolha qual você quer abrir agora.
        </p>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 12 }} role="alert">
            {erro}
          </p>
        )}

        <AvisoPerfilIncompleto lado="professional" />

        {/* A mesma grade das empresas, e de propósito: são a mesma pergunta
            ("qual destes eu abro agora?") nos dois lados do app, e duas
            aparências para a mesma pergunta fazem a pessoa reaprender. */}
        <div className="ei-empresas">
          {lista.map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.id === escolhido ? "ei-empresa-cartao aberta" : "ei-empresa-cartao"}
              onClick={() => {
                escolherCadastro(c.id);
                navegar("/painel");
              }}
            >
              <span className="ei-empresa-cabeca">
                <Foto foto={c.photo_url} nome={c.name} />
                <span className="ei-empresa-texto">
                  <span className="ei-empresa-nome">{c.name || "Cadastro sem nome"}</span>
                  {/* Os ofícios na segunda linha: é o que diferencia um
                      cadastro do outro na mesma conta — os dois têm o mesmo
                      nome, o da pessoa. */}
                  <span className="ei-empresa-onde">
                    {c.categories.length === 0
                      ? "Nenhuma função marcada"
                      : c.categories.slice(0, 3).join(" · ")}
                  </span>
                  {c.paused && <span className="ei-selo ei-selo-cinza">Escondido da lista</span>}
                  {c.id === escolhido && (
                    <span className="ei-empresa-aberta-selo">Selecionado</span>
                  )}
                </span>
                <span className="ei-linha-seta" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </span>
            </button>
          ))}

          {/* Cinco é o teto do banco (`professionals_evita_repetidos`).
              Esconder o botão no quinto evita o erro que só apareceria
              depois de a pessoa preencher o cadastro inteiro. */}
          {lista.length < 5 && (
            <Link to="/painel?novo=1" className="ei-empresa-cartao ei-empresa-nova">
              <span className="ei-empresa-mais" aria-hidden="true">+</span>
              <span className="ei-empresa-nome">Cadastrar outro perfil</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A foto do cadastro, com a inicial quando não há — e quando a que havia
 * não carrega (arquivo apagado do Storage): sem isso o navegador desenha o
 * ícone de imagem quebrada, que lê como app defeituoso.
 */
function Foto({ foto, nome }: { foto: string | null; nome: string }) {
  const [falhou, setFalhou] = useState(false);
  const inicial = (nome.trim() || "?").charAt(0).toLocaleUpperCase("pt-BR");
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
