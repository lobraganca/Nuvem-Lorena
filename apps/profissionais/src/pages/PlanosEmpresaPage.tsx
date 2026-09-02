import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SUPORTE_WHATSAPP } from "../config";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { Pagina } from "../components/ei/Pagina";
import { podeVender } from "../lib/plataforma";
import {
  PLANOS_EMPRESA,
  PLANO_GRATUITO,
  precoDoPlano,
  DIAS_ANUNCIO_VAGA,
  ONDAS_POR_VAGA,
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

  const ordem: PlanoEmpresa[] = ["pro", "tres", "ilimitado"];

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

        {/* Uma linha só, e curta: ela vive na faixa branca logo abaixo da
            barra azul, e cada palavra a mais empurra o primeiro preço para
            baixo. Era "Dá para começar de graça e assinar depois, quando
            precisar publicar uma vaga." — duas linhas no celular. */}
        {antesDoCadastro && (
          <p className="ei-apoio ei-margem">Comece de graça. Assine quando for publicar.</p>
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
        {!antesDoCadastro && (
          <div className="ei-margem">
            <div className="segmentado" role="group" aria-label="Como pagar">
              <button
                type="button"
                className={ciclo === "recorrente" ? "segmentado-opcao ativa" : "segmentado-opcao"}
                aria-pressed={ciclo === "recorrente"}
                onClick={() => setCiclo("recorrente")}
              >
                Renova sozinho
              </button>
              <button
                type="button"
                className={ciclo === "avulso" ? "segmentado-opcao ativa" : "segmentado-opcao"}
                aria-pressed={ciclo === "avulso"}
                onClick={() => setCiclo("avulso")}
              >
                Pagar uma vez
              </button>
            </div>
            <p className="ei-apoio" style={{ marginTop: 8 }}>
              {ciclo === "recorrente"
                ? "Cancela quando quiser, no seu painel."
                : `Vale ${DIAS_ANUNCIO_VAGA} dias e acaba. Não cobra de novo.`}
            </p>
          </div>
        )}

        <div className="ei-planos">
          {/* O de graça vem primeiro, e não por modéstia: ele é o degrau em
              que a empresa já está. Ver os pagos depois dele é comparar com
              o que ela tem hoje, em vez de escolher no escuro. */}
          <section className="ei-plano-cartao">
            <div className="ei-plano-linha">
              <span className="ei-plano-nome">{PLANO_GRATUITO.nome}</span>
              <span className="ei-plano-preco">R$ 0</span>
            </div>
            <ul className="ei-plano-lista">
              {PLANO_GRATUITO.beneficios.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="ei-plano-resumo">{PLANO_GRATUITO.limite}</p>
            {antesDoCadastro ? (
              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                onClick={() => seguir("gratuito")}
              >
                Aderir e ver o banco de talentos
              </button>
            ) : (
              <p className="ei-plano-resumo">É o que você já tem, sem assinar nada.</p>
            )}
          </section>

          {ordem.map((chave) => {
            const p = PLANOS_EMPRESA[chave];
            return (
              <section key={chave} className="ei-plano-cartao">
                <div className="ei-plano-linha">
                  <span className="ei-plano-nome">{p.nome}</span>
                  <span className="ei-plano-preco">
                    {precoDoPlano(chave)}
                    <span className="ei-plano-ciclo">
                      {ciclo === "recorrente" ? "/mês" : ` / ${DIAS_ANUNCIO_VAGA} dias`}
                    </span>
                  </span>
                </div>
                <ul className="ei-plano-lista">
                  {p.beneficios.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {antesDoCadastro ? (
                  <>
                    <button
                      type="button"
                      className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                      onClick={() => seguir(chave)}
                    >
                      Quero o {p.nome}
                    </button>
                    <p className="ei-plano-resumo">
                      A cobrança ainda está sendo ligada. Você faz o cadastro agora e a
                      gente combina o pagamento depois.
                    </p>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                    disabled
                  >
                    Em breve
                  </button>
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
            <p className="ei-apoio ei-margem" style={{ marginTop: 14 }}>
              A cobrança está sendo ligada. Enquanto isso, fale com o suporte que
              a gente libera o seu plano na mão.
            </p>

            {/* O argumento, agora embaixo e em uma linha cada.
                ───────────────────────────────────────────────
                Eram duas listas com marcador dentro de dois cartões, com frases
                de duas linhas — trinta e três palavras para dizer três coisas.

                O "de graça" continua aqui, e não é modéstia comercial: sem ele
                "assine para publicar" soa como se o app inteiro estivesse
                trancado, e a empresa vai embora sem descobrir a lista de
                profissionais, que resolve o problema de muita gente sem custar
                nada. */}
            <h2 className="ei-secao">Com o plano</h2>
            <div className="ei-lista">
              <div className="ei-linha-texto">Publica a vaga.</div>
              <div className="ei-linha-texto">
                Avisa quem encaixa — {ONDAS_POR_VAGA} ondas por vaga.
              </div>
              <div className="ei-linha-texto">
                Recebe quem se interessou, e {DIAS_ANUNCIO_VAGA} dias de anúncio.
              </div>
            </div>

            <h2 className="ei-secao">Sempre de graça</h2>
            <div className="ei-lista">
              <div className="ei-linha-texto">Ver todos os profissionais da cidade.</div>
              <div className="ei-linha-texto">Falar com cada um pelo telefone do cadastro.</div>
            </div>
            <p className="ei-apoio ei-margem" style={{ marginTop: 10 }}>
              Nem conta precisa. O plano serve para não ter que chamar um por um.
            </p>

            {/* ── ARREPENDIMENTO EM 7 DIAS (art. 49 do CDC) — 02/09 ──────
                A dona: "criar política de reembolso, se a pessoa fizer o
                pedido dentro dos 7 dias previstos em lei."

                A regra já estava escrita nos Termos desde sempre. O que
                faltava era ela aparecer ONDE a pessoa decide pagar: um
                direito que só existe numa página que ninguém abre não
                tranquiliza ninguém — e é justamente a garantia que faz
                assinar quem está em dúvida.

                E faltava o CAMINHO. "Você tem direito a reembolso" sem
                dizer como pedir devolve a pessoa ao mesmo lugar de antes.
                Como a cobrança do plano de empresa ainda é feita na mão
                pelo suporte, o pedido vai pelo mesmo canal — com o texto
                já escrito, para ela não ter que formular nada. */}
            <h2 className="ei-secao">Se você se arrepender</h2>
            <div className="ei-cartao">
              <p className="ei-corpo" style={{ marginTop: 0 }}>
                <strong>Até 7 dias corridos da contratação, devolvemos tudo.</strong> É o
                direito de arrependimento do art. 49 do Código de Defesa do Consumidor:
                não precisa justificar, e o valor volta integralmente pelo mesmo meio de
                pagamento.
              </p>
              <p className="ei-corpo">
                Depois dos 7 dias, cancelar interrompe as próximas cobranças e o período
                já pago continua valendo até o fim — sem multa e sem corte no meio de um
                mês quitado.
              </p>
              <a
                className="ei-btn-inline"
                href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${encodeURIComponent(
                  "Olá! Quero pedir o reembolso do meu plano do Ei Itabirito, dentro dos 7 dias de arrependimento."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pedir reembolso
              </a>
              <p className="ei-apoio" style={{ marginTop: 10, marginBottom: 0 }}>
                O estorno aparece na fatura no prazo do seu banco ou da administradora do
                cartão. Regras completas nos{" "}
                <Link to="/termos">Termos de Uso</Link>.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
