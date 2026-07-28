/**
 * Rascunhos jurídicos do Avena.
 *
 * Escritos seguindo a estrutura usual de marketplaces de turismo e as
 * exigências da LGPD (Lei 13.709/2018) e do Código de Defesa do Consumidor.
 * DEVEM ser revisados por advogado antes de entrar em produção — os trechos
 * entre colchetes precisam ser preenchidos com os dados reais da empresa.
 */

/** Alterar a versão obriga todos os usuários a aceitarem novamente. */
export const LEGAL_VERSION = "1.0";
export const LEGAL_UPDATED_AT = "2026-07-28";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export const termsOfUse: LegalSection[] = [
  {
    title: "1. Quem somos",
    paragraphs: [
      "O Avena é uma plataforma digital operada por [RAZÃO SOCIAL], inscrita no CNPJ [00.000.000/0001-00], com sede em [ENDEREÇO COMPLETO] (\"Avena\", \"nós\").",
      "Estes Termos de Uso regem o acesso e a utilização do aplicativo, do site e de todos os serviços do Avena. Ao criar uma conta, reservar um passeio ou cadastrar um estabelecimento, você declara que leu, compreendeu e aceita integralmente estes Termos e a Política de Privacidade.",
    ],
  },
  {
    title: "2. Definições",
    paragraphs: [
      "Viajante: pessoa física que utiliza o Avena para registrar experiências, descobrir destinos e reservar serviços turísticos.",
      "Parceiro: agência de turismo, guia, restaurante ou meio de hospedagem que cadastra e oferece seus serviços na plataforma.",
      "Serviço turístico: o passeio, roteiro, refeição, hospedagem ou atividade efetivamente prestado pelo Parceiro ao Viajante.",
      "Plataforma: o conjunto de aplicativo, site e sistemas do Avena.",
    ],
  },
  {
    title: "3. Nosso papel: intermediação",
    paragraphs: [
      "O Avena é um intermediador. Aproximamos Viajantes e Parceiros e viabilizamos a reserva e o pagamento, mas NÃO prestamos, organizamos, executamos nem supervisionamos os serviços turísticos anunciados.",
      "O contrato de prestação do serviço turístico é celebrado diretamente entre o Viajante e o Parceiro. O Parceiro é o único responsável pela execução do serviço, pela sua qualidade, segurança, pelas licenças exigidas e pela emissão da nota fiscal correspondente ao valor que recebe.",
      "O Avena responde pelos serviços que efetivamente presta: o funcionamento da plataforma, a intermediação da reserva e o repasse dos valores.",
    ],
  },
  {
    title: "4. Cadastro e conta",
    paragraphs: [
      "Para utilizar os serviços é necessário criar uma conta com informações verdadeiras, completas e atualizadas. Você é responsável por manter a confidencialidade das suas credenciais e por toda atividade realizada na sua conta.",
      "É proibido criar conta em nome de terceiro sem autorização, utilizar identidade falsa ou manter mais de uma conta com finalidade fraudulenta.",
      "O uso da plataforma é permitido a maiores de 18 anos. Menores só podem participar de experiências acompanhados de responsável legal, que assume a reserva em seu nome.",
    ],
  },
  {
    title: "5. Obrigações do Viajante",
    paragraphs: [
      "Fornecer informações corretas na reserva, incluindo data e número de participantes.",
      "Comparecer no local e horário combinados e cumprir as regras de segurança informadas pelo Parceiro.",
      "Informar previamente ao Parceiro condições de saúde, limitações físicas ou restrições que possam afetar a realização da atividade com segurança.",
      "Publicar avaliações verdadeiras, baseadas em experiência real, sem linguagem ofensiva, discriminatória ou difamatória.",
    ],
  },
  {
    title: "6. Obrigações do Parceiro",
    paragraphs: [
      "Manter registro válido no Cadastur (Ministério do Turismo) quando exigido por lei, bem como todas as licenças, alvarás e seguros aplicáveis à sua atividade.",
      "Anunciar informações verdadeiras sobre preço, duração, roteiro, nível de dificuldade, itens inclusos, vagas disponíveis e política de cancelamento.",
      "Prestar o serviço nas condições anunciadas e honrar todas as reservas confirmadas pela plataforma.",
      "Emitir nota fiscal ao Viajante pelo valor do serviço e cumprir suas obrigações fiscais, trabalhistas e previdenciárias.",
      "Comunicar imediatamente ao Avena e ao Viajante qualquer cancelamento, alteração ou incidente ocorrido durante a atividade.",
    ],
  },
  {
    title: "7. Reservas e pagamentos",
    paragraphs: [
      "A reserva se confirma após a aprovação do pagamento. Os pagamentos são processados por instituição de pagamento autorizada pelo Banco Central, contratada pelo Avena. O Avena não armazena dados completos de cartão de crédito.",
      "O valor pago pelo Viajante é dividido automaticamente entre o Parceiro e o Avena, conforme a taxa de serviço vigente no plano contratado pelo Parceiro.",
      "Os preços são exibidos em reais (BRL) e definidos pelo Parceiro. Impostos aplicáveis ao serviço turístico são de responsabilidade do Parceiro.",
    ],
  },
  {
    title: "8. Planos e assinaturas",
    paragraphs: [
      "Parceiros podem contratar planos de assinatura mensal, que concedem maior destaque na plataforma e taxa de serviço reduzida por reserva. Viajantes podem contratar planos opcionais com recursos adicionais.",
      "As assinaturas são renovadas automaticamente até que sejam canceladas. O cancelamento pode ser feito a qualquer momento e produz efeito ao fim do ciclo já pago, sem reembolso proporcional do período em curso, salvo disposição legal em contrário.",
      "Os valores dos planos podem ser alterados mediante aviso prévio de 30 dias, aplicando-se apenas aos ciclos seguintes.",
    ],
  },
  {
    title: "9. Cancelamento, arrependimento e reembolso",
    paragraphs: [
      "Direito de arrependimento: nos termos do art. 49 do Código de Defesa do Consumidor, o Viajante pode desistir da contratação em até 7 (sete) dias corridos contados da reserva, com reembolso integral, desde que o serviço ainda não tenha sido prestado.",
      "Fora desse prazo, aplica-se a política de cancelamento do passeio (Flexível, Moderada ou Rígida), exibida antes da confirmação da reserva.",
      "Cancelamento pelo Parceiro: se o Parceiro cancelar o serviço por qualquer motivo, incluindo condições climáticas ou operacionais, o Viajante tem direito a reembolso integral, inclusive da taxa de serviço do Avena.",
      "Os reembolsos são processados pela instituição de pagamento e o prazo de crédito depende do meio utilizado e da instituição financeira do Viajante.",
    ],
  },
  {
    title: "10. Avaliações e conteúdo do usuário",
    paragraphs: [
      "Fotos, vídeos, textos e avaliações publicados continuam pertencendo a você. Ao publicá-los, você concede ao Avena uma licença não exclusiva, gratuita e mundial para armazenar, exibir e reproduzir esse conteúdo na plataforma e em materiais de divulgação, enquanto sua conta estiver ativa.",
      "Você declara possuir os direitos sobre o conteúdo publicado e autorização das pessoas retratadas.",
      "Podemos remover conteúdo que viole a lei, direitos de terceiros ou estes Termos. Não alteramos nem removemos avaliações negativas legítimas a pedido de Parceiros.",
    ],
  },
  {
    title: "11. Condutas proibidas",
    paragraphs: [
      "É vedado: publicar avaliações falsas ou pagas; anunciar serviço que não se pretende prestar; combinar pagamento por fora para burlar a taxa de serviço; usar a plataforma para fins ilícitos; assediar, ameaçar ou discriminar outros usuários; e tentar acessar sistemas, dados ou contas de terceiros.",
      "O descumprimento pode resultar em remoção de conteúdo, suspensão ou encerramento da conta, sem prejuízo das medidas legais cabíveis.",
    ],
  },
  {
    title: "12. Suspensão e encerramento",
    paragraphs: [
      "Você pode encerrar sua conta a qualquer momento. Reservas já confirmadas permanecem válidas e sujeitas à política de cancelamento aplicável.",
      "Podemos suspender ou encerrar contas que violem estes Termos, apresentem indícios de fraude, ou cujo Parceiro perca registro legal exigido para sua atividade.",
    ],
  },
  {
    title: "13. Limitação de responsabilidade",
    paragraphs: [
      "O Avena não se responsabiliza por danos decorrentes da execução do serviço turístico, que é de responsabilidade exclusiva do Parceiro, incluindo acidentes, atrasos, cancelamentos e divergência entre o anunciado e o prestado.",
      "Não garantimos disponibilidade ininterrupta da plataforma, podendo haver interrupções para manutenção ou por falhas de terceiros.",
      "Nenhuma disposição destes Termos exclui ou limita responsabilidades que não possam ser excluídas ou limitadas pela legislação brasileira, em especial pelo Código de Defesa do Consumidor.",
    ],
  },
  {
    title: "14. Propriedade intelectual",
    paragraphs: [
      "A marca Avena, o logotipo, o software, o design e os conteúdos produzidos pela plataforma são de titularidade do Avena e protegidos por lei. O uso da plataforma não transfere qualquer direito sobre eles.",
    ],
  },
  {
    title: "15. Alterações destes Termos",
    paragraphs: [
      "Podemos alterar estes Termos a qualquer momento. Alterações relevantes serão comunicadas com antecedência razoável e exigirão novo aceite antes da próxima transação. A versão vigente está sempre disponível na plataforma.",
    ],
  },
  {
    title: "16. Lei aplicável e foro",
    paragraphs: [
      "Estes Termos são regidos pela lei brasileira. Fica eleito o foro do domicílio do consumidor para dirimir controvérsias, conforme o Código de Defesa do Consumidor.",
      "Dúvidas, reclamações e solicitações: [E-MAIL DE CONTATO].",
    ],
  },
];

export const privacyPolicy: LegalSection[] = [
  {
    title: "1. Controlador e Encarregado",
    paragraphs: [
      "O controlador dos dados pessoais tratados no Avena é [RAZÃO SOCIAL], CNPJ [00.000.000/0001-00], com sede em [ENDEREÇO COMPLETO].",
      "Encarregado pelo Tratamento de Dados Pessoais (DPO), nos termos do art. 41 da LGPD: [NOME DO ENCARREGADO] — [E-MAIL DO ENCARREGADO].",
      "Esta Política explica quais dados coletamos, por que coletamos, com quem compartilhamos e quais são os seus direitos.",
    ],
  },
  {
    title: "2. Dados que coletamos",
    paragraphs: [
      "Dados de cadastro: nome, nome de usuário, e-mail, foto de perfil e biografia. No login com Google, recebemos nome, e-mail e foto associados à conta Google.",
      "Dados de Parceiros: razão social ou nome, CNPJ ou CPF, número do Cadastur, endereço, telefone, e-mail e dados bancários para recebimento (estes coletados e tratados pela instituição de pagamento).",
      "Dados de uso: experiências registradas, localização dos lugares informados, fotos e vídeos, diário, avaliações, pessoas marcadas, reservas, mensagens trocadas e histórico de navegação na plataforma.",
      "Dados de pagamento: processados diretamente pela instituição de pagamento. O Avena recebe apenas o status da transação e os valores, não armazenando número completo de cartão nem CVV.",
      "Dados técnicos: endereço IP, tipo de dispositivo, sistema operacional, identificadores do aplicativo e registros de acesso, mantidos conforme exige o Marco Civil da Internet.",
    ],
  },
  {
    title: "3. Para que usamos e com qual base legal",
    paragraphs: [
      "Execução de contrato (art. 7º, V, LGPD): criar e manter sua conta, processar reservas, viabilizar pagamentos e repasses, permitir comunicação entre Viajante e Parceiro, e prestar suporte.",
      "Cumprimento de obrigação legal (art. 7º, II): guarda de registros de acesso, obrigações fiscais e atendimento a autoridades.",
      "Legítimo interesse (art. 7º, IX): prevenção a fraudes, segurança da plataforma, melhoria dos serviços e recomendações de destinos com base no seu histórico.",
      "Consentimento (art. 7º, I): envio de comunicações de marketing e uso da sua localização precisa, quando aplicável. Você pode retirar o consentimento a qualquer momento.",
    ],
  },
  {
    title: "4. Com quem compartilhamos",
    paragraphs: [
      "Com Parceiros: ao reservar, compartilhamos com o Parceiro os dados necessários à prestação do serviço (nome, contato, data e número de participantes).",
      "Com a instituição de pagamento: dados necessários ao processamento da cobrança, do split e de eventuais reembolsos.",
      "Com prestadores de tecnologia: hospedagem, banco de dados, envio de e-mails e análise de uso, que tratam os dados sob nossa instrução e com obrigação de confidencialidade.",
      "Com autoridades: mediante requisição legal, ordem judicial ou para defesa de direitos.",
      "Não vendemos dados pessoais.",
    ],
  },
  {
    title: "5. Perfis públicos e privados",
    paragraphs: [
      "Você escolhe se seu perfil é público ou privado. Em perfil público, seu nome de usuário, biografia, experiências e coleções podem ser vistos por outros usuários. Em perfil privado, o acesso é restrito.",
      "Avaliações publicadas sobre Parceiros são sempre públicas e exibidas com o seu nome, pois integram a reputação da comunidade.",
    ],
  },
  {
    title: "6. Cookies e tecnologias semelhantes",
    paragraphs: [
      "Utilizamos cookies e identificadores para manter sua sessão ativa, lembrar preferências, medir uso e melhorar a plataforma. Você pode gerenciar cookies nas configurações do navegador ou do dispositivo; a desativação de alguns deles pode limitar funcionalidades.",
    ],
  },
  {
    title: "7. Por quanto tempo guardamos",
    paragraphs: [
      "Dados de conta: enquanto a conta existir.",
      "Dados de reservas, pagamentos e notas fiscais: pelo prazo exigido pela legislação fiscal e para defesa em eventual processo.",
      "Registros de acesso: pelo prazo mínimo previsto no Marco Civil da Internet.",
      "Após esses prazos, os dados são eliminados ou anonimizados.",
    ],
  },
  {
    title: "8. Segurança",
    paragraphs: [
      "Adotamos medidas técnicas e administrativas para proteger seus dados, incluindo criptografia em trânsito, senhas armazenadas de forma irreversível, controle de acesso por perfil e registro de operações.",
      "Nenhum sistema é totalmente imune. Em caso de incidente de segurança que possa acarretar risco relevante, comunicaremos você e a ANPD conforme exige a LGPD.",
    ],
  },
  {
    title: "9. Seus direitos",
    paragraphs: [
      "Nos termos do art. 18 da LGPD, você pode solicitar: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade; portabilidade; informação sobre compartilhamentos; informação sobre a possibilidade de não consentir; e revogação do consentimento.",
      "Para exercer seus direitos, escreva para [E-MAIL DO ENCARREGADO]. Responderemos nos prazos legais. Alguns dados podem ser mantidos mesmo após pedido de exclusão, quando houver obrigação legal ou necessidade de defesa de direitos.",
    ],
  },
  {
    title: "10. Crianças e adolescentes",
    paragraphs: [
      "A plataforma é destinada a maiores de 18 anos. Não coletamos intencionalmente dados de menores. Identificado esse tratamento sem o consentimento específico de um dos pais ou responsável legal, os dados serão eliminados.",
    ],
  },
  {
    title: "11. Transferência internacional",
    paragraphs: [
      "Alguns prestadores de tecnologia podem armazenar dados fora do Brasil. Nesses casos, adotamos salvaguardas contratuais para assegurar nível de proteção compatível com a LGPD.",
    ],
  },
  {
    title: "12. Alterações desta Política",
    paragraphs: [
      "Podemos atualizar esta Política. Alterações relevantes serão comunicadas na plataforma e, quando exigido, solicitaremos novo consentimento. Dúvidas: [E-MAIL DO ENCARREGADO].",
    ],
  },
];
