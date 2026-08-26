import { useEstaOnline } from "../lib/useEstaOnline";

/**
 * A faixa que aparece quando o aparelho está sem internet.
 *
 * O app não tinha nada disso: sem sinal, cada tela dava a sua mensagem de
 * falha, e "não foi possível carregar os profissionais" lido sem contexto
 * é o app quebrado, não a internet ausente. A diferença decide o que a
 * pessoa faz em seguida — quem acha que quebrou desinstala, quem sabe que
 * é o sinal espera e volta.
 *
 * Fica no alto e não some sozinha: o motivo do problema continua na tela
 * enquanto o problema durar. É também o que o revisor da Play Store vê
 * quando testa em modo avião, que é um teste que ele faz.
 *
 * Não diz "tente de novo" nem oferece botão: não há o que tentar sem
 * rede, e um botão que não pode funcionar é pior que nenhum. Quando o
 * sinal volta, a faixa some sozinha e as telas recarregam ao serem
 * abertas de novo.
 */
export function AvisoSemInternet() {
  const online = useEstaOnline();
  if (online) return null;

  return (
    <div className="aviso-sem-internet" role="status">
      <span className="aviso-sem-internet-ponto" aria-hidden="true" />
      <span>
        <strong>Sem internet.</strong> O que já está na tela continua aqui; o resto volta quando o sinal
        voltar.
      </span>
    </div>
  );
}
