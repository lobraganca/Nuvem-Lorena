/**
 * Dados do responsável pela plataforma.
 *
 * A LGPD exige que quem coleta dados se identifique e ofereça um canal para
 * pedidos (acesso, correção, exclusão) — e exige que esse canal funcione de
 * verdade: um endereço que ninguém lê é descumprimento igual a não ter
 * nenhum. Está aqui, em um lugar só, porque aparece na Política de
 * Privacidade, nos Termos e no aviso de dados; espalhado pelo código, uma
 * troca de e-mail deixaria versões antigas vivas em alguma tela.
 */
export const CONTATO_EMAIL = "procuroapp@gmail.com";

/**
 * WhatsApp do suporte, só com dígitos e com o código do país.
 *
 * Fica aqui pelo mesmo motivo do e-mail: ele aparece no botão flutuante e
 * no rodapé, e um número trocado num lugar só deixaria o outro mandando
 * gente para um telefone que não atende mais.
 */
export const SUPORTE_WHATSAPP = "5531971473162";

/** O mesmo número escrito como se lê, para aparecer na tela. */
export const SUPORTE_WHATSAPP_VISIVEL = "(31) 97147-3162";

/** Nome usado nos documentos legais. */
export const NOME_PLATAFORMA = "procurô";

/** Cidade-sede, citada na Política de Privacidade. */
export const CIDADE_SEDE = "Itabirito/MG";

/**
 * Data da última revisão dos documentos legais. Precisa ser atualizada à mão
 * quando o texto mudar: a lei pede que a pessoa consiga saber se o documento
 * que ela leu ainda é o mesmo.
 */
export const VERSAO_DOCUMENTOS = "9 de agosto de 2026";


/**
 * Preço de um espaço de publicidade (banner), em centavos, e por quantos
 * dias ele vale.
 *
 * Em centavos e num lugar só pelo mesmo motivo do e-mail de contato: o
 * valor aparece na página de vendas e no cadastro do banner, e um preço
 * que muda em uma tela e não na outra é o tipo de diferença que só se
 * descobre quando um anunciante cobra a diferença.
 */
export const PRECO_BANNER_CENTAVOS = 2990;
export const DIAS_BANNER = 30;

/** O preço escrito como se lê: "R$ 29,90". */
export function precoDoBanner(): string {
  return (PRECO_BANNER_CENTAVOS / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Liga o botão "Entrar com a Apple".
 *
 * Fica atrás de uma chave porque o login da Apple exige conta de
 * desenvolvedor paga e configuração no painel do Supabase. Mostrar o botão
 * antes disso seria oferecer uma porta que não abre — e porta que não abre
 * custa mais confiança do que a ausência dela.
 *
 * Para ligar: criar a variável VITE_APPLE_LOGIN com valor 1 na Vercel, depois
 * de configurar o provedor Apple no Supabase.
 */
export const LOGIN_APPLE_ATIVO = (import.meta.env.VITE_APPLE_LOGIN ?? "") === "1";
