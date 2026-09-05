import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import {
  empresaAtual,
  minhasEmpresas,
  listarMinhasVagas,
  confirmarTelefoneDaEmpresa,
  situacaoDoPlano,
  contarRespostasDasVagas,
} from "../lib/company";
import { mensagemDeErro } from "../lib/erros";
import type { Company, JobListing } from "../types/domain";
import { Callout, Pagina, Prop } from "../components/ei/Pagina";

/**
 * "Ninguém respondeu" / "1 pessoa respondeu" / "4 pessoas responderam".
 *
 * O zero tem frase própria porque "0 pessoas responderam" soa a erro de
 * sistema, e o que aconteceu ali é normal: a vaga acabou de sair.
 */
/**
 * "agora mesmo", "há 3 horas", "há 2 dias", "em 04/09/2026".
 *
 * A dona pediu horas na tela da vaga ("pra empresa ter noção"), e o mesmo
 * vale na lista: uma data crua obriga a empresa a calcular de cabeça se a
 * vaga é nova ou está encalhada — e é a conta, não a data, que ela quer.
 *
 * Passado um mês a contagem perde a graça e a data volta a ser mais útil.
 */
function haQuantoTempo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const horas = Math.floor(ms / 3_600_000);
  const dias = Math.floor(ms / 86_400_000);
  if (horas < 1) return "agora mesmo";
  if (horas < 24) return horas === 1 ? "há 1 hora" : `há ${horas} horas`;
  if (dias < 30) return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
  return `em ${new Date(iso).toLocaleDateString("pt-BR")}`;
}

function textoDeRespostas(n: number): string {
  /* "Interessadas", e não "responderam". Desde a 0078 a pessoa também pode
     responder que a vaga não é para ela, e essa resposta não vira nome no
     painel — contá-la aqui faria a empresa abrir esperando três pessoas
     para encontrar uma. */
  if (n === 0) return "Ninguém se interessou ainda";
  if (n === 1) return "1 pessoa interessada";
  return `${n} pessoas interessadas`;
}

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
  /* Quantas pessoas responderam cada vaga. `null` é "não deu para saber" e
     é diferente de zero: um mapa vazio escreveria "ninguém respondeu" em
     vaga cheia, e a empresa concluiria que ninguém quis o trabalho dela. */
  const [respostas, setRespostas] = useState<Map<string, number> | null>(new Map());
  /* Quem se interessou, com nome e rosto. `null` é "não deu para saber" e é
     diferente de lista vazia: uma lista vazia por erro escreveria "ninguém
     se interessou" numa vaga cheia, e a empresa concluiria que ninguém quis
     o trabalho dela. */
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

  /* Quantas empresas esta conta tem. Decide se o botão "trocar" aparece:
     com uma só, ele levaria a uma tela de escolha entre uma opção. */
  const [quantasEmpresas, setQuantasEmpresas] = useState(1);

  useEffect(() => {
    if (carregandoConta || !user) return;

    carregarDados();
  }, [user, carregandoConta]);

  async function carregarDados() {
    try {
      /* `empresaAtual` e não "a minha empresa": desde a 0102 uma conta
         pode ter várias, e o painel mostra a que está ABERTA — a escolhida
         na tela de escolha, ou a primeira quando ninguém escolheu ainda. */
      const minha = await empresaAtual(user?.id || "");
      /* Quantas existem, para o painel saber se oferece "trocar". Falhar
         aqui não derruba nada: sem o número o botão simplesmente não
         aparece, e o painel continua servindo. */
      minhasEmpresas(user?.id || "")
        .then((todas) => setQuantasEmpresas(todas.length))
        .catch(() => setQuantasEmpresas(1));
      if (!minha) {
        /* ── SEM EMPRESA, O PAINEL LEVA AO CADASTRO ────────────────────
           Isto tinha sido tirado hoje de manhã, porque a dona caía sempre
           no formulário sem saber por quê — mas o defeito real era outro:
           não havia saída dele. Com a saída no lugar ("não é empresa? ir
           para o lado de quem procura trabalho"), o desvio volta, e volta
           a pedido dela:

             "quando a pessoa escolher o painel de empresa, se não tiver
              cadastrado a empresa, tem que cair na tela de cadastro.
              senão ela consegue verificar o banco de talentos e eu não
              consigo ter dados para oferecer planos depois."

           É decisão de negócio, e é dela: o banco de talentos é o que o
           lado da empresa tem de valioso, e entregá-lo a quem não se
           identificou é dar o produto sem saber para quem. */
        navegar("/cadastro-empresa", { replace: true });
        return;
      }
      setEmpresa(minha);

      const minhasVagas = await listarMinhasVagas(minha.id);
      setVagas(minhasVagas);

      /* A contagem vem DEPOIS da lista e num `catch` próprio: é informação
         a mais numa tela que já funciona sem ela. Se a consulta cair, a
         empresa continua vendo as vagas dela — derrubar o painel inteiro
         por causa de um número ao lado do título seria trocar uma tela útil
         por uma mensagem de erro. */
      contarRespostasDasVagas(minhasVagas.map((v) => v.id))
        .then(setRespostas)
        .catch(() => setRespostas(null));

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
          <p className="ei-apoio ei-margem" style={{ paddingTop: 24 }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (!empresa) {
    /* O painel de quem ainda não cadastrou a empresa. Diz o que falta, o
       que se ganha, e oferece a saída para quem entrou no lado errado. */
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Minhas vagas" />
          <section className="ei-cartao" style={{ marginTop: 12 }}>
            <h2 className="ei-etapa-titulo">Falta cadastrar sua empresa</h2>
            <p className="ei-etapa-apoio">
              São três passos curtos. Depois disso você publica vagas, e o app
              avisa quem faz aquele serviço na cidade.
            </p>
            <Link className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto" to="/cadastro-empresa">
              Cadastrar minha empresa
            </Link>
          </section>
          <p className="ei-apoio ei-margem" style={{ marginTop: 12 }}>
            Você contrata como pessoa física? Também vale — é uma opção dentro do
            cadastro.
          </p>
        </div>
      </div>
    );
  }

  const semPlano = plano?.temPlano === false;
  return (
    <div className="ei">
      <div className="ei-tela">
        {/* Cabeçalho de página do Notion, e o estado da empresa em
            PROPRIEDADES — rótulo à esquerda, valor à direita.
            ─────────────────────────────────────────────────────
            Era um cartão com tarja, título "Seu plano", o número 3/3 em
            corpo grande e uma faixa cinza embaixo. Dava a um dado de
            ficha o peso de uma manchete, e era o mesmo cartão branco que
            aparecia em toda tela do app.

            Aqui é o que o Notion faz com o estado de uma página: três
            linhas quietas de rótulo e valor, que se lê de relance e não
            se toca. */}
        {/* A ação principal no cabeçalho, e não só numa grade lá embaixo.
            ────────────────────────────────────────────────────────────
            Publicar vaga é a única coisa que uma empresa vem fazer aqui, e
            estava como um dos quatro quadradinhos iguais do meio da tela,
            com o mesmo peso de "Editar empresa". Agora fica onde a mão
            alcança sem rolar e onde o olho chega primeiro.

            Sem plano ele não aparece: quem não pode publicar não deve ver
            um botão que só leva a uma recusa. Para essa empresa o callout
            logo abaixo é que diz o caminho. */}
        {/* 02/09: o botão saiu da barra azul e desceu para dentro do
            cartão branco — "o botão de incluir nova vaga fica dentro da
            parte branca com um botão laranja igual ao da logo".

            Na barra ele era branco sobre azul, do tamanho do título, e
            longe da linha que diz quantas vagas ainda cabem. Agora fica
            logo abaixo dela: quem lê "cabe mais 1 vaga" tem o botão
            embaixo do dedo. */}
        <Pagina titulo="Minhas vagas">
          {/* ── O RESUMO ABRE A TELA, NÃO A FICHA ──────────────────────
              Vindo dos prints do Conta Azul: a tela de pagamentos abre com
              "Saldo disponível / R$ 10.000,00" — rótulo pequeno em cima,
              número grande embaixo — e só DEPOIS vem a lista. O número que
              a pessoa veio ver ocupa o primeiro lugar da tela.

              Aqui era o contrário. O painel abria com quatro linhas de
              ficha — Empresa, Onde, Plano, Telefone — que nunca mudam, e
              "quantas pessoas se interessaram", que é a única coisa que
              muda e a única razão de a empresa abrir o app, ficava abaixo
              da dobra, depois da lista de vagas.

              A ficha não sumiu: desceu para depois dos atalhos, que é o
              lugar de dado de cadastro. */}
          {/* ── QUAL EMPRESA ESTÁ ABERTA, E COMO TROCAR (itens 4 e 6) ──
              A dona: "ter um botão onde tem a informação da empresa
              'trocar' pra outra empresa se ele tiver cadastrado" e "ter
              como ver a empresa que está selecionada".

              Com duas lojas, o painel é idêntico nas duas — mesmas
              seções, mesmos botões. Sem esta linha, publicar a vaga da
              lanchonete na padaria é um engano que não dá nenhum sinal
              na hora e só aparece quando o telefone toca. */}
          {/* ── UM CARTÃO SÓ, E NÃO TRÊS BLOCOS SOLTOS ─────────────────
              A dona, olhando o painel no celular: "tela extremamente
              quebrada e fora dos padrões que já escrevi."

              Estava. Eram três coisas empilhadas com desenhos diferentes:
              uma LINHA solta com o nome da empresa, um CARTÃO com os dois
              números, e outra LINHA solta com o plano. As duas linhas
              soltas eram texto sobre branco, sem cartão e sem título de
              seção — e como cada uma ficava logo acima de um cartão, elas
              liam como o TÍTULO do cartão de baixo. "Plano Pro · Cabe mais
              1 vaga" parecia ser o nome do quadro de atalhos.

              O resto do app tem duas formas, e só duas: título de seção
              (VAGAS NO AR, DADOS DA EMPRESA) e cartão branco. Qualquer
              coisa fora dessas duas parece sobra de outra tela — e é
              exatamente o que ela viu.

              Agora é UM cartão de identificação: a empresa, os dois
              números e o plano. É também o que ela tinha pedido no item
              10, com todas as letras: "no início ter um card com
              informação sobre o plano e quantas vagas estão disponíveis
              dentro do plano escolhido". */}
          <div className="ei-cartao ei-painel-topo">
            {/* Quem está aberta, e como trocar (itens 4 e 6). Com duas
                lojas o painel é idêntico nas duas, e publicar a vaga na
                errada é um engano que não dá sinal na hora — só quando o
                telefone toca. */}
            {/* ── QUEM É ESTA EMPRESA, COM A FOTO ────────────────────
                A dona: "quando clica na empresa, tem um botão de cadastrar
                outra, esse botão não tinha que ficar na tela onde tem
                opção de entrar nas empresas? Está muito desconfigurado."

                Tinha, e ele saiu daqui: cadastrar a segunda loja é ação da
                tela ANTERIOR, onde ela já é o cartão tracejado com o "+".
                Duas portas para a mesma coisa, em duas telas seguidas, é o
                que faz um app parecer desarrumado — e aqui a porta ficava
                justamente onde a pessoa acabou de escolher em qual empresa
                queria entrar.

                Ficou só "Trocar", que volta para aquela tela — e é de lá
                que se cadastra outra. Vale mesmo com uma empresa só: antes
                o botão mudava de nome conforme a quantidade, então a mesma
                tela tinha dois desenhos diferentes sem nenhum motivo
                visível para quem usa.

                E a foto entrou: é ela que diz de qual loja é este painel
                antes de qualquer palavra — a mesma que a pessoa acabou de
                tocar na tela anterior. */}
            <div className="ei-painel-topo-linha">
              <span className="ei-empresa-logo" aria-hidden="true">
                {empresa.photo_url ? (
                  <img src={empresa.photo_url} alt="" />
                ) : (
                  empresa.company_name.trim().charAt(0).toLocaleUpperCase("pt-BR")
                )}
              </span>
              <span className="ei-painel-topo-texto">
                <span className="ei-painel-topo-nome ei-uma-linha">{empresa.company_name}</span>
                <span className="ei-painel-topo-onde ei-uma-linha">
                  {[empresa.neighborhood, empresa.city].filter(Boolean).join(" · ")}
                </span>
              </span>
              {/* Os dois botões da empresa ficam juntos, na linha dela —
                  02/09
                  ────────────────────────────────────────────────────────
                  A dona: "na tela de minhas vagas, do lado do botão de
                  trocar, coloque o de editar empresa e tire o botão de
                  profissionais."

                  Faz sentido: os dois falam da MESMA empresa que está
                  escrita ao lado — trocar por outra, ou mexer nesta. Numa
                  grade de atalhos lá embaixo, "Editar empresa" ficava sem
                  dizer qual empresa, a três blocos de distância do nome.

                  "Profissionais" saiu: o banco de talentos é da cidade,
                  não desta empresa, e ele está na tela inicial e na barra
                  de baixo — que é onde ele estava sendo procurado. */}
              {/* ── MENORES, E "TROCAR EMPRESA" POR EXTENSO — 05/09 ────
                  A dona: "os botões de editar e trocar podem ser menores.
                  Trocar para 'trocar empresa'."

                  Eram duas pastilhas laranja do tamanho de botão de ação,
                  logo abaixo do nome da empresa — e pesavam mais que o
                  "+ Nova vaga" ali embaixo, que é o que a tela existe
                  para oferecer.

                  E "Trocar" sozinho não dizia trocar O QUÊ. Ao lado de um
                  "Editar" e embaixo do nome da empresa, dava para ler
                  como trocar a foto, o endereço, o plano. O nome inteiro
                  custa cinco letras e tira a adivinhação. */}
              <span className="ei-painel-topo-botoes">
                <Link to="/painel/editar-empresa" className="ei-btn-inline ei-btn-miudo">
                  Editar
                </Link>
                <Link to="/minhas-empresas" className="ei-btn-inline ei-btn-miudo">
                  Trocar empresa
                </Link>
              </span>
            </div>

            {/* Os dois números saíram daqui.
                ─────────────────────────────
                Eles são os MESMOS que agora aparecem no cartão da empresa
                na tela anterior — a pessoa acabou de lê-los para escolher
                em qual entrar, e reencontrá-los idênticos na tela seguinte
                é o que dava a sensação de repetição.

                Nenhum dos dois sumiu do app: "Cabe mais 1 vaga" continua na
                linha do plano, logo abaixo, e quem se interessou tem uma
                seção própria mais adiante, com nome e telefone — que é o
                que a empresa vem procurar de verdade. */}

            {/* O BLOCO DO PLANO SAIU DAQUI — 02/09
                ─────────────────────────────────────
                A dona: "as informações do plano não têm que ficar dentro
                da tela de vagas, ela pode ficar na tela das empresas
                mostrando o plano atual e quantas vagas 1 de 2."

                Faz sentido: com duas lojas cada uma tem o seu plano, e a
                pergunta "qual delas ainda cabe vaga?" é da tela ANTERIOR,
                onde se escolhe em qual entrar. Aqui a pessoa já escolheu.

                O que o plano ainda decide nesta tela é o botão: com as
                vagas cheias ele vira "Aumentar plano" e leva aos planos. */}
            {/* Sem plano ele não aparece: quem não pode publicar não deve
                ver um botão que só leva a uma recusa. Para essa empresa o
                caminho é o "Ver planos" da linha acima. */}
            {/* ── O BOTÃO NÃO VIRA MAIS "AUMENTAR PLANO" — 03/09 ────────
                A dona: "tirar o botão aumentar o plano de dentro do módulo
                minhas vagas."

                Ele trocava de nome sozinho quando as vagas enchiam, e o
                lugar onde a empresa vem publicar virava, sem aviso, o
                lugar onde ela é convidada a pagar mais. Pior: o mesmo
                botão, na mesma posição, passava a fazer outra coisa.

                Agora ele é sempre "+ Nova vaga" e sempre leva à criação.
                Quem esbarrar no teto é recebido lá pela tela que explica
                o que houve e oferece os dois caminhos — fechar uma vaga
                ou mudar de plano. Ver `CriarVagaPage`. */}
            {!semPlano && (
              <Link to="/criar-vaga" className="ei-btn-laranja">
                + Nova vaga
              </Link>
            )}
          </div>

        </Pagina>

        {erro && (
          <p className="ei-campo-erro ei-margem" style={{ marginTop: 16 }} role="alert">
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
          <Callout atencao>
            <strong>Sem o telefone confirmado a vaga não sai.</strong>{" "}
            <button
              type="button"
              className="ei-btn-inline"
              disabled={confirmando}
              onClick={confirmarTelefone}
            >
              {confirmando ? "Confirmando…" : "Confirmar agora"}
            </button>
          </Callout>
        )}

        {semPlano && (
          <Callout>
            Ver profissionais é grátis. Para publicar vaga e disparar a onda,{" "}
            <Link to="/planos-empresa" className="ei-btn-inline">
              escolha um plano
            </Link>
            .
          </Callout>
        )}

        {/* O que a empresa faz daqui.
            ────────────────────────────
            "Criar nova vaga" entrou aqui porque saiu do cartão do plano,
            que deixou de existir — e sem esta linha o caminho principal da
            empresa ficaria só num link pequeno de cabeçalho de seção.

            Sem vaga sobrando no plano, o toque leva ao plano e não à
            criação: a tela de criar recusaria no fim, depois de a empresa
            ter escrito a vaga inteira. */}
        {/* A grade dos caminhos secundários.
            ───────────────────────────────────
            Ela tinha QUATRO quadrados, e dois iam para o mesmo lugar: com
            o plano cheio, o primeiro virava "Aumentar o plano" e o
            terceiro já era "Planos" — os dois abrindo /planos-empresa,
            lado a lado, com desenhos diferentes. Quem visse isso ia supor
            que fazem coisas diferentes e tocar nos dois para descobrir.

            Agora a ação principal mora no cabeçalho e aqui ficam só os
            caminhos que ela não cobre. "Planos" some quando o cabeçalho já
            está oferecendo aumentar o plano. */}
        {/* Três grupos, e não uma lista só.
            ─────────────────────────────────
            Arquivar uma vaga a fazia SUMIR do painel — junto com a lista de
            quem se interessou por ela. E a tela de arquivar promete o
            contrário, por escrito: "quem já respondeu continua nesta lista".
            A lista continuava mesmo; era o caminho até ela que deixava de
            existir.

            No ar primeiro, porque é o que a empresa vem ver. As encerradas
            por último, porque só se procura por elas quando se procura. */}
        {vagas.length === 0 ? (
          <>
            <div className="ei-secao-linha">
              <h2>Vagas no ar</h2>
              <span className="ei-secao-acao">0</span>
            </div>
            <Callout>
              Publique uma vaga e quem tiver interesse aparece aqui.
            </Callout>
          </>
        ) : (
          GRUPOS_DE_VAGA.map(({ estado, titulo, vazio }) => {
            const doGrupo = vagas.filter((v) => v.status === estado);
            /* Grupo vazio não aparece — menos o das que estão no ar, que
               some do painel de quem tem só vagas arquivadas e aí a tela
               deixa de dizer que dá para publicar. */
            if (doGrupo.length === 0 && estado !== "active") return null;

            return (
              <div key={estado}>
                <div className="ei-secao-linha">
                  <h2>{titulo}</h2>
                  <span className="ei-secao-acao">{doGrupo.length}</span>
                </div>

                {doGrupo.length === 0 ? (
                  <Callout>{vazio}</Callout>
                ) : (
                  /* Lista colada num bloco só, e não um cartão por vaga:
                     cinco cartões soltos com espaço entre eles viram um
                     acordeão, e a empresa quer varrer a lista, não
                     contemplar cada uma. */
                  /* `ei-lista-vagas`: as linhas desta lista são maiores
                     que as das outras. A dona: "o card da vaga que está
                     no ar pode ser maiorzinho." É a linha mais importante
                     do painel — é onde estão as pessoas interessadas — e
                     tinha exatamente a altura de um item de menu. */
                  /* ── O CARTÃO DA VAGA — 05/09 ──────────────────────────
                     A dona: "o card da vaga ficou muito sem graça."

                     E estava. Aumentar a altura da linha deixou o item mais
                     alto, mas ele continuou sendo uma LINHA DE MENU esticada:
                     ícone de maleta cinza à esquerda (o mesmo em todas, sem
                     dizer nada), título, e embaixo "1 pessoa interessada ·
                     04/09/2026" quebrando com o "·" pendurado no fim da
                     linha.

                     Agora é cartão de verdade: o título sozinho no alto, e
                     embaixo as informações em PASTILHAS, que é como o resto
                     do app mostra estado. A de gente interessada é verde
                     quando há alguém e cinza quando não há — a empresa varre
                     a lista procurando verde, sem ler nada.

                     A maleta saiu: ícone que se repete igual em todos os
                     itens não informa, só ocupa a largura do título. */
                  <div className="ei-lista ei-lista-vagas">
                    {doGrupo.map((vaga) => (
              <Link key={vaga.id} to={`/vaga/${vaga.id}`} className="ei-linha-item ei-vaga-cartao">
                <span className="ei-vaga-cartao-texto">
                  <span className="ei-vaga-cartao-titulo">{vaga.title}</span>
                  <span className="ei-chips">
                    {respostas !== null &&
                      (() => {
                        const n = respostas.get(vaga.id) ?? 0;
                        return (
                          <span
                            className={
                              n > 0 ? "ei-selo ei-selo-verde" : "ei-selo ei-selo-cinza"
                            }
                          >
                            {textoDeRespostas(n)}
                          </span>
                        );
                      })()}
                    {/* A etiqueta de estado repete o título do grupo de
                        propósito: quem rola a lista inteira perde de vista
                        sob qual cabeçalho está, e confundir uma vaga
                        pausada com uma no ar é deixar de reabrir a que
                        devia estar recebendo. */}
                    {vaga.status === "paused" && (
                      <span className="ei-selo ei-selo-laranja">Pausada</span>
                    )}
                    {vaga.status === "closed" && (
                      <span className="ei-selo ei-selo-cinza">Encerrada</span>
                    )}
                    {/* "há 2 dias" em vez de "04/09/2026": a empresa quer
                        saber se a vaga é nova ou está encalhada, e essa é
                        uma conta que a data crua obriga ela a fazer. */}
                    <span className="ei-vaga-cartao-quando">
                      {haQuantoTempo(vaga.created_at)}
                    </span>
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
            );
          })
        )}

        {/* ── A FICHA DA EMPRESA SAIU DAQUI — 02/09 ──────────────────
            A dona, olhando o painel: "na tela tem duas vezes a informação
            da empresa. Informação de telefone confirmado porque?"

            As duas perguntas têm a mesma resposta. Havia uma seção "Dados
            da empresa" no fim com quatro linhas — Empresa, Onde, Plano,
            Telefone — e as três primeiras já estavam no cartão do topo,
            ditas com outras palavras. Ler o mesmo nome duas vezes na mesma
            tela faz a pessoa procurar a diferença entre os dois, e não há
            nenhuma.

            A quarta — "Telefone: Confirmado" — era pior: não é dado, é o
            resultado de uma conferência que já aconteceu. Um selo verde
            dizendo que está tudo certo ocupa uma linha para não pedir nada
            e não informar nada. O que a empresa precisa saber sobre o
            telefone é o CONTRÁRIO: quando ele NÃO está confirmado — e isso
            já aparece em destaque, no aviso do topo da tela, com o botão
            de confirmar do lado.

            Os dados de cadastro moram onde se mexe neles: em "Editar
            empresa", ali nos atalhos. O painel volta a ser só o que muda:
            quem se interessou, e quais vagas estão no ar. */}

        {/* ── AS PESSOAS INTERESSADAS ─────────────────────────────────────
            A dona: "na tela do empresário ter as vagas que ela
            disponibilizou e as pessoas que interessaram."

            O painel mostrava as vagas e o NÚMERO — "3 pessoas interessadas"
            — e mais nada. Para saber quem eram, a empresa tinha que abrir
            vaga por vaga e voltar. Numa cidade em que as pessoas se
            conhecem, o nome e o rosto são o que ela veio ver: reconhecer
            alguém decide o telefonema antes de qualquer currículo.

            Todas as vagas juntas, e não uma seção por vaga: quem contrata
            olha "quem apareceu hoje", e a vaga de cada pessoa vem escrita
            do lado. */}
        {/* A LISTA DE INTERESSADOS SAIU DAQUI — 02/09
            ───────────────────────────────────────────
            A dona: "debaixo do card da empresa aparece as pessoas
            interessadas, isso não teria que ser na tela das vagas?"

            Teria, e já era: a tela de cada vaga tem a seção "Profissionais
            interessados", com quem respondeu AQUELA vaga. Aqui embaixo
            vinha a mesma gente de novo, de todas as vagas misturadas, com
            o título da vaga escrito ao lado de cada nome para desfazer a
            mistura — ou seja, o painel juntava o que a pessoa depois tinha
            de separar com os olhos.

            Cada linha da lista de vagas já diz quantos se interessaram, e
            um toque abre a vaga com os nomes. Um caminho, e não dois. */}
      </div>
    </div>
  );
}

/* Os três estados de uma vaga, na ordem em que a empresa pensa neles.
   "Encerradas" e não "fechadas": a empresa encerra um processo seletivo,
   não fecha um arquivo. */
const GRUPOS_DE_VAGA = [
  {
    estado: "active" as const,
    titulo: "Vagas no ar",
    vazio: "Publique uma vaga e quem tiver interesse aparece aqui.",
  },
  {
    estado: "paused" as const,
    titulo: "Pausadas",
    vazio: "",
  },
  {
    estado: "closed" as const,
    titulo: "Encerradas",
    vazio: "",
  },
];

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

