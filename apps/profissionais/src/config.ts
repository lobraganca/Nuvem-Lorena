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

/* ---------------------------------------------------------------------
   As portas de entrada que dependem de configuração no painel do Supabase
   ---------------------------------------------------------------------

   As três chaves abaixo nascem desligadas, e isso foi decidido de
   propósito: cada uma delas, ligada sem o ajuste correspondente no
   Supabase, vira uma porta que não abre — e porta que não abre custa mais
   confiança do que porta que não existe. A pessoa digita o número, aperta
   "receber código", vê "Enviando…" e espera para sempre. Não há erro
   nenhum na tela dizendo o que houve, porque do lado do app nada deu
   errado.

   Ligar cada uma é trocar o valor por "1" numa variável na Vercel
   (Settings > Environment Variables), sem mexer no código.
   ------------------------------------------------------------------- */

/**
 * Entrar pelo celular, com código por SMS.
 *
 * Antes de ligar: Supabase > Authentication > Sign In / Providers > Phone,
 * conferindo se **criar conta nova pelo telefone** está permitido. O envio
 * de código já funciona no app (é o que confirma o número de quem anuncia),
 * mas confirmar o número de uma conta que já existe e *nascer* uma conta
 * pelo número são coisas separadas no painel.
 *
 * Variável: VITE_LOGIN_TELEFONE
 */
export const LOGIN_TELEFONE_ATIVO = (import.meta.env.VITE_LOGIN_TELEFONE ?? "") === "1";

/**
 * Entrar com e-mail e senha, com "criar conta" e "esqueci a senha".
 *
 * Antes de ligar: Supabase > Authentication > SMTP Settings, com um
 * remetente de verdade. O remetente que vem de fábrica tem limite baixo por
 * hora e cai em spam — e os dois caminhos que este login precisa
 * (confirmar o cadastro e recuperar a senha) são exatamente os que morrem
 * quando o e-mail não chega. Sem SMTP, quem criar conta fica sem conseguir
 * entrar nela.
 *
 * Variável: VITE_LOGIN_EMAIL
 */
export const LOGIN_EMAIL_ATIVO = (import.meta.env.VITE_LOGIN_EMAIL ?? "") === "1";

/**
 * Exigir número confirmado nas telas de conta.
 *
 * Esta não depende de configuração nova — usa o mesmo envio de código que
 * já funciona. Nasce desligada por outro motivo: ela é a única mudança
 * daqui que pode **impedir alguém de usar o que já usava**. Quem entrou
 * pelo Google e não confirmou o número topa com a barreira no painel, no
 * perfil, nos favoritos e na administração — e isso inclui a dona do app.
 *
 * Uma barreira dessas não deve estrear enquanto não houver ninguém
 * disponível para socorrer quem ficar do lado de fora.
 *
 * Variável: VITE_EXIGIR_NUMERO
 */
export const EXIGIR_NUMERO_ATIVO = (import.meta.env.VITE_EXIGIR_NUMERO ?? "") === "1";
