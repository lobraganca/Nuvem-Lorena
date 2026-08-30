import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { signInWithGoogle, signOut } from "../lib/auth";
import { hasDatabase } from "../lib/supabase";
import { getProfile, salvarMeuPerfil } from "../lib/profiles";
import { isAdmin } from "../lib/admin";
import { forcarAtualizacao } from "../lib/atualizacao";
import { excluirMinhaConta } from "../lib/account";
import { BottomSheet } from "../components/BottomSheet";
import { BotaoApple } from "../components/BotaoApple";
import { BotaoGoogle } from "../components/BotaoGoogle";
import { baixarMeusDados } from "../lib/meusDados";
import type { Profile } from "../types/domain";
import { FecharApp } from "../components/FecharApp";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { useOnboardingStatus } from "../lib/useOnboardingStatus";
import { mensagemDeErro } from "../lib/erros";
import { googleServeAqui } from "../lib/plataforma";
import { uploadProfessionalPhoto } from "../lib/storage";
import { LOGIN_TELEFONE_ATIVO, SUPORTE_WHATSAPP, CONTATO_EMAIL } from "../config";

/**
 * A Conta — o terceiro item da barra de baixo, dos dois lados.
 *
 * Era a tela de perfil do procurô e mostrava o produto dele: "Planos e
 * benefícios" (a venda de selo e destaque), "Meus favoritos", "Como
 * funciona", "Rever apresentação" e o cartão de assinatura. Três desses
 * links apontavam para telas que já não existem — apagadas junto com o
 * produto —, e um toque em qualquer um deles caía no nada. Estavam ali
 * porque esta tela nunca foi revisada depois da limpeza.
 *
 * Agora ela responde só o que é da conta: quem é você, de que lado está,
 * os documentos, os seus dados e as duas saídas.
 */

function initials(name: string | null, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Uma linha da lista. Aceita link, botão ou endereço de fora, porque a
   lista mistura os três e três componentes quase iguais é como um deles
   fica para trás quando o desenho muda. */
function Linha({
  para,
  href,
  onClick,
  desativado,
  icone,
  children,
}: {
  para?: string;
  href?: string;
  onClick?: () => void;
  desativado?: boolean;
  icone: ReactNode;
  children: ReactNode;
}) {
  const dentro = (
    <>
      <span className="ei-linha-icone" aria-hidden="true">
        {icone}
      </span>
      <span className="ei-linha-nome">{children}</span>
      <span className="ei-linha-seta" aria-hidden="true">
        <IconeSeta />
      </span>
    </>
  );

  if (para) {
    return (
      <Link to={para} className="ei-linha-item">
        {dentro}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="ei-linha-item">
        {dentro}
      </a>
    );
  }
  return (
    <button type="button" className="ei-linha-item" onClick={onClick} disabled={desativado}>
      {dentro}
    </button>
  );
}

export function PerfilPage() {
  useTituloDaPagina("Conta");
  const { user, loading } = useAuth();
  const tipo = useOnboardingStatus();
  const [profile, setProfile] = useState<Profile | null>(null);
  /* Edição do próprio nome e foto. Guardados em rascunho até salvar, para
     que cancelar devolva o que estava lá — e não o que a pessoa digitou e
     desistiu. */
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeRascunho, setNomeRascunho] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroPerfil, setErroPerfil] = useState("");
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [baixando, setBaixando] = useState(false);
  /** Trava o botão de forçar atualização: o recarregamento leva um instante,
   *  e dois toques disparariam duas limpezas em cima uma da outra. */
  const [forcando, setForcando] = useState(false);

  async function handleExcluirConta() {
    setExcluindo(true);
    setErroExclusao("");
    try {
      await excluirMinhaConta();
      // Depois de apagar, não há para onde voltar dentro da conta.
      window.location.href = "/inicio";
    } catch (err) {
      setErroExclusao(mensagemDeErro(err, "Não foi possível apagar a conta."));
      setExcluindo(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setAdmin(false);
      return;
    }
    getProfile(user.id).then(setProfile);
    isAdmin(user.id).then(setAdmin);
  }, [user]);

  async function handleGoogleLogin() {
    setError("");
    try {
      await signInWithGoogle("/perfil");
    } catch (err) {
      setError(mensagemDeErro(err, "Não foi possível iniciar o login."));
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <h1 className="ei-titulo-g">Entrar</h1>
          {/* Mesma regra do painel: no app da loja o Google não volta, e o
              caminho passa pela tela de login. Ver `googleServeAqui`. */}
          {googleServeAqui() ? (
            <>
              <p className="ei-apoio" style={{ marginBottom: 24 }}>
                Entre para receber vagas de Itabirito ou para publicar as suas.
              </p>
              <BotaoGoogle onClick={handleGoogleLogin} disabled={!hasDatabase()} />
              <div style={{ marginTop: 10 }}>
                <BotaoApple voltarPara="/perfil" onErro={setError} />
              </div>
              {/* O telefone existe e é o caminho principal desde que o app
                  passou a ser instalável — mas esta tela continuava
                  oferecendo só o Google, e quem não usa Google saía daqui
                  achando que não tinha como entrar. */}
              {LOGIN_TELEFONE_ATIVO && (
                <Link
                  className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                  style={{ marginTop: 12 }}
                  to="/login"
                >
                  Entrar com meu celular
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="ei-apoio" style={{ marginBottom: 24 }}>
                Entre com seu celular. A gente manda um código por SMS — sem senha nova.
              </p>
              <Link className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto" to="/login">
                Entrar com meu celular
              </Link>
            </>
          )}
          {!hasDatabase() && (
            <p className="ei-apoio" style={{ marginTop: 12 }}>
              Configure VITE_SUPABASE_URL/ANON_KEY e o provider Google no Supabase para habilitar
              o login.
            </p>
          )}
          {error && (
            <p className="ei-campo-erro" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  const name = profile?.full_name ?? user.user_metadata?.full_name ?? null;
  const avatarUrl = profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;
  const contato = user.phone ? telefoneLegivel(user.phone) : (user.email ?? "");

  return (
    <div className="ei">
      <div className="ei-tela">
        <h1 className="ei-titulo-g">Conta</h1>

        {/* Quem é você.
            ─────────────
            Foto e nome são EDITÁVEIS aqui, e isso é consequência direta da
            porta de entrada. Com o login só pelo Google, os dois vinham
            prontos e ninguém precisava preenchê-los — por isso nunca houve
            onde. Entrando pelo telefone não vem nada: a conta nasce
            anônima e ficava assim para sempre. */}
        <div className="ei-cartao" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <label className="ei-foto" title="Trocar a foto">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <span className="ei-foto-iniciais">{initials(name, user.email)}</span>
              )}
              <span className="ei-foto-trocar">{enviandoFoto ? "Enviando…" : "Trocar"}</span>
              <input
                type="file"
                accept="image/*"
                disabled={enviandoFoto}
                style={{ display: "none" }}
                onChange={async (e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = "";
                  if (!arquivo) return;
                  setEnviandoFoto(true);
                  setErroPerfil("");
                  try {
                    const url = await uploadProfessionalPhoto(user.id, arquivo);
                    await salvarMeuPerfil(user.id, { avatar_url: url });
                    setProfile((p) => (p ? { ...p, avatar_url: url } : p));
                  } catch (err) {
                    setErroPerfil(mensagemDeErro(err, "Não foi possível enviar a foto."));
                  } finally {
                    setEnviandoFoto(false);
                  }
                }}
              />
            </label>

            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: "1.1rem" }}>{name || "Sem nome"}</strong>
              {contato && (
                <p className="ei-apoio" style={{ marginTop: 2 }}>
                  {contato}
                </p>
              )}
            </div>
          </div>

          {editandoNome ? (
            <div className="ei-campo" style={{ marginTop: 14 }}>
              <input
                value={nomeRascunho}
                onChange={(e) => setNomeRascunho(e.target.value)}
                placeholder="Como você quer ser chamada"
                maxLength={60}
                autoFocus
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  className="ei-btn ei-btn-cheio"
                  disabled={salvandoNome || !nomeRascunho.trim()}
                  onClick={async () => {
                    setSalvandoNome(true);
                    setErroPerfil("");
                    try {
                      const limpo = nomeRascunho.trim();
                      await salvarMeuPerfil(user.id, { full_name: limpo });
                      setProfile((p) => (p ? { ...p, full_name: limpo } : p));
                      setEditandoNome(false);
                    } catch (err) {
                      setErroPerfil(mensagemDeErro(err, "Não foi possível salvar o nome."));
                    } finally {
                      setSalvandoNome(false);
                    }
                  }}
                >
                  {salvandoNome ? "Salvando…" : "Salvar"}
                </button>
                <button className="ei-btn ei-btn-texto" onClick={() => setEditandoNome(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="ei-btn ei-btn-contorno ei-btn-largo"
              style={{ marginTop: 14 }}
              onClick={() => {
                setNomeRascunho(name ?? "");
                setEditandoNome(true);
              }}
            >
              {name ? "Editar nome" : "Escrever meu nome"}
            </button>
          )}

          {erroPerfil && (
            <p className="ei-campo-erro" style={{ marginTop: 10 }}>
              {erroPerfil}
            </p>
          )}
        </div>

        {/* O caminho de volta ao lado da pessoa. Sem ele, a Conta é um beco:
            três telas na barra, e uma delas só serve para sair. */}
        <div className="ei-secao-linha">
          <h2>{tipo === "company" ? "Minha empresa" : "Meu cadastro"}</h2>
        </div>
        <div className="ei-lista">
          {tipo === "company" ? (
            <>
              <Linha para="/painel/editar-empresa" icone={<IconeLoja />}>
                Dados da empresa
              </Linha>
              <Linha para="/planos-empresa" icone={<IconeSelo />}>
                Meu plano
              </Linha>
            </>
          ) : (
            <>
              <Linha para="/meu-perfil" icone={<IconePessoa />}>
                Meu perfil profissional
              </Linha>
              <Linha para="/vagas-para-mim" icone={<IconeMala />}>
                Vagas que chegaram para mim
              </Linha>
            </>
          )}
        </div>

        <div className="ei-secao-linha">
          <h2>Ajuda</h2>
        </div>
        <div className="ei-lista">
          {/* O suporte era um botão verde grande no rodapé — a peça mais
              reconhecível do procurô numa tela. Como linha da lista ele
              continua a um toque, sem pintar a tela de outro app. */}
          <Linha
            href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
              "Oi! Preciso de ajuda com o Ei Itabirito."
            )}`}
            icone={<IconeConversa />}
          >
            Falar com o suporte
          </Linha>
          {/* O endereço vai na segunda linha e não no rótulo: em 390px de
              largura ele estourava a linha e era cortado no meio
              ("contato@empregoitabirito.co…"), que é pior do que não
              mostrar — um e-mail cortado parece um e-mail errado. */}
          <Linha href={`mailto:${CONTATO_EMAIL}`} icone={<IconeCarta />}>
            Escrever um e-mail
            <span className="ei-linha-sub">{CONTATO_EMAIL}</span>
          </Linha>
          {/* Não é informação, é conserto: a saída de quando o app trava
              numa versão antiga e nem recarregar nem fechar e reabrir
              resolvem. Já foi preciso mais de uma vez. */}
          <Linha
            icone={<IconeAtualizar />}
            desativado={forcando}
            onClick={() => {
              setForcando(true);
              void forcarAtualizacao();
            }}
          >
            {forcando ? "Buscando a versão nova…" : "Forçar atualização"}
          </Linha>
          {/* Tenta fechar de verdade e, quando o sistema não deixa, ensina
              o gesto — ver FecharApp. */}
          <FecharApp />
        </div>

        <div className="ei-secao-linha">
          <h2>Dados e documentos</h2>
        </div>
        <div className="ei-lista">
          <Linha para="/termos" icone={<IconePapel />}>
            Termos de uso
          </Linha>
          <Linha para="/privacidade" icone={<IconeCadeado />}>
            Política de privacidade
          </Linha>
          {/* Direito de acesso da LGPD resolvido em um toque: pedir por e-mail
              e esperar 15 dias é o mínimo legal, não o certo, quando o dado
              está a uma consulta de distância. */}
          <Linha
            icone={<IconeBaixar />}
            desativado={baixando}
            onClick={async () => {
              setBaixando(true);
              setError("");
              try {
                await baixarMeusDados(user.id, user.email ?? undefined);
              } catch (err) {
                setError(mensagemDeErro(err, "Não foi possível gerar o arquivo."));
              } finally {
                setBaixando(false);
              }
            }}
          >
            {baixando ? "Preparando…" : "Baixar meus dados"}
          </Linha>
        </div>

        {admin && (
          <>
            <div className="ei-secao-linha">
              <h2>Administração</h2>
            </div>
            <div className="ei-lista">
              <Linha para="/admin" icone={<IconeEscudo />}>
                Painel administrativo
              </Linha>
              <Linha para="/configuracao" icone={<IconeEngrenagem />}>
                Configuração do app
              </Linha>
            </div>
          </>
        )}

        {error && (
          <p className="ei-campo-erro" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}

        <button
          className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
          style={{ marginTop: 28 }}
          onClick={() => signOut()}
        >
          Sair da conta
        </button>

        {/* Separado de "Sair da conta" por espaço e por peso visual: são ações
            vizinhas com consequências muito diferentes, e trocar uma pela outra
            por engano seria irreversível. */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            type="button"
            className="link-perigo"
            onClick={() => {
              setTextoConfirmacao("");
              setErroExclusao("");
              setConfirmarExclusao(true);
            }}
          >
            Excluir minha conta
          </button>
        </div>

        {confirmarExclusao && (
          <BottomSheet
            title="Excluir minha conta"
            subtitle="Esta ação não tem volta."
            onClose={() => setConfirmarExclusao(false)}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <p style={{ margin: 0 }}>Vão ser apagados para sempre:</p>
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }} className="muted">
                <li>seu perfil e as funções que você marcou</li>
                <li>as vagas que chegaram para você e os interesses que você enviou</li>
                <li>sua empresa e as vagas que ela publicou, se você tiver uma</li>
              </ul>
              <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
                Quem já recebeu o seu interesse continua com o seu recado — é o que permite a
                empresa te retornar.
              </p>
              <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
                Se você tem plano ativo, cancele antes pelo Mercado Pago: apagar a conta aqui não
                cancela a cobrança lá.
              </p>

              <label style={{ display: "grid", gap: 6, fontSize: "0.88rem" }}>
                Para confirmar, escreva <strong>EXCLUIR</strong> abaixo:
                <input
                  value={textoConfirmacao}
                  onChange={(e) => setTextoConfirmacao(e.target.value.toUpperCase())}
                  placeholder="EXCLUIR"
                  autoComplete="off"
                />
              </label>

              {erroExclusao && <p style={{ color: "var(--color-danger)", margin: 0 }}>{erroExclusao}</p>}

              <div style={{ display: "grid", gap: 10 }}>
                <button
                  className="btn btn-danger-forte btn-block"
                  disabled={textoConfirmacao !== "EXCLUIR" || excluindo}
                  onClick={handleExcluirConta}
                >
                  {excluindo ? "Apagando…" : "Apagar minha conta para sempre"}
                </button>
                <button className="btn btn-outline btn-block" onClick={() => setConfirmarExclusao(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </BottomSheet>
        )}
      </div>
    </div>
  );
}

/* "5531999998888" é como o Auth guarda, e não é como ninguém lê o próprio
   número. Sem isto a Conta mostrava para a pessoa uma sequência de treze
   dígitos e ela não reconhecia como sendo dela. */
function telefoneLegivel(bruto: string): string {
  const so = bruto.replace(/\D/g, "");
  const sem55 = so.startsWith("55") ? so.slice(2) : so;
  if (sem55.length < 10) return bruto;
  const ddd = sem55.slice(0, 2);
  const resto = sem55.slice(2);
  return `(${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
}

/* Ícones em traço. Desenhados aqui e não importados: são nove, e uma
   dependência de ícones custa dezenas de KB no 4G da cidade. */
const traco = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconeSeta() {
  return (
    <svg {...traco} width="20" height="20" strokeWidth={2.2}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconePessoa() {
  return (
    <svg {...traco}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

function IconeMala() {
  return (
    <svg {...traco}>
      <rect x="2.5" y="7.5" width="19" height="12" rx="2.5" />
      <path d="M8.5 7.5V5.8a1.8 1.8 0 0 1 1.8-1.8h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7" />
      <path d="M2.5 12.5h19" />
    </svg>
  );
}

function IconeLoja() {
  return (
    <svg {...traco}>
      <path d="M4 9.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V9.5" />
      <path d="M3 6.5L4.4 3.5h15.2L21 6.5a2.6 2.6 0 0 1-4.5 2 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5-2z" />
      <path d="M9.5 20.5v-5h5v5" />
    </svg>
  );
}

function IconeSelo() {
  return (
    <svg {...traco}>
      <path d="M12 3l2.6 1.9 3.2-.2.6 3.1 2.3 2.2-1.6 2.8 1.6 2.8-2.3 2.2-.6 3.1-3.2-.2L12 22.6 9.4 20.7l-3.2.2-.6-3.1-2.3-2.2L4.9 12.8 3.3 10l2.3-2.2.6-3.1 3.2.2z" />
      <path d="M9 12.2l2.1 2.1L15.4 10" />
    </svg>
  );
}

function IconeConversa() {
  return (
    <svg {...traco}>
      <path d="M20.5 11.6a8 8 0 0 1-11.8 7l-5.2 1.4 1.4-5A8 8 0 1 1 20.5 11.6z" />
    </svg>
  );
}

function IconeCarta() {
  return (
    <svg {...traco}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </svg>
  );
}

function IconeAtualizar() {
  return (
    <svg {...traco}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4v5h-5" />
    </svg>
  );
}

function IconePapel() {
  return (
    <svg {...traco}>
      <path d="M6 2.5h7.5L19 8v13.5H6z" />
      <path d="M13.5 2.5V8H19" />
      <path d="M9 12.5h7M9 16h5" />
    </svg>
  );
}

function IconeCadeado() {
  return (
    <svg {...traco}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  );
}

function IconeBaixar() {
  return (
    <svg {...traco}>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 18.5v1a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </svg>
  );
}

function IconeEscudo() {
  return (
    <svg {...traco}>
      <path d="M12 2.8l7.5 2.8v6c0 4.4-3 8.1-7.5 9.6-4.5-1.5-7.5-5.2-7.5-9.6v-6z" />
    </svg>
  );
}

function IconeEngrenagem() {
  return (
    <svg {...traco}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5l1.4 2.2 2.6-.5.6 2.6 2.4 1.1-1 2.4 1 2.4-2.4 1.1-.6 2.6-2.6-.5L12 21.5l-1.4-2.2-2.6.5-.6-2.6-2.4-1.1 1-2.4-1-2.4 2.4-1.1.6-2.6 2.6.5z" />
    </svg>
  );
}
