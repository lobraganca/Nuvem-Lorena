import { useState } from "react";
import { BottomSheet } from "./BottomSheet";

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

  function tentarFechar() {
    window.close();
    // Se ainda estamos aqui, o sistema recusou. Meio segundo é folgado para
    // o fechamento acontecer e curto para não parecer que o toque falhou.
    window.setTimeout(() => setEnsinando(true), 500);
  }

  return (
    <>
      <button type="button" className="settings-item" onClick={tentarFechar}>
        <span className="settings-icon" aria-hidden="true">
          🚪
        </span>
        <span>Fechar o app</span>
        <span className="settings-arrow" aria-hidden="true">
          ›
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
                <li>Empurre o procurô para cima e solte.</li>
              </ol>
            </div>
            <div>
              <p style={{ margin: "0 0 6px" }}>
                <strong>No Android</strong>
              </p>
              <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, lineHeight: 1.45 }}>
                <li>Toque no botão de aplicativos recentes (o quadrado ou as três barras).</li>
                <li>Empurre o procurô para o lado.</li>
              </ol>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
              Você também pode simplesmente ir para a tela de início do celular: parado ali, o procurô não gasta
              bateria nem internet.
            </p>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
