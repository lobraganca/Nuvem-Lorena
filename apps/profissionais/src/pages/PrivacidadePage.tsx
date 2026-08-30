import { Link } from "react-router-dom";
import { CIDADE_SEDE, CONTATO_EMAIL, NOME_PLATAFORMA, VERSAO_DOCUMENTOS } from "../config";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Política de Privacidade — documento exigido pela LGPD, separado dos Termos
 * de Uso de propósito: os Termos dizem o que a plataforma faz e não faz; este
 * diz o que ela sabe sobre a pessoa e o que ela pode exigir de volta.
 *
 * O texto é escrito para ser lido por quem não é advogado. A lei não pede
 * juridiquês — pede informação "clara, adequada e ostensiva" (art. 9º), e um
 * documento que ninguém entende não cumpre isso, por mais completo que seja.
 */
export function PrivacidadePage() {
  useTituloDaPagina("Política de Privacidade");
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Política de Privacidade</h1>
      <p className="muted" style={{ marginTop: -8 }}>Última atualização: {VERSAO_DOCUMENTOS}</p>

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <p>
          Esta política explica quais dados o <strong>{NOME_PLATAFORMA}</strong> coleta, por que coleta, com
          quem compartilha e o que você pode exigir a respeito deles. Ela segue a Lei Geral de Proteção de
          Dados (Lei 13.709/2018).
        </p>

        <h2>Quem é o responsável pelos seus dados</h2>
        <p>
          O {NOME_PLATAFORMA} é operado por uma pessoa física, com sede em {CIDADE_SEDE}. Para qualquer
          assunto relacionado a dados pessoais — inclusive os pedidos descritos mais abaixo — o canal é{" "}
          <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
        </p>

        <h2>O que coletamos</h2>
        <p>
          <strong>De todo mundo que entra:</strong> o número de telefone (ou o e-mail e a foto da conta
          Google, quando o login é por ela) e a confirmação de que aquele número é seu.
        </p>
        <p>
          <strong>De quem procura trabalho:</strong> nome, telefone, e-mail, as funções que você aceita, as
          experiências que você contar (empresa, início e fim), cursos e especializações, sua cidade e se
          você está disponível ou oculto.
        </p>
        <p>
          <strong>De quem contrata:</strong> nome da empresa, CNPJ ou CPF, endereço, telefone e e-mail, além
          das vagas publicadas.
        </p>
        <p>
          {/* Sem esta linha, o app guardaria um identificador do aparelho e a
              política não diria — a divergência exata que o comentário abaixo,
              sobre localização, existe para não repetir. */}
          <strong>Para o aviso de vaga:</strong> quando você liga a notificação, guardamos um{" "}
          <strong>identificador do aparelho</strong> gerado pelo sistema (Google ou navegador). Ele serve
          só para entregar o aviso naquele celular, não diz quem você é para ninguém de fora e some
          quando você desliga a notificação ou desinstala o app.
        </p>
        <p>
          <strong>De uso:</strong> quais vagas chegaram até você, quais você respondeu, e registros técnicos
          necessários para o app funcionar e para investigar abusos.
        </p>
        <p>
          {/* Esta parte dizia "não coletamos sua localização em tempo real", e
              era falso: o app pede a localização do aparelho. Uma política que
              nega o que o código faz é pior que uma omissão — e é o tipo de
              divergência que reprova na revisão da Play Store, porque lá o
              formulário de dados, a política e o app são comparados entre si.
              Aqui está o que realmente acontece. */}
          <strong>Localização: não pedimos.</strong> O app do procurô, de onde este código veio, pedia a
          localização do aparelho para adivinhar a cidade. O Ei Itabirito é de uma cidade só — a cidade já
          é conhecida —, e o pedido saiu do código. Nada de coordenada é lido, enviado ou guardado.
        </p>
        <p>
          <strong>Não coletamos</strong> sua lista de contatos, suas fotos, sua agenda, nem dados de cartão:
          quando há pagamento, quem processa é o Mercado Pago, e os dados do cartão não passam pela
          plataforma.
        </p>

        <h2 id="anuncio-publico">O que fica visível para todo mundo</h2>
        <p>
          Ficar <strong>visível</strong> é permitir que qualquer pessoa na internet — inclusive quem não tem
          conta aqui — veja: <strong>nome, foto, cidade, as funções que você aceita, suas experiências,
          cursos e o telefone</strong> que você preencher. É assim que uma empresa te encontra sem que você
          precise responder a nada.
        </p>
        <p>
          {/* O modo oculto é o que a dona pediu para quem já tem emprego e não
              quer ser visto procurando — e uma política que não o descreve
              deixa a pessoa sem saber que ele existe. */}
          O <strong>modo oculto</strong> tira você da busca sem te tirar do app: nesse modo o seu perfil não
          aparece para ninguém, e você continua recebendo os avisos das vagas. A empresa só vê seus dados
          se você responder que tem interesse.
        </p>
        <p>
          <strong>Ficam fora:</strong> seu CPF, seu CNPJ e o seu e-mail de login. Eles existem no cadastro, mas
          são invisíveis na busca e no perfil público.
        </p>
        <p>
          Preencha apenas os contatos que você quer receber. Um campo em branco simplesmente não aparece no seu
          cadastro.
        </p>

        <h2>Por que coletamos (base legal)</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
          <li>
            <strong>Para executar o serviço que você pediu</strong> — mostrar seu cadastro, permitir que te
            encontrem e te chamem. Sem esses dados não existe cadastro.
          </li>
          <li>
            <strong>Para cumprir obrigações legais</strong> — guardar registros de acesso, como exige o Marco
            Civil da Internet.
          </li>
          <li>
            <strong>Por interesse legítimo</strong> — impedir fraude e cadastro em nome de terceiros. É por
            isso que quem se cadastra informa CPF ou CNPJ, envia foto e confirma o número por código.
          </li>
          <li>
            <strong>Com o seu consentimento</strong> — quando houver algo além disso, perguntamos antes.
          </li>
        </ul>

        <h2>Com quem compartilhamos</h2>
        <p>
          {/* Faltavam dois, e são justamente os que recebem telefone e e-mail:
              a empresa que manda o SMS de confirmação e a que manda os avisos
              por e-mail. Omitir quem recebe um dado é omitir o
              compartilhamento em si. */}
          Só com quem é necessário para o app existir, e apenas o mínimo:{" "}
          <strong>Supabase</strong> (banco de dados e login), <strong>Vercel</strong> (hospedagem),{" "}
          <strong>Google</strong> (login), <strong>Mercado Pago</strong> (pagamentos, apenas para quem
          assina), <strong>Twilio</strong> (envio do SMS de confirmação — recebe o número de telefone, só
          para entregar o código), <strong>Resend</strong> (envio de e-mails do app, como o aviso de
          vencimento — recebe o endereço de e-mail, só para entregar a mensagem) e o{" "}
          <strong>serviço de notificação</strong> do Google ou do seu navegador, que recebe o
          identificador do aparelho e o texto do aviso para entregá-lo na sua tela.
        </p>
        <p>
          Twilio e Resend são empresas sediadas fora do Brasil, o que significa que esses dados podem ser
          tratados no exterior. Eles recebem apenas o necessário para entregar a mensagem, e nada além
          disso.
        </p>
        <p>
          <strong>Não vendemos seus dados</strong> e não os cedemos para publicidade de terceiros.
        </p>

        <h2>Por quanto tempo guardamos</h2>
        <p>
          Enquanto sua conta existir. Se você apagar a conta, apagamos o seu perfil, as funções e
          experiências, os avisos de vaga que chegaram e os aparelhos cadastrados para notificação. Duas
          exceções, e é justo você saber delas: os <strong>registros de acesso</strong>, que a lei manda
          guardar por seis meses, e o <strong>interesse que você enviou a uma vaga</strong> — ele continua
          com a empresa que recebeu, porque é o recado que permite ela te retornar.
        </p>

        <h2>Seus direitos</h2>
        <p>Você pode, a qualquer momento e sem justificar:</p>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
          <li>
            <strong>Ver e baixar seus dados</strong> — em <Link to="/perfil">Perfil</Link>, em "Baixar meus
            dados", sem precisar pedir a ninguém.
          </li>
          <li>
            <strong>Corrigir</strong> qualquer informação, editando o cadastro ou o perfil.
          </li>
          <li>
            <strong>Apagar a conta</strong> — em <Link to="/perfil">Perfil</Link>, em "Excluir minha conta"
            (ou direto por <Link to="/excluir-conta">esta página</Link>). É imediato e definitivo.
          </li>
          <li>
            <strong>Saber com quem compartilhamos</strong> e revogar consentimentos, escrevendo para{" "}
            <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
          </li>
        </ul>
        <p>
          Respondemos os pedidos enviados por e-mail em até <strong>15 dias</strong>. Se você achar que seus
          direitos não foram respeitados, pode reclamar à ANPD (Autoridade Nacional de Proteção de Dados).
        </p>

        <h2>Cookies e armazenamento no aparelho</h2>
        <p>
          Não usamos cookies de publicidade nem rastreamento de terceiros. O app guarda no seu próprio aparelho
          apenas o necessário para funcionar: a sua sessão de login (para você não precisar entrar de novo) e
          preferências como "já vi a apresentação". Nada disso é enviado a anunciantes.
        </p>

        <h2>Crianças e adolescentes</h2>
        <p>
          A plataforma é para maiores de 18 anos. Se soubermos de um cadastro de menor de idade, ele será
          removido.
        </p>

        <h2>Segurança</h2>
        <p>
          Os dados ficam em servidores com acesso restrito, e o banco é protegido por regras que impedem uma
          pessoa de ler os dados de outra. Nenhum sistema é infalível: se acontecer um incidente que possa te
          causar risco, avisaremos você e a ANPD, como manda a lei.
        </p>

        <h2>Mudanças nesta política</h2>
        <p>
          Se este texto mudar de forma relevante, avisamos no app. A data no alto da página sempre indica a
          versão vigente.
        </p>

        <p>
          Veja também os <Link to="/termos">Termos de Uso</Link>.
        </p>
      </div>
    </div>
  );
}
