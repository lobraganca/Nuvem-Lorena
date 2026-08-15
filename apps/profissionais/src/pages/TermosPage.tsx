import { useTituloDaPagina } from "../lib/tituloDaPagina";

export function TermosPage() {
  useTituloDaPagina("Termos de Uso");
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <h1>Termos de Uso</h1>
      <div className="card" style={{ display: "grid", gap: 16 }}>
        <p>
          O <strong>procurô</strong> é uma plataforma de busca e divulgação de profissionais autônomos
          e empresas prestadoras de serviço. Funcionamos como uma vitrine/intermediário de contato entre quem
          procura um serviço e quem o oferece — não somos parte na relação de prestação de serviço em si.
        </p>
        <p>
          <strong>Não prestamos os serviços cadastrados.</strong> Não empregamos, não supervisionamos e não nos
          responsabilizamos pela qualidade, execução, prazos, preços ou resultado de qualquer serviço
          contratado entre o usuário e o profissional ou empresa cadastrada.
        </p>
        <p>
          A contratação e todo o relacionamento decorrente dela — incluindo pagamento pelo serviço prestado,
          combinações entre as partes, eventuais danos, atrasos ou problemas de qualquer natureza — é
          inteiramente entre o usuário e o profissional/empresa. A plataforma não é parte nessa relação e não
          media disputas comerciais entre as partes.
        </p>
        <p>
          A <strong>conta premium</strong> e o destaque de cadastro <strong>"turbinado"</strong> indicam
          <strong> apenas que o profissional ou a empresa assinou o plano correspondente</strong>. Não são
          selo de checagem: a plataforma <strong>não confere documentos, não audita o cadastro e não atesta a
          idoneidade</strong> de quem se cadastra. Também não são garantia de qualidade nem de bom resultado do
          serviço contratado.
        </p>
        <p>
          As <strong>avaliações</strong> publicadas na plataforma são de responsabilidade exclusiva de quem as
          escreve. A plataforma pode remover, a seu critério, avaliações ou conteúdo de cadastros que sejam
          denunciados e considerados em violação a estes Termos.
        </p>
        <p>
          Existe um <strong>canal de denúncias</strong> para reportar problemas em cadastros (informação falsa,
          golpe/fraude, conteúdo ofensivo, entre outros). A plataforma pode suspender ou remover cadastros que
          recebam denúncias procedentes, mas isso não gera qualquer obrigação de mediar ou resolver disputas
          entre usuário e profissional/empresa.
        </p>
        <p>
          O cadastro de pessoa física exige CPF e foto de rosto; o cadastro de pessoa jurídica exige CNPJ e o
          nome de um responsável pela empresa. Esses dados servem para reduzir fraude e dar mais transparência
          aos cadastros, mas <strong>não constituem, por si só, garantia de idoneidade</strong> de quem se cadastrou.
        </p>
        <h2 style={{ fontSize: "1.05rem", marginBottom: 0 }}>Assinaturas, cancelamento e reembolso</h2>
        <p>
          As assinaturas (conta premium, destaque na busca e Empresa Plus) podem ser{" "}
          <strong>canceladas a qualquer momento</strong>, pelo próprio app, no Painel do profissional — no mesmo
          lugar onde foram contratadas e sem precisar falar com ninguém.
        </p>
        <p>
          <strong>Arrependimento em 7 dias (art. 49 do Código de Defesa do Consumidor):</strong> se o
          cancelamento for pedido em até 7 dias corridos da contratação, o valor pago é devolvido{" "}
          <strong>integralmente</strong>, sem necessidade de justificar, pelo mesmo meio de pagamento usado na
          compra. O benefício contratado é encerrado no ato.
        </p>
        <p>
          <strong>Depois dos 7 dias:</strong> o cancelamento interrompe as cobranças seguintes, e o período já
          pago continua valendo até o fim — não há corte no meio de um mês (ou ano) já quitado, nem multa por
          encerrar.
        </p>
        <p>
          Compras avulsas de <strong>banner de categoria</strong> seguem a mesma regra de 7 dias; após esse
          prazo, por serem por período determinado e já em veiculação, não são reembolsáveis
          proporcionalmente.
        </p>
        <p>
          Os pagamentos são processados pelo <strong>Mercado Pago</strong>; o prazo de estorno na fatura ou na
          conta depende do banco ou administradora do cartão, e não da plataforma.
        </p>

        <p>
          Ao usar o procurô — seja buscando um profissional, avaliando um cadastro ou cadastrando o seu
          próprio cadastro — você concorda com estes Termos de Uso.
        </p>
      </div>
    </div>
  );
}
