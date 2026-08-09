import { Link } from "react-router-dom";
import { CONTATO_EMAIL, NOME_PLATAFORMA } from "../config";

/**
 * Página pública de exclusão de conta, em `/excluir-conta`.
 *
 * A Google Play exige que exista um endereço **acessível sem login** onde
 * qualquer pessoa entenda como apagar a conta e o que é apagado — e o link
 * precisa ser informado na ficha da loja. Uma opção escondida dentro do app,
 * atrás da tela de entrar, não cumpre a regra: quem perdeu acesso à conta é
 * exatamente quem mais precisa dela.
 *
 * O caminho de dentro do app continua sendo o principal, porque é imediato.
 * O e-mail existe para quem não consegue mais entrar.
 */
export function ExcluirContaPage() {
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 640 }}>
      <h1>Excluir sua conta</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        {NOME_PLATAFORMA} — como apagar sua conta e seus dados
      </p>

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <h2>Pelo app, em segundos</h2>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, lineHeight: 1.5 }}>
          <li>Entre na sua conta</li>
          <li>
            Toque em <strong>Perfil</strong>, na barra de baixo
          </li>
          <li>
            Role até <strong>Excluir minha conta</strong>
          </li>
          <li>
            Digite <strong>EXCLUIR</strong> para confirmar
          </li>
        </ol>
        <p style={{ margin: 0 }}>
          <Link to="/perfil">Ir para o Perfil agora</Link>
        </p>

        <h2>Se você não consegue mais entrar</h2>
        <p style={{ margin: 0 }}>
          Escreva para <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a> do mesmo e-mail que você usava
          para entrar. Respondemos em até 15 dias, como manda a LGPD.
        </p>

        <h2>O que é apagado</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, lineHeight: 1.5 }}>
          <li>Sua conta e seu perfil (nome, e-mail, foto e CPF, se você tiver informado)</li>
          <li>Seus anúncios, com fotos, contatos e endereço</li>
          <li>As avaliações que você escreveu</li>
          <li>Seus favoritos</li>
        </ul>

        <h2>O que continua</h2>
        <p style={{ margin: 0 }}>
          <strong>Registros de acesso</strong>, guardados por seis meses porque o Marco Civil da Internet
          obriga.
        </p>
        <p style={{ margin: 0 }}>
          <strong>Pedidos de contato que você enviou a profissionais.</strong> Eles continuam no painel de quem
          recebeu, sem ligação com a sua conta: o profissional precisa saber quem o chamou para poder
          responder. Apagar isso quebraria o trabalho dele, não a sua privacidade.
        </p>

        <h2>É definitivo</h2>
        <p style={{ margin: 0 }}>
          Não há como desfazer nem recuperar depois. Criar uma conta nova com o mesmo e-mail não traz de volta
          anúncios nem avaliações.
        </p>

        <p style={{ margin: 0 }}>
          Veja também a <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
