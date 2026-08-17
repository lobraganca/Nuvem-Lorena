import { SUPORTE_WHATSAPP } from "../config";

/**
 * O atalho para falar com quem cuida do app, flutuando no canto.
 *
 * Até aqui, quem travava em alguma coisa tinha duas saídas: o e-mail no
 * rodapé — que exige rolar até o fim, abrir o aplicativo de e-mail e
 * esperar resposta um dia depois — ou "Enviar sugestão", que é uma caixa
 * de texto sem volta, boa para ideia e péssima para problema. Quem está
 * com um defeito na frente não faz nenhuma das duas: fecha o app.
 *
 * O WhatsApp é onde essa conversa já acontece de qualquer jeito, e um
 * botão que abre a conversa já escrita tira o "como eu explico isso" do
 * caminho.
 *
 * Fica acima da barra de baixo, no canto direito: à esquerda ele cairia
 * sobre o botão Voltar, e no meio, sobre o círculo da busca.
 */
export function BotaoSuporte() {
  const texto = encodeURIComponent("Oi! Preciso de ajuda com o procurô.");

  return (
    <a
      className="botao-suporte"
      href={`https://wa.me/${SUPORTE_WHATSAPP}?text=${texto}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Falar com o suporte no WhatsApp"
      aria-label="Falar com o suporte no WhatsApp"
    >
      {/* Desenhado, e não a imagem oficial: o logotipo do WhatsApp tem
          regras de uso, e o que precisa ser reconhecido aqui é o balão com
          o telefone — que é o que qualquer pessoa lê como "conversa". */}
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.2-.4-4.5-1.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
        <path d="M16.6 14.2c-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.5-.6c.1-.2.2-.3.3-.5v-.5l-.9-2c-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.8.8-1 1.9-.7 3a9.4 9.4 0 0 0 4.1 4.9c1.4.8 2.5 1 3.3.9.6-.1 1.5-.7 1.7-1.4.2-.6.2-1.1.1-1.2l-.6-.3Z" />
      </svg>
    </a>
  );
}
