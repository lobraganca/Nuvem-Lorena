import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { signInWithGoogle, signOut } from "../lib/auth";
import { hasDatabase } from "../lib/supabase";
import { getProfile } from "../lib/profiles";
import { getMyProfessionals } from "../lib/professionals";
import { isAdmin } from "../lib/admin";
import { resetOnboarding } from "../lib/onboarding";
import { forcarAtualizacao } from "../lib/atualizacao";
import { excluirMinhaConta } from "../lib/account";
import { BottomSheet } from "../components/BottomSheet";
import { InstalarApp } from "../components/InstalarApp";
import { BotaoApple } from "../components/BotaoApple";
import { BotaoGoogle } from "../components/BotaoGoogle";
import { baixarMeusDados } from "../lib/meusDados";
import type { Professional, Profile } from "../types/domain";
import { FecharApp } from "../components/FecharApp";
import { MinhaAssinatura } from "../components/MinhaAssinatura";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { mensagemDeErro } from "../lib/erros";
import { googleServeAqui } from "../lib/plataforma";
import { salvarMeuPerfil } from "../lib/profiles";
import { uploadProfessionalPhoto } from "../lib/storage";
import { LOGIN_TELEFONE_ATIVO } from "../config";

function initials(name: string | null, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SettingsItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link to={to} className="settings-item">
      <span className="settings-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
      <span className="settings-arrow" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

export function PerfilPage() {
  useTituloDaPagina("Meu perfil");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  /* Edição do próprio nome e foto. Guardados em rascunho até salvar, para
     que cancelar devolva o que estava lá — e não o que a pessoa digitou e
     desistiu. */
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeRascunho, setNomeRascunho] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroPerfil, setErroPerfil] = useState("");
  /**
   * Cadastros da pessoa, só para dizer se o cadastro está no ar.
   *
   * `null` significa "ainda não sei" — durante o carregamento e também
   * quando a consulta falha. Nos dois casos a tela não mostra selo
   * nenhum: escrever "não está no ar" para quem está com a internet
   * ruim seria um susto por engano, e num lugar onde a pessoa não tem
   * como conferir se é verdade.
   */
  const [anuncios, setAnuncios] = useState<Professional[] | null>(null);
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
      setAnuncios(null);
      setAdmin(false);
      return;
    }
    getProfile(user.id).then(setProfile);
    isAdmin(user.id).then(setAdmin);
    getMyProfessionals(user.id)
      .then(setAnuncios)
      .catch(() => setAnuncios(null));
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
      <div className="container" style={{ maxWidth: 420, paddingTop: 60, textAlign: "center" }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Entrar</h1>
          {/* Mesma regra do Painel: no app da loja o Google não volta, e o
              caminho passa pela tela de login. Ver `googleServeAqui`. */}
          {googleServeAqui() ? (
            <>
              <p className="muted">Use sua conta Google para buscar, avaliar e cadastrar seus serviços.</p>
              <div style={{ marginTop: 20 }}>
                <BotaoGoogle onClick={handleGoogleLogin} disabled={!hasDatabase()} />
              </div>
              <div style={{ marginTop: 10 }}>
                <BotaoApple voltarPara="/perfil" onErro={setError} />
              </div>
              {/* O telefone existe e é o caminho principal desde que o app
                  passou a ser instalável — mas esta tela continuava
                  oferecendo só o Google, e quem não usa Google saía daqui
                  achando que não tinha como entrar. */}
              {LOGIN_TELEFONE_ATIVO && (
                <p style={{ marginTop: 14, marginBottom: 0 }}>
                  <Link className="entrar-link" to="/login">
                    Entrar com meu celular
                  </Link>
                </p>
              )}
            </>
          ) : (
            <>
              <p className="muted">
                Entre com seu celular para avaliar, favoritar e cadastrar seus serviços. A gente manda um
                código por SMS — sem senha nova.
              </p>
              <div style={{ marginTop: 20 }}>
                <Link className="btn btn-primary btn-block" to="/login">
                  Entrar com meu celular
                </Link>
              </div>
            </>
          )}
          {!hasDatabase() && (
            <p className="muted" style={{ marginTop: 10 }}>
              Configure VITE_SUPABASE_URL/ANON_KEY e o provider Google no Supabase para habilitar o login.
            </p>
          )}
          {error && <p style={{ color: "var(--color-danger)", marginTop: 10 }}>{error}</p>}
        </div>
      </div>
    );
  }

  const name = profile?.full_name ?? user.user_metadata?.full_name ?? null;
  const avatarUrl = profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;

  /**
   * O cadastro está no ar?
   *
   * É a primeira coisa que quem tem cadastro quer saber ao abrir o perfil, e
   * até agora a resposta exigia entrar no Painel e interpretar a lista.
   * Quem entrou com o Google e parou no meio não tinha como perceber que
   * tinha parado — a tela não dizia nada, e "sem aviso" lê como "está
   * tudo certo".
   *
   * `suspended` é o que tira o cadastro da busca de verdade: é a coluna
   * que a policy de RLS filtra na leitura pública. Por isso ela decide
   * o selo, e não uma checagem de campos preenchidos, que diria "no ar"
   * para um cadastro que a moderação derrubou.
   */
  const situacao =
    anuncios === null
      ? null
      : anuncios.length === 0
        ? { tom: "pendente", texto: "Cadastro não finalizado" }
        : anuncios.some((p) => !p.suspended)
          ? { tom: "ok", texto: "Seu cadastro está no ar" }
          : { tom: "problema", texto: "Cadastro suspenso" };

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 32 }}>
      <div className="card" style={{ textAlign: "center" }}>
        {/* Foto e nome passaram a ser EDITÁVEIS aqui, e isso é consequência
            direta da troca de porta de entrada.

            Com o login só pelo Google, os dois vinham prontos e ninguém
            precisava preenchê-los — por isso nunca houve onde. Entrando
            pelo telefone não vem nada: a conta nasce anônima e ficava
            assim para sempre. As avaliações dessa pessoa apareciam como
            "Usuário do procurô", com um "?" no lugar do rosto.

            Isso corrói o que dá valor ao app. Uma avaliação vale pela
            pessoa que a escreveu; assinada por "Usuário do procurô" ela lê
            como texto de robô, e quem veio ler opinião de gente da cidade
            desconfia da lista inteira. */}
        <label className="perfil-foto-alvo" title="Trocar a foto">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="profile-avatar-foto" />
          ) : (
            <div className="profile-avatar">{initials(name, user.email)}</div>
          )}
          <span className="perfil-foto-etiqueta">{enviandoFoto ? "Enviando…" : "Trocar"}</span>
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

        {editandoNome ? (
          <div className="perfil-nome-edita">
            <input
              value={nomeRascunho}
              onChange={(e) => setNomeRascunho(e.target.value)}
              placeholder="Como você quer ser chamada"
              maxLength={60}
              autoFocus
            />
            <div className="perfil-nome-acoes">
              <button
                className="btn btn-primary"
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
              <button className="btn btn-outline" onClick={() => setEditandoNome(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ margin: "12px 0 2px" }}>{name || "Sem nome"}</h2>
            <button
              type="button"
              className="perfil-editar-nome"
              onClick={() => {
                setNomeRascunho(name ?? "");
                setEditandoNome(true);
              }}
            >
              {name ? "Editar nome" : "Escrever meu nome"}
            </button>
          </>
        )}

        {/* Sem nome, o aviso explica ONDE isso aparece. "Complete seu
            perfil" não convence ninguém; saber que a própria avaliação sai
            assinada como "Usuário do procurô", sim. */}
        {!name && !editandoNome && (
          <p className="perfil-sem-nome">
            Suas avaliações aparecem como <strong>"Usuário do procurô"</strong> até você escrever seu nome.
          </p>
        )}
        {erroPerfil && <p className="perfil-erro">{erroPerfil}</p>}

        {/* A linha existe mesmo vazia, com altura reservada: o selo chega
            depois da consulta, e sem o espaço guardado ele empurraria o
            resto da tela para baixo no momento em que aparece. */}
        <div className="situacao-linha">
          {situacao && (
            <Link
              to="/painel"
              className={`situacao situacao-${situacao.tom}`}
              /* Levar ao Painel importa mais quando falta terminar, mas
                 vale nos três estados: o selo diz o que está acontecendo,
                 e o toque leva ao único lugar onde se resolve. */
            >
              <span className="situacao-ponto" aria-hidden="true" />
              {situacao.texto}
            </Link>
          )}
        </div>
      </div>

      {/* Antes do resto: é a pergunta que se faz no Perfil ("eu pago alguma
          coisa por esse app?"), e a resposta estava escondida dentro do
          Painel, presa ao cartão de cada cadastro. */}
      <p className="settings-group-title">Assinatura</p>
      <MinhaAssinatura userId={user.id} />
      <div className="settings-list">
        <SettingsItem to="/assinatura" icon="⭐" label="Planos e benefícios" />
      </div>

      <p className="settings-group-title">Meus cadastros</p>
      <div className="settings-list">
        <InstalarApp />
        <SettingsItem to="/painel" icon="📋" label="Meus cadastros" />
        <SettingsItem to="/favoritos" icon="❤️" label="Meus favoritos" />
      </div>

      {/* O número da versão saiu daqui.
          Ele existia para responder "estou atualizado?" de dentro do app,
          numa época em que publicar não dava para conferir de fora. Hoje
          quem confere é o workflow, que só fica verde depois de o site
          devolver o commit exato — e um carimbo de data e hora no perfil
          de quem só quer achar um encanador não diz nada a essa pessoa.

          "Forçar atualização" fica. Ele não é informação, é conserto: é a
          saída de quando o app trava numa versão antiga e nem recarregar
          nem fechar e reabrir resolvem. Já foi preciso mais de uma vez. */}
      <p className="settings-group-title">O app</p>
      <div className="settings-list">
        <button
          type="button"
          className="settings-item"
          onClick={() => {
            setForcando(true);
            void forcarAtualizacao();
          }}
          disabled={forcando}
        >
          <span className="settings-icon" aria-hidden="true">🔄</span>
          <span>{forcando ? "Buscando a versão nova…" : "Forçar atualização"}</span>
          <span className="settings-arrow" aria-hidden="true">›</span>
        </button>
      </div>

      <p className="settings-group-title">Dados e segurança</p>
      <div className="settings-list">
        <SettingsItem to="/termos" icon="📄" label="Termos de uso" />
        <SettingsItem to="/privacidade" icon="🔒" label="Política de privacidade" />
        {/* Direito de acesso da LGPD resolvido em um toque: pedir por e-mail
            e esperar 15 dias é o mínimo legal, não o certo, quando o dado
            está a uma consulta de distância. */}
        <button
          type="button"
          className="settings-item"
          disabled={baixando}
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
          <span className="settings-icon" aria-hidden="true">
            ⬇️
          </span>
          <span>{baixando ? "Preparando…" : "Baixar meus dados"}</span>
          <span className="settings-arrow" aria-hidden="true">
            ›
          </span>
        </button>
        <SettingsItem to="/como-funciona" icon="ℹ️" label="Como funciona" />
        {/* Fica aqui porque é aqui que a pessoa procura. Tenta fechar de
            verdade e, quando o sistema não deixa, ensina o gesto — ver
            FecharApp. */}
        <FecharApp />
        <button
          type="button"
          className="settings-item"
          onClick={() => {
            resetOnboarding();
            navigate("/inicio");
          }}
        >
          <span className="settings-icon" aria-hidden="true">
            🧭
          </span>
          <span>Rever apresentação do app</span>
          <span className="settings-arrow" aria-hidden="true">
            ›
          </span>
        </button>
        {admin && <SettingsItem to="/admin" icon="🛡️" label="Painel administrativo" />}
        {admin && <SettingsItem to="/configuracao" icon="⚙️" label="Configuração do app" />}
      </div>

      <button
        className="btn btn-danger-soft btn-block"
        style={{ marginTop: 26 }}
        onClick={() => signOut()}
      >
        Sair da conta
      </button>

      {/* Separado de "Sair da conta" por espaço e por peso visual: são ações
          vizinhas com consequências muito diferentes, e trocar uma pela outra
          por engano seria irreversível. */}
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

      {confirmarExclusao && (
        <BottomSheet
          title="Excluir minha conta"
          subtitle="Esta ação não tem volta."
          onClose={() => setConfirmarExclusao(false)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <p style={{ margin: 0 }}>Vão ser apagados para sempre:</p>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }} className="muted">
              <li>seus cadastros e as avaliações que você recebeu neles</li>
              <li>as avaliações que você escreveu sobre outros profissionais</li>
              <li>seus favoritos e seu cadastro</li>
            </ul>
            <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
              Os pedidos de contato que você enviou continuam com os profissionais, sem o vínculo com a sua
              conta — eles precisam do seu recado para poder te retornar.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
              Se você tem assinatura ativa, cancele antes pelo Mercado Pago: apagar a conta aqui não cancela a
              cobrança lá.
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
  );
}
