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
export const CONTATO_EMAIL = "buscaitabirito@gmail.com";

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
