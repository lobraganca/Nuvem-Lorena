import { supabase } from "./supabase";
import { onlyPhoneDigits } from "./phone";

/**
 * Confirmação de posse do número por código enviado no WhatsApp.
 *
 * Quem envia e confere o código é o Supabase Auth, ligado a um provedor de
 * mensagens (Twilio) — de propósito. Um código gerado por nós ficaria guardado
 * em algum lugar do banco, e um código guardado é um código que vaza; além
 * disso, controle de tentativas, expiração e reenvio já vêm prontos ali.
 *
 * O número entra no Auth como telefone da conta e, uma vez confirmado, a RPC
 * `confirmar_whatsapp` compara o que o Auth confirmou com o que está escrito
 * no anúncio. É essa comparação, feita no servidor, que impede alguém de
 * confirmar o próprio celular e anunciar o número de outra pessoa.
 */

/** O Auth exige formato internacional; o formulário guarda como se escreve aqui. */
export function paraFormatoInternacional(telefone: string): string {
  const d = onlyPhoneDigits(telefone);
  return `+55${d}`;
}

export async function enviarCodigoWhatsApp(telefone: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");

  const digitos = onlyPhoneDigits(telefone);
  if (digitos.length !== 10 && digitos.length !== 11) {
    throw new Error("Confira o número: precisa ter DDD e 8 ou 9 dígitos.");
  }

  const { error } = await client.auth.updateUser({ phone: paraFormatoInternacional(telefone) });
  if (error) throw new Error(traduzir(error.message));
}

export async function conferirCodigoWhatsApp(telefone: string, codigo: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");

  const { error } = await client.auth.verifyOtp({
    phone: paraFormatoInternacional(telefone),
    token: codigo.trim(),
    // "phone_change" e não "sms": a conta já existe e entrou pelo Google; o
    // que está acontecendo é a adição de um telefone a ela, não um login.
    type: "phone_change",
  });
  if (error) throw new Error(traduzir(error.message));
}

/** Marca o anúncio como confirmado — o servidor confere tudo de novo. */
export async function marcarAnuncioConfirmado(professionalId: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");
  const { error } = await client.rpc("confirmar_whatsapp", { p_professional_id: professionalId });
  if (error) throw new Error(error.message);
}

/**
 * As mensagens do Auth vêm em inglês e falam de "phone provider" e "OTP" —
 * vocabulário de quem construiu o sistema, não de quem está tentando
 * confirmar o próprio número.
 */
function traduzir(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("token has expired") || m.includes("expired")) {
    return "Esse código expirou. Peça um novo.";
  }
  if (m.includes("invalid") && m.includes("token")) {
    return "Código incorreto. Confira os números e tente de novo.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  }
  if (m.includes("phone provider") || m.includes("not enabled") || m.includes("unsupported")) {
    return "O envio por WhatsApp ainda não está ligado no servidor. Fale com a administração.";
  }
  if (m.includes("already been registered") || m.includes("already exists")) {
    return "Esse número já está confirmado em outra conta.";
  }
  return mensagem;
}
