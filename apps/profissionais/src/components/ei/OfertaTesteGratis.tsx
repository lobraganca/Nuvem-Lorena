import { useEffect, useState } from "react";
import {
  DIAS_DO_TESTE_GRATIS,
  ativarTesteGratis,
  diaPorExtenso,
  testeGratisDisponivel,
} from "../../lib/testeGratis";

/**
 * "30 dias grátis" — o convite da promoção, com o botão que a ativa.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "quero liberar 30 dias de 1 vaga grátis. Escrever que é por
 * tempo limitado."
 *
 * ── POR QUE UM BOTÃO, E NÃO AUTOMÁTICO ────────────────────────────────
 *
 * Foi a escolha dela, e o motivo é o relógio: os 30 dias começam a correr
 * no momento em que alguém toca aqui. Dando automaticamente no cadastro,
 * quem se cadastrasse hoje e só fosse publicar daqui a um mês perderia a
 * promoção inteira sem ter usado um dia — e sem nunca saber que teve uma.
 *
 * O botão também é onde a frase "por tempo limitado" cabe: ela precisa
 * estar onde a decisão é tomada, não numa tela que a pessoa já passou.
 *
 * ── O QUE ESTA TELA NÃO DECIDE ────────────────────────────────────────
 *
 * Nada. Quem diz se a promoção existe, se esta conta pode e se ainda está
 * no ar é o banco (migration 0133) — aqui só se pergunta e se mostra. Uma
 * regra escrita nesta tela seria uma segunda verdade, e a que vale é a de
 * lá.
 *
 * `onAtivou` existe porque a tela que envolve este cartão costuma ser uma
 * BARREIRA ("precisa de um plano"): ativado o teste, ela deixa de fazer
 * sentido e tem de sair da frente. Quem a derruba é o BOTÃO da
 * confirmação, e não o fim da ativação — ver o comentário lá embaixo.
 *
 * ── AS CLASSES SÃO `ei-promo`, E NÃO `ei-oferta` ──────────────────────
 *
 * `ei-oferta` já existe e é o CARTÃO DE PLANO da tela de preços. A
 * primeira versão deste arquivo usou esse nome, e o resultado foi o fio
 * laranja da promoção aparecendo nos cinco cartões de plano — descoberto
 * no navegador, porque a conferência de tipos não olha CSS e nada mais
 * reclamaria. Nome de classe é global; conferir antes de criar é mais
 * barato que caçar depois.
 */
export function OfertaTesteGratis({
  companyId,
  onAtivou,
}: {
  companyId: string | null | undefined;
  onAtivou?: () => void;
}) {
  const [pode, setPode] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const [ate, setAte] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    testeGratisDisponivel().then((sim) => vivo && setPode(sim));
    return () => {
      vivo = false;
    };
  }, []);

  /* ── ATIVADO: A CONFIRMAÇÃO ESPERA UM TOQUE — 07/09 ─────────────────
     A primeira versão avisava a tela na hora (`onAtivou` dentro do
     `ativar`), e o efeito foi visto no navegador: a barreira "Precisa de
     um plano" sumia no mesmo quadro, levando este cartão junto. A pessoa
     tocava em "ativar", a tela trocava, e ela nunca lia que ganhou 30
     dias nem até quando eles valem.

     Agora o aviso é o botão. Quem acabou de ganhar lê a data, e é ela
     quem decide seguir — a tela só muda depois disso. */
  if (ate) {
    return (
      <div className="ei-promo ei-promo-pronta">
        <p className="ei-promo-titulo">Pronto — sua vaga grátis está valendo</p>
        <p className="ei-promo-texto">
          Você pode manter <strong>1 vaga aberta</strong> até <strong>{diaPorExtenso(ate)}</strong>,
          sem pagar nada.
        </p>
        {onAtivou && (
          <button
            type="button"
            className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
            onClick={onAtivou}
          >
            Publicar minha vaga
          </button>
        )}
      </div>
    );
  }

  /* Sem direito, sem cartão. Um convite que vai ser recusado é pior que
     convite nenhum: a pessoa toca, leva um "não" e fica achando que o app
     prometeu algo que não cumpre. */
  if (!pode || !companyId) return null;

  async function ativar() {
    if (!companyId || ativando) return;
    setAtivando(true);
    setErro(null);
    const r = await ativarTesteGratis(companyId);
    setAtivando(false);
    if (!r.ok) {
      setErro(r.erro);
      /* Recusado quer dizer que o direito acabou entre desenhar o botão e
         tocá-lo. O cartão fica, com o motivo escrito — sumir na hora do
         toque pareceria defeito. */
      return;
    }
    setAte(r.ate);
  }

  return (
    <div className="ei-promo">
      <p className="ei-promo-selo">Oferta por tempo limitado</p>
      <p className="ei-promo-titulo">{DIAS_DO_TESTE_GRATIS} dias grátis</p>
      <p className="ei-promo-texto">
        Publique <strong>1 vaga</strong> e receba quem se interessou, com telefone, por{" "}
        {DIAS_DO_TESTE_GRATIS} dias. Sem cartão, sem cobrança e sem renovar sozinho.
      </p>
      <button
        type="button"
        className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
        onClick={ativar}
        disabled={ativando}
      >
        {ativando ? "Ativando…" : `Ativar meus ${DIAS_DO_TESTE_GRATIS} dias grátis`}
      </button>
      {erro && (
        <p className="ei-promo-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
