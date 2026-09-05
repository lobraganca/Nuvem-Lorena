import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SUPORTE_WHATSAPP } from "../config";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { Pagina } from "../components/ei/Pagina";
import { useAuth } from "../lib/useAuth";
import { minhasEmpresas } from "../lib/company";
import type { Company } from "../types/domain";
import { podeVender } from "../lib/plataforma";
import {
  PLANOS_EMPRESA,
  PLANO_GRATUITO,
  precoDoPlano,
  DIAS_ANUNCIO_VAGA,
  type CicloDoPlano,
  type PlanoEmpresa,
} from "../types/domain";

/**
 * Os planos de quem contrata.
 *
 * O que se compra aqui é publicar vaga: a onda que avisa quem encaixa, e as
 * respostas de quem se interessou chegando sozinhas. O anúncio na área de
 * anúncios vem junto.
 *
 * O que continua de graça, e a tela precisa dizer: ver e procurar os
 * profissionais, e falar com cada um direto. Sempre foi livre, sem conta,
 * para qualquer pessoa — e uma empresa que topa chamar um por um resolve o
 * problema dela sem pagar nada.
 *
 * Dizer isso ao lado do preço não é modéstia comercial, é o que faz o preço
 * ser entendido: o plano não vende acesso aos profissionais (que é grátis),
 * vende não ter que chamar cada um deles.
 *
 * A tela inteira some dentro do app da Play Store (ver `podeVender`), e a
 * rota nem existe lá. A Google não permite vender bem digital por fora da
 * cobrança dela, e mostrar o preço já conta como vender.
 */
export function PlanosEmpresaPage() {
  useTituloDaPagina("Planos para contratar");
  const navegar = useNavigate();

  /* Recorrente por padrão porque é o que quase todo mundo quer: a vaga que
     ficou no ar 30 dias e some sozinha, sem aviso, é a reclamação previsível
     do avulso. Quem prefere pagar uma vez troca num toque. */
  const [ciclo, setCiclo] = useState<CicloDoPlano>("recorrente");

  /* ── A MESMA TELA, DOIS MOMENTOS ────────────────────────────────────
     A dona: "antes de cadastrar a empresa o app deve mostrar em cards
     bonitos e arredondados com andamento vertical os planos disponíveis,
     desde o free. com preços, especificações e se deseja aderir".

     Então esta tela passou a ser também a PRIMEIRA coisa que a empresa vê,
     antes do formulário — e não só um item de menu para quem já está
     dentro. O que muda entre os dois momentos é pouco e importa: o título,
     o botão de voltar (que não existe antes do cadastro, porque não há
     para onde voltar) e o texto do botão de cada cartão, que ali é uma
     escolha e não uma compra.

     Escolher um plano pago aqui não cobra nada: a cobrança ainda não está
     ligada. A escolha fica guardada e o cadastro continua — prometer o
     contrário seria vender o que não existe. */
  const [busca] = useSearchParams();
  const antesDoCadastro = busca.get("antes") === "cadastro";

  function seguir(escolha: PlanoEmpresa | "gratuito") {
    /* O gratuito não leva ao formulário: leva ao banco de talentos.
       ────────────────────────────────────────────────────────────
       A dona: "no plano gratuito também deve ter opção de aderir e a tela
       ir para o banco de talentos."

       Faz sentido e conserta uma incoerência que estava ali: o gratuito
       não publica vaga, então mandar quem o escolheu preencher treze
       campos de cadastro de empresa é pedir trabalho por nada. O que o
       gratuito DÁ é a lista de gente da cidade — então é para lá que o
       botão vai. O cadastro continua esperando, no dia em que ela quiser
       publicar. */
    if (escolha === "gratuito") {
      navegar("/profissionais");
      return;
    }

    /* Guarda a intenção para o painel oferecer o pagamento depois, quando
       a cobrança existir. `try` porque navegador em aba anônima recusa o
       armazenamento — e perder a escolha não pode travar o cadastro. */
    try {
      localStorage.setItem("ei-plano-escolhido", escolha);
    } catch {
      /* segue sem guardar */
    }
    navegar("/cadastro-empresa", { replace: true });
  }

  /* Dentro do app da loja esta tela não existe. Não é "escondida": ela
     redireciona, porque uma tela em branco com o menu em volta faz a pessoa
     achar que o app quebrou. E em lugar nenhum aparece "assine no site" —
     convidar a pagar fora é a mesma violação que vender. */
  if (!podeVender()) {
    navegar(antesDoCadastro ? "/cadastro-empresa" : "/painel-empresa", { replace: true });
    return null;
  }

  const ordem: PlanoEmpresa[] = ["pro", "tres", "cinco", "dez", "ilimitado"];

  return (
    /* O PREÇO PRIMEIRO, e o desenho do Ei.
       ────────────────────────────────────
       Esta tela tinha 1633px de altura e o primeiro preço só aparecia a
       1150px — depois de um título de venda, um parágrafo de três linhas e
       DUAS listas com marcador. Quem abre "Planos" abriu para ver quanto
       custa; fazer essa pessoa rolar por seis parágrafos de argumento antes
       do número é responder outra pergunta que não a dela.

       O argumento não sumiu, desceu. Quem quer saber o que o plano faz lê
       logo abaixo do preço, que é onde a pergunta nasce.

       E a tela era a última grande ainda escrita com `container`, `card` e
       `btn btn-primary` do tema antigo, com estilo solto em quase toda tag:
       cartão cinza e botão laranja no meio de um app preto e branco. */
    <div className="ei">
      <div className="ei-tela">
        <Pagina
          titulo={antesDoCadastro ? "Escolha seu plano" : "Planos"}
          voltar={antesDoCadastro ? undefined : "/painel-empresa"}
        />

        {/* O que está valendo hoje, antes de qualquer preço. */}
        {!antesDoCadastro && <AssinaturaAtual />}

        {/* Uma linha só, e curta: ela vive na faixa branca logo abaixo da
            barra azul, e cada palavra a mais empurra o primeiro preço para
            baixo. Era "Dá para começar de graça e assinar depois, quando
            precisar publicar uma vaga." — duas linhas no celular. */}
        {antesDoCadastro && (
          <p className="ei-apoio ei-margem">
            Escolher agora não cobra nada — você paga na hora de publicar a
            primeira vaga.
          </p>
        )}

        {/* ── O TOPO DESTA TELA ESTAVA COM QUATRO FAIXAS ───────────────
            A dona, com o print na mão: "o topo está muito confuso."

            Eram, de cima para baixo: a marca, o título da tela, uma linha
            de apoio em faixa branca, o seletor "Renova sozinho / Pagar uma
            vez" e mais uma linha explicando o seletor. Cinco alturas
            diferentes antes do primeiro preço — e o preço é o que a pessoa
            veio ver.

            O seletor sai de cena ANTES do cadastro: nesse momento a
            empresa está decidindo SE quer um plano, não como pagar. Quem
            já é cliente continua vendo o seletor no acesso pelo menu, que
            é onde a pergunta "mensal ou avulso?" nasce de verdade. */}
        {/* ── A ESCOLHA DE COMO PAGAR, EXPLICADA DENTRO DELA — 04/09 ────
            A dona: "o botão de pagamento uma vez ou recorrente está
            confuso."

            Estava, e o motivo é concreto: eram dois botõezinhos com duas
            palavras cada ("Renova sozinho" / "Pagar uma vez") e UMA linha
            de explicação embaixo, que mudava conforme o escolhido. Ou
            seja: para comparar as duas, a pessoa tinha que tocar numa,
            ler, tocar na outra, ler de novo, e guardar as duas frases na
            cabeça. E como o PREÇO é o mesmo nos dois (é: `precoDoPlano`
            não muda com o ciclo), quem olhava não achava diferença
            nenhuma — parecia um botão quebrado.

            Agora são duas opções grandes, lado a lado, cada uma dizendo o
            que faz DENTRO dela, ao mesmo tempo. E o preço igual está
            escrito com todas as letras, em vez de deixar a pessoa
            procurando a pegadinha. */}
        {/* ── COMO PAGAR VIROU UMA CHAVINHA — 05/09 ────────────────────
            A dona, de novo: "a tela dos planos está muito confusa, faça
            mais clean e chamativa."

            Isto eram DOIS CARTÕES GRANDES, com título de seção em cima e
            uma linha de explicação embaixo — quase meia tela perguntando
            "como você prefere pagar?" ANTES de a pessoa ter visto um
            preço sequer. Perguntar a forma de pagamento antes de mostrar
            o que se compra é a inversão que fazia a tela parecer um
            formulário.

            E o peso visual mentia sobre a importância: o preço é
            EXATAMENTE o mesmo nos dois (`precoDoPlano` não olha o ciclo),
            então esta é a escolha mais barata da tela, ocupando o maior
            espaço dela.

            Agora é uma chavinha de duas palavras, e a linha embaixo diz
            as duas coisas AO MESMO TEMPO — sem obrigar a tocar numa, ler,
            tocar na outra e guardar as duas frases na cabeça, que era a
            queixa da versão anterior. */}
        {!antesDoCadastro && (
          <div className="ei-margem ei-comopagar">
            <div className="ei-chave" role="group" aria-label="Como pagar">
              <button
                type="button"
                className="ei-chave-opcao"
                aria-pressed={ciclo === "recorrente"}
                onClick={() => setCiclo("recorrente")}
              >
                Todo mês
              </button>
              <button
                type="button"
                className="ei-chave-opcao"
                aria-pressed={ciclo === "avulso"}
                onClick={() => setCiclo("avulso")}
              >
                Uma vez só
              </button>
            </div>
            <p className="ei-apoio ei-comopagar-nota">
              Mesmo preço nos dois: <strong>todo mês</strong> renova sozinho e
              cancela quando quiser; <strong>uma vez só</strong> vale{" "}
              {DIAS_ANUNCIO_VAGA} dias e nunca cobra de novo.
            </p>
          </div>
        )}

        {/* ══ A LISTA DEIXOU DE ROLAR PARA O LADO — 05/09 ════════════════
            A dona: "a tela dos planos está muito confusa, faça mais clean
            e chamativa."

            O defeito não era enfeite: OS PLANOS ESTAVAM NUM CARROSSEL
            HORIZONTAL. Seis cartões lado a lado, cada um com 82% da
            largura da tela — então aparecia um e a beirada do seguinte, e
            para ver o quinto preço era preciso arrastar quatro vezes.

            Comparar preço é o serviço inteiro desta tela, e rolagem
            lateral é o formato que mais atrapalha comparar: some da vista
            justamente aquilo que se está comparando. Pior, quase ninguém
            descobre sozinho que se arrasta — quem não descobre acha que o
            app tem dois planos.

            Agora é uma coluna: rola para baixo como o resto do app, os
            preços ficam alinhados um embaixo do outro e dá para varrer os
            cinco de relance.

            E CADA CARTÃO PERDEU A LISTA DE VISTOS. Entre os planos pagos
            só UMA coisa muda de verdade — quantas vagas abertas —, e ela
            estava escondida como primeiro item de uma lista com ✓, no
            mesmo tamanho de letra do resto. Agora ela É o cartão: frase
            grande à esquerda, preço grande à direita, e o que sobra vira
            uma linha miúda. A informação é a mesma; o que mudou é que ela
            se lê sem ser procurada. */}
        <div className="ei-ofertas">
          {/* ── O DE GRAÇA VOLTOU PARA CIMA, E IGUAL AOS OUTROS — 05/09
              A dona: "o plano de graça pode ficar também em um card igual
              ao dos outros e em cima."

              Mais cedo hoje ele tinha descido para o fim e ganhado fundo
              rebaixado e fio tracejado, com o argumento de que não
              precisa ser vendido. O argumento estava errado por um
              motivo simples: ele É uma opção, e opção se compara — com
              outra forma e noutro lugar, ele parava de ser comparável
              com os pagos, que é justamente o serviço desta tela.

              E em cima porque é o degrau em que a empresa já está: ver os
              pagos depois dele é comparar com o que ela tem hoje, em vez
              de escolher no escuro. */}
          <section className="ei-oferta">
            <div className="ei-oferta-topo">
              <span className="ei-oferta-titulo">Sem plano, de graça</span>
              <span className="ei-oferta-preco">R$ 0</span>
            </div>
            <span className="ei-oferta-nome">{PLANO_GRATUITO.nome}</span>
            <span className="ei-oferta-nota">
              {PLANO_GRATUITO.beneficios.join(" · ")}
            </span>
            <span className="ei-oferta-nota">{PLANO_GRATUITO.limite}</span>
            {antesDoCadastro ? (
              <button
                type="button"
                className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                onClick={() => seguir("gratuito")}
              >
                Aderir e ver o banco de talentos
              </button>
            ) : null}
          </section>

          {ordem.map((chave) => {
            const p = PLANOS_EMPRESA[chave];
            /* ── UM PLANO EM DESTAQUE — 04/09 ─────────────────────────
                A dona: "precisa ser mais atrativa... preciso fazer uma
                coisa mais chamativa."

                Cinco cartões iguais em fila não são uma oferta: são um
                formulário de escolha múltipla, e quem não sabe a diferença
                entre 1 e 3 vagas fecha a tela. Um destaque responde "e se
                eu não souber qual?" sem obrigar ninguém a nada — e é o Ei
                Onda porque é o primeiro que resolve o caso comum daqui:
                mais de uma vaga aberta ao mesmo tempo, que é o que uma
                loja com balcão e cozinha tem.

                Na coluna vertical o selo finalmente APARECE: no carrossel
                ele nascia fora da tela, junto com o cartão que marcava. */
            const destaque = chave === "tres";
            /* O primeiro benefício é sempre a contagem de vagas — é o que
               diferencia um plano do outro, e por isso vira o título. O
               resto desce para a linha miúda. */
            const [quantasVagas, ...resto] = p.beneficios;
            const rotulo = p.sobConsulta ? "Falar com a gente" : `Quero o ${p.nome}`;
            return (
              <section
                key={chave}
                className={destaque ? "ei-oferta ei-oferta-destaque" : "ei-oferta"}
              >
                {destaque && <span className="ei-oferta-selo">Mais escolhido</span>}
                <div className="ei-oferta-topo">
                  <span className="ei-oferta-titulo">{quantasVagas}</span>
                  {/* Preço só de quem tem preço. O Ei Infinit é combinado
                      caso a caso: escrever "R$ 0,00" nele prometeria
                      gratuidade, e inventar um número faria a empresa
                      cobrar esse número na conversa. */}
                  {p.sobConsulta ? (
                    <span className="ei-oferta-preco ei-oferta-preco-consulta">
                      Sob consulta
                    </span>
                  ) : (
                    <span className="ei-oferta-preco">
                      {precoDoPlano(chave)}
                      <span className="ei-oferta-ciclo">
                        {ciclo === "recorrente" ? "/mês" : `/${DIAS_ANUNCIO_VAGA} dias`}
                      </span>
                    </span>
                  )}
                </div>
                <span className="ei-oferta-nome">{p.nome}</span>
                {resto.map((b) => (
                  <span key={b} className="ei-oferta-nota">
                    {b}
                  </span>
                ))}
                {antesDoCadastro ? (
                  /* A frase "você escolhe agora e paga na hora de publicar"
                     ficava aqui, embaixo de CADA cartão — seis vezes na
                     mesma tela, inclusive embaixo do plano sob consulta
                     (que não tem preço para pagar) e do de graça (que não
                     cobra nada). Ela é verdadeira e importante, então
                     subiu para a linha de apoio do topo, dita uma vez. */
                  <button
                    type="button"
                    className={
                      destaque
                        ? "ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                        : "ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                    }
                    onClick={() => seguir(chave)}
                  >
                    {rotulo}
                  </button>
                ) : (
                  /* ── O BOTÃO DEIXOU DE SER UM BECO — 04/09 ─────────────
                     Ele dizia "Em breve", desligado, e logo abaixo vinha
                     um parágrafo explicando que a cobrança ainda estava
                     sendo ligada. A dona mandou tirar esse parágrafo — e
                     um botão desligado SEM a explicação é pior que os
                     dois juntos: a empresa toca três vezes e desiste.

                     Então o botão passa a fazer a única coisa que hoje
                     resolve de verdade: abrir a conversa com o suporte já
                     com o nome do plano escrito. Nada é prometido que não
                     exista.

                     O destaque é o único de fundo cheio: cinco botões
                     sólidos em coluna brigam entre si e nenhum chama. */
                  <a
                    className={
                      destaque
                        ? "ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                        : "ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                    }
                    href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
                      p.sobConsulta
                        ? `Olá! Quero saber sobre o plano ${p.nome} do Ei Emprego.`
                        : `Olá! Quero assinar o plano ${p.nome} do Ei Emprego.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {rotulo}
                  </a>
                )}
              </section>
            );
          })}

        </div>

        {/* Estes três blocos repetem, em lista, o que os cartões já dizem
            item por item. Antes do cadastro isso é ruído: a pessoa acabou
            de ler tudo isso dentro do cartão do plano. Ficam só no acesso
            pelo menu, onde quem chega já é cliente e vem conferir o que
            tem direito. */}
        {!antesDoCadastro && (
          <>
        {/* O botão está desligado e diz por quê.
                ─────────────────────────────────────
                A cobrança ainda não existe: falta a Edge Function que fala com
                o Mercado Pago, como já acontece com as assinaturas de
                profissional. Um botão que abre um checkout inexistente é pior
                que um desligado — e "Em breve" sem explicação é o que faz a
                pessoa tocar três vezes. */}
            {/* O que é IGUAL nos três, dito uma vez só — ver o comentário
                em `PLANOS_EMPRESA`. Antes eram duas linhas repetidas dentro
                de cada um dos três cartões. */}
            {/* ── A FRASE DOS TRÊS PLANOS, REESCRITA — 04/09 ────────────
                A dona: "tem uma fala que tem que revisar: 'todos incluem
                aviso que pra quem tem a função que você procura'."

                Estava escrita como uma etiqueta de embalagem — "Todos
                incluem: aviso para quem tem a função que você procura" —,
                com dois-pontos no meio e sem sujeito nenhum. Quem lia
                tinha de montar a frase sozinha para descobrir QUEM avisa
                QUEM. Agora é uma frase inteira, com quem faz a ação na
                frente. */}
            {/* Saiu a pedido da dona (04/09): "tire essa fala". Ela dizia o
                que os três cartões de plano logo acima já dizem, e numa tela
                de preço a repetição não reforça — faz procurar a diferença
                entre as duas frases, não achar nenhuma, e desconfiar. */}

            {/* ── AS DUAS LISTAS DE ARGUMENTO SAÍRAM — 04/09 ────────────
                A dona: "a tela de planos está muito cheia de informação e
                sem respiro."

                Estava: 1900px de altura, e a metade de baixo REPETIA a de
                cima. "Com o plano" dizia publica a vaga, avisa quem
                encaixa e recebe quem se interessou — as mesmas três linhas
                que já estavam dentro de cada cartão de preço. "Sempre de
                graça" repetia, item por item, o cartão Gratuito, que fica
                a duas telas de distância.

                Numa tela de preço, repetir não reforça: faz a pessoa
                procurar a diferença entre as duas listas, não achar
                nenhuma, e desconfiar. O que sobrou é a única frase que os
                cartões não diziam. */}
            {/* Saiu a pedido da dona (04/09). */}

            <h2 className="ei-secao">Se você se arrepender</h2>
            {/* O texto encolheu de dois parágrafos longos para duas
                frases — a garantia é o que tranquiliza, o detalhe do
                estorno e do cancelamento é o que cansa. O que saiu está
                nos Termos, cujo link continua logo abaixo. */}
            <div className="ei-cartao">
              {/* ── DE DOIS PARÁGRAFOS PARA UMA LINHA — 04/09 ─────────
                  A dona: "o texto de arrependimento está enorme."

                  Ele já tinha encolhido de dois parágrafos longos para dois
                  curtos, e continuava sendo o bloco mais comprido de uma
                  tela cujo assunto é preço. O que a pessoa precisa saber
                  aqui cabe numa linha: sete dias, dinheiro de volta, sem
                  justificar. O resto — que cancelar depois disso só para as
                  próximas cobranças — é regra de contrato, e regra de
                  contrato mora nos Termos, cujo link está logo abaixo. */}
              <p className="ei-corpo" style={{ marginTop: 0, marginBottom: 0 }}>
                <strong>Até 7 dias, devolvemos tudo</strong> — sem precisar justificar.
              </p>
              {/* ── O PEDIDO SAIU DO WHATSAPP — 04/09 ──────────────────
                  A dona: "a pessoa ao pedir reembolso ter onde escrever o
                  motivo, e isso chegar pra mim no painel do administrador."

                  Era um link que abria uma conversa com o texto pronto. O
                  pedido virava mais uma mensagem no meio de outras trinta:
                  sem lista, sem data, sem como saber o que já foi
                  resolvido — e o motivo, que é a parte que ensina alguma
                  coisa, se perdia na conversa. */}
              <Link className="ei-btn-inline" to="/reembolso">
                Pedir reembolso
              </Link>
              <p className="ei-apoio" style={{ marginTop: 10, marginBottom: 0 }}>
                Regras completas nos <Link to="/termos">Termos de Uso</Link>.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


/**
 * "Seu plano agora": qual é, desde quando e até quando.
 *
 * ── O pedido ──────────────────────────────────────────────────────────
 *
 * A dona: "dentro da tela de planos, colocar data de início, a vigência."
 *
 * A tela mostrava três preços e nada sobre o que a empresa JÁ tem. Quem
 * abre "Meu plano" quase nunca vem comprar: vem conferir até quando o que
 * pagou vale — e essa era exatamente a informação que não estava em tela
 * nenhuma do app.
 *
 * ── Por que a data de início pode não aparecer ────────────────────────
 *
 * `plano_desde` é da migration 0110. Enquanto a SQL não for aplicada, a
 * coluna não existe e o campo chega indefinido — e aí o bloco mostra só a
 * vigência, que sempre existiu. Escrever isso como opcional foi de
 * propósito: publicar uma tela que depende de coluna nova é o erro que já
 * derrubou o cadastro por um dia inteiro (ver a 0060 no CLAUDE.md).
 *
 * ── O plano é da CONTA (0107) ─────────────────────────────────────────
 *
 * O teto é somado entre as lojas, então quem manda é o melhor plano em dia
 * de qualquer uma delas — e é a data DELE que a tela mostra.
 */
function AssinaturaAtual() {
  const { user } = useAuth();
  const [empresas, setEmpresas] = useState<Company[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    /* Falha em silêncio: este bloco é informativo, e derrubar a tela de
       planos por causa dele deixaria a empresa sem o caminho de assinar. */
    minhasEmpresas(user.id)
      .then((lista) => vivo && setEmpresas(lista))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user]);

  if (!empresas) return null;

  const agora = Date.now();
  const forca = { pro: 1, tres: 2, ilimitado: 3 } as const;
  let melhor: Company | null = null;
  let nota = 0;
  for (const e of empresas) {
    if (!e.plano || !e.plano_ate || new Date(e.plano_ate).getTime() < agora) continue;
    const f = forca[e.plano as keyof typeof forca] ?? 0;
    if (f > nota) {
      nota = f;
      melhor = e;
    }
  }

  /* Sem plano em dia não há vigência para mostrar, e um bloco dizendo
     "plano gratuito, vence nunca" só empurraria os preços para baixo. */
  if (!melhor || !melhor.plano) return null;

  const dia = (quando: string) =>
    new Date(quando).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const ate = melhor.plano_ate as string;
  /* Quantos dias faltam, arredondando para cima: com 0,4 dia restando a
     conta para baixo diria "vence em 0 dias" numa assinatura que ainda
     está valendo. */
  const faltam = Math.ceil((new Date(ate).getTime() - agora) / 86400000);

  return (
    <div className="ei-assinatura ei-margem">
      <span className="ei-assinatura-nome">
        Plano {PLANOS_EMPRESA[melhor.plano]?.nome ?? melhor.plano}
      </span>
      <dl className="ei-assinatura-datas">
        {melhor.plano_desde && (
          <div>
            <dt>Começou em</dt>
            <dd>{dia(melhor.plano_desde)}</dd>
          </div>
        )}
        <div>
          <dt>{melhor.plano_recorrente ? "Renova em" : "Vale até"}</dt>
          <dd>{dia(ate)}</dd>
        </div>
      </dl>
      <p className="ei-assinatura-nota">
        {melhor.plano_recorrente
          ? `Renova sozinho nessa data. ${
              faltam <= 1 ? "É amanhã." : `Faltam ${faltam} dias.`
            } Dá para cancelar quando quiser, em Conta.`
          : `Depois dessa data as vagas param de ser publicadas. ${
              faltam <= 1 ? "É amanhã." : `Faltam ${faltam} dias.`
            }`}
      </p>
    </div>
  );
}
