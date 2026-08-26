import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { MinhaAssinatura } from "../components/MinhaAssinatura";
import { precoMensal } from "../lib/payments";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { podeVender } from "../lib/plataforma";

/**
 * Tela de Assinatura.
 *
 * A oferta já existia no Perfil, num bloco espremido entre outras coisas.
 * Espremida, ela responde "quanto custa" mas não responde a pergunta que
 * vem antes: "o que eu perco ficando como estou?". Quem nunca viu os dois
 * lados lado a lado não tem como decidir — e um plano pago que não se
 * explica não é caro nem barato, é obscuro.
 *
 * Aqui as duas colunas aparecem inteiras: o que a conta básica já faz (e
 * ela faz bastante, de graça) e o que o premium acrescenta. Dizer com todas
 * as letras que o básico funciona é o que dá credibilidade ao resto: quem
 * sente que está sendo empurrado desconfia do produto todo.
 */

function Item({ tem, children }: { tem: boolean; children: React.ReactNode }) {
  return (
    <li className={tem ? "plano-tem" : "plano-nao-tem"}>
      <span aria-hidden="true">{tem ? "✓" : "—"}</span>
      <span>{children}</span>
    </li>
  );
}

export function AssinaturaPage() {
  const { user, loading } = useAuth();
  const [pessoa, setPessoa] = useState<"pf" | "pj">("pf");

  useTituloDaPagina("Assinatura");

  /* Dentro do app da Play Store esta tela inteira não existe.
     Ela é uma vitrine de plano do começo ao fim — comparação, preço,
     botão —, e é exatamente o que a regra da Google não admite fora da
     cobrança dela. Some sem substituto e sem "assine no site": apontar o
     caminho de fora é a mesma violação que vender.
     A rota continua existindo porque quem chega aqui por um link antigo
     precisa cair em algum lugar, e não numa tela em branco. */
  if (!podeVender()) {
    return (
      <div className="container" style={{ maxWidth: 520, paddingTop: 24, paddingBottom: 80 }}>
        <h1 style={{ marginBottom: 4 }}>Sua conta</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Aqui aparece a situação da sua conta e o que ela já faz.
        </p>
        {!loading && user && <MinhaAssinatura userId={user.id} />}
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>Sua conta já faz muita coisa</h2>
          <ul className="plano-lista" style={{ marginBottom: 0 }}>
            <Item tem>Aparecer na busca da sua cidade</Item>
            <Item tem>Telefone e WhatsApp visíveis no seu perfil</Item>
            <Item tem>Receber avaliações de quem contratou</Item>
            <Item tem>Responder a cada avaliação</Item>
            <Item tem>Catálogo com os serviços que você faz</Item>
          </ul>
        </div>
        <p className="muted" style={{ fontSize: "0.86rem", marginTop: 16 }}>
          Precisa de ajuda com a sua conta? Fale com o suporte pelo Perfil.
        </p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 520, paddingTop: 24, paddingBottom: 80 }}>
      <h1 style={{ marginBottom: 4 }}>Assinatura</h1>
      {/* Nada de "hoje sua conta é básica" escrito aqui de forma fixa: quem
          já assinou leria uma informação falsa logo na primeira linha. Quem
          diz o plano de cada um é o bloco abaixo, que lê o estado real. */}
      <p className="muted" style={{ marginTop: 0 }}>
        Usar o procurô é gratuito. A <strong>conta básica</strong> não expira, não vira cobrança e não some
        se você nunca assinar nada — o premium acrescenta, não destrava o que já era seu.
      </p>

      {/* Estado real de quem está logado: o que a pessoa paga (ou não)
          vem antes de qualquer oferta. Sem isso, alguém que JÁ é premium
          leria a página inteira como se não fosse. */}
      {!loading && user && <MinhaAssinatura userId={user.id} />}

      <p className="settings-group-title" style={{ marginTop: 24 }}>
        O que muda
      </p>

      <div className="planos-comparacao">
        <div className="plano-cartao">
          <h2>Conta básica</h2>
          <p className="plano-preco">Grátis</p>
          <ul className="plano-lista">
            <Item tem>Cadastro na busca, com foto e descrição</Item>
            <Item tem>Seu telefone visível para quem procurar</Item>
            <Item tem>Avaliações de quem já contratou você</Item>
            <Item tem>Lista de serviços que você faz</Item>
            <Item tem={false}>Botão de WhatsApp direto</Item>
            <Item tem={false}>Pedido de contato pelo app</Item>
            <Item tem={false}>Selo dourado ao lado do nome</Item>
          </ul>
        </div>

        <div className="plano-cartao plano-cartao-premium">
          <h2>Conta premium</h2>
          <p className="plano-preco">
            R$ {precoMensal("verification", pessoa).toFixed(2).replace(".", ",")}
            <span className="muted">/mês</span>
          </p>
          <div className="plano-alternar" role="group" aria-label="Tipo de conta">
            <button
              type="button"
              className={pessoa === "pf" ? "ativo" : ""}
              onClick={() => setPessoa("pf")}
            >
              Autônomo
            </button>
            <button
              type="button"
              className={pessoa === "pj" ? "ativo" : ""}
              onClick={() => setPessoa("pj")}
            >
              Empresa
            </button>
          </div>
          <ul className="plano-lista">
            <Item tem>Tudo o que a conta básica tem</Item>
            <Item tem>
              <strong>Botão de WhatsApp</strong> — o cliente abre a conversa com um toque, sem copiar número
            </Item>
            <Item tem>
              <strong>"Peça para te chamar"</strong> — quem não quer ligar deixa o número e você retorna
            </Item>
            <Item tem>
              <strong>Selo dourado</strong> ao lado do seu nome, na busca e no cadastro
            </Item>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <p style={{ marginTop: 0 }}>
          <strong>O que o selo não é.</strong>
        </p>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          Ele mostra que o cadastro assinou o plano — não é checagem de documento e não é garantia de
          qualidade do serviço. Preferimos dizer isso do que deixar o cliente entender uma coisa que não
          prometemos.
        </p>
      </div>

      <p className="muted" style={{ fontSize: "0.85rem", marginTop: 16 }}>
        Cobrança mensal pelo Mercado Pago. Dá para cancelar quando quiser, pelo Painel, sem falar com
        ninguém — e nos primeiros 7 dias o valor volta integral, por direito de arrependimento. Depois
        disso, o cancelamento encerra as próximas cobranças e o período já pago continua valendo até o fim.{" "}
        <Link to="/termos">Ver os Termos</Link>.
      </p>
    </div>
  );
}
