import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { ehAppDaLoja } from "../lib/plataforma";

/**
 * "Fechar o app".
 *
 * O botão tenta fechar de verdade — `window.close()` funciona no app
 * instalado de alguns navegadores, sobretudo no Android — e, quando o
 * sistema não permite, ensina o gesto em vez de não fazer nada.
 *
 * O iPhone é o caso em que não permite: o Safari ignora o pedido de uma
 * página para se fechar, e não existe aviso nem erro — a chamada simplesmente
 * não tem efeito. Por isso a folha de instruções abre por tempo, e não por
 * resposta: se meio segundo depois a página ainda está viva, é porque o
 * fechamento foi ignorado.
 *
 * Um botão que às vezes fecha e sempre explica é honesto. Um botão que não
 * faz nada em metade dos aparelhos ensina a pessoa que o app está travado.
 */
export function FecharApp() {
  const [ensinando, setEnsinando] = useState(false);

  /* No app da loja o botão de voltar do Android já fecha, e o gesto de
     aplicativos recentes também. Um item de menu escrito "Fechar o app"
     que abre uma folha ensinando o gesto que a pessoa já tem é ruído — e
     no Android é o tipo de coisa que um revisor lê como app mal
     adaptado. */
  if (ehAppDaLoja()) return null;

  function tentarFechar() {
    window.close();
    // Se ainda estamos aqui, o sistema recusou. Meio segundo é folgado para
    // o fechamento acontecer e curto para não parecer que o toque falhou.
    window.setTimeout(() => setEnsinando(true), 500);
  }

  return (
    <>
      {/* Linha do desenho do Ei, e não mais `settings-item` com um emoji de
          porta. Ela mora dentro da lista da Conta: com a classe antiga era
          a única linha do bloco com quadradinho cinza e desenho colorido, e
          quebrava o bloco no meio. */}
      <button type="button" className="ei-linha-item" onClick={tentarFechar}>
        <span className="ei-linha-icone" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5H14" />
            <path d="M14.5 8.5L18.5 12l-4 3.5" />
            <path d="M18.5 12H9.5" />
          </svg>
        </span>
        <span className="ei-linha-nome">Fechar o app</span>
        <span className="ei-linha-seta" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>

      {ensinando && (
        <BottomSheet
          title="Seu celular não deixa o app se fechar sozinho"
          subtitle="É regra do sistema, e vale para todos os aplicativos. Fecha assim:"
          onClose={() => setEnsinando(false)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <p style={{ margin: "0 0 6px" }}>
                <strong>No iPhone</strong>
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, lineHeight: 1.45 }}>
                <li>Deslize o dedo de baixo para cima e segure no meio da tela.</li>
                <li>Aparecem os aplicativos abertos, um ao lado do outro.</li>
                <li>Empurre o Ei Emprego para cima e solte.</li>
              </ol>
            </div>
            <div>
              <p style={{ margin: "0 0 6px" }}>
                <strong>No Android</strong>
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, lineHeight: 1.45 }}>
                <li>Toque no botão de aplicativos recentes (o quadrado ou as três barras).</li>
                <li>Empurre o Ei Emprego para o lado.</li>
              </ol>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
              Você também pode simplesmente ir para a tela de início do celular: parado ali, o Ei Emprego não gasta
              bateria nem internet.
            </p>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
