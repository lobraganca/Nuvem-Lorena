import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useOnboardingStatus } from "../lib/useOnboardingStatus";
import { temDestinoLogin } from "../lib/auth";
import { getProfile, salvarMeuPerfil } from "../lib/profiles";
import { uploadProfessionalPhoto } from "../lib/storage";
import { mensagemDeErro } from "../lib/erros";
import { formatPhone, onlyPhoneDigits, ehCelular, doFormatoDoBanco } from "../lib/phone";
import type { Profile } from "../types/domain";
import { Pagina } from "./ei/Pagina";

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
  /* De que lado está quem está preenchendo.
     ───────────────────────────────────────
     Esta tela nasceu no procurô, quando só havia um tipo de pessoa. No Ei
     Itabirito ela cobre os dois lados — e a empresa via, palavra por
     palavra, o texto de quem procura trabalho: "Passo 1 de 4", "isto já
     vale para o seu CADASTRO PROFISSIONAL", "com ela, sua AVALIAÇÃO tem
     rosto" (não existe avaliação neste app) e uma saída chamada "voltar
     para a BUSCA" (não existe busca).

     Pior que o texto era o destino: ao salvar, a empresa era mandada para
     `/painel` — o perfil profissional de quem procura trabalho. Ela entrava
     para publicar vaga e terminava numa tela de outro produto. */
  const ladoDaConta = useOnboardingStatus();
  const ehEmpresa = ladoDaConta === "company";
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
        navegar(ehEmpresa ? "/painel-empresa" : "/painel", { replace: true });
      }
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar seu perfil."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    /* O desenho do Ei, e não mais o do procurô.
       ────────────────────────────────────────
       Esta tela ficou para trás quando o app mudou de identidade: era a
       única do caminho principal ainda escrita com `container`, `card` e
       `btn btn-primary` do tema antigo. O efeito era gritante justamente
       onde mais custa — é a PRIMEIRA tela depois de entrar: botão laranja,
       links azul-marinho e cartão cinza, no meio de um app inteiro preto e
       branco de canto reto. Parecia outro aplicativo aberto por engano. */
    <div className="ei">
      <div className="ei-tela">
        {/* A barra de passos é do funil de quem procura trabalho: entrar,
            cadastro, ofícios, telefone. A empresa não tem esses quatro
            passos — para ela isto é uma tela só, e prometer "1 de 4"
            seria prometer três telas que não vêm. */}
        {levaAoCadastro(pathname) && !ehEmpresa && (
          <div className="ei-margem" style={{ paddingTop: 20 }}>
            <div className="passos-barra" aria-hidden="true">
              <div className="passos-preenchido" style={{ width: "25%" }} />
            </div>
            <p className="ei-apoio" style={{ marginTop: 8 }}>
              Passo 1 de 4 · <strong>Sua conta</strong>
            </p>
          </div>
        )}

        <Pagina titulo="Falta pouco" />

        <p className="ei-apoio ei-margem" style={{ marginTop: -4 }}>
          {ehEmpresa
            ? "É por aqui que quem responder à sua vaga fala com você."
            : "É por aqui que as vagas chegam até você."}
        </p>

        <div className="ei-cartao" style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label className="ei-foto-escolha" title="Escolher foto">
            {foto ? (
              <img src={foto} alt="" className="ei-foto-escolha-img" />
            ) : (
              <span className="ei-foto-escolha-vazia" aria-hidden="true">
                {nome.trim().charAt(0).toLocaleUpperCase("pt-BR") || "+"}
              </span>
            )}
            <span className="ei-btn-inline">
              {enviandoFoto ? "Enviando…" : foto ? "Trocar foto" : "Pôr foto (opcional)"}
            </span>
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

          <div className="ei-campo">
            <label htmlFor="completar-nome">Seu nome</label>
            <input
              id="completar-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como você quer ser chamada"
              maxLength={60}
              autoComplete="name"
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="completar-email">E-mail</label>
            <input
              id="completar-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              autoComplete="email"
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="completar-telefone">Celular</label>
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
              <p className="ei-campo-ajuda">Esse número parece ser fixo. Prefira um celular.</p>
            )}
          </div>

          {erro && (
            <p className="ei-campo-erro" role="alert">
              {erro}
            </p>
          )}

          <button
            className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
            disabled={falta || salvando}
            onClick={salvar}
          >
            {salvando ? "Salvando…" : "Salvar e continuar"}
          </button>
        </div>

        {/* A saída continua existindo — barreira sem saída é como se perde a
            pessoa em vez do dado —, mas com o nome do lugar certo. "Voltar
            para a busca" era do procurô: aqui não há busca, e quem lesse
            isso procuraria uma tela que não existe. */}
        <p className="ei-margem" style={{ marginTop: 16 }}>
          <Link to="/" className="ei-btn-inline">
            Agora não
          </Link>
        </p>
      </div>
    </div>
  );
}
