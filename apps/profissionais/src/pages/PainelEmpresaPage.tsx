import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import {
  obterMinhaEmpresa,
  listarMinhasVagas,
  confirmarTelefoneDaEmpresa,
  situacaoDoPlano,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import type { Company, JobListing } from "../types/domain";

/**
 * A casa da empresa.
 *
 * Ela responde três perguntas, nesta ordem — que é a ordem em que a dúvida
 * aparece de verdade: quanto do meu plano ainda dá para usar, o que eu faço
 * daqui, e quais vagas estão de pé.
 *
 * O cartão do plano é o "saldo" desta tela: número grande no topo e o
 * detalhe numa faixa cinza dentro do próprio cartão. Antes era um botão
 * solto escrito "Assinar para publicar vagas", que dizia o que fazer sem
 * dizer onde a empresa está.
 */
export function PainelEmpresaPage() {
  useTituloDaPagina("Minhas vagas");
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [empresa, setEmpresa] = useState<Company | null>(null);
  const [vagas, setVagas] = useState<JobListing[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  /* `null` enquanto não se sabe. Começar em `false` faria o painel piscar
     "assine" para quem já paga, a cada vez que a tela abre. */
  const [plano, setPlano] = useState<{
    limite: number;
    abertas: number;
    temPlano: boolean;
    cabeMais: boolean;
  } | null>(null);

  /**
   * Confirma o telefone da empresa.
   *
   * Quem confere tudo é o banco. O caso que exige cuidado aqui é o do
   * número que a conta de login NÃO confirmou: a função recusa com uma
   * mensagem técnica, e traduzi-la é o que separa "faça isto" de "deu
   * erro". Sem isso, a empresa fica olhando uma frase sobre código sem
   * saber que o caminho é entrar pelo telefone.
   */
  async function confirmarTelefone() {
    if (!empresa) return;
    setConfirmando(true);
    setErro("");
    try {
      await confirmarTelefoneDaEmpresa(empresa.id);
      await carregarDados();
    } catch (err) {
      const texto = mensagemDeErro(err, "Não foi possível confirmar o telefone.");
      setErro(
        texto.includes("ainda não foi confirmado")
          ? "Para confirmar, sua conta precisa ter entrado com este mesmo número. " +
              "Saia e entre de novo usando o telefone da empresa."
          : texto.includes("diferente")
            ? "O número do cadastro da empresa é diferente do número com que você entrou. " +
                "Ajuste um dos dois para que fiquem iguais."
            : texto
      );
    } finally {
      setConfirmando(false);
    }
  }

  useEffect(() => {
    if (carregandoConta || !user) return;

    carregarDados();
  }, [user, carregandoConta]);

  async function carregarDados() {
    try {
      const minha = await obterMinhaEmpresa(user?.id || "");
      if (!minha) {
        navegar("/cadastro-empresa", { replace: true });
        return;
      }
      setEmpresa(minha);

      const minhasVagas = await listarMinhasVagas(minha.id);
      setVagas(minhasVagas);

      /* O plano decide o texto do botão principal. Se a leitura falhar,
         fica `null` e o botão segue oferecendo criar vaga — quem recusa de
         verdade é o banco, e mandar quem já paga para a tela de preço por
         causa de uma consulta que caiu seria pior que o contrário. */
      setPlano(await situacaoDoPlano(minha.id));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível carregar os dados."));
    } finally {
      setCarregando(false);
    }
  }

  if (carregandoConta || carregando) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <p className="ei-apoio">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <p className="ei-apoio">Empresa não encontrada.</p>
        </div>
      </div>
    );
  }

  const semPlano = plano?.temPlano === false;
  /* -1 é "sem teto" no banco (`limite_de_vagas_do_plano`). Escrito por
     extenso porque "-1 vagas" na tela é o tipo de coisa que ninguém vê em
     revisão e todo mundo vê em produção. */
  const limiteEmTexto =
    plano == null ? "—" : plano.limite < 0 ? "sem limite" : String(plano.limite);

  return (
    <div className="ei">
      <div className="ei-tela">
        {/* O título é o nome da TELA, não o da empresa.
            ─────────────────────────────────────────────
            "Padaria Pão de Minas" em corpo 1,9rem quebrava em duas linhas
            enormes e comia um terço da altura antes de qualquer coisa útil
            — e nome de empresa longo é a regra, não a exceção. O nome fica
            embaixo, numa linha só, onde ele identifica sem gritar. */}
        <h1 className="ei-titulo-g">Minhas vagas</h1>
        <p className="ei-apoio ei-uma-linha">
          {empresa.company_name}
          {empresa.neighborhood ? ` · ${empresa.neighborhood}` : ""}
        </p>

        {erro && (
          <p className="ei-campo-erro" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}

        {/* O telefone confirmado, antes de qualquer coisa.
            ────────────────────────────────────────────────
            Fica ACIMA de tudo, e não escondido nas configurações, porque é
            o que separa uma empresa de um número digitado — e do lado de
            quem contrata isso pesa mais: quem responde à vaga vai procurar
            essa empresa de volta, e é aí que mora o golpe do falso emprego.

            O caminho de criar vaga continua aceso: quem trava a publicação
            é a própria tela de criação, com o motivo escrito. Travar aqui
            deixaria a empresa olhando um botão cinza sem saber o que fazer
            para acendê-lo. */}
        {!empresa.phone_verified && (
          <div className="ei-cartao" style={{ marginTop: 20 }}>
            <div className="ei-cartao-topo">
              <span className="ei-tarja" aria-hidden="true" />
              <h2 className="ei-cartao-titulo">Confirme o telefone</h2>
            </div>
            <p className="ei-apoio" style={{ marginBottom: 14 }}>
              Sem ele a vaga não sai.
            </p>
            <button
              type="button"
              className="ei-btn ei-btn-tonal ei-btn-largo"
              disabled={confirmando}
              onClick={confirmarTelefone}
            >
              {confirmando ? "Confirmando…" : "Confirmar agora"}
            </button>
          </div>
        )}

        {/* O cartão do plano: onde a empresa está, em número grande. */}
        <div className="ei-cartao" style={{ marginTop: 20 }}>
          <div className="ei-cartao-topo">
            <span className="ei-tarja" aria-hidden="true" />
            <h2 className="ei-cartao-titulo">Seu plano</h2>
            <span className="ei-cartao-valor">
              {semPlano ? "Sem plano" : `${plano?.abertas ?? 0}/${limiteEmTexto}`}
            </span>
          </div>

          <div className="ei-faixa">
            <span>{semPlano ? "Vagas anunciadas" : "Vagas no ar agora"}</span>
            <span className="ei-faixa-valor">
              {semPlano ? "nenhuma" : `${plano?.abertas ?? 0} de ${limiteEmTexto}`}
            </span>
          </div>

          {semPlano ? (
            <>
              <p className="ei-apoio" style={{ margin: "12px 0 14px" }}>
                Ver profissionais é grátis. Publicar vaga, não.
              </p>
              <Link
                to="/planos-empresa"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
              >
                Ver os planos
              </Link>
            </>
          ) : (
            <Link
              to="/criar-vaga"
              className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
              style={{ marginTop: 14 }}
              /* Sem vaga sobrando, o caminho é o plano e não a criação: a
                 tela de criar recusaria no fim, depois de a empresa ter
                 escrito a vaga inteira. */
              onClick={(e) => {
                if (plano && !plano.cabeMais) {
                  e.preventDefault();
                  navegar("/planos-empresa");
                }
              }}
            >
              {plano && !plano.cabeMais ? "Aumentar o plano" : "Criar nova vaga"}
            </Link>
          )}
        </div>

        {/* As ações em círculo, como na referência: o que a empresa faz
            daqui, sem virar quatro botões empilhados ocupando meia tela. */}
        <div className="ei-acoes">
          <Link to="/profissionais" className="ei-acao">
            <span className="ei-acao-circulo" aria-hidden="true">
              <IconePessoas />
            </span>
            Profissionais
          </Link>
          <Link to="/planos-empresa" className="ei-acao">
            <span className="ei-acao-circulo" aria-hidden="true">
              <IconeSelo />
            </span>
            Planos
          </Link>
          <Link to="/painel/editar-empresa" className="ei-acao">
            <span className="ei-acao-circulo" aria-hidden="true">
              <IconeLoja />
            </span>
            Editar empresa
          </Link>
        </div>

        <div className="ei-secao-linha">
          <h2>Vagas no ar</h2>
          {vagas.length > 0 && !semPlano && (
            <Link to="/criar-vaga" className="ei-secao-acao">
              Nova vaga
            </Link>
          )}
        </div>

        {vagas.length === 0 ? (
          <div className="ei-cartao" style={{ padding: 0 }}>
            <div className="ei-vazio">
              <span className="ei-vazio-icone" aria-hidden="true">
                <IconeMegafone />
              </span>
              <h3 className="ei-titulo">Nenhuma vaga ainda</h3>
              <p className="ei-apoio">
                Publique uma vaga e quem tiver interesse aparece aqui.
              </p>
            </div>
          </div>
        ) : (
          /* Lista colada num bloco só, e não um cartão por vaga: cinco
             cartões soltos com espaço entre eles viram um acordeão, e a
             empresa quer varrer a lista, não contemplar cada uma. */
          <div className="ei-lista">
            {vagas.map((vaga) => (
              <Link key={vaga.id} to={`/vaga/${vaga.id}`} className="ei-linha-item">
                <span className="ei-linha-icone" aria-hidden="true">
                  <IconeMala />
                </span>
                <span className="ei-linha-nome">
                  <span className="ei-uma-linha">{vaga.title}</span>
                  {/* Ofício e data, numa linha. A especialidade saiu: com
                      ela a linha quebrava em duas ("Pedreiro · Alvenaria ·"
                      / "29/08/2026") e o item de lista ficava mais alto que
                      os vizinhos. E ela já está no título da vaga. */}
                  <span className="ei-linha-sub ei-uma-linha">
                    {vaga.profession} · {new Date(vaga.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <span className="ei-linha-seta" aria-hidden="true">
                  <IconeSeta />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Os ícones moram aqui e não numa biblioteca: são poucos, e uma dependência
   de ícones custa dezenas de KB para desenhar meia dúzia deles. Todos com
   `stroke="currentColor"`, então herdam a cor de quem os contém — é o que
   deixa o mesmo desenho servir dentro do círculo cinza e fora dele. */
function svgProps() {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function IconePessoas() {
  return (
    <svg {...svgProps()}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.2" />
      <path d="M17.5 14.2A6 6 0 0 1 21 20" />
    </svg>
  );
}

function IconeSelo() {
  return (
    <svg {...svgProps()}>
      <path d="M12 3l2.6 1.9 3.2-.2.6 3.1 2.3 2.2-1.6 2.8 1.6 2.8-2.3 2.2-.6 3.1-3.2-.2L12 22.6 9.4 20.7l-3.2.2-.6-3.1-2.3-2.2L4.9 12.8 3.3 10l2.3-2.2.6-3.1 3.2.2z" />
      <path d="M9 12.2l2.1 2.1L15.4 10" />
    </svg>
  );
}

function IconeLoja() {
  return (
    <svg {...svgProps()}>
      <path d="M4 9.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V9.5" />
      <path d="M3 6.5L4.4 3.5h15.2L21 6.5a2.6 2.6 0 0 1-4.5 2 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5-2z" />
      <path d="M9.5 20.5v-5h5v5" />
    </svg>
  );
}

function IconeMegafone() {
  return (
    <svg {...svgProps()} width="30" height="30">
      <path d="M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2.5l7 4.5V5.5l-7 4.5H5A1.5 1.5 0 0 0 3.5 10z" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M7.5 15.5v3.2a1.3 1.3 0 0 0 1.3 1.3h1" />
    </svg>
  );
}

function IconeMala() {
  return (
    <svg {...svgProps()}>
      <rect x="2.5" y="7.5" width="19" height="12" rx="2.5" />
      <path d="M8.5 7.5V5.8a1.8 1.8 0 0 1 1.8-1.8h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7" />
      <path d="M2.5 12.5h19" />
    </svg>
  );
}

function IconeSeta() {
  return (
    <svg {...svgProps()} width="20" height="20" strokeWidth={2.2}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
