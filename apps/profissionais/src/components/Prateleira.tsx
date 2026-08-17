import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Uma faixa da tela inicial: título, "ver tudo" e uma fileira que rola de
 * lado.
 *
 * A tela inicial era uma grade de oito categorias e mais nada — só
 * perguntava, nunca mostrava. Quem abria o app pela primeira vez não via
 * uma pessoa sequer antes de escolher alguma coisa, e uma cidade que
 * parece vazia não convence ninguém a voltar.
 *
 * A fileira rola na horizontal de propósito: empilhar tudo faria a primeira
 * prateleira ocupar a tela inteira e as outras nunca serem descobertas.
 * Rolando de lado, cabem três assuntos na altura de um.
 *
 * **Some sozinha quando tem pouca coisa.** Numa cidade pequena, uma
 * prateleira com dois cartões e um vazio ao lado não parece uma seleção,
 * parece defeito — e é a primeira tela do app. O mínimo é decidido por quem
 * chama (`minimo`), porque três cadastros é pouco para "em alta" e pode ser
 * bastante para um grupo de serviço.
 */
export function Prateleira({
  titulo,
  subtitulo,
  verTudo,
  ancora,
  minimo = 3,
  quantidade,
  duasFileiras = false,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  /** Destino do "ver tudo ›". Sem ele, o cabeçalho fica só com o título. */
  verTudo?: string;
  /** `id` para os chips do topo rolarem até aqui. */
  ancora?: string;
  minimo?: number;
  /** Quantos itens a fileira tem. Decide se a prateleira aparece. */
  quantidade: number;
  /** Empilha em duas linhas em vez de uma — para muitos itens pequenos. */
  duasFileiras?: boolean;
  children: ReactNode;
}) {
  if (quantidade < minimo) return null;

  return (
    <section className="prateleira" id={ancora}>
      <div className="prateleira-topo">
        <div className="prateleira-titulos">
          <h2 className="prateleira-titulo">{titulo}</h2>
          {subtitulo && <p className="prateleira-subtitulo">{subtitulo}</p>}
        </div>
        {verTudo && (
          <Link to={verTudo} className="prateleira-ver-tudo">
            ver tudo <span aria-hidden="true">›</span>
          </Link>
        )}
      </div>
      {/* `role="list"` porque a rolagem horizontal precisa de um contêiner
          com `overflow`, e um `<ul>` com `overflow-x` e `display: flex`
          perde o papel de lista em alguns leitores de tela. */}
      <div className={`prateleira-fileira${duasFileiras ? " prateleira-duas" : ""}`} role="list">
        {children}
      </div>
    </section>
  );
}
