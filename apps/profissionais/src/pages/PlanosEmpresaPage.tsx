import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { Pagina } from "../components/ei/Pagina";
import { podeVender } from "../lib/plataforma";
import {
  PLANOS_EMPRESA,
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

  /* Dentro do app da loja esta tela não existe. Não é "escondida": ela
     redireciona, porque uma tela em branco com o menu em volta faz a pessoa
     achar que o app quebrou. E em lugar nenhum aparece "assine no site" —
     convidar a pagar fora é a mesma violação que vender. */
  if (!podeVender()) {
    navegar("/painel-empresa", { replace: true });
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
        <Pagina titulo="Planos" />

        {/* Mensal ou avulso — antes dos preços, porque é o que muda os
            números que vêm logo abaixo. */}
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

        <div className="ei-lista" style={{ marginTop: 16 }}>
          {ordem.map((chave) => {
            const p = PLANOS_EMPRESA[chave];
            return (
              <div key={chave} className="ei-plano">
                <div className="ei-plano-linha">
                  <span className="ei-plano-nome">{p.nome}</span>
                  <span className="ei-plano-preco">
                    {precoDoPlano(chave)}
                    <span className="ei-plano-ciclo">
                      {ciclo === "recorrente" ? "/mês" : ` / ${DIAS_ANUNCIO_VAGA} dias`}
                    </span>
                  </span>
                </div>
                <p className="ei-plano-resumo">{p.resumo}.</p>
                <button
                  type="button"
                  className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                  disabled
                >
                  Em breve
                </button>
              </div>
            );
          })}
        </div>

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
      </div>
    </div>
  );
}
