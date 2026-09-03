import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatPhone } from "../lib/phone";
import { useAuth } from "../lib/useAuth";
import { signOut, definirSenha } from "../lib/auth";
import { registrarTipoDeUsuario, minhasEmpresas } from "../lib/company";
import { meusCadastros } from "../lib/meuPerfil";
import { hasDatabase } from "../lib/supabase";
import { getProfile } from "../lib/profiles";
import { isAdmin } from "../lib/admin";
import { forcarAtualizacao } from "../lib/atualizacao";
import { excluirMinhaConta } from "../lib/account";
import { BottomSheet } from "../components/BottomSheet";
import { baixarMeusDados } from "../lib/meusDados";
import type { Profile } from "../types/domain";
import { InstalarApp } from "../components/InstalarApp";
import { Pagina, Prop } from "../components/ei/Pagina";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { useOnboardingStatus } from "../lib/useOnboardingStatus";
import { mensagemDeErro } from "../lib/erros";
import { sendSuggestion } from "../lib/suggestions";
import { SUPORTE_WHATSAPP, CONTATO_EMAIL } from "../config";

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
  const navegar = useNavigate();
  const { user, loading } = useAuth();
  const tipo = useOnboardingStatus();
  const [profile, setProfile] = useState<Profile | null>(null);
  /* Edição do próprio nome e foto. Guardados em rascunho até salvar, para
     que cancelar devolva o que estava lá — e não o que a pessoa digitou e
     desistiu. */
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState("");
  /** Trocando o lado mostrado (profissional ↔ empresa). */
  const [trocando, setTrocando] = useState(false);
  /* Quais cadastros esta conta REALMENTE tem. `null` em um deles quer
     dizer "não consegui saber" — e nesse caso a tela mostra o caminho do
     mesmo jeito, porque errar para o lado de mostrar demais é melhor que
     esconder um cadastro que existe. */
  /* Quantos cadastros a conta tem de cada lado. `null` é "não sei" — a
     consulta caiu —, e é diferente de zero: dizer "nenhum" a quem tem dois
     é o defeito que esta tela existe para não cometer. */
  const [temOutroLado, setTemOutroLado] = useState<{
    empresa: number | null;
    profissional: number | null;
  } | null>(null);
  const [mostrandoSenha, setMostrandoSenha] = useState(false);
  const [senhaNova, setSenhaNova] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [avisoSenha, setAvisoSenha] = useState("");
  /* "Enviar sugestão" — a dona pediu na Conta, junto de "como funciona"
     e dos documentos. O mesmo canal que já existia para "função que
     faltava na lista" (MeuPerfilPage), aqui aberto para qualquer coisa. */
  const [mostrandoSugestao, setMostrandoSugestao] = useState(false);
  const [textoSugestao, setTextoSugestao] = useState("");
  const [enviandoSugestao, setEnviandoSugestao] = useState(false);
  const [sugestaoEnviada, setSugestaoEnviada] = useState(false);
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
      setTemOutroLado(null);
      return;
    }
    getProfile(user.id).then(setProfile);
    isAdmin(user.id).then(setAdmin);

    /* ── QUEM TEM OS DOIS CADASTROS VÊ OS DOIS — 03/09 ─────────────────
       A dona: "o botão de conta vai pro cadastro de empresa, mas nesse
       caso eu também tenho cadastro como profissional, como fica nesse
       caso?"

       Ficava escondido. A Conta mostrava só o lado ATUAL, e o outro
       aparecia atrás de um botão escrito "também procuro trabalho" — a
       frase de quem AINDA NÃO tem esse cadastro. Para quem já tem os dois
       (o caso dela, e o caso comum numa cidade pequena: a dona da loja que
       também é eletricista à noite), o app negava a existência de metade
       do que ela cadastrou.

       Duas consultas, e o erro de cada uma vira "não sei" e não "não
       tem": esconder um cadastro que existe é o defeito que estamos
       consertando, e repeti-lo por causa de uma consulta que caiu seria
       trocar um erro por ele mesmo. */
    let vivo = true;
    /* QUANTOS, e não "tem ou não tem" — a dona: "mostre nos botões o
       número de quantos cadastros tem em cada opção."

       Faz diferença desde que os dois lados passaram a aceitar mais de um
       cadastro: quem tem duas lojas e um perfil precisa ver isso aqui,
       senão a Conta diz menos do que a pessoa já sabe. `null` continua
       sendo "não sei" (a consulta caiu), que é diferente de zero. */
    Promise.all([
      minhasEmpresas(user.id).then((l) => l.length).catch(() => null),
      meusCadastros(user.id).then((l) => l.length).catch(() => null),
    ]).then(([empresas, profissionais]) => {
      if (vivo) setTemOutroLado({ empresa: empresas, profissional: profissionais });
    });
    return () => {
      vivo = false;
    };
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Entrar" />
          <div className="ei-margem" style={{ paddingTop: 12 }}>
          {/* O Google saiu daqui junto com o da tela de entrar (01/09, a
              pedido da dona). Sobrou o caminho único, que é o do celular —
              e sobrou mais simples: eram dois blocos alternativos, um com
              Google e outro sem, e agora é um só. */}
          <p className="ei-apoio" style={{ marginBottom: 24 }}>
            Entre com seu celular. A gente manda um código por SMS, e depois você
            pode criar uma senha.
          </p>
          <Link className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto" to="/login">
            Entrar com meu celular
          </Link>
          {!hasDatabase() && (
            <p className="ei-apoio" style={{ marginTop: 12 }}>
              O app não está conseguindo falar com o banco agora. Tente de novo
              daqui a pouco.
            </p>
          )}
          {error && (
            <p className="ei-campo-erro" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}
          </div>
        </div>
      </div>
    );
  }

  const name = profile?.full_name ?? user.user_metadata?.full_name ?? null;
  const contato = user.phone ? telefoneLegivel(user.phone) : (user.email ?? "");

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo="Conta" />

        {/* Quem é você.
            ─────────────
            Era um cartão branco com foto, nome, telefone e um botão de
            contorno largo. Virou o que o Notion faz: a foto e o nome no
            corpo da página, e o telefone como PROPRIEDADE — rótulo à
            esquerda, valor à direita.

            Foto e nome são editáveis aqui por causa da porta de entrada:
            com o login só pelo Google os dois vinham prontos e nunca houve
            onde preenchê-los. Entrando pelo telefone não vem nada — a
            conta nasce anônima e ficava assim para sempre. */}
        {/* ── A FOTO E O NOME SAÍRAM DAQUI — 04/09 ────────────────────
            A dona: "nessa tela não precisa ter os dados da pessoa lá em
            cima. Ela já vai ter acesso pelos botões."

            E é verdade: foto, nome e o "editar nome" ocupavam a primeira
            dobra inteira da Conta com dados que já se editam DENTRO de cada
            cadastro — no perfil profissional e no da empresa, onde eles
            importam de verdade, porque é lá que a empresa e o candidato os
            leem.

            Aqui em cima eles eram uma terceira cópia dos mesmos campos, e a
            que menos serve: ninguém procura a Conta para trocar de foto.

            O que fica é o telefone confirmado, logo abaixo — ele não é um
            dado do cadastro, é a IDENTIDADE da conta (ver o comentário
            seguinte). */}

        {/* ── O TELEFONE CONFIRMADO É A IDENTIDADE DA CONTA — 03/09 ─────
            A dona: "o botão de conta acho que poderia ser pelo número de
            telefone validado."

            E é: a conta deste app não tem e-mail nem usuário — ela É o
            número, provado por SMS. Quem tem duas contas (a da loja e a
            sua) precisa ver EM QUAL está antes de mexer em qualquer coisa,
            e o nome não serve para isso: as duas podem se chamar Lorena.

            Vem do Auth, e não de um campo de cadastro: é o número que a
            pessoa provou, e não um que ela digitou. */}
        {user.phone && (
          <p className="ei-conta-fone ei-margem">
            <span>{formatPhone(user.phone)}</span>
            <span className="ei-selo ei-selo-verde">Confirmado</span>
          </p>
        )}

        {/* "Você é: Empresa" saiu (03/09): os cartões logo abaixo dizem a
            mesma coisa, e com o "Aberto agora" escrito no próprio cartão.
            O contato fica — e é a linha que identifica a conta quando ela
            não tem telefone (as contas antigas, de e-mail). */}
        {!user.phone && (
          <div className="ei-props">
            <Prop rotulo="E-mail">{contato || "—"}</Prop>
          </div>
        )}

        {/* ── OS DOIS LADOS, EM CARTÕES ─────────────────────────────────
            A dona: "aparecer em card identificados se é empresa ou
            profissional" e "tirar essa opção 'Também procuro trabalho —
            abrir meu lado de profissional'".

            As duas coisas são a mesma: aquele botão era um TEXTO comprido
            que fazia o trabalho de um cartão — dizia o lado, o estado e a
            ação numa frase só, e mudava de nome conforme o caso. Agora são
            dois cartões iguais, sempre os dois, cada um dizendo o que é
            (Profissional / Empresa), se já existe cadastro ali, e qual dos
            dois está aberto agora.

            Tocar num cartão troca o lado do app — que é o que o botão
            fazia. A diferença é que agora dá para VER os dois antes de
            escolher, em vez de ler uma frase sobre o que não está na tela.

            Uma conta, um número, dois lados: é assim que a cidade usa o
            app (a dona da loja que também é eletricista à noite), e a
            Conta é o lugar onde isso tem que estar visível. */}
        <div className="ei-secao-linha">
          <h2>Seus cadastros</h2>
        </div>
        <div className="ei-lados">
          {(["professional", "company"] as const).map((lado) => {
            const aberto = tipo === lado;
            const quantos =
              lado === "company" ? temOutroLado?.empresa : temOutroLado?.profissional;
            return (
              <button
                key={lado}
                type="button"
                className={aberto ? "ei-lado-cartao aberto" : "ei-lado-cartao"}
                disabled={trocando}
                onClick={async () => {
                  if (!user) return;
                  /* Já está aberto: o cartão leva para o lado, e não
                     regrava o que já está gravado. */
                  if (aberto) {
                    navegar(lado === "company" ? "/minhas-empresas" : "/painel");
                    return;
                  }
                  setTrocando(true);
                  try {
                    await registrarTipoDeUsuario(user.id, lado);
                    /* Recarrega o app inteiro no endereço do lado novo: a
                       barra de baixo e várias telas leem o lado uma vez, na
                       abertura, e uma navegação comum deixaria metade do
                       app mostrando o lado antigo. */
                    window.location.href =
                      lado === "company" ? "/minhas-empresas" : "/painel";
                  } catch (err) {
                    setError(mensagemDeErro(err, "Não consegui trocar de lado."));
                    setTrocando(false);
                  }
                }}
              >
                <span className="ei-lado-icone" aria-hidden="true">
                  {lado === "company" ? <IconeLoja /> : <IconePessoa />}
                </span>
                <span className="ei-lado-nome">
                  {lado === "company" ? "Empresa" : "Profissional"}
                </span>
                <span className="ei-lado-nota">
                  {quantos === 0
                    ? "Ainda não cadastrado"
                    : lado === "company"
                      ? "Publicar vagas e ver quem respondeu"
                      : "Receber vagas do seu ofício"}
                </span>
                {/* Quantos, quando há mais de um: com um só, o número não
                    acrescenta nada ("1 cadastro" numa conta que tem um é
                    ruído) — e com dois ele responde de relance a pergunta
                    que faz a pessoa entrar aqui. */}
                {quantos != null && quantos > 1 && (
                  <span className="ei-lado-conta">
                    {lado === "company" ? `${quantos} empresas` : `${quantos} cadastros`}
                  </span>
                )}
                {aberto && <span className="ei-lado-selo">Aberto agora</span>}
              </button>
            );
          })}
        </div>

        <div className="ei-lista" style={{ marginTop: 12 }}>
          {/* Favoritos vale para os DOIS lados, e por isso fica fora dos
              cartões: quem contrata guarda candidatos, quem procura
              trabalho guarda empresas, e a mesma conta pode ser os dois. */}
          <Linha para="/favoritos" icone={<IconeCoracao />}>
            Meus favoritos
          </Linha>
        </div>

        {/* ── CRIAR OU TROCAR A SENHA, A QUALQUER HORA ────────────────
            A oferta de senha aparecia só uma vez, logo depois de entrar
            por SMS. Quem tocasse "Agora não" — ou quem, como a dona, não
            chegou a ver a oferta por causa de um defeito — não tinha
            nenhum outro lugar para criar uma.

            Aqui ela fica para sempre, e serve para os dois casos: criar a
            primeira e trocar a que existe. Não pede a senha antiga porque
            quem está aqui já provou quem é (entrou), e pedir uma senha que
            a pessoa não tem seria trancar justamente quem veio criar. */}
        <div className="ei-secao-linha">
          <h2>Entrar sem SMS</h2>
        </div>
        <div className="ei-lista">
          {!mostrandoSenha ? (
            <button
              type="button"
              className="ei-linha-item"
              onClick={() => setMostrandoSenha(true)}
            >
              Criar ou trocar minha senha
            </button>
          ) : (
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <div className="ei-campo">
                <label htmlFor="conta-senha-nova">Nova senha</label>
                <input
                  id="conta-senha-nova"
                  type="password"
                  autoComplete="new-password"
                  value={senhaNova}
                  onChange={(e) => setSenhaNova(e.target.value)}
                />
                <span className="ei-campo-ajuda">
                  Pelo menos 8 letras ou números. Com senha, você entra digitando o
                  celular e ela — sem esperar SMS.
                </span>
              </div>
              <button
                type="button"
                className="ei-btn ei-btn-cheio"
                disabled={salvandoSenha || senhaNova.length < 8}
                onClick={async () => {
                  setSalvandoSenha(true);
                  setError("");
                  try {
                    await definirSenha(senhaNova);
                    try {
                      localStorage.setItem("ei-tem-senha", "1");
                    } catch {
                      /* segue sem lembrar */
                    }
                    setSenhaNova("");
                    setMostrandoSenha(false);
                    setAvisoSenha("Senha guardada. Da próxima vez, entre com ela.");
                  } catch (err) {
                    setError(mensagemDeErro(err, "Não consegui guardar a senha."));
                  } finally {
                    setSalvandoSenha(false);
                  }
                }}
              >
                {salvandoSenha ? "Guardando…" : "Guardar senha"}
              </button>
              <button
                type="button"
                className="ei-btn-inline"
                onClick={() => {
                  setMostrandoSenha(false);
                  setSenhaNova("");
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
        {avisoSenha && (
          <p className="ei-apoio ei-margem" style={{ marginTop: 8 }}>{avisoSenha}</p>
        )}

        {/* Instalar o app.
            ─────────────────
            Some do celular de quem já está dentro do app instalado, e só
            ali — em aba de navegador aparece sempre, inclusive para quem
            instalou em outro aparelho. Ver InstalarApp.

            Ficou um tempo sem aparecer em lugar NENHUM: saiu do cabeçalho
            na arrumação do topo e saiu daqui na reescrita da Conta, e
            ninguém percebeu porque o componente continuava importado. Era
            a dona quem não achava mais como pôr o app no celular. */}
        <div className="ei-secao-linha">
          <h2>O app</h2>
        </div>
        <div className="ei-lista">
          <InstalarApp />
        </div>

        <div className="ei-secao-linha">
          <h2>Ajuda</h2>
        </div>

        <div className="ei-lista">
          {/* A dona pediu "como funciona" junto de sugestão, termos e
              suporte — o roteiro de quem não sabe se o app está fazendo o
              que devia, antes de escrever para o suporte. Por isso vem
              primeiro nesta lista. */}
          <Linha para="/como-funciona" icone={<IconeAjuda />}>
            Como funciona
          </Linha>
          {/* O endereço vai na segunda linha e não no rótulo: em 390px de
              largura ele estourava a linha e era cortado no meio
              ("contato@empregoitabirito.co…"), que é pior do que não
              mostrar — um e-mail cortado parece um e-mail errado. */}
          <Linha href={`mailto:${CONTATO_EMAIL}`} icone={<IconeCarta />}>
            Escrever um e-mail
            <span className="ei-linha-sub">{CONTATO_EMAIL}</span>
          </Linha>
          {/* "Enviar sugestão" — a dona pediu explicitamente. Mesmo canal
              (`sendSuggestion`) que já recebia os pedidos de função nova
              do cadastro profissional; aqui aberto para qualquer ideia,
              sem exigir que seja sobre uma função específica. */}
          {!mostrandoSugestao ? (
            <Linha
              icone={<IconeLampada />}
              onClick={() => {
                setSugestaoEnviada(false);
                setMostrandoSugestao(true);
              }}
            >
              Enviar sugestão
            </Linha>
          ) : (
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <div className="ei-campo">
                <label htmlFor="conta-sugestao">Sua sugestão</label>
                <textarea
                  id="conta-sugestao"
                  rows={3}
                  value={textoSugestao}
                  onChange={(e) => setTextoSugestao(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="ei-btn ei-btn-cheio"
                disabled={enviandoSugestao || !textoSugestao.trim()}
                onClick={async () => {
                  setEnviandoSugestao(true);
                  setError("");
                  try {
                    await sendSuggestion(textoSugestao.trim(), user.id);
                    setTextoSugestao("");
                    setMostrandoSugestao(false);
                    setSugestaoEnviada(true);
                  } catch (err) {
                    setError(mensagemDeErro(err, "Não consegui enviar a sugestão."));
                  } finally {
                    setEnviandoSugestao(false);
                  }
                }}
              >
                {enviandoSugestao ? "Enviando…" : "Enviar"}
              </button>
              <button
                type="button"
                className="ei-btn ei-btn-texto"
                onClick={() => {
                  setMostrandoSugestao(false);
                  setTextoSugestao("");
                }}
              >
                Cancelar
              </button>
            </div>
          )}
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
          {/* "Fechar o app" saiu a pedido da dona (03/09). Ele existia
              para o caso de o app instalado não ter botão de fechar — mas
              quem quer fechar já fecha pelo gesto do celular, e o item
              gastava uma linha do menu para ensinar o que o sistema já
              ensina. */}
        </div>
        {sugestaoEnviada && (
          <p className="ei-apoio ei-margem" style={{ marginTop: 8 }}>
            Sugestão enviada. Obrigado!
          </p>
        )}

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
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}

        {/* ── O SUPORTE VIROU BOTÃO — 03/09 ────────────────────────────
            A dona: "virar um botão de suporte dentro da conta."

            Ele era mais uma linha no meio de cinco iguais — mesmo tamanho
            de letra, mesmo ícone cinza que "Como funciona" e "Termos de
            Uso". Quem está travado não lê uma lista: procura uma coisa
            para tocar. Um botão de largura cheia, no alto da Ajuda e antes
            das linhas, é o que se acha sem ler.

            A conversa abre já escrita — "como eu explico isso" é onde a
            maioria desiste de pedir ajuda. */}
        <div className="ei-margem" style={{ padding: "12px 20px 4px" }}>
          <a
            className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
            href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
              "Oi! Preciso de ajuda com o Ei Emprego."
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {/* O ícone com tamanho fixo: solto dentro de um flex ele
                esticou para 212px de altura na primeira tentativa — um SVG
                sem largura declarada cresce até onde deixarem. */}
            <span style={{ display: "grid", placeItems: "center", width: 20, height: 20, flex: "none" }}>
              <IconeConversa />
            </span>
            Falar com o suporte
          </a>
        </div>


        <button
          className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
          style={{ marginTop: 28 }}
          onClick={async () => {
            /* A dona: "ter botão de sair da conta, daí desloga e volta a
               tela de login." `location.href` e não o roteador — mesma
               razão do "Entrar em outra conta" da ExigirDesbloqueio: o
               app tem telas já montadas com dados desta conta, e só um
               recarregamento completo garante que nenhuma continue de
               pé mostrando o que era de quem acabou de sair. */
            try {
              await signOut();
            } catch {
              /* Seguir para o login é melhor que travar aqui: lá dá
                 para tentar de novo. */
            }
            window.location.href = "/login";
          }}
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

        {/* ── A VERSÃO QUE ESTE APARELHO ESTÁ RODANDO ─────────────────────
            A dona, três vezes: "as alterações não estão chegando no app."

            Ela estava certa, e a causa era o service worker guardando a
            versão de antes (ver vite.config.ts). Mas houve dias em que a
            versão ESTAVA no ar e o problema era outro — e nós dois não
            tínhamos como distinguir os dois casos.

            Este carimbo resolve isso num print: é a data e a hora em que a
            build que está rodando NESTE aparelho foi feita. Se ele estiver
            velho, o app não atualizou; se estiver de agora, o defeito é
            outro e a conversa começa do lugar certo.

            Fica no fim da Conta, pequeno e cinza: não é para ser lido todo
            dia, é para ser encontrado quando alguém perguntar. */}
        <p
          className="ei-apoio ei-margem"
          style={{ textAlign: "center", marginTop: 28, fontSize: "0.78rem" }}
        >
          Versão de {__VERSAO__}
        </p>

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
              {/* A dona: "criar situação para exclusão de conta, reembolso...
                  quero criar um sistema sustentavel que não precise da minha
                  intervenção." Isto era um pedido para cancelar por fora,
                  na mão, antes de apagar — hoje o `delete-account` já
                  cancela (e reembolsa, se dentro dos 7 dias) sozinho, então
                  o aviso não pode continuar pedindo o que não é mais
                  preciso fazer. O plano de empresa é a exceção verdadeira:
                  ele ainda é cobrado por fora do app, por isso continua
                  precisando do suporte. */}
              <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
                Assinatura de profissional (selo ou impulso) ativa é cancelada — e
                reembolsada, se ainda dentro dos 7 dias de arrependimento — automaticamente.
                Plano de empresa é cobrado à parte: para cancelar o seu, fale com o suporte.
              </p>

              <label style={{ display: "grid", gap: 6, fontSize: "0.88rem" }}>
                Para confirmar, escreva <strong>EXCLUIR</strong> abaixo:
                <input
                  value={textoConfirmacao}
                  onChange={(e) => setTextoConfirmacao(e.target.value.toUpperCase())}
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

function IconeAjuda() {
  return (
    <svg {...traco}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M9.2 9.5a2.8 2.8 0 1 1 4.3 2.4c-.9.6-1.5 1.1-1.5 2.3" />
      <circle cx="12" cy="17.3" r="0.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeLampada() {
  return (
    <svg {...traco}>
      <path d="M9 18.5h6" />
      <path d="M8.2 15.5a6 6 0 1 1 7.6 0c-.7.6-1.2 1.4-1.2 2.5H9.4c0-1.1-.5-1.9-1.2-2.5z" />
      <path d="M12 2.5v1.6M4.2 6.7l1.3 1M19.8 6.7l-1.3 1" />
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

function IconeCoracao() {
  return (
    <svg {...traco}>
      <path d="M12 20.3s-7.5-4.6-7.5-9.6a4.3 4.3 0 0 1 7.5-2.9 4.3 4.3 0 0 1 7.5 2.9c0 5-7.5 9.6-7.5 9.6z" />
    </svg>
  );
}
