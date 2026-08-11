import { useEffect, useState } from "react";
import {
  getAssinaturasAtivas,
  getResumoFinanceiro,
  type AssinaturasAtivas,
  type ResumoFinanceiro,
} from "../lib/admin";
import { PRECOS_MENSAIS } from "../lib/payments";

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function data(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

const NOME_DO_TIPO: Record<string, string> = {
  verification: "Conta premium",
  boost: "Destaque na busca",
  plus: "Empresa Plus",
  credits: "Créditos de contato",
  sponsorship: "Patrocínio de categoria",
  outros: "Sem categoria",
};

/**
 * O dinheiro do app, num lugar só.
 *
 * Os números estão separados em dois blocos porque merecem confiança
 * diferente, e misturá-los seria a maneira mais fácil de tomar uma decisão
 * de preço em cima de um número que não é o que parece:
 *
 * - **Recebido** é dinheiro que entrou, somado do registro de pagamentos.
 * - **Por mês** é projeção: assinaturas ativas hoje × preço de hoje. Não é
 *   caixa; é o que elas somam por mês se ninguém cancelar.
 *
 * O aviso sobre o início do histórico não é rodapé jurídico: o valor de
 * cada pagamento só passou a ser gravado na migration 0047, e sem essa
 * frase um total baixo pareceria queda de faturamento quando é falta de
 * histórico.
 */
export function AdminFinanceiro() {
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [assinaturas, setAssinaturas] = useState<AssinaturasAtivas | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    Promise.all([getResumoFinanceiro(), getAssinaturasAtivas()]).then(([r, a]) => {
      if (!ativo) return;
      setResumo(r);
      setAssinaturas(a);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (carregando) return <p className="muted">Carregando…</p>;
  if (!resumo || !assinaturas) return null;

  /* Projeção mensal pelo preço de hoje. Usa o preço de pessoa física por
     não haver, aqui, como saber o tipo de cadastro de cada assinante sem
     mais uma consulta — então é o piso, e a tela diz isso. Prometer o teto
     seria a escolha errada num número que serve para decidir preço. */
  const porMesCentavos = Object.entries(assinaturas.porTipo).reduce((soma, [tipo, qtd]) => {
    const preco = PRECOS_MENSAIS[tipo as keyof typeof PRECOS_MENSAIS];
    return soma + (preco ? Math.round(preco.pf * 100) * qtd : 0);
  }, 0);

  const totalGeral = resumo.recebidoCentavos + resumo.bannersRecebidoCentavos;
  const tipos = Object.entries(resumo.porTipo).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="admin-numeros">
        <div className="admin-numero admin-numero-forte">
          <span className="admin-numero-rotulo">Total recebido</span>
          <strong>{reais(totalGeral)}</strong>
          <span className="admin-numero-obs">
            {resumo.desde ? `pagamentos registrados desde ${data(resumo.desde)}` : "nenhum pagamento registrado ainda"}
          </span>
        </div>

        <div className="admin-numero">
          <span className="admin-numero-rotulo">Assinaturas ativas</span>
          <strong>{assinaturas.total}</strong>
          <span className="admin-numero-obs">
            {assinaturas.anuais > 0
              ? `${assinaturas.anuais} anual${assinaturas.anuais > 1 ? "is" : ""}, o resto mensal`
              : "todas mensais"}
          </span>
        </div>

        <div className="admin-numero">
          <span className="admin-numero-rotulo">Somam por mês</span>
          <strong>{reais(porMesCentavos)}</strong>
          <span className="admin-numero-obs">
            projeção pelo preço de hoje, no mínimo — empresa paga mais que autônomo
          </span>
        </div>

        <div className="admin-numero">
          <span className="admin-numero-rotulo">Publicidade a receber</span>
          <strong>{reais(resumo.bannersAReceberCentavos)}</strong>
          <span className="admin-numero-obs">banners no ar ainda não marcados como pagos</span>
        </div>
      </div>

      <div className="admin-detalhe">
        <div>
          <h3>De onde veio</h3>
          {tipos.length === 0 && resumo.bannersRecebidoCentavos === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Nada recebido ainda.</p>
          ) : (
            <ul className="admin-lista">
              {tipos.map(([tipo, centavos]) => (
                <li key={tipo}>
                  <span>{NOME_DO_TIPO[tipo] ?? tipo}</span>
                  <strong>{reais(centavos)}</strong>
                </li>
              ))}
              {resumo.bannersRecebidoCentavos > 0 && (
                <li>
                  <span>Publicidade (banners)</span>
                  <strong>{reais(resumo.bannersRecebidoCentavos)}</strong>
                </li>
              )}
            </ul>
          )}
        </div>

        <div>
          <h3>O que está ativo</h3>
          {assinaturas.total === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Nenhuma assinatura ativa.</p>
          ) : (
            <ul className="admin-lista">
              {Object.entries(assinaturas.porTipo)
                .sort((a, b) => b[1] - a[1])
                .map(([tipo, qtd]) => (
                  <li key={tipo}>
                    <span>{NOME_DO_TIPO[tipo] ?? tipo}</span>
                    <strong>{qtd}</strong>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Dito onde a pessoa está olhando o número, não escondido num rodapé:
          quem lê "Total recebido" precisa saber, na mesma tela, que ele não
          cobre o app inteiro desde o começo. */}
      {resumo.pagamentosSemValor > 0 && (
        <p className="admin-aviso">
          {resumo.pagamentosSemValor} pagamento{resumo.pagamentosSemValor > 1 ? "s" : ""} antigo
          {resumo.pagamentosSemValor > 1 ? "s" : ""} não entra{resumo.pagamentosSemValor > 1 ? "m" : ""} nesta
          soma: o valor de cada cobrança só começou a ser guardado depois. Para o que veio antes, o extrato do
          Mercado Pago é a fonte.
        </p>
      )}
    </div>
  );
}
