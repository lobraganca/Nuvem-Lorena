import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
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
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <h1 style={{ marginBottom: 8 }}>Pare de chamar um por um</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Você publica a vaga, e ela é avisada para quem faz aquele serviço em
        Itabirito. Quem tem interesse responde, e a lista chega até você.
      </p>

      {/* O que o plano dá, em três linhas. */}
      <div className="card" style={{ padding: 14, margin: "16px 0" }}>
        <strong style={{ fontSize: "0.95em" }}>Com o plano:</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Publica a vaga.</li>
          <li>
            Avisa quem encaixa — {ONDAS_POR_VAGA} ondas por vaga, da mais parecida
            para a mais ampla.
          </li>
          <li>
            Recebe quem se interessou, e a vaga ainda fica {DIAS_ANUNCIO_VAGA} dias na
            área de anúncios.
          </li>
        </ul>
      </div>

      {/* O que já é de graça, dito antes do preço. Sem isto, "assine para
          publicar" soa como se o app inteiro estivesse trancado — e a
          empresa vai embora sem descobrir a busca, que resolve o problema
          de muita gente sem custar nada. */}
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <strong style={{ fontSize: "0.95em" }}>Sem plano, de graça:</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Ver e procurar todos os profissionais da cidade.</li>
          <li>Falar com cada um direto, pelo telefone do cadastro.</li>
        </ul>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88em" }}>
          Nem conta precisa. O plano serve para não ter que chamar um por um.
        </p>
      </div>

      {/* Mensal ou recorrente */}
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

      <p className="muted" style={{ fontSize: "0.88em", margin: "8px 0 20px" }}>
        {ciclo === "recorrente"
          ? "Cobra todo mês e você cancela quando quiser, no seu painel."
          : `Paga uma vez, vale ${DIAS_ANUNCIO_VAGA} dias e acaba. Não cobra de novo.`}
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {ordem.map((chave) => {
          const p = PLANOS_EMPRESA[chave];
          return (
            <div key={chave} className="card" style={{ padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <strong style={{ fontSize: "1.05em" }}>{p.nome}</strong>
                <span style={{ fontSize: "1.15em", fontWeight: 700 }}>
                  {precoDoPlano(chave)}
                  <span className="muted" style={{ fontSize: "0.75em", fontWeight: 400 }}>
                    {ciclo === "recorrente" ? "/mês" : ` / ${DIAS_ANUNCIO_VAGA} dias`}
                  </span>
                </span>
              </div>

              <p className="muted" style={{ margin: "4px 0 12px", fontSize: "0.92em" }}>
                {p.resumo}.
              </p>

              <button type="button" className="btn btn-primary btn-block" disabled>
                Em breve
              </button>
            </div>
          );
        })}
      </div>

      {/* O botão está desligado e diz por quê.
          ─────────────────────────────────────
          A cobrança ainda não existe: falta a Edge Function que fala com o
          Mercado Pago, como já acontece com as assinaturas de profissional.
          Um botão que abre um checkout inexistente é pior que um desligado —
          e "Em breve" sem explicação é o que faz a pessoa tocar três vezes. */}
      <p className="muted" style={{ marginTop: 16, fontSize: "0.88em" }}>
        A cobrança está sendo ligada. Enquanto isso, fale com a gente pelo suporte
        que a gente libera o seu plano na mão.
      </p>
    </div>
  );
}
