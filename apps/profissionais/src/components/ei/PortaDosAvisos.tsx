import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import { quantasVagasNovas, todosOsAvisos } from "../../lib/minhasVagas";
import { IconePorta } from "../../pages/ei/ComecarPage";

/**
 * "Avisos" na tela de quem procura emprego, com o que tem dentro escrito.
 *
 * ── O pedido ──────────────────────────────────────────────────────────
 *
 * A dona: "na tela de procuro emprego pode ter um botão de notificações
 * que mostre se a pessoa foi chamada por alguma onda."
 *
 * Os avisos já existiam na barra de baixo, mas ali são um sino pequeno
 * entre cinco ícones — e essa é justamente a notícia que faz a pessoa
 * abrir o app. Aqui a porta não só leva: ela CONTA. "1 vaga nova" na
 * própria tela poupa o toque de quem não tem novidade nenhuma, e chama
 * quem tem.
 *
 * ── Por que duas contagens ────────────────────────────────────────────
 *
 * `novas` são as que ainda não foram abertas — é o selo laranja, o que
 * chama. `total` é quanta vaga já chegou pela onda: sem ele, quem abriu
 * tudo veria uma porta muda, sem saber se o app já trabalhou por ela
 * alguma vez.
 *
 * ── Falha em silêncio ─────────────────────────────────────────────────
 *
 * Esta é uma porta, e o caminho para os avisos vale com ou sem número.
 * Derrubar a tela de "Procuro emprego" por causa de uma contagem seria
 * trocar a casa inteira por um enfeite. O que ela nunca faz é mostrar
 * "nenhum aviso" quando a leitura falhou: sem resposta, a nota fica com o
 * texto neutro.
 */
export function PortaDosAvisos() {
  const { user } = useAuth();
  const [novas, setNovas] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    quantasVagasNovas(user.id)
      .then((n) => vivo && setNovas(n))
      .catch(() => {});
    todosOsAvisos(user.id)
      .then((lista) => vivo && setTotal(lista.length))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user]);

  const nota =
    novas == null && total == null
      ? "As vagas que a onda mandou para você"
      : novas != null && novas > 0
        ? novas === 1
          ? "1 vaga nova esperando você abrir"
          : `${novas} vagas novas esperando você abrir`
        : total === 0
          ? "Ainda não chegou nenhuma vaga para você"
          : total === 1
            ? "1 vaga já chegou para você"
            : `${total} vagas já chegaram para você`;

  return (
    <Link to="/avisos" className="ei-porta">
      <IconePorta desenho="sino" />
      <span className="ei-porta-nome">
        Avisos
        {/* O selo repete o número que a nota já diz, e é de propósito: a
            cor é o que se vê antes de ler, e é ela que faz a pessoa parar
            nesta porta em vez de passar direto. */}
        {novas != null && novas > 0 && (
          <span className="ei-selo ei-selo-laranja" style={{ marginLeft: 8 }}>
            {novas}
          </span>
        )}
      </span>
      <span className="ei-porta-nota">{nota}</span>
    </Link>
  );
}
