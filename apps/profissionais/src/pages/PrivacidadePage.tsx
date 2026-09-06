import { Link } from "react-router-dom";
import {
  CIDADE_SEDE,
  CONTATO_EMAIL,
  NOME_PLATAFORMA,
  SUPORTE_WHATSAPP_VISIVEL,
  VERSAO_DOCUMENTOS,
} from "../config";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Política de Privacidade.
 *
 * ── Reescrita em 06/09 ────────────────────────────────────────────────
 *
 * A dona: "sobre privacidade, ter um campo antes de salvar o cadastro onde
 * a pessoa marque e se comprometa com as regras de divulgação dos dados e
 * utilização deles para encontro de oportunidades. Que inclusive os dados
 * coletados serão divulgados, pois esse é o intuito da plataforma."
 *
 * O texto anterior já era honesto, mas enterrava a frase mais importante
 * no meio do documento, entre "o que coletamos" e "por quanto tempo
 * guardamos". Num app cujo propósito é PUBLICAR o cadastro de alguém, essa
 * é a informação que não pode depender de a pessoa ler até o fim: virou a
 * seção 1, antes de qualquer outra coisa.
 *
 * ── Por que "divulgação" tem seção própria, e é a primeira ────────────
 *
 * A LGPD pede informação "clara, adequada e ostensiva" (art. 9º).
 * Ostensiva quer dizer difícil de não ver. Um cadastro que aparece na
 * internet para qualquer pessoa é exatamente o tipo de tratamento que
 * ninguém pode descobrir depois — e a caixinha de consentimento que a
 * pessoa marca antes de salvar aponta para esta seção pelo nome.
 *
 * ── Este arquivo tem de continuar sendo verdade ───────────────────────
 *
 * A parte da localização já esteve errada uma vez: dizia "não coletamos"
 * quando o código pedia a coordenada do aparelho. Política que diverge do
 * código é pior que política omissa, e é o que reprova na revisão da Play
 * Store, onde o formulário de dados, este texto e o app são comparados
 * entre si. Quem mexer no que o app coleta, mexe aqui na mesma tarefa.
 *
 * ── E o que este arquivo não é ────────────────────────────────────────
 *
 * Um texto revisado por advogado. Cobre o que foi pedido e o que a lei
 * lista, mas quem responde por ele é quem assina.
 */
export function PrivacidadePage() {
  useTituloDaPagina("Política de Privacidade");
  return (
    <div className="ei">
      <div className="ei-tela">
        <h1 className="ei-titulo-g">Política de Privacidade</h1>
        <p className="ei-apoio">
          Última revisão: {VERSAO_DOCUMENTOS}. Esta política explica quais dados o{" "}
          {NOME_PLATAFORMA} coleta, o que ele faz com eles e o que você pode exigir a
          respeito. Ela segue a Lei Geral de Proteção de Dados (Lei 13.709/2018).
        </p>

        <div className="ei-cartao ei-documento">
          <h2 className="ei-doc-secao">1. O seu cadastro é feito para ser divulgado</h2>
          <p className="ei-doc-destaque">
            <strong>
              Este é o ponto mais importante de todo o documento: os dados que você
              cadastra aqui serão divulgados. É para isso que a plataforma existe.
            </strong>
          </p>
          <p>
            O {NOME_PLATAFORMA} não é um cofre de currículos. Ele é uma{" "}
            <strong>vitrine pública</strong>: o seu cadastro é mostrado a empresas e a
            qualquer pessoa na internet — inclusive a quem não tem conta aqui — justamente
            para que alguém te encontre e te chame para trabalhar. Um cadastro que ninguém
            pudesse ver não serviria para nada.
          </p>
          <p>
            <strong>Ficam visíveis para qualquer pessoa:</strong>
          </p>
          <ul className="ei-doc-lista">
            <li>seu nome e sua foto;</li>
            <li>sua cidade e, se você preencher, o seu bairro;</li>
            <li>as funções que você aceita e as suas especialidades;</li>
            <li>suas experiências, cursos e formação;</li>
            <li>
              o <strong>telefone</strong> e os contatos que você preencher — é por eles que
              a empresa te chama.
            </li>
          </ul>
          <p>
            <strong>Nunca ficam visíveis:</strong> seu CPF, seu CNPJ e o e-mail que você usa
            para entrar. Eles existem no cadastro, mas não aparecem na busca nem no seu
            perfil público.
          </p>
          <p>
            Ao salvar o cadastro, você <strong>autoriza essa divulgação</strong> e o uso dos
            seus dados para te aproximar de oportunidades de trabalho: aparecer nas buscas,
            entrar nas listas de profissionais, ser comparado com as vagas abertas e receber
            avisos das que combinam com você.
          </p>
          <p>
            <strong>Preencha só o que você quer que apareça.</strong> Campo em branco não
            aparece em lugar nenhum.
          </p>

          <h2 className="ei-doc-secao">2. O modo oculto, para quem não quer ser visto</h2>
          <p>
            Se você já tem emprego e não quer que te vejam procurando, ligue o{" "}
            <strong>modo oculto</strong> no seu cadastro. Nele o seu perfil sai da busca e
            das listas, e ninguém consegue abrir a sua ficha.
          </p>
          <p>
            Você continua recebendo os avisos das vagas — e a empresa só passa a ver os seus
            dados <strong>se você responder que tem interesse</strong>. Aí a divulgação
            acontece porque você escolheu, e só para aquela empresa.
          </p>

          <h2 className="ei-doc-secao">3. Quem é o responsável pelos seus dados</h2>
          <p>
            O {NOME_PLATAFORMA} é operado por pessoa física, com sede em {CIDADE_SEDE}. Para
            qualquer assunto sobre dados pessoais — inclusive os pedidos da seção 8 — o canal
            é <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a> ou o WhatsApp{" "}
            <strong>{SUPORTE_WHATSAPP_VISIVEL}</strong>.
          </p>

          <h2 className="ei-doc-secao">4. O que coletamos</h2>
          <p>
            <strong>De todo mundo que entra:</strong> o número de telefone (ou o e-mail e a
            foto da conta Google, quando o acesso é por ela) e a confirmação de que aquele
            número é seu.
          </p>
          <p>
            <strong>De quem procura emprego:</strong> nome, telefone, e-mail, CPF, as funções
            que você aceita, as experiências que você contar (empresa, início e fim), cursos e
            especializações, cidade, bairro, foto e se você está disponível ou oculto.
          </p>
          <p>
            <strong>De quem contrata:</strong> nome da empresa, CNPJ ou CPF, endereço,
            telefone, e-mail e as vagas publicadas.
          </p>
          <p>
            <strong>Para o aviso de vaga:</strong> quando você liga a notificação, guardamos
            um <strong>identificador do aparelho</strong> gerado pelo sistema (Google ou
            navegador). Ele serve só para entregar o aviso naquele celular, não diz quem você
            é para ninguém de fora e some quando você desliga a notificação ou desinstala o
            app.
          </p>
          <p>
            <strong>De uso:</strong> quais vagas chegaram até você, quais você respondeu,
            quem abriu o seu perfil, e registros técnicos necessários para o app funcionar e
            para investigar abusos.
          </p>
          <p>
            <strong>Localização: não pedimos.</strong> O app é de uma região só e a cidade
            você mesmo escolhe numa lista. Nenhuma coordenada do aparelho é lida, enviada ou
            guardada.
          </p>
          <p>
            <strong>Não coletamos</strong> sua lista de contatos, suas fotos, sua agenda nem
            dados de cartão: quando há pagamento, quem processa é o Mercado Pago, e o número
            do cartão não passa pela plataforma.
          </p>

          <h2 className="ei-doc-secao">5. Por que coletamos (base legal)</h2>
          <ul className="ei-doc-lista">
            <li>
              <strong>Para executar o serviço que você pediu</strong> — divulgar o seu
              cadastro, permitir que te encontrem e te chamem. Sem esses dados não existe
              cadastro.
            </li>
            <li>
              <strong>Com o seu consentimento</strong> — dado ao marcar a caixa antes de
              salvar o cadastro, e que você pode retirar a qualquer momento, ligando o modo
              oculto ou apagando a conta.
            </li>
            <li>
              <strong>Por interesse legítimo</strong> — impedir fraude e cadastro em nome de
              terceiros. É por isso que se informa CPF ou CNPJ e se confirma o número por
              código.
            </li>
            <li>
              <strong>Para cumprir obrigações legais</strong> — guardar registros de acesso,
              como exige o Marco Civil da Internet.
            </li>
          </ul>

          <h2 className="ei-doc-secao">6. Com quem compartilhamos</h2>
          <p>
            Além da divulgação pública descrita na seção 1, os seus dados passam apenas por
            quem é necessário para o app existir, e só o mínimo:{" "}
            <strong>Supabase</strong> (banco de dados e login), <strong>Vercel</strong>{" "}
            (hospedagem), <strong>Google</strong> (login e loja de aplicativos),{" "}
            <strong>Mercado Pago</strong> (pagamentos, apenas para quem assina),{" "}
            <strong>Twilio</strong> (envio do SMS de confirmação — recebe o telefone, só para
            entregar o código), <strong>Resend</strong> (envio dos e-mails do app — recebe o
            endereço, só para entregar a mensagem) e o{" "}
            <strong>serviço de notificação</strong> do Google ou do seu navegador, que recebe
            o identificador do aparelho e o texto do aviso.
          </p>
          <p>
            Twilio e Resend são empresas sediadas fora do Brasil, o que significa que esses
            dados podem ser tratados no exterior. Recebem apenas o necessário para entregar a
            mensagem.
          </p>
          <p>
            <strong>Não vendemos seus dados</strong> e não os cedemos para publicidade de
            terceiros.
          </p>

          <h2 className="ei-doc-secao">7. Por quanto tempo guardamos</h2>
          <p>
            Enquanto a sua conta existir. Se você apagar a conta, apagamos o seu perfil, as
            funções e experiências, os avisos que chegaram e os aparelhos cadastrados para
            notificação.
          </p>
          <p>
            Duas exceções, e é justo você saber delas: os{" "}
            <strong>registros de acesso</strong>, que a lei manda guardar por seis meses, e o{" "}
            <strong>interesse que você enviou a uma vaga</strong> — ele continua com a empresa
            que recebeu, porque é o recado que permite ela te retornar.
          </p>
          <p>
            E há o que a plataforma não alcança: um dado que já foi divulgado pode ter sido
            copiado, anotado ou salvo por quem o viu.{" "}
            <strong>
              Apagar o cadastro tira você do app, mas não desfaz o que terceiros já
              guardaram
            </strong>{" "}
            — e isso vale para qualquer informação publicada na internet.
          </p>

          <h2 className="ei-doc-secao">8. Seus direitos</h2>
          <p>Você pode, a qualquer momento e sem justificar:</p>
          <ul className="ei-doc-lista">
            <li>
              <strong>Ver e baixar seus dados</strong> — em{" "}
              <Link to="/perfil">Perfil</Link>, em "Baixar meus dados", sem pedir a ninguém.
            </li>
            <li>
              <strong>Corrigir</strong> qualquer informação, editando o cadastro.
            </li>
            <li>
              <strong>Sair da divulgação</strong> sem perder a conta, ligando o modo oculto.
            </li>
            <li>
              <strong>Apagar a conta</strong> — em <Link to="/perfil">Perfil</Link>, em
              "Excluir minha conta" (ou direto por{" "}
              <Link to="/excluir-conta">esta página</Link>). É imediato e definitivo.
            </li>
            <li>
              <strong>Saber com quem compartilhamos</strong> e revogar consentimentos, pelo
              e-mail ou WhatsApp da seção 3.
            </li>
          </ul>
          <p>
            Respondemos os pedidos em até <strong>15 dias</strong>. Se você achar que seus
            direitos não foram respeitados, pode reclamar à ANPD (Autoridade Nacional de
            Proteção de Dados).
          </p>

          <h2 className="ei-doc-secao">9. Segurança, e o que ela não cobre</h2>
          <p>
            Os dados ficam em servidores de acesso restrito, e o banco é protegido por regras
            que impedem uma pessoa de ler os dados de outra. Nenhum sistema é infalível: se
            acontecer um incidente que possa te causar risco, avisaremos você e a ANPD, como
            manda a lei.
          </p>
          <p>
            <strong>
              A plataforma não responde pelo uso que terceiros façam dos dados que você
              escolheu divulgar
            </strong>{" "}
            — inclusive contatos indesejados vindos de quem viu o seu cadastro. Golpe,
            cobrança e proposta suspeita devem ser denunciados pelo canal do app, e as{" "}
            <Link to="/termos">condições completas estão nos Termos de Uso</Link>.
          </p>

          <h2 className="ei-doc-secao">10. Cookies e o que fica no seu aparelho</h2>
          <p>
            Não usamos cookies de publicidade nem rastreamento de terceiros. O app guarda no
            seu próprio aparelho apenas o necessário para funcionar: a sua sessão de login
            (para você não precisar entrar de novo) e preferências como "já vi a
            apresentação". Nada disso vai para anunciantes.
          </p>

          <h2 className="ei-doc-secao">11. Crianças e adolescentes</h2>
          <p>
            A plataforma é para maiores de 18 anos. Se soubermos de um cadastro de menor de
            idade, ele será removido.
          </p>

          <h2 className="ei-doc-secao">12. Mudanças nesta política</h2>
          <p>
            Se este texto mudar de forma relevante, avisamos no app. A data no alto da página
            sempre indica a versão vigente.
          </p>
          <p>
            Veja também os <Link to="/termos">Termos de Uso</Link> e as{" "}
            <Link to="/ajuda">Perguntas frequentes</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
