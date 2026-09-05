import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/useAuth";
import {
  melhorPlanoEmDia,
  minhasEmpresas,
  resumoDasEmpresas,
  type ResumoDasEmpresas,
} from "../../lib/company";
import { PLANO_GRATUITO, PLANOS_EMPRESA, type Company } from "../../types/domain";
import { IconePorta } from "../../pages/ei/ComecarPage";

/**
 * "Meu plano" — a porta do plano na tela de quem contrata.
 *
 * ── O pedido ──────────────────────────────────────────────────────────
 *
 * A dona: "nessa tela pode colocar 'meu plano' e tirar a informação da
 * tela de minhas empresas."
 *
 * A faixa do plano morava no fim de "Minhas empresas", que é a tela de
 * ESCOLHER a loja — o plano ficava pendurado no fim de uma lista que não
 * é sobre ele, e só era visto por quem rolava até lá. Aqui em cima ele é
 * uma porta como as outras: quem contrata vê logo o que tem contratado e
 * quanto já usou, sem entrar em empresa nenhuma.
 *
 * ── O plano é da CONTA, não da empresa (0107) ─────────────────────────
 *
 * O teto é somado entre as lojas: com o Ei Onda dá para abrir 2 na padaria
 * e 1 na lanchonete. Por isso a conta olha TODAS as empresas do dono e
 * fica com o melhor plano em dia — e por isso ele nunca apareceu dentro do
 * cartão de cada loja, onde "3 de 3" leria como "três em cada uma".
 *
 * O nome sai do que foi PAGO (`companies.plano`), e não do teto: dois
 * planos podem acabar com o mesmo teto depois de uma promoção, e aí a tela
 * diria o nome errado.
 */
export function PortaDoPlano() {
  const { user } = useAuth();
  const [empresas, setEmpresas] = useState<Company[] | null>(null);
  const [resumo, setResumo] = useState<ResumoDasEmpresas | null>(null);

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    minhasEmpresas(user.id)
      .then(async (lista) => {
        if (!vivo) return;
        setEmpresas(lista);
        const r = await resumoDasEmpresas(lista);
        if (vivo) setResumo(r);
      })
      /* Falha em silêncio: esta porta é informativa e o caminho para os
         planos continua valendo sem ela. Derrubar a tela inteira de
         "Quero contratar" por causa da linha de apoio seria trocar um
         defeito pequeno por um grande. */
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user]);

  /* Quem ainda não cadastrou empresa nenhuma não vê esta porta: sem
     empresa não há vaga para publicar, e oferecer plano antes disso é
     cobrar antes de existir o que cobrar. */
  if (!empresas || empresas.length === 0) return null;

  /* A escolha do melhor plano é de `melhorPlanoEmDia` — ver o comentário
     longo lá. Aqui havia uma segunda cópia da mesma tabela de antes da
     0120, e era ela que escrevia "Ei Começo" (o plano de graça) na tela de
     quem paga o Ei Impulso ou o Ei Máximo. */
  const plano = melhorPlanoEmDia(empresas);
  const nome = plano ? `Plano ${PLANOS_EMPRESA[plano].nome}` : PLANO_GRATUITO.nome;

  /* Sem plano não há "de quantas": o gratuito não publica vaga, e "0 de 0"
     lê como defeito. `-1` é o sem teto, e "3 de -1" seria o número mágico
     vazando para a tela. */
  const quanto =
    resumo == null
      ? ""
      : resumo.limite === 0
        ? "não publica vaga"
        : resumo.limite < 0
          ? `${resumo.abertas} ${resumo.abertas === 1 ? "vaga no ar" : "vagas no ar"}`
          : `${resumo.abertas} de ${resumo.limite} ${resumo.limite === 1 ? "vaga" : "vagas"}`;

  return (
    <Link to="/planos-empresa" className="ei-porta">
      <IconePorta desenho="selo" />
      <span className="ei-porta-nome">Meu plano</span>
      <span className="ei-porta-nota">
        {nome}
        {quanto ? ` · ${quanto}` : ""}
      </span>
    </Link>
  );
}
