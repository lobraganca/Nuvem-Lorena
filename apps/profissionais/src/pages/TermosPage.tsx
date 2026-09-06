import { Link } from "react-router-dom";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { SUPORTE_WHATSAPP_VISIVEL, VERSAO_DOCUMENTOS } from "../config";

/**
 * Termos de Uso.
 *
 * ── Reescritos em 06/09 ───────────────────────────────────────────────
 *
 * A dona: "nos termos de uso, deixar claro que o Ei é só uma plataforma
 * de intermediação e consulta de pessoas e empresas, que não tem nenhuma
 * responsabilidade sobre os cadastros e sobre compromissos assumidos
 * entre as partes. Preciso que todos esses termos sejam escritos de forma
 * profissional e que deixem claro que o Ei não tem responsabilidade."
 *
 * O que mudou não foi o conteúdo — a isenção já estava dita — e sim a
 * FORMA. Antes eram catorze parágrafos soltos: um documento em que a
 * cláusula que protege está no meio de um texto corrido não é encontrável
 * quando alguém precisa apontar para ela. Agora são seções numeradas, com
 * a limitação de responsabilidade num item próprio e com título.
 *
 * ── Escrito para ser LIDO ─────────────────────────────────────────────
 *
 * Profissional não quer dizer rebuscado. Quem lê isto é gente de
 * Itabirito procurando emprego no celular, e um texto em juridiquês tem o
 * efeito oposto do pretendido: ninguém lê, ninguém sabe do que
 * discordou, e uma cláusula que não foi compreendida é a mais fácil de
 * derrubar. As frases são curtas e as palavras são as de todo dia.
 *
 * ── Os preços continuam fora ──────────────────────────────────────────
 *
 * Dentro do app da loja, oferecer compra por fora da cobrança da Google é
 * infração, e um documento que lista mensalidades passa perto demais
 * dessa linha. O que precisa estar escrito é o DIREITO: que dá para
 * cancelar, quando o dinheiro volta e quem processa o pagamento.
 *
 * ── E o que este arquivo não é ────────────────────────────────────────
 *
 * Um texto revisado por advogado. Ele foi escrito com cuidado e cobre o
 * que a dona pediu, mas quem responde por um documento destes num
 * processo é quem assina — e vale a leitura de alguém da área antes de o
 * app crescer.
 */
export function TermosPage() {
  useTituloDaPagina("Termos de Uso");
  return (
    <div className="ei">
      <div className="ei-tela">
        <h1 className="ei-titulo-g">Termos de Uso</h1>
        <p className="ei-apoio">
          Última revisão: {VERSAO_DOCUMENTOS}. Ao criar cadastro, publicar vaga ou responder
          a uma, você concorda com todo o conteúdo abaixo.
        </p>

        <div className="ei-cartao ei-documento">
          <h2 className="ei-doc-secao">1. O que o Ei Emprego é</h2>
          <p>
            O <strong>Ei Emprego</strong> é uma <strong>plataforma de intermediação e
            consulta</strong>. Ele aproxima quem procura trabalho em Itabirito e região de
            quem está contratando: exibe cadastros, avisa sobre vagas e entrega os
            contatos para que as partes conversem diretamente.
          </p>
          <p>
            É <strong>ponto de encontro</strong>, e nada além disso.
          </p>

          <h2 className="ei-doc-secao">2. O que o Ei Emprego não é</h2>
          <p>
            O Ei Emprego <strong>não é agência de emprego, não é empregador, não é
            representante</strong> de nenhuma das partes e <strong>não participa da relação
            de trabalho</strong> que venha a existir entre elas.
          </p>
          <p>
            A plataforma não seleciona candidatos, não avalia currículos, não negocia
            salário, não acompanha entrevistas, não fiscaliza jornada e não interfere em
            nenhuma decisão de contratação ou de desligamento.
          </p>

          <h2 className="ei-doc-secao">
            3. Cada um responde pelo que publica
          </h2>
          <p>
            Todo conteúdo dos cadastros e das vagas é escrito e enviado pelos próprios
            usuários. <strong>Quem publica é o único responsável</strong> pela veracidade,
            pela exatidão e pela legalidade do que publicou — nome, telefone, funções,
            experiência, formação, descrição da vaga, remuneração e exigências.
          </p>
          <p>
            <strong>O Ei Emprego não confere documentos</strong>, não checa antecedentes,
            não valida diplomas, não visita empresas e não atesta a idoneidade de ninguém.
            A confirmação do número de telefone existe para reduzir cadastro falso e{" "}
            <strong>não é garantia de identidade, de capacidade técnica nem de boa-fé</strong>{" "}
            de qualquer das partes.
          </p>

          <h2 className="ei-doc-secao">
            4. Ausência de responsabilidade da plataforma
          </h2>
          <p>
            Esta é a cláusula central destes Termos, e vale para os dois lados.
          </p>
          <p className="ei-doc-destaque">
            <strong>O Ei Emprego não se responsabiliza, em nenhuma hipótese, por:</strong>
          </p>
          <ul className="ei-doc-lista">
            <li>
              o conteúdo, a veracidade ou a atualidade de qualquer cadastro, vaga, foto,
              telefone ou informação publicada por usuários;
            </li>
            <li>
              compromissos, acordos, promessas, propostas, combinados verbais ou contratos
              firmados entre profissionais e empresas, dentro ou fora do app;
            </li>
            <li>
              a efetivação da contratação, o pagamento de salários, diárias, comissões ou
              qualquer valor devido entre as partes;
            </li>
            <li>
              a qualidade, a segurança ou a conclusão do serviço prestado, e por prejuízos
              materiais ou morais decorrentes dele;
            </li>
            <li>
              condições de trabalho, acidentes, encargos, obrigações trabalhistas,
              previdenciárias, tributárias ou de qualquer outra natureza entre as partes;
            </li>
            <li>
              condutas, omissões, desistências ou não comparecimento de qualquer usuário;
            </li>
            <li>
              danos decorrentes de golpe, fraude ou má-fé praticados por terceiros com uso
              da plataforma.
            </li>
          </ul>
          <p>
            <strong>Toda e qualquer obrigação assumida entre um profissional e uma empresa
            é exclusivamente entre eles.</strong> A plataforma não é parte, não é fiadora,
            não é testemunha e não medeia conflitos trabalhistas, cíveis ou comerciais.
          </p>
          <p>
            O uso do Ei Emprego é feito por conta e risco de cada usuário, que deve tomar
            as cautelas de sempre antes de fechar qualquer acordo — conferir informações,
            pedir referências e desconfiar do que parecer bom demais.
          </p>

          <h2 className="ei-doc-secao">5. Segurança de quem procura trabalho</h2>
          <p>
            <strong>O Ei Emprego nunca cobra de quem procura emprego.</strong> Desconfie e
            denuncie qualquer vaga que peça pagamento adiantado, depósito, taxa de
            cadastro, compra de material, envio de documentos por fora do app ou dados
            bancários.
          </p>
          <p>
            O cadastro do profissional é <strong>gratuito</strong> e responder às vagas
            também.
          </p>

          <h2 className="ei-doc-secao">6. Planos das empresas</h2>
          <p>
            Sem plano, a empresa consegue ver os profissionais disponíveis e falar com cada
            um. Com plano, ela publica vagas e dispara os avisos para quem faz aquele
            trabalho na cidade, na quantidade que o plano permitir e enquanto ele estiver
            válido.
          </p>
          <p>
            <strong>O plano não garante candidato.</strong> O aviso alcança quem está
            cadastrado naquele ofício na cidade, e não há como assegurar quantas pessoas
            vão responder — nem que alguma responda. O que se contrata é a divulgação, não
            o resultado dela.
          </p>

          <h2 className="ei-doc-secao">7. Cancelamento e reembolso</h2>
          <p>
            O plano pode ser <strong>cancelado a qualquer momento, pelo próprio app</strong>,
            no mesmo lugar em que foi contratado e sem precisar falar com ninguém.
          </p>
          <p>
            <strong>Arrependimento em 7 dias (art. 49 do Código de Defesa do
            Consumidor):</strong> pedido o cancelamento em até 7 dias corridos da
            contratação, o valor pago é devolvido <strong>integralmente</strong>, sem
            necessidade de justificar, pelo mesmo meio de pagamento usado na compra. O
            plano é encerrado no ato.
          </p>
          <p>
            <strong>Depois dos 7 dias:</strong> o cancelamento interrompe as cobranças
            seguintes e o período já pago continua valendo até o fim. Não há corte no meio
            de um mês quitado, nem multa por encerrar.
          </p>
          <p>
            Os pagamentos são processados pelo <strong>Mercado Pago</strong>. O prazo de
            estorno na fatura ou na conta depende do banco ou da administradora do cartão,
            e não da plataforma.
          </p>

          <h2 className="ei-doc-secao">8. Denúncias, suspensão e remoção</h2>
          <p>
            Existe um <strong>canal de denúncias</strong> no app para relatar vaga falsa,
            cobrança indevida, informação mentirosa, discriminação ou conteúdo ofensivo, de
            qualquer um dos lados.
          </p>
          <p>
            O Ei Emprego pode <strong>suspender ou remover</strong> cadastros e vagas que
            violem estes Termos ou a lei, a seu critério e sem aviso prévio. Essa
            faculdade <strong>não cria obrigação de fiscalizar</strong> o conteúdo
            publicado, nem de mediar ou resolver a disputa entre as partes.
          </p>

          <h2 className="ei-doc-secao">9. Disponibilidade do serviço</h2>
          <p>
            O app é oferecido no estado em que se encontra. Podem ocorrer interrupções para
            manutenção, falhas de conexão, indisponibilidade de serviços de terceiros
            (envio de SMS, notificações, pagamento) e perda de mensagens. A plataforma não
            responde por prejuízo decorrente de indisponibilidade temporária, e um aviso de
            vaga que não chegue não gera direito a indenização.
          </p>

          <h2 className="ei-doc-secao">10. Mudanças nestes Termos</h2>
          <p>
            Estes Termos podem ser atualizados a qualquer momento, e a versão vigente é
            sempre esta, dentro do app, com a data de revisão no alto. O uso continuado
            depois de uma alteração significa concordância com ela.
          </p>

          <h2 className="ei-doc-secao">11. Foro e contato</h2>
          <p>
            Aplica-se a legislação brasileira, e fica eleito o foro da comarca de{" "}
            <strong>Itabirito/MG</strong> para dirimir questões destes Termos, com renúncia
            a qualquer outro.
          </p>
          <p>
            Dúvidas, denúncias e pedidos sobre dados podem ser enviados pelo WhatsApp{" "}
            <strong>{SUPORTE_WHATSAPP_VISIVEL}</strong> ou pelo canal de suporte dentro do app.
          </p>
          <p>
            Veja também a <Link to="/privacidade">Política de Privacidade</Link> e as{" "}
            <Link to="/ajuda">Perguntas frequentes</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
