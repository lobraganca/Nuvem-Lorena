import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { signOut } from "../lib/auth";
import { ConfirmarMeuNumero } from "./ConfirmarMeuNumero";
import { EXIGIR_NUMERO_ATIVO } from "../config";

/**
 * As telas de conta que só abrem com número confirmado.
 *
 * Buscar não está aqui, e nunca vai estar: a busca é o motivo de o app
 * existir e funciona sem conta nenhuma. O que exige número é o que envolve
 * outra pessoa — anunciar, avaliar, ser chamado.
 */
const TELAS_DE_CONTA = ["/painel", "/perfil", "/favoritos", "/admin"];

export function exigeNumero(caminho: string): boolean {
  /* Desligada, a barreira não existe — nem como componente. Não basta
     devolver os filhos lá dentro: o `useAuth` daqui dispararia uma consulta
     de sessão em toda tela de conta para não fazer nada com a resposta. */
  if (!EXIGIR_NUMERO_ATIVO) return false;
  return TELAS_DE_CONTA.some((t) => caminho === t || caminho.startsWith(`${t}/`));
}

/**
 * Barreira do número confirmado.
 *
 * Quem entra pelo telefone já chega com ele confirmado — o código *foi* a
 * entrada. Quem entra pelo Google chega sem número nenhum, e é dessa
 * pessoa que o app precisa do número: sem ele, um cliente que pede
 * orçamento não tem como ser avisado, e uma denúncia não tem como ser
 * respondida.
 *
 * A escolha de exigir foi da dona, e tem um custo que vale escrever: cada
 * confirmação é um SMS pago, e alguém que só queria olhar os próprios
 * favoritos vai topar com esta tela. Por isso ela não é um bloqueio seco —
 * diz para que serve o número, e deixa duas saídas visíveis (voltar para a
 * busca, que funciona sem conta, e sair da conta). Barreira sem saída é
 * como se perde a pessoa em vez do dado.
 */
export function ExigirNumero({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [confirmado, setConfirmado] = useState(false);
  const [abrindo, setAbrindo] = useState(false);

  /* Enquanto a sessão carrega, mostra a tela: piscar a barreira e sumir é
     pior do que esperar meio segundo. */
  if (loading || !user) return <>{children}</>;
  if (user.phone_confirmed_at || confirmado) return <>{children}</>;

  return (
    <div className="container exigir-numero">
      <h1>Falta o seu celular</h1>
      <p className="muted">
        Você entrou com o Google, e o app ainda não tem seu número. Ele é o que permite avisar você
        quando alguém pedir seu contato — e é o que a gente confere antes de deixar denunciar um
        cadastro.
      </p>

      {/* A confirmação abre em folha, com o próprio botão de fechar
          funcionando: fechar devolve para esta tela, que continua
          explicando e continua oferecendo as duas saídas. Passar um
          "fechar" que não faz nada seria deixar um controle morto no
          lugar mais frustrante possível. */}
      <button type="button" className="btn btn-primary btn-block" onClick={() => setAbrindo(true)}>
        Confirmar meu número
      </button>

      {abrindo && (
        <ConfirmarMeuNumero
          onConfirmado={() => {
            setAbrindo(false);
            setConfirmado(true);
          }}
          onClose={() => setAbrindo(false)}
        />
      )}

      <div className="exigir-numero-saidas">
        {/* Duas saídas, sempre visíveis. A busca funciona sem conta, e sair
            da conta precisa continuar possível de qualquer tela — senão
            quem entrou por engano numa conta fica preso nela. */}
        <Link to="/" className="btn btn-outline">
          Voltar para a busca
        </Link>
        <button type="button" className="entrar-link" onClick={() => void signOut()}>
          Sair desta conta
        </button>
      </div>
    </div>
  );
}
