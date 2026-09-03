import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Termos de Uso.
 *
 * Eram os do procurô, inteiros: falavam de "conta premium", de cadastro
 * "turbinado", de avaliações, de banner de categoria e de cancelar no
 * "Painel do profissional". Nada disso existe no Ei Emprego — e um
 * documento legal que descreve outro serviço não protege ninguém: não vale
 * para o que o app faz, e ainda dá à pessoa a impressão de que ela
 * concordou com regras de coisas que não estão aqui.
 *
 * Os preços não aparecem de propósito. Dentro do app da loja, oferecer
 * compra por fora da cobrança da Google é infração — e um documento que
 * lista mensalidades passa perto demais dessa linha. O que precisa estar
 * escrito é o direito: que dá para cancelar, quando devolve o dinheiro e
 * quem processa o pagamento.
 */
export function TermosPage() {
  useTituloDaPagina("Termos de Uso");
  return (
    <div className="ei">
      <div className="ei-tela">
        <h1 className="ei-titulo-g">Termos de Uso</h1>
        <p className="ei-apoio">Última revisão: agosto de 2026.</p>

        <div className="ei-cartao" style={{ display: "grid", gap: 16, marginTop: 20 }}>
          <p className="ei-corpo">
            O <strong>Ei Emprego</strong> aproxima quem procura trabalho em Itabirito e região de
            quem está contratando. Funcionamos como ponto de encontro: mostramos perfis, avisamos
            sobre vagas e entregamos o contato. <strong>Não somos parte da relação de trabalho.</strong>
          </p>

          <p className="ei-corpo">
            <strong>Não contratamos ninguém e não somos agência de emprego.</strong> Não empregamos,
            não selecionamos, não intermediamos salário e não respondemos por acordos, promessas,
            condições de trabalho, pagamentos ou desligamentos combinados entre a pessoa e a empresa.
          </p>

          <p className="ei-corpo">
            A entrevista, a contratação e tudo o que vem depois dela acontecem diretamente entre as
            duas partes. A plataforma não media conflitos trabalhistas nem comerciais.
          </p>

          <p className="ei-corpo">
            <strong>Não conferimos documentos.</strong> Pedimos a confirmação do número de telefone de
            profissionais e de empresas para reduzir cadastro falso, mas isso{" "}
            <strong>não é checagem de antecedentes nem atestado de idoneidade</strong> de nenhum dos
            dois lados. Desconfie de qualquer vaga que peça pagamento adiantado, depósito ou
            documento por fora do app — o Ei Emprego nunca cobra de quem procura trabalho.
          </p>

          <p className="ei-corpo">
            O cadastro do profissional é <strong>gratuito</strong>, e continua gratuito responder às
            vagas que chegarem.
          </p>

          <h2 className="ei-titulo" style={{ marginTop: 8 }}>
            Planos das empresas
          </h2>

          <p className="ei-corpo">
            Sem plano, a empresa consegue ver os profissionais disponíveis e falar com cada um. Com
            plano, ela publica vagas e dispara os avisos para quem faz aquele trabalho na cidade, na
            quantidade que o plano dela permite e enquanto ele estiver válido.
          </p>

          <p className="ei-corpo">
            <strong>O plano não garante candidato.</strong> O aviso alcança quem está cadastrado
            naquele ofício na cidade e não há como assegurar quantas pessoas vão responder — nem que
            alguma responda.
          </p>

          <h2 className="ei-titulo" style={{ marginTop: 8 }}>
            Cancelamento e reembolso
          </h2>

          <p className="ei-corpo">
            O plano pode ser <strong>cancelado a qualquer momento, pelo próprio app</strong>, em
            "Minha empresa" — no mesmo lugar onde foi contratado e sem precisar falar com ninguém.
          </p>

          <p className="ei-corpo">
            <strong>Arrependimento em 7 dias (art. 49 do Código de Defesa do Consumidor):</strong> se
            o cancelamento for pedido em até 7 dias corridos da contratação, o valor pago é devolvido{" "}
            <strong>integralmente</strong>, sem necessidade de justificar, pelo mesmo meio de
            pagamento usado na compra. O plano é encerrado no ato.
          </p>

          <p className="ei-corpo">
            <strong>Depois dos 7 dias:</strong> o cancelamento interrompe as cobranças seguintes, e o
            período já pago continua valendo até o fim — não há corte no meio de um mês já quitado,
            nem multa por encerrar.
          </p>

          <p className="ei-corpo">
            Os pagamentos são processados pelo <strong>Mercado Pago</strong>; o prazo de estorno na
            fatura ou na conta depende do banco ou da administradora do cartão, e não da plataforma.
          </p>

          <h2 className="ei-titulo" style={{ marginTop: 8 }}>
            Denúncias
          </h2>

          <p className="ei-corpo">
            Existe um <strong>canal de denúncias</strong> para relatar vaga falsa, cobrança indevida,
            informação mentirosa ou conteúdo ofensivo, de qualquer um dos lados. Cadastros com
            denúncia procedente podem ser suspensos ou removidos, o que não gera obrigação de mediar
            ou resolver a disputa entre as partes.
          </p>

          <p className="ei-corpo">
            Ao usar o Ei Emprego — procurando trabalho, publicando vaga ou respondendo a uma — você
            concorda com estes Termos de Uso.
          </p>
        </div>
      </div>
    </div>
  );
}
