import { useEffect, useState } from "react";
import { useAuth } from "../../lib/useAuth";
import { bancoDeVagas } from "../../lib/bancoDeVagas";
import { FAIXAS_DAS_ONDAS } from "../../types/domain";
import {
  situacaoDeVolta,
  continuoDisponivel,
  naoEstouProcurando,
  marcarQueApareci,
} from "../../lib/aindaDisponivel";

/**
 * "👋 Ainda está disponível?"
 *
 * A dona: "uma pessoa ficou 1 mês sem abrir o app. O Ei manda: ainda está
 * disponível? Encontramos 4 oportunidades que combinam com seu perfil."
 *
 * ── A CONTA É FEITA NA HORA DE ABRIR ──────────────────────────────────
 *
 * E não na hora em que a pergunta foi decidida. É a diferença entre uma
 * promessa e uma isca: a pessoa que lê "4 oportunidades" toca esperando
 * quatro, e se o app contou isso há três semanas pode não haver nenhuma.
 * Uma decepção dessas na volta de quem sumiu é a última.
 *
 * Quem conta é `bancoDeVagas`, com a mesma fórmula de compatibilidade das
 * outras telas — sem segunda conta, então o número aqui é o mesmo que a
 * lista vai mostrar.
 *
 * ── SEM NÚMERO, A PERGUNTA CONTINUA ───────────────────────────────────
 *
 * Se hoje não há vaga combinando, a pergunta é feita do mesmo jeito, só
 * sem a promessa. Ela não existe para vender vaga: existe para saber se a
 * pessoa ainda está procurando — e essa resposta vale mais quando NÃO há
 * vaga, porque é aí que a lista está mais suja.
 *
 * ── AS DUAS RESPOSTAS SÃO DE VERDADE ──────────────────────────────────
 *
 * "Não estou procurando" tira a pessoa das listas na hora. Não é o botão
 * de fechar o aviso: é a resposta que faz a empresa parar de ligar para
 * quem já arrumou emprego. Ver `aindaDisponivel.ts`.
 */
export function AindaEstaDisponivel() {
  const { user } = useAuth();
  const [mostrar, setMostrar] = useState(false);
  const [dias, setDias] = useState<number | null>(null);
  const [quantas, setQuantas] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    (async () => {
      const s = await situacaoDeVolta(user.id);
      if (!vivo) return;

      if (!s.sumiu) {
        /* Só carimba "apareci" quando NÃO vai perguntar. Carimbando antes
           da resposta, bastaria recarregar a tela para a pergunta sumir —
           e o cadastro continuaria dizendo "disponível" sem ninguém ter
           confirmado. */
        void marcarQueApareci(user.id);
        return;
      }

      setDias(s.diasSemAparecer);
      setMostrar(true);

      /* A contagem vem depois de a pergunta já estar na tela: ela é o
         enfeite, e esperar por ela para mostrar a pergunta faria o cartão
         aparecer com atraso — ou não aparecer, se a consulta falhasse. */
      try {
        const vagas = await bancoDeVagas(user.id);
        if (!vivo) return;
        const combinam = vagas.filter(
          (v) => (v.compatibilidade ?? 0) >= FAIXAS_DAS_ONDAS[2].de
        ).length;
        setQuantas(combinam);
      } catch {
        /* Fica sem o número, e a pergunta sozinha dá conta. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [user]);

  if (!mostrar || !user) return null;

  async function responder(disponivel: boolean) {
    if (salvando || !user) return;
    setSalvando(true);
    try {
      if (disponivel) await continuoDisponivel(user.id);
      else await naoEstouProcurando(user.id);
      setMostrar(false);
    } catch {
      /* Não conseguiu gravar: o cartão FICA na tela. Sumir daria a
         entender que a resposta foi registrada, e ela não foi — e a
         próxima abertura perguntaria de novo sem explicação. */
      setSalvando(false);
    }
  }

  return (
    <section className="ei-cartao ei-voltou">
      <p className="ei-voltou-titulo">
        <span aria-hidden="true">👋</span> Ainda está disponível?
      </p>
      <p className="ei-voltou-texto">
        {/* O número de dias entra quando se sabe: "faz 2 meses" explica
            por que a pergunta apareceu, e sem essa explicação ela parece
            uma cobrança vinda do nada. */}
        {dias !== null && dias >= 60
          ? `Faz uns ${Math.floor(dias / 30)} meses que você não aparece por aqui. `
          : "Faz um tempo que você não aparece por aqui. "}
        {quantas === null
          ? "Confirme para continuar aparecendo para as empresas."
          : quantas > 0
            ? `Encontramos ${quantas} ${quantas === 1 ? "vaga que combina" : "vagas que combinam"} com o seu perfil.`
            : "Nenhuma vaga combinando hoje, mas aparecem novas toda semana."}
      </p>
      <div className="ei-voltou-botoes">
        <button
          type="button"
          className="ei-btn ei-btn-cheio"
          disabled={salvando}
          onClick={() => responder(true)}
        >
          Sim, estou disponível
        </button>
        {/* Contorno e não vermelho: dizer que não está procurando agora é
            uma resposta normal, não um estrago. Pintar de vermelho o que
            metade das pessoas vai responder transforma a pergunta numa
            armadilha. */}
        <button
          type="button"
          className="ei-btn ei-btn-contorno"
          disabled={salvando}
          onClick={() => responder(false)}
        >
          Não estou procurando agora
        </button>
      </div>
    </section>
  );
}
