import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";
import { formatPhone, doFormatoDoBanco, onlyPhoneDigits } from "../../lib/phone";
import { Switch } from "../../components/ei/Switch";
import { ListaEmCartoes } from "../../components/ei/ListaEmCartoes";
import { CampoTelefone } from "../../components/ei/CampoTelefone";
import { Pagina, Callout } from "../../components/ei/Pagina";
import { AjustarFoto } from "../../components/ei/AjustarFoto";
import { uploadProfessionalPhoto } from "../../lib/storage";
import { CATEGORIES, MAX_FUNCOES, DISPONIBILIDADE, PERIODOS_DE_SALARIO } from "../../types/domain";
import { sendSuggestion } from "../../lib/suggestions";
import {
  lerMeuPerfil,
  escolherCadastro,
  salvarMeuPerfil,
  lerCursos,
  salvarCursos,
  lerCompetencias,
  salvarCompetencias,
  definirCadastroAtivo,
  PERFIL_VAZIO,
  type MeuPerfil,
  type CursoEmEdicao,
  type CompetenciaEmEdicao,
} from "../../lib/meuPerfil";
import { lerExperiencias, salvarExperiencias } from "../../lib/experiencias";
import { useRascunho, CHAVE_RASCUNHO_PROFISSIONAL } from "../../lib/rascunho";
import { quemViuMeuPerfil, type QuemViu } from "../../lib/quemMeViu";
import { numeroJaConfirmadoNaConta, marcarAnuncioConfirmado } from "../../lib/whatsappVerify";
/* Nome trocado no import: `lib/profiles.ts` e `lib/meuPerfil.ts` têm cada
   um a sua própria `salvarMeuPerfil`, gravando em tabelas diferentes
   (`profiles` e `professionals`) — os dois nomes iguais por coincidência
   de quem escreveu cada arquivo em dias diferentes. */
import { salvarMeuPerfil as sincronizarProfile } from "../../lib/profiles";

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
type Experiencia = {
  empresa: string;
  cargo: string;
  inicio: string;
  fim: string;
  /* O que estava escrito no banco quando a tela abriu, quando não dá para
     separar em duas datas ("de 2019 a 2022", "2 anos"). Ver
     `periodoParaCampos`: sem guardar isto, salvar de novo apagava o que a
     pessoa tinha escrito. */
  periodoLivre?: string;
};

/**
 * O período da experiência: um texto no banco, dois campos na tela.
 *
 * ── O defeito que isto conserta — 04/09 ───────────────────────────────
 *
 * A tela grava `periodo` como "2020-03 a 2022-01" e, ao reabrir, jogava a
 * string INTEIRA no campo "Começou" — que é um `input type="month"`. Um
 * campo de mês recusa valor que não seja "AAAA-MM" e aparece VAZIO: a
 * pessoa reabria o cadastro e as datas do emprego dela tinham sumido.
 *
 * E pior no segundo salvamento: com os dois campos vazios, o `periodo`
 * gravado virava "" — as datas sumiam do banco também. Uma pessoa que
 * corrigisse o telefone perdia as datas de todos os empregos.
 *
 * Foi encontrado no navegador, pelo aviso do próprio Chrome ("The
 * specified value '2 anos' does not conform to the required format"),
 * enquanto se olhava outra coisa.
 */
function periodoParaCampos(periodo: string): { inicio: string; fim: string; periodoLivre?: string } {
  const texto = (periodo ?? "").trim();
  if (!texto) return { inicio: "", fim: "" };

  const mes = /^\d{4}-\d{2}$/;
  const partes = texto.split(" a ").map((p) => p.trim());

  if (partes.length === 2 && mes.test(partes[0]) && mes.test(partes[1])) {
    return { inicio: partes[0], fim: partes[1] };
  }
  if (partes.length === 1 && mes.test(partes[0])) {
    return { inicio: partes[0], fim: "" };
  }

  /* Texto livre (cadastro antigo, ou alguém que escreveu "2 anos"): os
     campos de mês ficam vazios, porque não há mês nenhum ali — mas o
     texto é guardado e devolvido ao banco intacto se a pessoa não mexer
     nas datas. */
  return { inicio: "", fim: "", periodoLivre: texto };
}
/* O tipo local do curso saiu: agora ele é o `CursoEmEdicao` da lib, que
   ganhou `tipo`, `situacao` e `nivel` na 0104. Dois tipos com o mesmo
   nome e campos diferentes é como se perde uma coluna no caminho — foi o
   que aconteceu com a `disponivel` na 0101. */

/**
 * "maio de 2008 → hoje" — o período de uma experiência, em texto.
 *
 * O cartão precisa disso porque `input[type=month]` guarda "2008-05", que
 * não se lê. E "hoje" no lugar da saída em branco não é enfeite: é a
 * informação mais importante da linha, porque diz que a pessoa AINDA está
 * lá — que muda o que a empresa entende do cadastro inteiro.
 */
/** "Básico" / "Intermediário" / "Avançado", para o cartão. */
function nomeDoNivel(n: string): string {
  if (n === "avancado") return "Avançado";
  if (n === "intermediario") return "Intermediário";
  return "Básico";
}

function periodoDaExperiencia(e: { inicio: string; fim: string }): string | null {
  const mes = (v: string) => {
    if (!v) return "";
    /* Dia 15 e não dia 1: com fuso a oeste, o dia 1 às 00h vira o último
       dia do mês anterior, e "maio de 2008" apareceria como abril. */
    const d = new Date(`${v}-15T12:00:00`);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };
  const de = mes(e.inicio);
  const ate = mes(e.fim);
  if (!de && !ate) return null;
  if (de && !ate) return `${de} → hoje`;
  if (!de) return `até ${ate}`;
  return `${de} → ${ate}`;
}

export function MeuPerfilPage() {
  /* De onde a pessoa veio: "candidatura" quer dizer que ela tentou
     responder a uma vaga sem cadastro. */
  const [paramsDaUrl] = useSearchParams();
  const motivo = paramsDaUrl.get("motivo");
  useTituloDaPagina("Meu cadastro");
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [perfil, setPerfil] = useState<MeuPerfil>(PERFIL_VAZIO);
  const [experiencias, setExperiencias] = useState<Experiencia[]>([]);
  const [cursos, setCursos] = useState<CursoEmEdicao[]>([]);
  /* As competências, com nível (0104). A dona, no item 14: "Excel
     (básico | intermediário | avançado), informática, atendimento — ter
     campo + pra adicionar e metrificar". */
  const [competencias, setCompetencias] = useState<CompetenciaEmEdicao[]>([]);
  /* O nome ainda sendo digitado, antes de virar card — a dona: "ao
     adicionar, formar cards e ter opção de adicionar outras". */
  const [novaCompetencia, setNovaCompetencia] = useState("");
  /* O botão de ativar/inativar do pé da página. Grava sozinho, sem passar
     pelo "Salvar": é uma chave de sim ou não, e obrigar a salvar o
     formulário inteiro para desligar o cadastro faria quem só queria
     sumir da busca ter que revisar trinta campos antes. */
  const [alternandoAtivo, setAlternandoAtivo] = useState(false);
  /* As empresas que abriram este cadastro (0106). Quem procura trabalho
     passa semanas sem sinal nenhum e lê o silêncio como "não estou
     servindo para nada" — some do app calada. Isto é o primeiro sinal de
     que o app está funcionando para ela. */
  const [quemViu, setQuemViu] = useState<QuemViu[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  /* O aviso de que salvou. Sem ele a pessoa toca em Salvar, nada muda na
     tela, e ela não sabe se deu certo — numa tela em que o que está em
     jogo é a chance de ser chamada para trabalhar. */
  const [salvo, setSalvo] = useState(false);
  /* Se esta tela abriu SEM cadastro no banco, o salvamento é o primeiro —
     e o primeiro ganha a tela de "deu certo", com os caminhos. Editar um
     cadastro que já existe continua com o aviso na própria tela: uma tela
     de parabéns depois de corrigir o bairro seria comemoração de nada. */
  const [ehPrimeiroCadastro, setEhPrimeiroCadastro] = useState(false);

  /* ── O RASCUNHO DO CADASTRO ────────────────────────────────────────────
     Esta é a tela mais longa do app. Quem preenche pela primeira vez, no
     celular, quase sempre para no meio — para procurar o ano de um emprego
     antigo, o nome do curso, o telefone do trabalho anterior. Voltava e
     achava tudo em branco.

     Só vale para quem AINDA NÃO TEM cadastro no banco. Para quem já tem, o
     formulário é o retrato do que está gravado, e restaurar um rascunho de
     dias atrás por cima disso apagaria edição feita em outro aparelho — o
     rascunho passaria de rede de segurança a fonte de perda. */
  const [prontoParaGravar, setProntoParaGravar] = useState(false);
  const [avisoRascunho, setAvisoRascunho] = useState(false);
  const rascunho = useRascunho(
    CHAVE_RASCUNHO_PROFISSIONAL,
    { perfil, experiencias, cursos, competencias },
    1,
    prontoParaGravar
  );

  /* ── O CADASTRO ÚNICO ─────────────────────────────────────────────────
     Isto já foi um cadastro em três passos ("Você e o que faz" / "Sua
     experiência" / "Quando receber vaga"), pedido para quem estava
     preenchendo pela primeira vez. A dona voltou atrás: "o cadastro deve
     ser único, onde o profissional cadastra tudo de uma vez."

     E fazia sentido voltar: a passagem por `CompletarPerfil` (a tela
     "Falta pouco", que pede nome/e-mail/telefone/foto logo depois de
     entrar) já era um primeiro cadastro pela metade — e o de três passos
     era um SEGUNDO, pedindo nome, telefone e e-mail de novo no primeiro
     passo. Duas telas, duas vezes as mesmas perguntas, e só depois de
     tudo isso é que a pessoa chegava às funções e vagas. Uma tela só, com
     tudo dentro, é mais curta que a soma das duas. */
  /** O número do cadastro é o mesmo que a conta já confirmou por SMS. */
  const [foneDaConta, setFoneDaConta] = useState(false);
  /* A foto — que faltava aqui. Só existia na `CompletarPerfil`, gravando
     numa coluna (`profiles.avatar_url`) que a lista de talentos nem lê:
     `ProfissionaisPage` mostra `professionals.photo_url`. A foto enviada
     por ali nunca aparecia para ninguém. */
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [aEnquadrar, setAEnquadrar] = useState<File | null>(null);

  const { disponivel, oculto, funcoes } = perfil;
  /* Os quatro campos da 0101 seguem o mesmo padrão dos de cima: leitura
     por desestruturação, escrita por um `set` que mexe só naquele pedaço
     do perfil. */
  const { pretensao, pretensaoCombinar, disponibilidade, aceitaViajar } = perfil;
  const setPretensao = (v: string) => setPerfil((p) => ({ ...p, pretensao: v }));
  const setPretensaoCombinar = (v: boolean) =>
    setPerfil((p) => ({ ...p, pretensaoCombinar: v }));
  const setDisponibilidade = (f: (a: string[]) => string[]) =>
    setPerfil((p) => ({ ...p, disponibilidade: f(p.disponibilidade) }));
  const setAceitaViajar = (v: boolean) => setPerfil((p) => ({ ...p, aceitaViajar: v }));
  const setDisponivel = (v: boolean) => setPerfil((p) => ({ ...p, disponivel: v }));
  const setOculto = (v: boolean) => setPerfil((p) => ({ ...p, oculto: v }));
  const setFuncoes = (f: (a: string[]) => string[]) =>
    setPerfil((p) => ({ ...p, funcoes: f(p.funcoes) }));

  /**
   * Confirma o nome digitado e o transforma num card, com nível "Básico"
   * de partida — a pessoa ajusta o nível direto no card, sem precisar
   * escolher antes de adicionar.
   *
   * Repetido (mesmo nome, ignorando maiúscula) só limpa o campo: o banco
   * recusaria a repetida, e um erro aqui por causa de uma competência que
   * já está na lista confundiria mais do que ajudaria.
   */
  function adicionarCompetencia() {
    const nome = novaCompetencia.trim();
    if (!nome) return;
    const jaTem = competencias.some(
      (c) => c.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR")
    );
    if (!jaTem) setCompetencias((a) => [...a, { nome, nivel: "basico" }]);
    setNovaCompetencia("");
  }

  /**
   * "Salvar o que já preenchi", no pé de cada seção que acrescenta item.
   *
   * A dona: "todo lugar que tenha que adicionar algum dado, ter botão para
   * salvar, para depois adicionar outra."
   *
   * O cadastro tem um "Salvar" só, lá no fim de uma tela muito longa. Quem
   * acrescenta a terceira experiência não tem como saber se as duas
   * primeiras já estão guardadas — e a dúvida aparece justamente no meio
   * do preenchimento, quando ainda falta rolar meia tela até o botão.
   *
   * Grava o cadastro INTEIRO, e não só a seção: as listas são salvas em
   * bloco (`salvarExperiencias` troca a lista toda), e um salvamento
   * parcial gravaria a experiência nova por cima de um perfil que a tela
   * ainda tem em memória. O que muda é só o lugar do botão — e a frase,
   * que diz o que a pessoa quer ouvir antes de acrescentar a próxima.
   */
  function SalvarAqui() {
    return (
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className="ei-btn ei-btn-contorno ei-btn-largo"
          disabled={salvando}
          onClick={() => salvar({ irParaPronto: false })}
        >
          {salvando ? "Salvando…" : salvo ? "Salvo ✓" : "Salvar o que já preenchi"}
        </button>
      </div>
    );
  }

  /* Ativo = aparece na busca das empresas E recebe vaga. As duas chaves
     juntas, porque "inativar" quer dizer as duas — ver
     `definirCadastroAtivo`, em `lib/meuPerfil.ts`. */
  const ativo = perfil.disponivel && !perfil.oculto;

  async function alternarAtivo() {
    if (!perfil.id || alternandoAtivo) return;
    const novo = !ativo;
    setAlternandoAtivo(true);
    setErro("");
    try {
      await definirCadastroAtivo(perfil.id, novo);
      setPerfil((p) => ({ ...p, disponivel: novo, oculto: !novo }));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não consegui mudar o seu cadastro agora."));
    } finally {
      setAlternandoAtivo(false);
    }
  }

  useEffect(() => {
    if (carregandoConta) return;
    if (!user) {
      navegar("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const meu = await lerMeuPerfil(user.id);
        setEhPrimeiroCadastro(!meu);
        if (meu) {
          setPerfil(meu);
          if (meu.id) {
            /* As duas listas juntas: uma falha em qualquer uma derruba as
               duas, e é isso que se quer — meia tela carregada é a que faz
               a pessoa salvar por cima do que não apareceu. */
            /* As três listas juntas: uma falha em qualquer uma derruba as
               outras, e é isso que se quer — meia tela carregada é a que
               faz a pessoa salvar por cima do que não apareceu. */
            const [exps, curs, comps] = await Promise.all([
              lerExperiencias(meu.id),
              lerCursos(meu.id),
              lerCompetencias(meu.id),
            ]);
            setCompetencias(comps);

            /* À parte, e num `catch` próprio: é informação a mais numa
               tela que funciona sem ela. Derrubar o cadastro inteiro
               porque a lista de visitas falhou seria trocar a tela que a
               pessoa veio usar por uma mensagem de erro. */
            quemViuMeuPerfil(meu.id)
              .then(setQuemViu)
              .catch(() => setQuemViu([]));
            setExperiencias(
              exps.map((e) => ({
                cargo: e.cargo,
                empresa: e.onde ?? "",
                /* Duas datas quando dá para separar; texto livre guardado
                   à parte quando não dá. Ver `periodoParaCampos`. */
                ...periodoParaCampos(e.periodo ?? ""),
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
          const base = {
            ...PERFIL_VAZIO,
            phone: formatPhone(doFormatoDoBanco(user.phone)),
            email: user.email ?? "",
          };

          /* O rascunho entra por cima do vazio, mas NUNCA por cima do
             telefone que a conta acabou de confirmar por SMS: um rascunho
             de outro dia podia ter um número digitado à mão e antigo, e
             ele viraria o do cadastro sem ninguém perceber. */
          const guardado = rascunho.inicial;
          if (guardado?.dados?.perfil) {
            setPerfil({ ...base, ...guardado.dados.perfil, phone: base.phone });
            setExperiencias(guardado.dados.experiencias ?? []);
            setCursos(guardado.dados.cursos ?? []);
            setCompetencias(guardado.dados.competencias ?? []);
            setAvisoRascunho(true);
          } else {
            setPerfil(base);
          }
          /* Só grava rascunho de quem ainda não tem cadastro — ver o
             comentário do `useRascunho` lá em cima. */
          setProntoParaGravar(true);
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

  /**
   * Grava o cadastro.
   *
   * `irParaPronto` decide o que acontece DEPOIS de gravar, e os dois casos
   * são pedidos diferentes da dona:
   *
   *   `true`  — o "Salvar" do pé da página: "ao salvar o meu cadastro não
   *             está indo pra outra página que pedi pra cadastro salvo."
   *             Vai para a `ProntoPage`, que confirma e oferece os
   *             caminhos seguintes.
   *   `false` — o "Salvar o que já preenchi" do meio do formulário: "todo
   *             lugar que tenha que adicionar algum dado, ter botão para
   *             salvar, para depois adicionar outra." Aqui sair da tela
   *             seria o oposto do pedido — a pessoa ia acrescentar a
   *             próxima experiência.
   */
  async function salvar({ irParaPronto = true }: { irParaPronto?: boolean } = {}) {
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
      /* O que acabou de ser salvo passa a ser o cadastro aberto. Sem isto,
         quem criasse o SEGUNDO perfil salvava e voltava a ver o primeiro —
         parecendo que nada foi gravado. */
      escolherCadastro(id);

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
            /* Sem datas preenchidas, devolve o texto que veio do banco em
               vez de gravar vazio: era assim que o segundo salvamento
               apagava "de 2019 a 2022" de quem nunca tocou nesse campo. */
            periodo:
              [e.inicio, e.fim].filter(Boolean).join(" a ") || (e.periodoLivre ?? ""),
          }))
        ),
        salvarCursos(id, cursos),
        salvarCompetencias(id, competencias),
      ]);

      /* Sincroniza `profiles` — a identidade que a Conta mostra e que a
         barreira `CompletarPerfil` confere em `/perfil`. Este cadastro é
         o único lugar onde o profissional escreve nome/telefone/e-mail/
         foto, mas quem lê a Conta é `profiles`, uma tabela diferente. Sem
         isto, a Conta continuaria achando o perfil incompleto e pediria
         de novo as mesmas quatro coisas — o oposto de "um cadastro só".
         Erro aqui não derruba o salvamento: o cadastro profissional já
         está gravado, que é o que importa para a onda e para a busca. */
      try {
        await sincronizarProfile(user.id, {
          full_name: perfil.name,
          email: perfil.email || null,
          phone: onlyPhoneDigits(perfil.phone) || null,
          ...(perfil.photoUrl ? { avatar_url: perfil.photoUrl } : {}),
        });
      } catch {
        /* silêncio proposital: ver comentário acima */
      }

      /* ── A TELA DE "CADASTRO SALVO", SEMPRE — 04/09 ─────────────────
         A dona: "ao salvar o meu cadastro não está indo pra outra página
         que pedi pra cadastro salvo."

         Aqui havia um `if (ehPrimeiroCadastro)`: a confirmação aparecia
         só na PRIMEIRA vez, e quem editava o cadastro depois ficava na
         mesma tela com um aviso pequeno no rodapé — que é exatamente o
         "não está indo" que ela viu. Quem acabou de revisar vinte campos
         num celular precisa da mesma confirmação da primeira vez.

         `replace` para o botão de voltar não trazer de volta o formulário
         que acabou de ser salvo. */
      /* Gravou no banco: o rascunho cumpriu o papel. Deixá-lo vivo faria
         a próxima abertura restaurar por cima do que acabou de ser salvo. */
      rascunho.limpar();
      setAvisoRascunho(false);

      if (irParaPronto) {
        navegar("/pronto?tipo=profissional", { replace: true });
        return;
      }
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
  /* ── A PAREDE DE BOTÕES SAIU — 03/09 ─────────────────────────────────
     A dona: "na seção o que você aceita fazer, tirar os botões e deixar
     campo para escrever e acrescentar."

     Eram oitenta e tantas etiquetas numa caixa com rolagem própria, dentro
     de uma página que já rola — a rolagem de dentro engolia o dedo de quem
     tentava passar pela seção, e a lista era longa demais para se achar
     alguma coisa nela sem procurar assim mesmo.

     Agora só o campo. E as sugestões continuam existindo, mas SÓ enquanto
     a pessoa digita: são elas que fazem a vaga chegar, porque a onda cruza
     o que foi marcado com a profissão que a empresa escolheu de uma lista
     fechada. Sem sugestão nenhuma, todo mundo escreveria à mão e ninguém
     receberia vaga — o defeito que parece funcionar.

     Seis, e não todas: passar disso vira a mesma parede, agora embaixo do
     campo. */
  const visiveis = busca.trim()
    ? CATEGORIES.filter((c) =>
        c.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))
      ).slice(0, 6)
    : [];

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
        {/* O MESMO nome da porta e da barra de baixo: "Meu perfil" aqui,
            "Meu cadastro" na porta e "Painel" na barra eram três nomes
            para uma tela só. */}
        <Pagina titulo="Meu cadastro" />

        {/* Sem este aviso, quem volta encontra o formulário preenchido e
            acha que o app inventou os dados — o mesmo susto que já tinha
            acontecido na tela de criar vaga. Fica até tocarem em "começar
            do zero" ou salvar: sumir sozinho deixaria sem saída quem leu
            tarde. */}
        {avisoRascunho && (
          <div className="ei-rascunho ei-margem" role="status">
            <span>
              <strong>Voltamos de onde você parou.</strong> O que você escreve aqui fica
              guardado neste aparelho até salvar.
            </span>
            <button
              type="button"
              className="ei-btn-inline"
              onClick={() => {
                rascunho.descartar();
                setPerfil((p) => ({
                  ...PERFIL_VAZIO,
                  /* Telefone e e-mail vieram da conta, não do rascunho:
                     zerá-los faria a pessoa digitar de novo o que ela
                     acabou de confirmar por SMS. */
                  phone: p.phone,
                  email: p.email,
                }));
                setExperiencias([]);
                setCursos([]);
                setCompetencias([]);
                setAvisoRascunho(false);
              }}
            >
              Começar do zero
            </button>
          </div>
        )}

        {/* Quem chegou aqui barrado numa candidatura precisa entender POR
            QUE está nesta tela — senão ela parece um desvio aleatório, e a
            pessoa volta para a vaga e tenta de novo. Ver VagaAbertaPage. */}
        {motivo === "candidatura" && (
          <Callout atencao>
            <strong>Falta o seu cadastro para se candidatar.</strong> A empresa precisa
            do seu nome e do seu telefone confirmado para te chamar. Preencha aqui e
            volte para a vaga.
          </Callout>
        )}
        <p className="ei-apoio ei-margem" style={{ paddingBottom: 6 }}>
          É por ele que as vagas chegam até você.
        </p>

        {/* ── 0. Quem é você ───────────────────────────────────────────
            Nome, foto, telefone e e-mail, que a dona pediu por escrito e
            não existiam nesta tela. O nome é o que a empresa lê primeiro; o
            telefone é como ela chama. Sem eles, o cadastro não serve para
            nada — por isso vêm antes de tudo. */}
        <h2 className="ei-secao">Seus dados</h2>
        {/* Sem `display: grid` com `gap`: o vão do grid SOMAVA com a margem
            que separa dois campos (12 + 22 = 34px), e era por isso que o
            primeiro cartão do cadastro respirava mais que todos os outros
            — o defeito que a dona viu como "respiros maiores uns dos
            outros". Quem decide a distância entre campos é uma regra só,
            no fim do estilo-ei.css. */}
        <div className="ei-cartao">
          {/* A foto — mesma mecânica da `CompletarPerfil` (enquadrar antes
              de subir, para não cortar a testa de quem manda foto em pé),
              mas gravando na coluna que a lista de talentos realmente lê. */}
          {aEnquadrar && (
            <AjustarFoto
              arquivo={aEnquadrar}
              redondo
              aoConfirmar={async (recortada) => {
                if (!user) return;
                setAEnquadrar(null);
                setEnviandoFoto(true);
                setErro("");
                try {
                  const url = await uploadProfessionalPhoto(user.id, recortada);
                  setPerfil((x) => ({ ...x, photoUrl: url }));
                } catch (err) {
                  setErro(mensagemDeErro(err, "Não foi possível enviar a foto."));
                } finally {
                  setEnviandoFoto(false);
                }
              }}
              aoCancelar={() => setAEnquadrar(null)}
            />
          )}
          <label className="ei-foto-escolha" title="Escolher foto">
            {perfil.photoUrl ? (
              <img src={perfil.photoUrl} alt="" className="ei-foto-escolha-img" />
            ) : (
              <span className="ei-foto-escolha-vazia" aria-hidden="true">
                {perfil.name.trim().charAt(0).toLocaleUpperCase("pt-BR") || "+"}
              </span>
            )}
            {/* "Pôr foto (opcional)" virou "Incluir foto" — a dona pediu a
                troca, e o texto novo já não carrega o "opcional" embutido:
                a foto continua sem ser exigida (o botão de Salvar não olha
                para ela), só deixou de anunciar isso na própria etiqueta. */}
            <span className="ei-btn-inline">
              {enviandoFoto ? "Enviando…" : perfil.photoUrl ? "Trocar foto" : "Incluir foto"}
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={enviandoFoto}
              style={{ display: "none" }}
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (!arquivo || !user) return;
                setAEnquadrar(arquivo);
              }}
            />
          </label>
          <div className="ei-campo">
            <label htmlFor="meu-nome">Nome</label>
            <input
              id="meu-nome"
              value={perfil.name}
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
          {/* ── OUTROS TELEFONES (item 14, coluna da 0103) ─────────────
              A dona: "ao confirmar o telefone ele não pode sair do
              cadastro. A pessoa pode adicionar outros."

              Fica LOGO ABAIXO do confirmado — a dona: "o campo de telefone
              adicional tem que ficar abaixo do campo de telefone
              confirmado". Antes ele morava depois do e-mail, do bairro e do
              resumo, e quem tinha um segundo número não o encontrava: dois
              campos de telefone separados por três de outro assunto se
              leem como coisas sem relação.

              O de cima é o CONFIRMADO por SMS e fica trancado. Estes são
              outros, digitados à mão e sem confirmação nenhuma — e por
              isso moram noutra coluna: guardar os dois no mesmo lugar
              apagaria a diferença entre número provado e número que
              alguém escreveu. */}
          <div className="ei-campo">
            <label>Outro telefone (opcional)</label>
            {perfil.telefonesExtra.map((t, i) => (
              <div key={i} className="ei-linha-com-tirar">
                <input
                  aria-label={`Outro telefone ${i + 1}`}
                  inputMode="tel"
                  value={t}
                  onChange={(e) =>
                    setPerfil((x) => ({
                      ...x,
                      telefonesExtra: x.telefonesExtra.map((v, j) =>
                        j === i ? formatPhone(e.target.value) : v
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="ei-btn ei-btn-texto"
                  style={{ minHeight: 0, padding: "0 4px" }}
                  onClick={() =>
                    setPerfil((x) => ({
                      ...x,
                      telefonesExtra: x.telefonesExtra.filter((_, j) => j !== i),
                    }))
                  }
                >
                  Tirar
                </button>
              </div>
            ))}
            {/* Três é mais do que qualquer pessoa usa, e é o teto que o
                banco cobra (0103). Escondê-lo depois do terceiro evita o
                erro que só apareceria ao salvar. */}
            {perfil.telefonesExtra.length < 3 && (
              <button
                type="button"
                className="ei-btn ei-btn-tonal ei-btn-largo"
                /* Eram 22px, e no print da dona o vão ficava maior que o
                   respiro de qualquer outro campo da tela — sobra do tempo
                   em que o "Tirar" ao lado partia em duas linhas e empurrava
                   tudo. Com ele consertado, 10 é o mesmo ar do resto. */
                style={{ marginTop: perfil.telefonesExtra.length ? 10 : 0 }}
                onClick={() =>
                  setPerfil((x) => ({ ...x, telefonesExtra: [...x.telefonesExtra, ""] }))
                }
              >
                + {perfil.telefonesExtra.length ? "Mais um telefone" : "Acrescentar telefone"}
              </button>
            )}
          </div>

          <div className="ei-campo">
            <label htmlFor="meu-email">E-mail (opcional)</label>
            <input
              id="meu-email"
              type="email"
              inputMode="email"
              value={perfil.email}
              onChange={(e) => setPerfil((x) => ({ ...x, email: e.target.value }))}
            />
          </div>
          <div className="ei-campo">
            <label htmlFor="meu-bairro">Bairro</label>
            <input
              id="meu-bairro"
              value={perfil.neighborhood}
              maxLength={60}
              onChange={(e) => setPerfil((x) => ({ ...x, neighborhood: e.target.value }))}
            />
          </div>

          {/* O campo que faltava — a dona: "na tela de procuro um trabalho
              aparece um aviso dizendo que falta um resumo sobre você, mas
              não tem onde escrever." O AvisoPerfilIncompleto cobrava
              `bio` desde sempre; a coluna existe (herança do procurô), só
              nunca tinha voltado para o cadastro reescrito do Ei. */}
          <div className="ei-campo">
            <label htmlFor="meu-bio">Um resumo sobre você (opcional)</label>
            <textarea
              id="meu-bio"
              rows={3}
              maxLength={300}
              value={perfil.bio}
              onChange={(e) => setPerfil((x) => ({ ...x, bio: e.target.value }))}
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="meu-nascimento">Data de nascimento</label>
            <input
              id="meu-nascimento"
              type="date"
              value={perfil.nascimento}
              onChange={(e) => setPerfil((x) => ({ ...x, nascimento: e.target.value }))}
            />
            {/* A empresa vê a IDADE, nunca a data. Dizer isso aqui é o que
                faz a pessoa preencher: sem a frase, um campo de
                aniversário num cadastro de emprego parece intrusão. */}
          </div>

          {/* ── GÊNERO (0116) ────────────────────────────────────────────
              A dona: "colocar opção no cadastro de feminino ou masculino
              ou outro."

              Opcional de verdade: a primeira opção é "prefiro não dizer",
              e ela é o padrão. E a dica embaixo diz para onde este dado
              NÃO vai — as empresas não recebem esta informação, porque o
              art. 373-A da CLT proíbe usar sexo como critério para
              contratar. Isso não é promessa da tela: a coluna fica fora
              da lista pública (ver a 0116), então não há como filtrar por
              ela. */}
          <div className="ei-campo">
            <label htmlFor="meu-genero">Gênero (opcional)</label>
            <select
              id="meu-genero"
              value={perfil.genero}
              onChange={(e) => setPerfil((x) => ({ ...x, genero: e.target.value }))}
            >
              <option value="">Prefiro não dizer</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
              <option value="outro">Outro</option>
            </select>
            <span className="ei-campo-ajuda">
              As empresas não veem esta resposta. Ela serve para o app saber com
              quem está falando.
            </span>
          </div>

          {/* ── PCD (0115) ───────────────────────────────────────────────
              A dona: "colocar no cadastro da empresa e do empregado a
              opção de PCD."

              Ao contrário do gênero, esta marcação APARECE para as
              empresas — e é justamente para isso que a pessoa marcaria:
              as vagas que aceitam PCD ficam marcadas para ela, e a
              empresa que procura vê o selo. A dica diz isso com todas as
              letras, porque marcar sem saber para onde vai é o que
              ninguém deveria ter de descobrir depois.

              O app não pergunta QUAL deficiência, e não pede laudo: nada
              disso muda o que o app faz, e guardar dado de saúde que não
              serve para nada é só risco. */}
          <div className="ei-campo">
            <label className="ei-caixa">
              <input
                type="checkbox"
                checked={perfil.pcd}
                onChange={(e) => setPerfil((x) => ({ ...x, pcd: e.target.checked }))}
              />
              <span>Sou pessoa com deficiência (PCD)</span>
            </label>
            <span className="ei-campo-ajuda">
              Marcando, as empresas veem essa informação e você encontra as vagas
              que aceitam PCD. Não perguntamos qual deficiência.
            </span>
          </div>

          {/* CNH: a pergunta que abre metade das vagas de entrega da
              cidade. "Tem" e "qual categoria" são separados de propósito —
              "não tenho" e "tenho, mas não disse qual" são respostas
              diferentes, e num campo só virariam o mesmo vazio. */}
          <div className="ei-campo">
            <label className="ei-caixa">
              <input
                type="checkbox"
                checked={perfil.temCnh}
                onChange={(e) => setPerfil((x) => ({ ...x, temCnh: e.target.checked }))}
              />
              <span>Tenho CNH</span>
            </label>
            {perfil.temCnh && (
              <div className="ei-chips">
                {["A", "B", "C", "D", "E", "AB"].map((cat) => {
                  const marcada = perfil.cnhCategorias.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      className="ei-chip"
                      aria-pressed={marcada}
                      onClick={() =>
                        setPerfil((x) => ({
                          ...x,
                          cnhCategorias: marcada
                            ? x.cnhCategorias.filter((c) => c !== cat)
                            : [...x.cnhCategorias, cat],
                        }))
                      }
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── 1. Disponível ────────────────────────────────────────────
            No topo porque é o que muda toda semana. Quem arrumou emprego
            precisa desligar em dois toques, sem procurar. */}
        {/* As duas chaves não tinham título de seção nenhum: ficavam soltas
            entre "Seus dados" e "O que você aceita fazer", sem dizer do que
            tratavam. Num app em que toda seção se anuncia, a que não se
            anuncia parece sobra da seção anterior. */}

        {/* ── O QUE VOCÊ QUER (0101) ──────────────────────────────────
            A dona: "o cadastro do candidato está muito simples. tem que
            ter pretensão salarial, horário melhor, se aceita viajar."

            Os três ficam juntos, ao lado de "quando receber vaga",
            porque respondem à mesma pergunta: em que condições esta
            pessoa topa. Todos opcionais — quem não quiser dizer o quanto
            ganha segue sem dizer, e continua recebendo vaga. */}
        <h2 className="ei-secao">O que você quer</h2>
        <div className="ei-lista">
          <div className="ei-cartao">
            {/* O período ANTES do valor (a dona: "na opção de salário
                colocar opção da de mensal / hora / diária").

                O rótulo do campo de baixo muda com a escolha, porque
                "quanto você quer ganhar por mês" com uma diarista pensando
                em diária é a pergunta errada — e ela responde "200", que
                lido como mensal a tira de todas as vagas. */}
            <div className="ei-campo">
              <label htmlFor="meu-periodo">Você pensa em ganhar</label>
              <select
                id="meu-periodo"
                value={perfil.pretensaoPeriodo}
                disabled={pretensaoCombinar}
                onChange={(e) => setPerfil((x) => ({ ...x, pretensaoPeriodo: e.target.value }))}
              >
                {PERIODOS_DE_SALARIO.map((per) => (
                  <option key={per.valor} value={per.valor}>
                    {per.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="ei-campo">
              <label htmlFor="meu-pretensao">
                {perfil.pretensaoPeriodo === "dia"
                  ? "Quanto por diária"
                  : perfil.pretensaoPeriodo === "hora"
                    ? "Quanto por hora"
                    : "Quanto por mês"}
              </label>
              <input
                id="meu-pretensao"
                inputMode="decimal"
                value={pretensao}
                disabled={pretensaoCombinar}
                onChange={(e) => setPretensao(e.target.value)}
              />
              <span className="ei-campo-ajuda">
                Opcional. Evita que te chamem para uma vaga que não fecha.
              </span>
            </div>

          </div>

          {/* ── A CHAVE SAIU DE DENTRO DO CARTÃO — 04/09 ──────────────
              A dona: "alguns campos dentro do cadastro estão desalinhados,
              e com respiros maiores uns dos outros. Alinhe tudo."

              "Prefiro combinar" era um `.ei-cartao` DENTRO de outro
              `.ei-cartao`: os 20px de recuo de cada um se somavam, e a
              chave começava 40px da borda enquanto todo o resto da tela
              começava a 20px. Do lado de fora ela era só "uma linha
              torta", e é exatamente esse tipo de coisa que faz uma tela
              parecer quebrada sem que dê para dizer por quê.

              Agora ela é irmã do cartão do salário, como as outras três
              chaves desta mesma seção — mesmo recuo, mesmo vão. */}
          <div className="ei-cartao" style={{ padding: 0 }}>
            <Switch
              ligado={pretensaoCombinar}
              onChange={(v) => {
                setPretensaoCombinar(v);
                if (v) setPretensao("");
              }}
              titulo="Prefiro combinar"
            />
          </div>

          <div className="ei-cartao">
            <div className="ei-campo">
              <label>Melhor horário</label>
            </div>
            {/* ── UMA GRADE, E NÃO UMA FILEIRA SOLTA — 04/09 ────────────
                A dona, duas vezes, com print: "dar respiro e melhorar
                layout."

                As etiquetas eram `inline-flex` num bloco de texto: o vão
                entre elas era o espaço de uma letra (uns 4px), e entre as
                linhas, nada. Sete etiquetas de larguras diferentes viravam
                três fileiras irregulares, com "Qualquer horário" sobrando
                sozinho na última — e num toque de dedo 4px é a distância
                entre marcar "Noite" e marcar "Horário comercial".

                Em duas colunas todas ficam do mesmo tamanho, alinhadas, e
                com 44px de altura: o alvo de toque que o dedo pede.

                A rolagem de 232px também saiu. Ela existia quando esta
                lista tinha oitenta itens (as funções); com sete, ela só
                criava uma caixa que rola dentro de uma página que já
                rola. */}
            <div className="ei-opcoes">
              {DISPONIBILIDADE.map((h) => {
                const marcado = disponibilidade.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    className={marcado ? "ei-opcao-botao ativo" : "ei-opcao-botao"}
                    aria-pressed={marcado}
                    onClick={() =>
                      setDisponibilidade((atual) =>
                        marcado ? atual.filter((x) => x !== h) : [...atual, h],
                      )
                    }
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ei-cartao" style={{ padding: 0 }}>
            <Switch
              ligado={aceitaViajar}
              onChange={setAceitaViajar}
              titulo="Aceito viajar"
            />
          </div>

          {/* A chave "também faço freela e bico" (0114) foi feita e
              retirada no mesmo dia — a dona: "não vou colocar isso por
              enquanto". A coluna continua no banco e o cadastro continua
              lendo e gravando o valor que já estiver lá: apagar a resposta
              de quem marcou seria perder dado por causa de uma decisão de
              tela. */}

          {/* ── AS DUAS PERGUNTAS QUE FALTAVAM (item 14, colunas da 0103)
              A dona: "trabalha em final de semana?" e "disponibilidade pra
              começar imediato?".

              As duas são fechadas e a resposta padrão é NÃO — quem não
              respondeu não vira candidato a plantão de domingo. */}
          <div className="ei-cartao" style={{ padding: 0 }}>
            <Switch
              ligado={perfil.fimDeSemana}
              onChange={(v) => setPerfil((x) => ({ ...x, fimDeSemana: v }))}
              titulo="Trabalho em fim de semana"
            />
          </div>

          <div className="ei-cartao" style={{ padding: 0 }}>
            <Switch
              ligado={perfil.inicioImediato}
              onChange={(v) => setPerfil((x) => ({ ...x, inicioImediato: v }))}
              titulo="Posso começar imediato"
            />
          </div>

          {/* Modo de trabalho. O "tanto faz" existe e é a resposta mais
              comum aqui: numa cidade pequena quase tudo é presencial, e
              obrigar a escolher faz a pessoa marcar qualquer coisa para o
              formulário parar de reclamar. */}
          <div className="ei-cartao">
            <div className="ei-campo">
              <label htmlFor="modo-trabalho">Como você prefere trabalhar</label>
              <select
                id="modo-trabalho"
                value={perfil.modoTrabalho}
                onChange={(e) => setPerfil((x) => ({ ...x, modoTrabalho: e.target.value }))}
              >
                <option value="">Não informado</option>
                <option value="presencial">No local da empresa</option>
                <option value="remoto">De casa</option>
                <option value="hibrido">Parte no local, parte de casa</option>
                <option value="tanto_faz">Tanto faz</option>
              </select>
            </div>
          </div>
        </div>

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
              titulo="Não aparecer no banco de talentos"
              /* O texto muda com o estado porque a consequência é
                 diferente, e é ela que a pessoa precisa entender — não o
                 nome da opção. */
              descricao={
                oculto
                  ? "Ninguém te encontra procurando. Você continua recebendo as vagas que combinam com você."
                  : "Hoje qualquer empresa te encontra procurando no banco de talentos."
              }
            />
          </div>

          {/* ── O AVISO DE ATENÇÃO — 05/09 ───────────────────────────────
              A dona: "na parte de não aparecer na lista, acho que tem que
              melhorar o texto. Ter um aviso de atenção. Falar que você
              pode se cadastrar e ficar oculto no banco de talentos. Assim
              só você verifica as vagas, mas as pessoas não te acham."

              Aqui havia uma linha cinza de duas frases, do mesmo tom de
              todo texto de apoio da tela — e ela dizia POR QUE alguém
              usaria a chave sem dizer O QUE a chave faz. Faltava
              justamente o que destrava a decisão: que ficar oculto NÃO É
              sair do app, e que as vagas continuam chegando.

              Vira aviso destacado porque a consequência é grande nos dois
              sentidos: quem liga sem entender some do banco de talentos e
              acha que o cadastro parou de funcionar; quem não sabe que
              existe deixa de se cadastrar por medo de o patrão ver. As
              duas coisas custam um cadastro.

              Continua DENTRO do grupo branco, junto da chave que explica:
              solto no chão cinza depois dele parecia aviso sem dono. */}
          <div className="ei-atencao">
            <p className="ei-atencao-titulo">
              Atenção: dá para ficar cadastrado e oculto
            </p>
            <p className="ei-atencao-texto">
              Com esta chave ligada você sai do banco de talentos: as empresas
              não te acham procurando, e ninguém vê seu nome, sua foto nem seu
              telefone. Mas você continua recebendo as vagas que combinam com
              você — quem olha as vagas é você. A empresa só vê seus dados se
              você responder que tem interesse.
            </p>
            {/* Saiu a pedido da dona (05/09): "tirar essa fala". Era a
                frase sobre procurar sem o patrão ver. O aviso continua
                dizendo o que a chave FAZ, que é o que a decisão precisa —
                por que cada pessoa a usaria é conta dela. */}
          </div>
        </div>

        {/* ── 2. Funções ───────────────────────────────────────────────── */}
        <h2 className="ei-secao">O que você aceita fazer</h2>
        <div className="ei-cartao">
          {/* Só a contagem — a dona: "tirar as legendas da tela de
              cadastro". O que ensinava a usar o campo saiu; o que ele
              precisa dizer (quantas cabem, quantas já foram) não é
              legenda, é o estado do que a pessoa está fazendo. */}
          <p className="ei-apoio" style={{ marginBottom: 12 }}>
            <strong>{funcoes.length} de {MAX_FUNCOES}</strong> funções
          </p>

          <div className="ei-campo" style={{ marginBottom: 12 }}>
            {/* "ou escrever" no rótulo, e não só "procurar": era a tela
                inteira dizendo que a única coisa possível ali era achar o
                que já existe. */}
            <input
              type="text"
              /* Nome de ofício não passa disso. Sem limite, o campo aceitava
                 uma frase inteira ("operador de empilhadeira e conferente de
                 carga e descarga em galpão") e o botão de acrescentar virava
                 um parágrafo — e a etiqueta, depois de salva, não cabia em
                 lugar nenhum. */
              maxLength={40}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Escrever o que você faz"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                /* O teclado do celular manda "ir" e não "acrescentar": se
                   o que foi escrito é uma função da lista, o Enter marca
                   ela — senão, cria a escrita. Sem isto, apertar "ir"
                   dentro de um formulário tentava SALVAR o cadastro no
                   meio da digitação. */
                const igual = CATEGORIES.find(
                  (c) =>
                    c.toLocaleLowerCase("pt-BR") === escrita.toLocaleLowerCase("pt-BR")
                );
                if (igual && !funcoes.includes(igual) && !cheio) {
                  alternar(igual);
                  setBusca("");
                  return;
                }
                if (podeCriar) criarFuncao();
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
              Acrescentar “{escrita}”
            </button>
          )}

          {/* As sugestões que aparecem enquanto se digita. São o caminho
              que faz a vaga chegar (ver o comentário de `visiveis`), então
              ficam LOGO ABAIXO do campo — e não no fim da seção, onde a
              pessoa já teria escrito à mão antes de vê-las. */}
          {visiveis.filter((c) => !funcoes.includes(c)).length > 0 && (
            <div className="ei-chips" style={{ marginBottom: 12 }}>
              {visiveis
                .filter((c) => !funcoes.includes(c))
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="ei-chip"
                    aria-pressed={false}
                    disabled={cheio}
                    onClick={() => {
                      alternar(c);
                      setBusca("");
                    }}
                  >
                    + {c}
                  </button>
                ))}
            </div>
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

        {/* ── 3. Experiências ──────────────────────────────────────────── */}
        <h2 className="ei-secao">Onde você já trabalhou</h2>

        {/* ── O PRIMEIRO EMPREGO (0114) ────────────────────────────────
            A dona: "ter uma opção da pessoa colocar no cadastro que é 1º
            emprego, e no perfil da vaga ter opção de escolher que pode
            ser pessoa que busca o primeiro emprego."

            Fica AQUI, e não no meio das preferências: é a resposta para a
            lista de experiências vazia logo abaixo. Sem ela, um cadastro
            sem nenhuma experiência é lido pela empresa como um cadastro
            pela metade — e é o contrário: é alguém que está começando, e
            que a vaga de primeiro emprego procura. */}
        <div className="ei-cartao" style={{ padding: 0 }}>
          <Switch
            ligado={perfil.primeiroEmprego}
            onChange={(v) => setPerfil((x) => ({ ...x, primeiroEmprego: v }))}
            titulo="Estou atrás do primeiro emprego"
            descricao="As vagas que aceitam quem está começando ficam marcadas para você, e a empresa vê que é o seu primeiro."
          />
        </div>

        <div className="ei-cartao">

          {/* ── PREENCHE, SALVA, VIRA CARTÃO — 05/09 ──────────────────
              A dona: "tudo que tem que acrescentar no cadastro, como
              formação. Assim que digita, salva e ele vira um card
              visualmente bonito. A pessoa tem como excluir o que já
              inseriu ou adicionar outro."

              Aqui ficavam TODOS os formulários abertos ao mesmo tempo,
              um embaixo do outro: três experiências eram doze campos de
              texto abertos, e nada na tela dizia o que já estava pronto —
              campo preenchido e campo esperando têm a mesma cara.

              Agora o que já foi salvo é cartão de texto, e o formulário
              só existe enquanto se acrescenta ou se corrige um item. Ver
              `ListaEmCartoes`. */}
          <ListaEmCartoes
            itens={experiencias}
            aoMudar={(novos) => setExperiencias(novos)}
            novoItem={() => ({ empresa: "", cargo: "", inicio: "", fim: "" })}
            nomeDoItem="experiência"
            rotuloAdicionar={
              experiencias.length ? "Outra experiência" : "Acrescentar experiência"
            }
            vazio="Ainda não tem nenhuma. Cada trabalho que você acrescenta é uma chance a mais de a empresa te achar."
            temConteudo={(e) => e.empresa.trim() !== "" || e.cargo.trim() !== ""}
            resumo={(e) => ({
              /* O CARGO é o título, e não a empresa: é por função que a
                 empresa procura, e é o cargo que a pessoa reconhece como
                 "o que eu fazia". A empresa vira linha de apoio. */
              titulo: e.cargo.trim() || e.empresa.trim() || "Experiência",
              linhas: [
                e.cargo.trim() && e.empresa.trim() ? e.empresa.trim() : null,
                periodoDaExperiencia(e),
              ],
            })}
            aoSalvar={() => salvar({ irParaPronto: false })}
            salvando={salvando}
            formulario={(exp, mudar) => (
              <>
                <div className="ei-campo">
                  <label htmlFor="exp-empresa">Empresa</label>
                  <input
                    id="exp-empresa"
                    value={exp.empresa}
                    onChange={(e) => mudar({ empresa: e.target.value })}
                  />
                </div>
                <div className="ei-campo">
                  <label htmlFor="exp-cargo">O que você fazia</label>
                  <input
                    id="exp-cargo"
                    value={exp.cargo}
                    onChange={(e) => mudar({ cargo: e.target.value })}
                  />
                </div>
                {/* Empilhados, e não em duas colunas: `input[type=month]`
                    tem largura mínima própria e não cabe em meia tela de
                    390px — ver o comentário no CSS dos campos de mês. */}
                <div className="ei-campo">
                  <label htmlFor="exp-inicio">Começou</label>
                  <input
                    id="exp-inicio"
                    type="month"
                    value={exp.inicio}
                    onChange={(e) => mudar({ inicio: e.target.value })}
                  />
                </div>
                <div className="ei-campo">
                  <label htmlFor="exp-fim">Saiu</label>
                  <input
                    id="exp-fim"
                    type="month"
                    value={exp.fim}
                    onChange={(e) => mudar({ fim: e.target.value })}
                  />
                </div>
              </>
            )}
          />
        </div>

        {/* ── QUEM VIU O SEU CADASTRO (0106) ─────────────────────────
            Fica antes da formação e depois das funções: é notícia, e
            notícia vem antes de formulário. Só aparece quando há alguém —
            uma seção dizendo "ninguém ainda" é a frase mais desanimadora
            que esta tela poderia dar, e ela apareceria justamente para
            quem acabou de se cadastrar. */}
        {quemViu.length > 0 && (
          <>
            <h2 className="ei-secao">Quem viu seu cadastro</h2>
            <div className="ei-lista">
              {quemViu.map((v) => (
                <Link key={v.empresaId} to={`/empresa/${v.empresaId}`} className="ei-pessoa">
                  <span className="ei-pessoa-retrato" aria-hidden="true">
                    {v.foto ? (
                      <img src={v.foto} alt="" loading="lazy" />
                    ) : (
                      v.empresa.trim().charAt(0).toLocaleUpperCase("pt-BR")
                    )}
                  </span>
                  <div className="ei-pessoa-texto">
                    <div className="ei-pessoa-nome ei-uma-linha">{v.empresa}</div>
                    <div className="ei-pessoa-oficio ei-uma-linha">
                      {quandoFoi(v.quando)}
                      {/* "Voltou 3 vezes" é o sinal que vale esperar o
                          telefone tocar: uma visita é curiosidade, três em
                          dois dias é uma empresa decidindo. */}
                      {v.vezes > 1 && ` · voltou ${v.vezes} vezes`}
                    </div>
                  </div>
                  <span className="ei-linha-seta" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* ── 4. Formação e cursos (item 14) ───────────────────────────
            A dona pediu dois blocos com os MESMOS campos: "última
            escolaridade (instituição / curso / situação / ano)" e "cursos
            complementares (idem)", os dois com opção de acrescentar mais.

            No banco é uma tabela só, separada pela coluna `tipo` (0104):
            os campos são iguais, e duas tabelas iguais lado a lado seriam
            duas telas que um dia divergem. Aqui viram duas listas, porque
            na cabeça de quem preenche são coisas diferentes — o ensino
            médio e o curso de NR-35 não se misturam. */}
        <h2 className="ei-secao">Formação</h2>
        <div className="ei-cartao">
          <ListaDeCursos
            cursos={cursos}
            setCursos={setCursos}
            tipo="formacao"
            aoSalvar={() => salvar({ irParaPronto: false })}
            salvando={salvando}
            rotuloCurso="Curso ou série"
          />
        </div>

        <h2 className="ei-secao">Cursos complementares</h2>
        <div className="ei-cartao">
          <ListaDeCursos
            cursos={cursos}
            setCursos={setCursos}
            tipo="complementar"
            aoSalvar={() => salvar({ irParaPronto: false })}
            salvando={salvando}
            rotuloCurso="Curso"
          />
        </div>

        {/* ── 5. Competências (item 14) ────────────────────────────────
            A dona: "Excel (básico | intermediário | avançado), informática
            (idem), atendimento (idem). Ter campo + pra adicionar e
            metrificar."

            As três que ela nomeou vêm SUGERIDAS, não gravadas: tocar numa
            delas acrescenta a linha já com o nível para escolher. Deixá-las
            fixas na lista faria toda pessoa aparecer com "Excel: básico",
            inclusive quem nunca abriu um.

            ── VIROU CARD — 04/09 ────────────────────────────────────────
            A dona: "a parte de cadastrar as competências está confuso. ao
            adicionar, formar cards e ter opção de adicionar outras."

            Antes, cada competência já adicionada continuava sendo uma
            linha de formulário — nome num campo de texto editável, igual
            ao campo vazio esperando ser preenchido. Nada na tela dizia
            "isto já foi adicionado": parecia sempre uma pergunta em
            aberto, mesmo depois de respondida. Agora quem já foi
            adicionado vira um card fechado (nome fixo, só o nível e o ×
            continuam tocáveis), do mesmo jeito que as sugestões abaixo já
            pareciam — e o campo de adicionar fica sempre visível, pronto
            para a próxima. */}
        <h2 className="ei-secao">Competências</h2>
        <div className="ei-cartao">

          {/* ── CADA COMPETÊNCIA É UM BLOCO, COMO AS EXPERIÊNCIAS — 04/09
              A dona: "a parte de competências no cadastro dos profissionais
              está estranho e quebrado."

              Estava, e por dois motivos somados. Largura: nome, nível e
              "Tirar" dividiam a MESMA linha, e o seletor sozinho come
              132px — num celular de 390px sobravam quatro letras para o
              nome. E rótulo: as duas caixas não tinham nenhum, então uma
              competência salva aparecia como uma caixa de texto solta com
              um "Básico" ao lado, sem nada dizendo o que era aquilo.

              Agora cada competência é um bloco igual ao das experiências e
              dos cursos, logo acima: cabeçalho com "1ª competência" e o
              "Tirar" à direita, e embaixo dois campos com rótulo, um por
              linha — do jeito que o resto do formulário já faz. */}
          {/* 26px entre uma competência e a seguinte: com 18 o "2ª
              competência" encostava no campo de cima e as duas pareciam um
              bloco só. */}
          {/* Preenche, salva, vira cartão — ver `ListaEmCartoes`. Sem o
              botão de acrescentar dele: aqui já existe caminho melhor, as
              sugestões prontas e o campo sempre aberto logo abaixo, que
              entram com um toque só. */}
          <ListaEmCartoes
            itens={competencias}
            aoMudar={(novos) => setCompetencias(novos)}
            novoItem={(): CompetenciaEmEdicao => ({ nome: "", nivel: "basico" })}
            nomeDoItem="competência"
            rotuloAdicionar="Outra competência"
            semAdicionar
            temConteudo={(c) => c.nome.trim() !== ""}
            resumo={(c) => ({
              titulo: c.nome.trim() || "Competência",
              linhas: [nomeDoNivel(c.nivel)],
            })}
            aoSalvar={() => salvar({ irParaPronto: false })}
            salvando={salvando}
            formulario={(c, mudar) => (
              <>
                <div className="ei-campo">
                  <label htmlFor="comp-nome">O que você sabe fazer</label>
                  <input
                    id="comp-nome"
                    value={c.nome}
                    maxLength={40}
                    onChange={(e) => mudar({ nome: e.target.value })}
                  />
                </div>
                <div className="ei-campo">
                  <label htmlFor="comp-nivel">O quanto</label>
                  <select
                    id="comp-nivel"
                    value={c.nivel}
                    onChange={(e) =>
                      mudar({ nivel: e.target.value as CompetenciaEmEdicao["nivel"] })
                    }
                  >
                    <option value="basico">Básico</option>
                    <option value="intermediario">Intermediário</option>
                    <option value="avancado">Avançado</option>
                  </select>
                </div>
              </>
            )}
          />

          {/* As sugestões da dona, e só as que ainda não estão na lista:
              oferecer "Excel" a quem já pôs Excel é um botão que não faz
              nada — e o banco recusaria a repetida. */}
          {/* As sugestões entram na mesma grade de duas colunas de "Melhor
              horário": são a mesma coisa — opções para tocar —, e duas
              formas diferentes para a mesma coisa fazem a pessoa
              reaprender no meio do formulário. */}
          <div className="ei-opcoes" style={{ marginTop: competencias.length ? 22 : 0 }}>
            {["Excel", "Informática", "Atendimento", "Caixa", "Vendas", "Direção"]
              .filter(
                (nome) =>
                  !competencias.some(
                    (c) => c.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR")
                  )
              )
              .map((nome) => (
                <button
                  key={nome}
                  type="button"
                  className="ei-opcao-botao"
                  onClick={() =>
                    setCompetencias((a) => [...a, { nome, nivel: "basico" }])
                  }
                >
                  + {nome}
                </button>
              ))}
          </div>

          {/* O campo de adicionar outra fica sempre aberto — é a "opção de
              adicionar outras" que a dona pediu, sem precisar tocar num
              botão para abrir espaço de digitar. */}
          <div className="ei-competencia-add">
            <input
              aria-label="Nome da nova competência"
              placeholder="Nome da competência"
              value={novaCompetencia}
              onChange={(e) => setNovaCompetencia(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarCompetencia();
                }
              }}
            />
            <button
              type="button"
              className="ei-btn ei-btn-tonal"
              disabled={!novaCompetencia.trim()}
              onClick={adicionarCompetencia}
            >
              Adicionar
            </button>
          </div>

          {competencias.length > 0 && <SalvarAqui />}
        </div>

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
            Era "Voltar / Continuar", com "Terminar cadastro" só no
            último dos três passos — cadastro em etapas, cada um com o seu
            botão. Sem etapas, sobra o que sempre valeu para quem já tinha
            cadastro: um botão só, sempre visível. */}
        <div className="ei-margem ei-pe-etapas">
          <button
            type="button"
            className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
            disabled={salvando}
            onClick={() => salvar()}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>

        {/* ── ATIVAR / INATIVAR, NO PÉ DO CADASTRO — 04/09 ─────────────
            A dona: "o botão de inativar e ativar devem estar dentro do
            perfil na parte de baixo. E no card do lado de fora ter uma
            etiqueta dizendo se está ativo ou inativo." E antes: "caso a
            pessoa não queira excluir, ela pode inativar."

            Fica logo ACIMA do "Excluir meu cadastro", e é por isso que os
            dois são vizinhos: quem rolou até aqui procurando como sumir do
            app encontra primeiro a saída reversível. Inativar faz as duas
            coisas de uma vez — some da busca das empresas e para de
            receber vaga —, e nada do que foi preenchido se perde.

            O botão diz o que VAI acontecer, e a linha abaixo dele diz como
            está agora: um botão sozinho escrito "Inativar" não responde
            "então quer dizer que hoje estou ativo?". */}
        <div className="ei-cartao" style={{ marginTop: 22 }}>
          <p className="ei-apoio" style={{ margin: "0 0 10px" }}>
            {ativo
              ? "Seu cadastro está ativo: as empresas te encontram e as vagas do seu ofício chegam para você."
              : "Seu cadastro está inativo: ninguém te encontra na busca e nenhuma vaga chega. Nada do que você preencheu foi apagado."}
          </p>
          <button
            type="button"
            className="ei-btn ei-btn-contorno ei-btn-largo"
            disabled={alternandoAtivo}
            onClick={alternarAtivo}
          >
            {alternandoAtivo
              ? "Um instante…"
              : ativo
                ? "Inativar meu cadastro"
                : "Ativar meu cadastro"}
          </button>
        </div>

        {/* ── EXCLUIR, NO FIM DA PÁGINA — 03/09 ────────────────────────
            A dona: "dentro da opção cadastro, ter opção de excluir no
            final da página."

            Ela existia só em "Conta", que é onde quem quer apagar tudo
            costuma NÃO procurar: a pessoa vai ao próprio cadastro, rola
            até o fim atrás do botão, e não acha nada — e escrever para o
            suporte pedindo para apagar não é caminho de app.

            Fica depois do "Salvar", separado e sem cor de destaque: é uma
            ação sem volta, e o pé desta tela é o lugar mais provável de um
            toque errado com o polegar. E não apaga nada daqui — leva à
            tela que explica o que some junto e pede confirmação. */}
        <div className="ei-margem" style={{ textAlign: "center", padding: "22px 0 8px" }}>
          <Link to="/excluir-conta" className="link-perigo">
            Excluir meu cadastro
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * A lista de formação, ou a de cursos complementares.
 *
 * Uma função só para as duas porque os campos são os mesmos — é o mesmo
 * motivo de elas dividirem uma tabela no banco (0104). O que muda é o
 * rótulo, o exemplo, e o fato de a FORMAÇÃO ter nível (fundamental, médio,
 * técnico…) e o curso complementar não: um curso de NR-35 não é uma
 * escolaridade, e um nível ali viraria uma exigência que a vaga compara.
 *
 * O índice vem do array INTEIRO, e não da lista filtrada. Filtrar e depois
 * gravar pelo índice da filtrada apagaria a linha errada assim que
 * houvesse uma formação e um curso ao mesmo tempo.
 */
function ListaDeCursos({
  cursos,
  setCursos,
  tipo,
  rotuloCurso,
  aoSalvar,
  salvando,
}: {
  cursos: CursoEmEdicao[];
  setCursos: React.Dispatch<React.SetStateAction<CursoEmEdicao[]>>;
  tipo: "formacao" | "complementar";
  rotuloCurso: string;
  /* Quem sabe gravar é a página: as listas são salvas em bloco junto com
     o resto do cadastro, e gravar daqui escreveria por cima do que a tela
     ainda tem em memória. */
  aoSalvar: () => void;
  salvando: boolean;
}) {
  /* A lista do banco guarda formação e curso complementar JUNTAS, com um
     campo `tipo` separando. Aqui se enxerga só um dos dois, e ao gravar a
     outra metade volta inteira — sem isso, salvar a formação apagaria os
     cursos. */
  const meus = cursos.filter((c) => c.tipo === tipo);
  const dosOutros = cursos.filter((c) => c.tipo !== tipo);

  const eFormacao = tipo === "formacao";

  return (
    <ListaEmCartoes
      itens={meus}
      aoMudar={(novos) => setCursos([...dosOutros, ...novos])}
      novoItem={(): CursoEmEdicao => ({
        nome: "",
        instituicao: "",
        ano: "",
        tipo,
        situacao: "",
        nivel: "",
      })}
      nomeDoItem={eFormacao ? "formação" : "curso"}
      rotuloAdicionar={
        meus.length
          ? eFormacao
            ? "Outra formação"
            : "Outro curso"
          : eFormacao
            ? "Acrescentar formação"
            : "Acrescentar curso"
      }
      vazio={
        eFormacao
          ? "Ainda não tem nenhuma. Muitas vagas pedem escolaridade mínima, e sem isto o seu cadastro fica de fora delas."
          : "Ainda não tem nenhum. Curso curto conta: NR-35, informática, atendimento."
      }
      /* Sem nome não há cartão para mostrar — e a escolaridade sozinha
         ("Ensino médio", sem curso) é justamente o caso comum da
         formação, então lá ela também vale. */
      temConteudo={(c) =>
        c.nome.trim() !== "" || (eFormacao && c.nivel.trim() !== "")
      }
      resumo={(c) => {
        const escolaridade = nomeDaEscolaridadeDoCartao(c.nivel);
        const titulo = c.nome.trim() || escolaridade || "Formação";
        return {
          titulo,
          linhas: [
            /* A escolaridade só vira linha quando ela NÃO é o título — na
               base de teste havia uma formação com nome "Ensino médio" e
               nível "médio", e o cartão dizia "Ensino médio" duas vezes,
               uma embaixo da outra. */
            escolaridade && escolaridade !== titulo ? escolaridade : null,
            c.instituicao.trim() || null,
            [nomeDaSituacao(c.situacao), c.ano.trim()].filter(Boolean).join(" · ") || null,
          ],
        };
      }}
      aoSalvar={aoSalvar}
      salvando={salvando}
      formulario={(c, mudar) => (
        <>
          {eFormacao && (
            <div className="ei-campo">
              <label htmlFor="curso-nivel">Escolaridade</label>
              <select
                id="curso-nivel"
                value={c.nivel}
                onChange={(e) => mudar({ nivel: e.target.value })}
              >
                <option value="">Escolha</option>
                <option value="fundamental">Ensino fundamental</option>
                <option value="medio">Ensino médio</option>
                <option value="tecnico">Técnico</option>
                <option value="superior">Superior</option>
                <option value="pos">Pós-graduação</option>
                <option value="mestrado">Mestrado</option>
                <option value="doutorado">Doutorado</option>
              </select>
            </div>
          )}

          <div className="ei-campo">
            <label htmlFor="curso-nome">{rotuloCurso}</label>
            <input
              id="curso-nome"
              value={c.nome}
              onChange={(e) => mudar({ nome: e.target.value })}
            />
          </div>

          <div className="ei-campo">
            <label htmlFor="curso-inst">Onde fez</label>
            <input
              id="curso-inst"
              value={c.instituicao}
              onChange={(e) => mudar({ instituicao: e.target.value })}
            />
          </div>

          <div className="ei-duas ei-duas-ano">
            <div className="ei-campo">
              <label htmlFor="curso-sit">Situação</label>
              <select
                id="curso-sit"
                value={c.situacao}
                onChange={(e) => mudar({ situacao: e.target.value })}
              >
                <option value="">Não informado</option>
                {/* "Cursando" é informação, e não ausência dela: quem
                    termina o técnico em dezembro é candidato hoje. */}
                <option value="cursando">Cursando</option>
                <option value="concluido">Concluído</option>
                <option value="trancado">Trancado</option>
              </select>
            </div>
            <div className="ei-campo">
              <label htmlFor="curso-ano">Ano</label>
              <input
                id="curso-ano"
                inputMode="numeric"
                maxLength={4}
                value={c.ano}
                onChange={(e) => mudar({ ano: e.target.value })}
              />
            </div>
          </div>
        </>
      )}
    />
  );
}

/** O nome da escolaridade como se lê no cartão. */
function nomeDaEscolaridadeDoCartao(n: string): string | null {
  const nomes: Record<string, string> = {
    fundamental: "Ensino fundamental",
    medio: "Ensino médio",
    tecnico: "Técnico",
    superior: "Superior",
    pos: "Pós-graduação",
    mestrado: "Mestrado",
    doutorado: "Doutorado",
  };
  return nomes[n] ?? null;
}

/** "Cursando", "Concluído", "Trancado" — ou nada. */
function nomeDaSituacao(s: string): string {
  if (s === "cursando") return "Cursando";
  if (s === "concluido") return "Concluído";
  if (s === "trancado") return "Trancado";
  return "";
}

/**
 * "hoje", "ontem", "há 3 dias", "em 12/08".
 *
 * Data crua ("02/09/2026") obriga a pessoa a fazer a conta de quantos dias
 * faz — e é a conta, e não a data, que ela quer. Passada uma semana a
 * contagem perde a graça e a data volta a ser mais útil.
 */
function quandoFoi(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "Viu hoje";
  if (dias === 1) return "Viu ontem";
  if (dias < 7) return `Viu há ${dias} dias`;
  return `Viu em ${new Date(iso).toLocaleDateString("pt-BR")}`;
}
