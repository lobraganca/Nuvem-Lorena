import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { podeVender } from "../lib/plataforma";
import {
  PLANOS_EMPRESA,
  precoDoPlano,
  DIAS_ANUNCIO_VAGA,
  type CicloDoPlano,
  type PlanoEmpresa,
} from "../types/domain";

/**
 * Os planos de quem contrata.
 *
 * O que se compra aqui é o direito de ANUNCIAR — deixar a vaga parada na
 * tela onde as pessoas procuram. Duas coisas continuam de graça e é
 * importante que a tela diga isso, senão o plano parece um pedágio para
 * usar o app:
 *
 * - Ver e buscar profissionais. Sempre foi livre, sem conta, para qualquer
 *   pessoa. Uma empresa que não quer anunciar entra e procura como todo
 *   mundo.
 * - Publicar a vaga e disparar as ondas. Qualquer vaga avisa as pessoas que
 *   encaixam, com ou sem plano.
 *
 * Dizer o que é grátis ao lado do que é pago não é modéstia comercial: quem
 * não entende o que já tem de graça desconfia do que está sendo vendido.
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
      <h1 style={{ marginBottom: 8 }}>Anuncie suas vagas</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        A vaga anunciada fica {DIAS_ANUNCIO_VAGA} dias na tela onde as pessoas de
        Itabirito procuram trabalho — além de ser avisada pelas ondas.
      </p>

      {/* O que já é de graça, dito antes do preço. */}
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <strong style={{ fontSize: "0.95em" }}>Sem plano você já pode:</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Ver e procurar os profissionais da cidade, sem pagar nada.</li>
          <li>Publicar a vaga e avisar quem encaixa, pelas ondas.</li>
        </ul>
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.88em" }}>
          O plano serve para a vaga também <strong>ficar parada</strong> onde quem
          procura passa — para quem não recebeu o aviso encontrar sozinho.
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
