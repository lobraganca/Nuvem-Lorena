import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyProfessionals } from "../lib/professionals";
import {
  getAssinaturasAtivas,
  precoMensal,
  startSubscriptionCheckout,
  PRICES,
  type AssinaturaAtiva,
} from "../lib/payments";
import type { Professional } from "../types/domain";
import { mensagemDeErro } from "../lib/erros";

/**
 * Assinatura, na tela de Perfil.
 *
 * As assinaturas sempre existiram, mas só dentro do Painel, presas ao cartão
 * de cada anúncio. Quem quisesse saber "eu pago alguma coisa por esse app?"
 * tinha que abrir o painel, achar o anúncio e reparar num selo pequeno — e
 * essa é a pergunta que se faz no Perfil, que é a tela da conta.
 *
 * Esconder o que a pessoa paga não é neutro: quando ela finalmente descobre,
 * descobre com raiva. E do outro lado, quem não assina nunca esbarra na
 * oferta.
 *
 * A assinatura é por anúncio, não por conta — quem tem dois anúncios pode ter
 * premium num e não no outro. Por isso a lista é por anúncio, mesmo que na
 * maioria dos casos haja um só.
 */
export function MinhaAssinatura({ userId }: { userId: string }) {
  const [anuncios, setAnuncios] = useState<Professional[]>([]);
  const [assinaturas, setAssinaturas] = useState<Record<string, AssinaturaAtiva[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [indo, setIndo] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    getMyProfessionals(userId).then(async (lista) => {
      if (!ativo) return;
      setAnuncios(lista);
      const mapa: Record<string, AssinaturaAtiva[]> = {};
      await Promise.all(
        lista.map(async (p) => {
          mapa[p.id] = await getAssinaturasAtivas(p.id);
        })
      );
      if (!ativo) return;
      setAssinaturas(mapa);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [userId]);

  async function assinarPremium(p: Professional) {
    setIndo(p.id);
    setErro("");
    try {
      const { initPoint } = await startSubscriptionCheckout(p.id, "verification");
      window.location.href = initPoint;
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível abrir o pagamento."));
      setIndo(null);
    }
  }

  if (carregando) {
    return (
      <div className="settings-list">
        <div className="settings-item" style={{ cursor: "default" }}>
          <span className="muted">Carregando…</span>
        </div>
      </div>
    );
  }

  /* Sem anúncio não há o que assinar: o plano é do anúncio, e cobrar de
     alguém que não tem onde aplicar o benefício seria vender o nada. */
  if (anuncios.length === 0) {
    return (
      <div className="assinatura-bloco">
        <p style={{ margin: 0 }}>
          <strong>Você ainda não tem anúncio.</strong>
        </p>
        <p className="muted" style={{ margin: "4px 0 12px", fontSize: "0.88rem" }}>
          A conta premium é do anúncio — ela libera o botão de WhatsApp e o pedido de contato no <em>seu</em>{" "}
          anúncio. Crie o seu primeiro, que é grátis, e a assinatura fica disponível aqui.
        </p>
        <Link className="btn btn-primary" to="/painel">
          Criar meu anúncio
        </Link>
      </div>
    );
  }

  return (
    <div className="assinatura-lista">
      {anuncios.map((p) => {
        const ativas = assinaturas[p.id] ?? [];
        const premium = ativas.find((a) => a.type === "verification");
        const preco = precoMensal("verification", p.entity_type);

        return (
          <div key={p.id} className="assinatura-bloco">
            <p className="assinatura-anuncio">
              {p.name}
              <span className="muted">{p.entity_type === "pj" ? "empresa" : "profissional autônomo"}</span>
            </p>

            {ativas.length > 0 ? (
              <>
                <ul className="assinatura-planos">
                  {ativas.map((a) => (
                    <li key={a.id}>
                      <span>
                        <strong>{PRICES[a.type].label}</strong>
                        <span className="muted">
                          {a.billing_cycle === "annual" ? "plano anual" : "plano mensal"}
                          {/* A data é a informação que a pessoa procura aqui:
                              "até quando está pago" responde tanto a quem quer
                              renovar quanto a quem quer cancelar sem perder o
                              que já pagou. */}
                          {a.current_period_end
                            ? ` · pago até ${new Date(a.current_period_end).toLocaleDateString("pt-BR")}`
                            : ""}
                          {a.status === "pending" ? " · aguardando confirmação do pagamento" : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {/* Cancelar mora no Painel, onde já existe com a regra dos 7
                    dias de arrependimento. Duplicar aqui seria manter duas
                    telas de cancelamento — e a que fosse esquecida numa
                    mudança viraria a que descumpre o Código do Consumidor. */}
                <Link className="btn btn-outline" to="/painel">
                  Gerenciar ou cancelar
                </Link>
              </>
            ) : (
              <>
                <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.88rem" }}>
                  Sem assinatura. Este anúncio aparece na busca normalmente, com o telefone visível.
                </p>
                <div className="assinatura-oferta">
                  <strong>Conta premium — R$ {preco.toFixed(2).replace(".", ",")}/mês</strong>
                  <p>
                    Botão de <strong>WhatsApp direto</strong> no seu anúncio, o{" "}
                    <strong>"peça para te chamar"</strong> (o cliente deixa o número e você retorna) e o selo
                    dourado ao lado do seu nome.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={() => assinarPremium(p)}
                    disabled={indo === p.id}
                  >
                    {indo === p.id ? "Abrindo pagamento…" : "Assinar premium"}
                  </button>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    Cobrança mensal pelo Mercado Pago. Dá para cancelar quando quiser — e nos primeiros 7 dias
                    o valor volta integral, por direito de arrependimento.
                  </span>
                </div>
              </>
            )}
          </div>
        );
      })}

      {erro && <p className="form-erro">{erro}</p>}
    </div>
  );
}
