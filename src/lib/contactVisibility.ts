/**
 * Quando o contato direto de uma empresa aparece.
 *
 * Só para quem já reservou com ela. Antes disso, a conversa acontece dentro
 * do app.
 *
 * O motivo é o sustento da plataforma. A página pública mostrava e-mail e
 * site de qualquer empresa a qualquer visitante — quer dizer, o Avena
 * apresentava o passeio e entregava, de graça e na mesma tela, o caminho para
 * fechar por fora. A taxa de 5% é baixa justamente para que driblar não
 * compense; mas nenhuma taxa é baixa o bastante quando o atalho está impresso
 * ao lado do preço.
 *
 * Não é segredo nem armadilha: é a ordem das coisas. Pergunte aqui, reserve
 * aqui, e o telefone vem junto com a confirmação — que é quando ele serve
 * para alguma coisa, porque é aí que se combina o encontro.
 *
 * O que continua público de propósito: cidade, estado, tipo, descrição, notas,
 * Cadastur e o ponto de encontro. Nada disso permite fechar por fora, e tudo
 * isso é necessário para decidir e para conferir com quem se está tratando.
 */
import type { Booking, Business } from "../types";

export function canSeeContact(business: Business, bookings: Booking[]): boolean {
  return bookings.some(
    (b) =>
      b.businessId === business.id &&
      (b.status === "confirmada" || b.status === "aguardando-pagamento")
  );
}
