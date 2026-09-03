import { useId, useState } from "react";

/**
 * Um campo de senha com o olho de mostrar o que foi digitado.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ícone pra mostrar a senha no login."
 *
 * ── POR QUE ISSO NÃO É ENFEITE ─────────────────────────────────────────
 *
 * O campo de senha esconde o que se digita, e num celular isso soma dois
 * problemas: o teclado erra letra, e a pessoa não tem como conferir. Quem
 * erra duas vezes desiste — e no Ei desistir de entrar é desistir do app,
 * porque desde 01/09 não há nada visível sem conta.
 *
 * Mostrar a senha é a saída conhecida, e é segura no contexto certo: o
 * risco de alguém ler por cima do ombro existe, mas quem toca no olho está
 * escolhendo isso; o risco de errar em silêncio não é escolha de ninguém.
 *
 * ── TRÊS DETALHES QUE PARECEM PEQUENOS ─────────────────────────────────
 *
 * 1. O botão tem `tabIndex={-1}`. Sem isso, quem usa teclado sai do campo
 *    e cai no olho em vez de ir para o botão de entrar.
 * 2. Ele NÃO é `type="submit"` (é `type="button"`): dentro de um
 *    formulário, um botão sem tipo envia — e mostrar a senha tentaria
 *    entrar com ela pela metade.
 * 3. O rótulo do `aria-label` muda com o estado, e não é fixo: um leitor
 *    de tela que sempre anuncia "mostrar senha" não diz se ela está
 *    visível agora.
 */
export function CampoSenha({
  id,
  rotulo,
  valor,
  onChange,
  autoComplete = "current-password",
  desabilitado = false,
  ajuda,
  classeRotulo,
}: {
  id?: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete?: "current-password" | "new-password";
  desabilitado?: boolean;
  ajuda?: string;
  /** A tela de entrar usa `entrar-rotulo`; o resto do app usa o padrão. */
  classeRotulo?: string;
}) {
  const idAuto = useId();
  const idCampo = id ?? idAuto;
  const [visivel, setVisivel] = useState(false);

  return (
    <>
      <label className={classeRotulo} htmlFor={idCampo}>
        {rotulo}
      </label>
      <div className="ei-senha">
        <input
          id={idCampo}
          type={visivel ? "text" : "password"}
          autoComplete={autoComplete}
          value={valor}
          disabled={desabilitado}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          tabIndex={-1}
          className="ei-senha-olho"
          aria-label={visivel ? "Esconder a senha" : "Mostrar a senha"}
          aria-pressed={visivel}
          onClick={() => setVisivel((v) => !v)}
        >
          {visivel ? <OlhoFechado /> : <OlhoAberto />}
        </button>
      </div>
      {ajuda && <span className="ei-campo-ajuda">{ajuda}</span>}
    </>
  );
}

/* Os dois desenhos ficam aqui, e não numa biblioteca: são dois traçados,
   e uma dependência inteira para dois desenhos é peso que o 4G da cidade
   paga. */
function OlhoAberto() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function OlhoFechado() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .35 4.2.9" />
      <path d="M20 8.4c1 1.2 1.5 2.1 1.5 2.1s-1.4 2.6-4 4.4" />
      <path d="M14.5 17.9c-.8.2-1.6.3-2.5.3-6 0-9.5-6.2-9.5-6.2" />
      <path d="M4 20 20 4" />
    </svg>
  );
}
