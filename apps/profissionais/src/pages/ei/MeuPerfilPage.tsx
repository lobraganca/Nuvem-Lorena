import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import { formatPhone, doFormatoDoBanco } from "../../lib/phone";
import { Switch } from "../../components/ei/Switch";
import { CampoTelefone } from "../../components/ei/CampoTelefone";
import { Pagina } from "../../components/ei/Pagina";
import { Etapas } from "../../components/ei/Etapas";
import { CATEGORIES, MAX_FUNCOES } from "../../types/domain";
import { sendSuggestion } from "../../lib/suggestions";
import {
  lerMeuPerfil,
  salvarMeuPerfil,
  lerCursos,
  salvarCursos,
  PERFIL_VAZIO,
  type MeuPerfil,
} from "../../lib/meuPerfil";
import { lerExperiencias, salvarExperiencias } from "../../lib/experiencias";
import { numeroJaConfirmadoNaConta, marcarAnuncioConfirmado } from "../../lib/whatsappVerify";

/**
 * O perfil de quem procura trabalho.
 *
 * Tela nova, escrita do zero no desenho do Ei — não é o CadastroPage do
 * procurô repintado. Aquele existe para montar uma VITRINE: foto grande,
 * texto de venda, lista de serviços, selo, destaque pago. Aqui a pergunta é
 * outra: "para que trabalho posso te chamar, e você está disponível?".
 *
 * A ordem das partes segue o que decide se a pessoa termina o cadastro:
 *
 *   1. Disponível — o estado que muda toda semana, então fica no topo, onde
 *      se troca sem rolar nada.
 *   2. Funções — o que faz a vaga chegar. Sem isto, nada mais importa.
 *   3. Contato — curto.
 *   4. Experiências e cursos — opcionais, recolhidos.
 *
 * O procurô pedia o inverso: foto e texto de apresentação primeiro, e o que
 * a pessoa faz lá pelo meio.
 *
 * ── Esta tela era uma MAQUETE ─────────────────────────────────────────
 *
 * Até aqui ela desenhava tudo isso e não gravava nada: o botão "Salvar"
 * não tinha `onClick`, o arquivo não importava o banco, e recarregar a
 * página zerava o que a pessoa tinha marcado. Parecia funcionar, que é o
 * pior estado possível — e era a tela de que todo o resto depende, porque
 * é `areas_de_interesse` que a onda consulta para achar quem avisar.
 */
type Experiencia = { empresa: string; cargo: string; inicio: string; fim: string };
type Curso = { nome: string; instituicao: string; ano: string };

export function MeuPerfilPage() {
  useTituloDaPagina("Meu perfil");
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [perfil, setPerfil] = useState<MeuPerfil>(PERFIL_VAZIO);
  const [experiencias, setExperiencias] = useState<Experiencia[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  /* O aviso de que salvou. Sem ele a pessoa toca em Salvar, nada muda na
     tela, e ela não sabe se deu certo — numa tela em que o que está em
     jogo é a chance de ser chamada para trabalhar. */
  const [salvo, setSalvo] = useState(false);

  /* ── O CADASTRO EM ETAPAS ─────────────────────────────────────────────
     A dona: "o cadastro do usuário, pode ser por etapa, acho que fica mais
     fácil de visualização."

     Esta tela tem 3.900px de altura: cinco seções, cinquenta campos e um
     Salvar lá no fim. Para quem já tem cadastro e veio trocar o bairro,
     isso é o certo — a pessoa rola até o campo e mexe. Para quem está
     preenchendo pela PRIMEIRA vez, é uma parede: não dá para ver quanto
     falta, não há onde parar, e a única confirmação de que valeu a pena
     está a quatro telas de distância.

     Então: quem ainda NÃO tem cadastro vê uma seção por vez, com a barra
     de passos em cima. Quem já tem continua vendo a tela inteira. É a
     mesma tela, e o que muda é só quanto dela aparece de cada vez.

     E isto finalmente cumpre o "Passo 1 de 4" que a tela de entrar na
     conta promete desde sempre: lá é o passo 1, aqui são o 2, o 3 e o 4.
     Até agora os passos 2 a 4 não existiam — a promessa quebrava na
     primeira tela depois dela. */
  const [etapa, setEtapa] = useState(1);
  /** O número do cadastro é o mesmo que a conta já confirmou por SMS. */
  const [foneDaConta, setFoneDaConta] = useState(false);

  /* Cadastro novo é o que ainda não tem linha no banco. Depois do primeiro
     Salvar a tela vira a de edição sozinha, que é o que a pessoa espera:
     ela terminou o cadastro, agora está mexendo nele. */
  const emEtapas = !perfil.id;

  /* O nome do passo tem que casar com o que está NA TELA. "O que você
     faz" anunciava um passo que abre em "Seus dados" — pequeno, mas é o
     tipo de desencontro que faz a pessoa achar que pulou alguma coisa. */
  const ETAPAS = [
    "Você e o que faz",
    "Sua experiência",
    "Quando receber vaga",
  ];

  /** Esta seção aparece agora? Fora do modo de etapas, todas aparecem. */
  const mostra = (n: number) => !emEtapas || etapa === n;

  const { disponivel, oculto, funcoes } = perfil;
  const setDisponivel = (v: boolean) => setPerfil((p) => ({ ...p, disponivel: v }));
  const setOculto = (v: boolean) => setPerfil((p) => ({ ...p, oculto: v }));
  const setFuncoes = (f: (a: string[]) => string[]) =>
    setPerfil((p) => ({ ...p, funcoes: f(p.funcoes) }));

  useEffect(() => {
    if (carregandoConta) return;
    if (!user) {
      navegar("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const meu = await lerMeuPerfil(user.id);
        if (meu) {
          setPerfil(meu);
          if (meu.id) {
            /* As duas listas juntas: uma falha em qualquer uma derruba as
               duas, e é isso que se quer — meia tela carregada é a que faz
               a pessoa salvar por cima do que não apareceu. */
            const [exps, curs] = await Promise.all([
              lerExperiencias(meu.id),
              lerCursos(meu.id),
            ]);
            setExperiencias(
              exps.map((e) => ({
                cargo: e.cargo,
                empresa: e.onde ?? "",
                /* O banco guarda um período em texto livre ("de 2019 a
                   2022"); a tela tem dois campos. Na volta, o que não dá
                   para separar vai inteiro no "começou" — melhor mostrar
                   torto do que sumir com o que a pessoa escreveu. */
                inicio: e.periodo ?? "",
                fim: "",
              }))
            );
            setCursos(curs);
          }
        } else {
          /* Sem cadastro ainda: o telefone da conta já entra preenchido.
             É o dado que a pessoa acabou de confirmar por SMS, e pedir de
             novo é o tipo de atrito que faz desistir no primeiro campo. */
          /* O telefone da conta vem do Auth em formato internacional e sem
             pontuação — "5531988224938". Jogado cru no campo, é o que a
             dona viu na tela: um número que ninguém reconhece como o seu.
             `doFormatoDoBanco` tira o 55 e `formatPhone` escreve como se
             lê aqui: (31) 98822-4938. */
          setPerfil({
            ...PERFIL_VAZIO,
            phone: formatPhone(doFormatoDoBanco(user.phone)),
            email: user.email ?? "",
          });
        }
      } catch (err) {
        setErro(mensagemDeErro(err, "Não consegui carregar o seu perfil."));
      } finally {
        setCarregando(false);
      }
    })();
  }, [user, carregandoConta, navegar]);

  /* ── O TELEFONE DO LOGIN JÁ VEM CONFIRMADO ──────────────────────────
     A dona: "quando o celular confirma na entrada ele fica como confirmado
     no cadastro."

     Está certíssimo, e antes não era assim: quem entrava por SMS — ou
     seja, todo mundo — chegava no cadastro com o mesmo número e um selo
     "Falta confirmar" do lado. O atalho existia, mas exigia um toque em
     "Confirmar este número", e recusar o salvamento por causa dele era
     pedir a mesma prova duas vezes.

     Agora a tela pergunta ao Auth, na abertura, se o número do cadastro é
     o número já confirmado da conta. Se for, o selo fica verde na hora, e
     o carimbo no banco acontece sozinho no primeiro salvamento. */
  useEffect(() => {
    if (!perfil.phone) return;
    let vivo = true;
    numeroJaConfirmadoNaConta(perfil.phone).then((sim) => {
      if (vivo) setFoneDaConta(sim);
    });
    return () => { vivo = false; };
  }, [perfil.phone]);

  async function salvar() {
    if (!user) return;

    /* A confirmação é campo obrigatório, e o botão trata como tal.
       ────────────────────────────────────────────────────────────
       Antes ela era um aviso no topo que dava para ignorar: a pessoa
       preenchia tudo, salvava, e só então descobria que o cadastro não
       valia. Recusar aqui é o mesmo que o formulário faz com o nome em
       branco — e o texto aponta para ONDE resolver, que é a diferença
       entre uma recusa e um beco.

       Não se perde nada do que foi digitado: continua tudo na tela, e o
       próprio botão de confirmar grava o cadastro ao ser usado. */
    if (!perfil.confirmado && !foneDaConta) {
      setSalvo(false);
      setErro(
        "Falta confirmar o telefone. Toque em “Confirmar este número”, ali em cima, " +
          "no campo do telefone."
      );
      return;
    }

    setSalvando(true);
    setErro("");
    setSalvo(false);
    try {
      const id = await salvarMeuPerfil(user.id, perfil);
      setPerfil((p) => ({ ...p, id }));

      /* O carimbo do telefone, para quem entrou por SMS com este mesmo
         número. Só dá para fazer aqui: a função do banco compara o número
         do CADASTRO com o da conta, e o cadastro acabou de existir.
         Falhar aqui não derruba o salvamento — o perfil já está gravado, e
         o campo continua oferecendo a confirmação manual. */
      if (foneDaConta && !perfil.confirmado) {
        try {
          await marcarAnuncioConfirmado(id);
          setPerfil((p) => ({ ...p, confirmado: true }));
        } catch {
          /* silêncio proposital: ver comentário acima */
        }
      }
      await Promise.all([
        salvarExperiencias(
          id,
          experiencias.map((e) => ({
            cargo: e.cargo,
            onde: e.empresa,
            periodo: [e.inicio, e.fim].filter(Boolean).join(" a "),
          }))
        ),
        salvarCursos(id, cursos),
      ]);
      setSalvo(true);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui salvar o seu perfil."));
    } finally {
      setSalvando(false);
    }
  }

  const cheio = funcoes.length >= MAX_FUNCOES;

  function alternar(f: string) {
    setFuncoes((atual) =>
      atual.includes(f) ? atual.filter((x) => x !== f) : cheio ? atual : [...atual, f]
    );
  }

  /* A lista inteira é longa demais para rolar atrás de uma função, e curta
     demais para justificar abrir outra tela. O campo de procurar resolve os
     dois: quem sabe o nome digita, quem não sabe rola. */
  const visiveis = busca.trim()
    ? CATEGORIES.filter((c) => c.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")))
    : CATEGORIES;

  /* ── ESCREVER A PRÓPRIA FUNÇÃO ────────────────────────────────────────
     A dona: "do jeito que está a pessoa tem que procurar e pode ser que a
     função dela não esteja na lista."

     Está certo, e o beco era completo: o campo só FILTRAVA a lista. Quem
     faz soldagem de tubulação, ou opera empilhadeira, digitava, não achava
     nada, e a tela não oferecia saída nenhuma — nem um "não achou?", nem
     um caminho. A pessoa conclui que o app não é para ela.

     ── E POR QUE A FUNÇÃO ESCRITA VEM MARCADA ──────────────────────────
     Porque senão isto vira a pior classe de defeito deste projeto: o que
     parece funcionar.

     A onda que avisa das vagas cruza o que a pessoa marcou com a profissão
     que a EMPRESA escolheu — e a empresa escolhe de uma lista fechada
     (`CATEGORIES`, no formulário da vaga). Duas listas que não se
     encontram: uma função escrita à mão nunca cruza com nada. A pessoa
     escreveria "Soldador", veria salvo, e esperaria para sempre por uma
     vaga que jamais chega. Ninguém reclama de vaga que não chegou.

     Então a função escrita entra no cadastro — ela aparece no perfil, e a
     empresa que procura na lista de profissionais lê —, mas a tela DIZ que
     por ela a vaga ainda não chega, e o que foi escrito é mandado para a
     administração como pedido de função nova. É assim que a lista cresce
     com o que as pessoas de verdade fazem, em vez de com o que se
     imaginou. */
  const escrita = busca.trim();
  const jaExisteNaLista = CATEGORIES.some(
    (c) => c.toLocaleLowerCase("pt-BR") === escrita.toLocaleLowerCase("pt-BR")
  );
  const jaMarcada = funcoes.some(
    (f) => f.toLocaleLowerCase("pt-BR") === escrita.toLocaleLowerCase("pt-BR")
  );
  /* Duas letras é curto demais para ser função e é o que sobra quando a
     pessoa está no meio de digitar. */
  const podeCriar = escrita.length >= 3 && !jaExisteNaLista && !jaMarcada && !cheio;

  /** A função não está na lista fechada — logo, não recebe onda ainda. */
  const foraDaLista = (f: string) => !CATEGORIES.includes(f);

  async function criarFuncao() {
    const nome = escrita;
    if (!nome) return;
    alternar(nome);
    setBusca("");
    /* Avisa a administração, para a lista crescer. Falha aqui não pode
       derrubar nada: a função já está no cadastro da pessoa, que é o que
       ela pediu. O pedido perdido é menos grave que a tela travada. */
    try {
      await sendSuggestion(`Função que faltava na lista: "${nome}"`, user?.id ?? null);
    } catch {
      /* segue em frente de propósito */
    }
  }

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
        {/* Era a única tela principal sem o cabeçalho de página — sem
            migalha, sem ícone, e com o título centralizado enquanto todas
            as outras alinham à esquerda. */}
        <Pagina titulo={emEtapas ? "Seu cadastro" : "Meu perfil"} />
        <p className="ei-apoio ei-margem" style={{ paddingBottom: 6 }}>
          {emEtapas
            ? "Três passos. Dá para mudar tudo depois."
            : "É por ele que as vagas chegam até você."}
        </p>

        {/* A trilha em cartões, a mesma do cadastro da empresa. Era uma
            barrinha de 4px preenchida pela metade: ela informava o
            progresso e não dizia o NOME do que vinha. A dona pediu os dois
            cadastros iguais, "em cards por etapas". */}
        {emEtapas && <Etapas passos={ETAPAS} atual={etapa} />}

        {/* ── 0. Quem é você ───────────────────────────────────────────
            Nome, telefone e e-mail, que a dona pediu por escrito e não
            existiam nesta tela. O nome é o que a empresa lê primeiro; o
            telefone é como ela chama. Sem os dois, o cadastro não serve
            para nada — por isso vêm antes de tudo. */}
        {mostra(1) && (
        <>
        <h2 className="ei-secao">Seus dados</h2>
        <div className="ei-cartao" style={{ display: "grid", gap: 12 }}>
          <div className="ei-campo">
            <label htmlFor="meu-nome">Nome</label>
            <input
              id="meu-nome"
              value={perfil.name}
              placeholder="Como a empresa vai te chamar"
              maxLength={80}
              onChange={(e) => setPerfil((x) => ({ ...x, name: e.target.value }))}
            />
          </div>
          {/* O telefone NÃO é um campo com um aviso ao lado: ele é o
              lugar onde a confirmação acontece. Ver CampoTelefone. */}
          <CampoTelefone
            valor={perfil.phone}
            confirmado={perfil.confirmado || foneDaConta}
            onChange={(v) => setPerfil((x) => ({ ...x, phone: v, confirmado: false }))}
            onConfirmado={(id) => setPerfil((x) => ({ ...x, id, confirmado: true }))}
            aoPrecisarSalvar={async () => {
              if (!user) throw new Error("Entre na sua conta para confirmar.");
              /* Salva sempre, e não só quando falta id: a função do banco
                 compara o número do CADASTRO com o da conta, e o número
                 que a pessoa acabou de digitar ainda não chegou lá. Sem
                 isto, corrigir o telefone e confirmar dava "o número
                 confirmado é diferente do que está no anúncio" — sobre um
                 número que ela tinha acabado de acertar. */
              const id = await salvarMeuPerfil(user.id, perfil);
              setPerfil((x) => ({ ...x, id }));
              return id;
            }}
          />
          <div className="ei-campo">
            <label htmlFor="meu-email">E-mail</label>
            <input
              id="meu-email"
              type="email"
              inputMode="email"
              value={perfil.email}
              placeholder="opcional"
              onChange={(e) => setPerfil((x) => ({ ...x, email: e.target.value }))}
            />
          </div>
          <div className="ei-campo">
            <label htmlFor="meu-bairro">Bairro</label>
            <input
              id="meu-bairro"
              value={perfil.neighborhood}
              placeholder="Centro"
              maxLength={60}
              onChange={(e) => setPerfil((x) => ({ ...x, neighborhood: e.target.value }))}
            />
          </div>
        </div>

        {/* ── 1. Disponível ────────────────────────────────────────────
            No topo porque é o que muda toda semana. Quem arrumou emprego
            precisa desligar em dois toques, sem procurar. */}
        {/* As duas chaves não tinham título de seção nenhum: ficavam soltas
            entre "Seus dados" e "O que você aceita fazer", sem dizer do que
            tratavam. Num app em que toda seção se anuncia, a que não se
            anuncia parece sobra da seção anterior. */}
        </>
        )}

        {mostra(3) && (
        <>
        <h2 className="ei-secao">Quando você quer receber vaga</h2>
        <div className="ei-lista">
          <div className="ei-cartao" style={{ padding: 0 }}>
            <Switch
              ligado={disponivel}
              onChange={setDisponivel}
              titulo={disponivel ? "Estou disponível" : "Não estou disponível"}
              descricao={
                disponivel
                  ? "Você recebe as vagas que combinam com você."
                  : "Você não recebe vaga nenhuma até ligar de novo."
              }
            />
          </div>

          <div className="ei-cartao" style={{ padding: 0 }}>
            <Switch
              ligado={oculto}
              onChange={setOculto}
              desabilitado={!disponivel}
              titulo="Não aparecer na lista"
              /* O texto muda com o estado porque a consequência é
                 diferente, e é ela que a pessoa precisa entender — não o
                 nome da opção. */
              descricao={
                oculto
                  ? "As empresas não te encontram procurando. Você continua recebendo as vagas."
                  : "Hoje as empresas podem te encontrar procurando na lista."
              }
            />
          </div>

          {/* Este é o motivo de a opção existir, e dizê-lo evita a pergunta
              "por que eu esconderia meu perfil?".

              Fica DENTRO do grupo branco, e não solto no chão cinza depois
              dele: é a explicação da chave logo acima, e fora do grupo
              parecia um aviso avulso, sem dono. */}
          <p className="ei-apoio" style={{ margin: 0, padding: "0 20px 14px" }}>
            Quem está empregado e não quer ser encontrado pelo patrão pode se
            esconder da lista e continuar recebendo vaga.
          </p>
        </div>

        </>
        )}

        {/* ── 2. Funções ───────────────────────────────────────────────── */}
        {mostra(1) && (
        <>
        <h2 className="ei-secao">O que você aceita fazer</h2>
        <div className="ei-cartao">
          <p className="ei-apoio" style={{ marginBottom: 12 }}>
            Escolha até {MAX_FUNCOES}. É por aqui que a vaga te encontra —{" "}
            <strong>{funcoes.length} de {MAX_FUNCOES}</strong> marcadas.
          </p>

          <div className="ei-campo" style={{ marginBottom: 12 }}>
            {/* "ou escrever" no rótulo, e não só "procurar": era a tela
                inteira dizendo que a única coisa possível ali era achar o
                que já existe. */}
            <input
              type="search"
              placeholder="Procurar ou escrever sua função"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Procurar ou escrever sua função"
              onKeyDown={(e) => {
                if (e.key === "Enter" && podeCriar) {
                  e.preventDefault();
                  criarFuncao();
                }
              }}
            />
          </div>

          {/* A saída para quem não achou. Aparece assim que o que foi
              digitado não existe na lista — antes de a pessoa desistir. */}
          {podeCriar && (
            <button
              type="button"
              className="ei-btn ei-btn-contorno ei-btn-largo"
              style={{ marginBottom: 12 }}
              onClick={criarFuncao}
            >
              Adicionar “{escrita}”
            </button>
          )}

          {escrita.length >= 3 && visiveis.length === 0 && !podeCriar && jaMarcada && (
            <p className="ei-apoio" style={{ marginBottom: 12 }}>
              “{escrita}” já está nas suas funções.
            </p>
          )}

          {/* As marcadas sobem para o topo: com oito escolhidas no meio de
              oitenta, a pessoa perde de vista o que já marcou. */}
          {funcoes.length > 0 && (
            <div className="ei-chips" style={{ marginBottom: 12 }}>
              {funcoes.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={foraDaLista(f) ? "ei-chip ei-chip-nova" : "ei-chip"}
                  aria-pressed={true}
                  onClick={() => alternar(f)}
                  title={
                    foraDaLista(f)
                      ? "Função escrita por você — ainda não recebe vaga por ela"
                      : undefined
                  }
                >
                  {f} <span aria-hidden="true">✕</span>
                </button>
              ))}
            </div>
          )}

          {/* A altura fixa cortava a última fileira NO MEIO, e um bloco que
              termina em meia etiqueta parece tela quebrada, não lista que
              rola. 232px fecham em fileira inteira, e o fio de baixo diz
              que há mais para rolar. */}
          <div className="ei-chips ei-chips-rolagem">
            {visiveis
              .filter((c) => !funcoes.includes(c))
              .map((c) => (
                <button
                  key={c}
                  type="button"
                  className="ei-chip"
                  aria-pressed={false}
                  disabled={cheio}
                  onClick={() => alternar(c)}
                >
                  {c}
                </button>
              ))}
          </div>

          {/* O aviso que impede a mentira calma. Ver o comentário de
              `criarFuncao`: a onda cruza o que a pessoa marcou com a
              profissão que a EMPRESA escolheu de uma lista fechada, então
              função escrita à mão não cruza com nada — e sem esta linha a
              pessoa esperaria para sempre uma vaga que não vem. */}
          {funcoes.some(foraDaLista) && (
            <p className="ei-apoio" style={{ marginTop: 10 }}>
              As funções com <strong>+</strong> foram escritas por você. Elas
              aparecem no seu perfil para quem procurar, mas a vaga ainda não
              chega por elas — mandamos para a gente incluir na lista.
            </p>
          )}

          {cheio && (
            <p className="ei-apoio" style={{ marginTop: 10 }}>
              Você marcou as {MAX_FUNCOES}. Tire uma para pôr outra.
            </p>
          )}
        </div>

        </>
        )}

        {/* ── 3. Experiências ──────────────────────────────────────────── */}
        {mostra(2) && (
        <>
        <h2 className="ei-secao">Onde você já trabalhou</h2>
        <div className="ei-cartao">
          {experiencias.length === 0 && (
            <p className="ei-apoio" style={{ marginBottom: 12 }}>
              Opcional. Empresas costumam chamar antes quem já fez o serviço.
            </p>
          )}

          <div style={{ display: "grid", gap: 16 }}>
            {experiencias.map((exp, i) => (
              <div key={i} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="ei-apoio">{i + 1}ª experiência</span>
                  <button
                    type="button"
                    className="ei-btn ei-btn-texto"
                    style={{ minHeight: 0, padding: "0 4px" }}
                    onClick={() => setExperiencias((a) => a.filter((_, j) => j !== i))}
                  >
                    Tirar
                  </button>
                </div>

                <div className="ei-campo">
                  <label htmlFor={`empresa-${i}`}>Empresa</label>
                  <input
                    id={`empresa-${i}`}
                    value={exp.empresa}
                    placeholder="Construções Silva"
                    onChange={(e) =>
                      setExperiencias((a) =>
                        a.map((x, j) => (j === i ? { ...x, empresa: e.target.value } : x))
                      )
                    }
                  />
                </div>

                <div className="ei-campo">
                  <label htmlFor={`cargo-${i}`}>O que você fazia</label>
                  <input
                    id={`cargo-${i}`}
                    value={exp.cargo}
                    placeholder="Ajudante de pedreiro"
                    onChange={(e) =>
                      setExperiencias((a) =>
                        a.map((x, j) => (j === i ? { ...x, cargo: e.target.value } : x))
                      )
                    }
                  />
                </div>

                {/* Mês e ano, não dia: ninguém lembra o dia em que começou
                    num emprego de cinco anos atrás, e pedir o dia faz a
                    pessoa inventar ou desistir. */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="ei-campo">
                    <label htmlFor={`inicio-${i}`}>Começou</label>
                    <input
                      id={`inicio-${i}`}
                      type="month"
                      value={exp.inicio}
                      onChange={(e) =>
                        setExperiencias((a) =>
                          a.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="ei-campo">
                    <label htmlFor={`fim-${i}`}>Saiu</label>
                    <input
                      id={`fim-${i}`}
                      type="month"
                      value={exp.fim}
                      onChange={(e) =>
                        setExperiencias((a) =>
                          a.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x))
                        )
                      }
                    />
                    <span className="ei-campo-ajuda">Vazio = ainda trabalho lá</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="ei-btn ei-btn-tonal ei-btn-largo"
            style={{ marginTop: experiencias.length ? 16 : 0 }}
            onClick={() =>
              setExperiencias((a) => [...a, { empresa: "", cargo: "", inicio: "", fim: "" }])
            }
          >
            + {experiencias.length ? "Outra experiência" : "Acrescentar experiência"}
          </button>
        </div>

        {/* ── 4. Cursos ────────────────────────────────────────────────── */}
        <h2 className="ei-secao">Cursos e especializações</h2>
        <div className="ei-cartao">
          {cursos.length === 0 && (
            <p className="ei-apoio" style={{ marginBottom: 12 }}>
              NR-35, curso técnico, CNH categoria D — o que te habilita a alguma vaga.
            </p>
          )}

          <div style={{ display: "grid", gap: 16 }}>
            {cursos.map((c, i) => (
              <div key={i} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="ei-apoio">{i + 1}º curso</span>
                  <button
                    type="button"
                    className="ei-btn ei-btn-texto"
                    style={{ minHeight: 0, padding: "0 4px" }}
                    onClick={() => setCursos((a) => a.filter((_, j) => j !== i))}
                  >
                    Tirar
                  </button>
                </div>
                <div className="ei-campo">
                  <label htmlFor={`curso-${i}`}>Curso</label>
                  <input
                    id={`curso-${i}`}
                    value={c.nome}
                    placeholder="NR-35 — trabalho em altura"
                    onChange={(e) =>
                      setCursos((a) => a.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))
                    }
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: 8 }}>
                  <div className="ei-campo">
                    <label htmlFor={`inst-${i}`}>Onde fez</label>
                    <input
                      id={`inst-${i}`}
                      value={c.instituicao}
                      placeholder="SENAI"
                      onChange={(e) =>
                        setCursos((a) =>
                          a.map((x, j) => (j === i ? { ...x, instituicao: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="ei-campo">
                    <label htmlFor={`ano-${i}`}>Ano</label>
                    <input
                      id={`ano-${i}`}
                      inputMode="numeric"
                      maxLength={4}
                      value={c.ano}
                      placeholder="2021"
                      onChange={(e) =>
                        setCursos((a) => a.map((x, j) => (j === i ? { ...x, ano: e.target.value } : x)))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="ei-btn ei-btn-tonal ei-btn-largo"
            style={{ marginTop: cursos.length ? 16 : 0 }}
            onClick={() => setCursos((a) => [...a, { nome: "", instituicao: "", ano: "" }])}
          >
            + {cursos.length ? "Outro curso" : "Acrescentar curso"}
          </button>
        </div>

        </>
        )}

        {/* O aviso de que deu certo, e o de que não deu.
            ───────────────────────────────────────────────
            O botão não tinha ação nenhuma; agora tem, e avisa nos dois
            casos. Salvar em silêncio numa tela em que o que está em jogo é
            a chance de ser chamada para trabalhar faz a pessoa tocar de
            novo, e depois desconfiar do app inteiro. */}
        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
            {erro}
          </p>
        )}
        {salvo && !erro && (
          <div className="ei-callout" style={{ marginTop: 16 }}>
            <span className="ei-callout-texto">
              <strong>Perfil salvo.</strong>{" "}
              {funcoes.length === 0
                ? "Marque ao menos uma função para começar a receber vaga."
                : oculto
                  ? "Você não aparece na lista, mas continua recebendo vaga."
                  : "As vagas do seu ofício vão chegar aqui."}
            </span>
          </div>
        )}

        {/* O pé da tela.
            ─────────────
            Em etapas ele é "Voltar / Continuar", e só o ÚLTIMO passo
            salva. Salvar no meio do caminho gravaria um cadastro pela
            metade — e, pior, o aviso de "perfil salvo" apareceria antes de
            a pessoa ter dito o que faz.

            O passo da experiência tem "Pular": ele é opcional por
            definição, e um passo obrigatório que não tem resposta é onde
            se perde quem está começando agora. */}
        <div className="ei-margem ei-pe-etapas">
          {emEtapas ? (
            <>
              {etapa < 3 ? (
                <button
                  type="button"
                  className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                  onClick={() => setEtapa((n) => n + 1)}
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="button"
                  className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                  disabled={salvando}
                  onClick={salvar}
                >
                  {salvando ? "Salvando…" : "Terminar cadastro"}
                </button>
              )}

              {etapa === 2 && (
                <button
                  type="button"
                  className="ei-btn ei-btn-texto ei-btn-largo"
                  onClick={() => setEtapa(3)}
                >
                  Pular por enquanto
                </button>
              )}

              {etapa > 1 && (
                <button
                  type="button"
                  className="ei-btn ei-btn-texto ei-btn-largo"
                  onClick={() => setEtapa((n) => n - 1)}
                >
                  Voltar
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
              disabled={salvando}
              onClick={salvar}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
