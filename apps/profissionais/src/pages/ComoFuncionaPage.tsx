import { Link } from "react-router-dom";

export function ComoFuncionaPage() {
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Como funciona</h1>
      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Como buscar</h2>
        <p className="muted" style={{ margin: 0 }}>
          Na página inicial, filtre por cidade e categoria ou digite uma palavra-chave (nome ou algo da
          descrição). Os resultados trazem foto/logo, nota média, selo de verificação (quando houver) e um
          botão de WhatsApp direto para quem é verificado.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Como avaliar</h2>
        <p className="muted" style={{ margin: 0 }}>
          Para avaliar um profissional é preciso entrar com sua conta Google e confirmar seu CPF (ele não
          aparece publicamente — serve só para reduzir avaliações falsas). Depois disso, você pode dar uma
          nota de 1 a 5 estrelas e escrever um comentário. Você pode editar ou apagar sua própria avaliação a
          qualquer momento.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>O que é o selo de verificação</h2>
        <p className="muted" style={{ margin: 0 }}>
          O <strong>selo de verificação</strong> (<span className="badge badge-verified">✓ Verificado</span>)
          é uma assinatura paga pelo profissional/empresa (R$ 10,90/mês via Mercado Pago) que indica que ele
          passou por uma checagem básica de cadastro (documento, foto de rosto ou logo, e nome do responsável
          no caso de empresas). Também libera o botão de WhatsApp direto no perfil.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>O que é um anúncio turbinado</h2>
        <p className="muted" style={{ margin: 0 }}>
          Um anúncio <strong>turbinado</strong> (<span className="badge badge-boosted">Destaque</span>) é
          outra assinatura opcional que faz o anúncio aparecer primeiro nos resultados de busca. É só um
          destaque de posicionamento — não é uma avaliação de qualidade do serviço.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Importante</h2>
        <p className="muted" style={{ margin: 0 }}>
          O Busca Itabirito é uma vitrine: só ajuda quem busca um serviço a encontrar quem oferece. Não
          empregamos, não supervisionamos e não nos responsabilizamos pela execução, qualidade, prazos ou
          resultado de nenhum serviço contratado — isso é combinado diretamente entre você e o
          profissional/empresa. Veja os detalhes completos nos <Link to="/termos">Termos de Uso</Link>.
        </p>
      </div>
    </div>
  );
}
