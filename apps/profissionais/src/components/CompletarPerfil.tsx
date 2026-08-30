import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { temDestinoLogin } from "../lib/auth";
import { getProfile, salvarMeuPerfil } from "../lib/profiles";
import { uploadProfessionalPhoto } from "../lib/storage";
import { mensagemDeErro } from "../lib/erros";
import { formatPhone, onlyPhoneDigits, ehCelular, doFormatoDoBanco } from "../lib/phone";
import type { Profile } from "../types/domain";

/**
 * As telas de conta que só abrem com o perfil preenchido.
 *
 * Buscar não está aqui, e nunca vai estar: a busca é o motivo de o app
 * existir e funciona sem conta nenhuma. Quem só quer achar um eletricista
 * não deve topar com formulário nenhum.
 */
const TELAS_DE_CONTA = ["/painel", "/perfil", "/favoritos"];

export function exigePerfil(caminho: string): boolean {
  return TELAS_DE_CONTA.some((t) => caminho === t || caminho.startsWith(`${t}/`));
}

/**
 * Depois de salvar, esta tela leva ao cadastro profissional?
 *
 * Só quando ela apareceu no Perfil — que é onde o login larga quem acabou
 * de entrar. É essa pessoa que "acabou de entrar", e quase sempre entrou
 * para anunciar: buscar nunca pediu conta nenhuma, então fazer login já é
 * quase uma declaração de que se veio para ser achado.
 *
 * Quem chegou aqui por Favoritos fica de fora de propósito: essa pessoa
 * tocou num lugar específico e quis ir a ele. Mandá-la para um formulário
 * de cadastro seria trocar o destino dela pelo nosso.
 *
 * E o destino é `/painel`, não `/painel/novo`. Quem decide entre os dois é
 * o próprio painel, que já sabe distinguir "não tem cadastro" (vai para o
 * formulário) de "a rede caiu" (mostra o erro e oferece tentar de novo).
 * Apontar direto para o formulário jogaria fora essa distinção, e uma
 * falha de conexão viraria um segundo cadastro em branco.
 */
function levaAoCadastro(caminho: string): boolean {
  return caminho === "/perfil";
}

/** Falta alguma coisa? É o que decide se a tela aparece. */
function incompleto(p: Profile | null): boolean {
  if (!p) return false; // ainda carregando: não mostra nada
  return !p.full_name?.trim() || !p.email?.trim() || !p.phone?.trim();
}

/**
 * Completar o perfil, uma vez, depois de entrar.
 *
 * Existe porque a porta de entrada mudou e cada uma traz só metade do
 * contato: o Google entrega nome, foto e e-mail, mas nenhum telefone; o
 * login por SMS entrega o telefone e mais nada. Antes disso a conta ficava
 * pela metade para sempre, e as avaliações saíam assinadas como "Usuário
 * do Ei Itabirito".
 *
 * Três decisões que valem ser ditas, porque cada uma é onde se perde
 * gente:
 *
 * 1. **O que o sistema já sabe vem preenchido.** Pedir de novo o e-mail de
 *    quem acabou de entrar pelo Google é o jeito mais rápido de irritar —
 *    a pessoa lê como "não prestaram atenção em nada".
 *
 * 2. **A foto é convidada, não exigida.** É o campo que mais faz desistir:
 *    quem só quer avaliar um eletricista não tem foto à mão e abandona
 *    ali. Ela pode ser posta depois, no Perfil, e o convite aqui explica
 *    o que ela muda. (Para torná-la obrigatória, basta somá-la ao `falta`
 *    lá embaixo — é uma linha.)
 *
 * 3. **Tem saída visível.** Voltar para a busca continua possível a
 *    qualquer momento. Barreira sem saída é como se perde a pessoa em vez
 *    do dado.
 *
 * E uma quarta, que nasceu de um erro desta própria tela: **ela é o passo 1
 * de quem vai anunciar, não um portão a mais.**
 *
 * Quando entrou, esta tela se enfiou no meio de um funil que já existia e
 * já era contado — "Passo 1 de 4 · Entrar" no painel, e os passos 2 a 4 no
 * formulário do cadastro. O resultado era um degrau sem número entre o 1 e
 * o 2, pedindo nome, foto e telefone... que o passo 2 pede de novo (nome e
 * foto) e o passo 4 também (telefone). Duas vezes a mesma digitação, e a
 * promessa de "4 passos" quebrada logo no primeiro.
 *
 * Agora a tela mostra a mesma barra de passos, e o que se preenche aqui vai
 * junto para o formulário (ver o efeito que lê `profiles` na CadastroPage).
 * Quem entra sai daqui direto para o cadastro profissional — que é o que
 * quase todo mundo que faz login veio fazer, já que buscar nunca pediu
 * conta nenhuma.
 */
export function CompletarPerfil({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (loading || !user) {
      setCarregando(false);
      return;
    }
    let ativo = true;
    getProfile(user.id)
      .then((p) => {
        if (!ativo) return;
        setPerfil(p);
        /* Semeia os campos com tudo o que já se sabe — do perfil e, se ele
           estiver vazio, da própria conta de login. Quem entrou agora pelo
           Google vê nome e e-mail já preenchidos e só acrescenta o
           telefone. */
        setNome(p?.full_name ?? user.user_metadata?.full_name ?? "");
        setEmail(p?.email ?? user.email ?? "");
        setTelefone(formatPhone(doFormatoDoBanco(p?.phone || user.phone)));
        setFoto(p?.avatar_url ?? user.user_metadata?.avatar_url ?? null);
      })
      .catch((e) => setErro(mensagemDeErro(e, "Não foi possível carregar seu perfil.")))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [user, loading]);

  if (loading || carregando) return null;
  if (!user || !incompleto(perfil)) return <>{children}</>;

  const digitos = onlyPhoneDigits(telefone);
  const falta =
    !nome.trim() || !email.trim() || digitos.length < 10 || !email.includes("@");

  async function salvar() {
    if (!user) return;
    setSalvando(true);
    setErro("");
    try {
      await salvarMeuPerfil(user.id, {
        full_name: nome.trim(),
        email: email.trim(),
        phone: digitos,
        ...(foto ? { avatar_url: foto } : {}),
      });
      /* Relê do banco em vez de montar o objeto aqui: se algo não gravou,
         a tela continua pedindo em vez de seguir com um perfil que só
         existe na memória. */
      const salvo = await getProfile(user.id);
      setPerfil(salvo);
      /* `temDestinoLogin` porque quem pediu para entrar a partir de uma
         ação específica já tem quem o leve de volta a ela — o
         RetomarDestinoLogin. Dois redirecionamentos disputando a mesma
         tela é como se perde o destino que a pessoa escolheu. */
      if (!incompleto(salvo) && levaAoCadastro(pathname) && !temDestinoLogin()) {
        navegar("/painel", { replace: true });
      }
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar seu perfil."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="container completar-perfil">
      {/* A mesma barra do painel e do formulário. Sem ela esta tela era um
          degrau sem número entre o passo 1 e o passo 2, e a conta de "4
          passos" prometida na tela anterior não fechava. Entrar e dizer
          quem se é são o mesmo passo do ponto de vista de quem preenche —
          por isso 1 de 4, e não um quinto passo novo. */}
      {levaAoCadastro(pathname) && (
        <div className="passos" style={{ marginBottom: 16 }}>
          <div className="passos-barra" aria-hidden="true">
            <div className="passos-preenchido" style={{ width: "25%" }} />
          </div>
          <p className="passos-rotulo">
            Passo 1 de 4 · <strong>Sua conta</strong>
          </p>
        </div>
      )}
      <h1>Falta pouco</h1>
      <p className="muted completar-intro">
        {levaAoCadastro(pathname)
          ? "Isto já vale para o seu cadastro profissional — o que você puser aqui aparece lá preenchido."
          : "É rápido, e só se faz uma vez."}
      </p>

      <div className="card completar-card">
        <label className="completar-foto" title="Escolher foto">
          {foto ? (
            <img src={foto} alt="" className="completar-foto-img" />
          ) : (
            <span className="completar-foto-vazia" aria-hidden="true">
              {nome.trim().charAt(0).toLocaleUpperCase("pt-BR") || "+"}
            </span>
          )}
          <span className="completar-foto-acao">{enviandoFoto ? "Enviando…" : foto ? "Trocar" : "Pôr foto"}</span>
          <input
            type="file"
            accept="image/*"
            disabled={enviandoFoto}
            style={{ display: "none" }}
            onChange={async (e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (!arquivo || !user) return;
              setEnviandoFoto(true);
              setErro("");
              try {
                setFoto(await uploadProfessionalPhoto(user.id, arquivo));
              } catch (err) {
                setErro(mensagemDeErro(err, "Não foi possível enviar a foto."));
              } finally {
                setEnviandoFoto(false);
              }
            }}
          />
        </label>
        <p className="completar-foto-nota">
          Opcional. Com ela, sua avaliação tem rosto.
        </p>

        <label className="completar-rotulo" htmlFor="completar-nome">
          Seu nome
        </label>
        <input
          id="completar-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como você quer ser chamada"
          maxLength={60}
          autoComplete="name"
        />

        <label className="completar-rotulo" htmlFor="completar-email">
          E-mail
        </label>
        <input
          id="completar-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          autoComplete="email"
        />

        <label className="completar-rotulo" htmlFor="completar-telefone">
          Celular
        </label>
        <input
          id="completar-telefone"
          type="tel"
          inputMode="numeric"
          value={telefone}
          onChange={(e) => setTelefone(formatPhone(e.target.value))}
          placeholder="(31) 90000-0000"
          autoComplete="tel"
        />
        {/* Avisa antes de salvar, e não depois: fixo não recebe SMS, e
            descobrir isso na hora de precisar do contato é tarde. */}
        {digitos.length >= 10 && !ehCelular(digitos) && (
          <p className="completar-dica">Esse número parece ser de telefone fixo. Prefira um celular.</p>
        )}

        {erro && <p className="completar-erro">{erro}</p>}

        <button className="btn btn-primary btn-block" disabled={falta || salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar e continuar"}
        </button>
      </div>

      {/* A saída. Buscar funciona sem conta, e quem chegou aqui sem querer
          preencher nada precisa poder voltar ao que veio fazer. */}
      <p className="completar-saida">
        <Link to="/">Voltar para a busca</Link>
      </p>
    </div>
  );
}
