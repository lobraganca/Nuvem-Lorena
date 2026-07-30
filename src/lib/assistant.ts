import { plans } from "./plans";
import { serviceFeePercent } from "./pricing";
import { cancellationPolicyDescription, cancellationPolicyLabel } from "./cancellation";
import { BOOST_PACKAGES, boostDailyPrice } from "./boosts";
import { cancellationPolicies } from "./cancellation";

/**
 * Local answer engine for the help chat.
 *
 * Answers are generated from the app's real configuration (plan prices,
 * commission rates, cancellation rules) rather than hardcoded prose, so they
 * can never drift from what the app actually charges or does.
 *
 * This is deterministic keyword matching, not a language model. The intent
 * list and `answerQuestion` are the seam where a real AI API would plug in:
 * send unmatched questions to the model with this knowledge as context.
 */

export interface Intent {
  id: string;
  keywords: string[];
  /**
   * Breaks ties when a question matches more than one intent with equal
   * keyword weight. "Como cancelo minha reserva?" contains both "cancel" and
   * "reserv" — cancelling is the more specific request, so it wins.
   */
  priority?: number;
  answer: () => string;
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export const intents: Intent[] = [
  {
    id: "planos-empresa",
    keywords: ["plano", "mensalidade", "assinatura", "quanto custa", "valor do plano"],
    answer: () =>
      "Planos de adesão para agências, guias, hotéis e restaurantes:\n\n" +
      plans.map((p) => `• ${p.tier} — ${p.price}`).join("\n") +
      "\n\nNada é descontado das suas reservas: o preço que você anuncia é o " +
      "que você recebe.\n\nPara o viajante não há mensalidade nenhuma.",
  },
  {
    id: "comissao",
    keywords: ["comiss", "taxa", "quanto o avena", "porcentagem", "quanto voces cobram"],
    answer: () =>
      `A taxa de serviço do Avena é de ${serviceFeePercent()}% e é somada ao ` +
      "valor do passeio, paga por quem reserva.\n\nA empresa recebe o preço " +
      "cheio que anunciou — nada sai dela. O que a empresa paga é a adesão " +
      "mensal do plano.\n\nOs três valores aparecem separados antes de você " +
      "confirmar: passeio, taxa de serviço e total.",
  },
  {
    id: "reservar",
    keywords: ["reserv", "compr", "agend", "contrat"],
    answer: () =>
      "Para reservar:\n\n1. Abra “Destinos” e busque a cidade para onde vai\n2. Escolha uma agência, guia ou hotel\n3. Clique em “Reservar” no passeio desejado\n4. Escolha a data e o número de pessoas\n5. Confira o valor e a política de cancelamento e confirme\n\nA reserva aparece em “Reservas”.",
  },
  {
    id: "cancelamento",
    priority: 2,
    keywords: ["cancel", "reembols", "estorn", "desist", "arrepend", "dinheiro de volta"],
    answer: () =>
      "Você cancela em “Reservas”, no botão “Cancelar reserva”. O app mostra quanto será devolvido antes de você confirmar.\n\nPor lei, você tem 7 dias corridos após a compra para desistir com reembolso integral, desde que o passeio ainda não tenha acontecido.\n\nDepois desse prazo vale a política do passeio:\n\n" +
      cancellationPolicies
        .map((p) => `• ${cancellationPolicyLabel[p]}: ${cancellationPolicyDescription[p]}`)
        .join("\n") +
      "\n\nSe a agência cancelar, o reembolso é sempre integral.",
  },
  {
    id: "vagas",
    priority: 1,
    keywords: ["vaga", "lotad", "disponibilidade", "disponivel", "tem lugar", "esgotad"],
    answer: () =>
      "As vagas aparecem no próprio passeio, por data. Quando a agência define um limite diário, você vê algo como “8 de 12 vagas hoje”.\n\nSe a data escolhida estiver esgotada, o botão de confirmar fica bloqueado e o app avisa. Tente outra data.",
  },
  {
    id: "avaliacao",
    priority: 1,
    keywords: ["avali", "nota", "estrela", "review", "reputa", "recomend", "coment"],
    answer: () =>
      "Depois que a data do passeio passa, aparece o botão “Avaliar agência” em “Reservas”. Você dá uma nota de 1 a 5, escreve um comentário e diz se recomenda.\n\nSó quem reservou pelo app pode avaliar — por isso a reputação que você vê é de gente que realmente foi.",
  },
  {
    id: "cadastur",
    keywords: ["cadastur", "verificad", "registro", "confia", "seguro", "golpe"],
    answer: () =>
      "Cadastur é o registro obrigatório no Ministério do Turismo para agências, guias e hospedagem venderem serviços no Brasil.\n\nO Avena exige esse número no cadastro dessas empresas, e ele aparece na página delas. Se você vê o selo Cadastur, a empresa declarou registro oficial.",
  },
  {
    id: "turbinar",
    priority: 2,
    keywords: ["turbin", "anunci", "destaqu", "patrocin", "divulg", "impulsion"],
    answer: () =>
      "Se você tem conta profissional, pode destacar um passeio na primeira tela dos viajantes.\n\nNo painel, clique em “Turbinar anúncio”, escolha " +
      BOOST_PACKAGES.join(", ") +
      " dias e confirme. O preço por dia depende do seu plano:\n\n" +
      plans
        .map((p) => `• ${p.tier}: R$ ${brl(boostDailyPrice(p.tier))}/dia`)
        .join("\n") +
      "\n\nAnúncios em destaque aparecem sempre marcados como “Patrocinado”.",
  },
  {
    id: "experiencia",
    keywords: ["experienc", "memoria", "registr", "mapa afetivo", "diario", "lembranc"],
    answer: () =>
      "O mapa afetivo guarda os lugares que você viveu. Toque no “+” sobre o mapa para registrar uma experiência: local, data, fotos, diário, humor do dia e as pessoas que estavam com você.\n\nDepois dá para abrir o perfil de cada pessoa e ver tudo que vocês viveram juntos.",
  },
  {
    id: "cadastro-empresa",
    keywords: ["cadastrar empresa", "sou agenc", "sou guia", "quero anunciar", "minha empresa", "meu restaurante", "meu hotel", "minha pousada"],
    answer: () =>
      "Em “Para empresas” você cadastra sua agência, seu trabalho como guia, restaurante ou hotel.\n\nVocê informa dados de contato, localização, o número do Cadastur (obrigatório para agências, guias e hospedagem) e escolhe um plano. Depois publica seus passeios com preço, duração, vagas por dia e política de cancelamento.",
  },
  {
    id: "pagamento",
    keywords: ["pagament", "pagar", "cartao", "pix", "cobran", "receb", "boleto"],
    answer: () =>
      "O pagamento é feito no app e dividido automaticamente: a agência recebe o valor do serviço e o Avena retém a taxa de serviço.\n\nO processamento é feito por instituição de pagamento autorizada pelo Banco Central. O Avena não guarda os dados do seu cartão.",
  },
  {
    id: "privacidade",
    keywords: ["privacidade", "meus dados", "lgpd", "excluir conta", "apagar conta", "cookie", "perfil privado"],
    answer: () =>
      "Você controla seus dados. No Perfil dá para deixar sua conta pública ou privada, e no rodapé você acessa a Política de Privacidade e as preferências de cookies.\n\nPela LGPD você pode pedir acesso, correção ou exclusão dos seus dados pelo canal indicado na Política de Privacidade.",
  },
  {
    id: "mensagem",
    keywords: ["mensag", "conversar", "falar com", "contato", "telefone", "whatsapp"],
    answer: () =>
      "Em “Mensagens” você conversa com as pessoas que participaram das suas experiências.\n\nPara falar com uma agência ou guia sobre um passeio, use os dados de contato na página dele — e-mail, telefone e site aparecem lá.",
  },
];

export interface AssistantReply {
  text: string;
  matched: boolean;
}

export function answerQuestion(question: string): AssistantReply {
  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  let best: { intent: Intent; score: number; priority: number } | null = null;

  for (const intent of intents) {
    let score = 0;
    for (const keyword of intent.keywords) {
      const k = keyword
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      // Keywords are stems ("cancel"), so "cancelo", "cancelar" and
      // "cancelamento" all match the same intent.
      if (normalized.includes(k)) {
        // Longer stems are more specific, so they weigh more.
        score += k.length;
      }
    }
    if (score === 0) continue;

    const priority = intent.priority ?? 0;
    const beatsBest =
      !best || priority > best.priority || (priority === best.priority && score > best.score);

    if (beatsBest) {
      best = { intent, score, priority };
    }
  }

  if (!best) {
    return {
      matched: false,
      text: "Ainda não sei responder isso. Posso ajudar com: planos e taxas, como reservar, cancelamento e reembolso, vagas, avaliações, Cadastur, anúncios em destaque, registrar experiências, pagamento e privacidade.\n\nSe for algo específico da sua reserva, fale direto com a agência pelos contatos na página dela.",
    };
  }

  return { matched: true, text: best.intent.answer() };
}

export const suggestedQuestions = [
  "Quanto custam os planos?",
  "Como faço para reservar?",
  "Como cancelo e recebo reembolso?",
  "O que é Cadastur?",
  "Como turbinar meu anúncio?",
];
