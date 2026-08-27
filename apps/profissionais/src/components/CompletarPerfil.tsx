import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
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
 * do procurô".
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
 */
export function CompletarPerfil({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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
      setPerfil(await getProfile(user.id));
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar seu perfil."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="container completar-perfil">
      <h1>Falta pouco</h1>
      <p className="muted completar-intro">
        É rápido, e só se faz uma vez.
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
