import { supabase } from "./supabase";
import { ehCelular, onlyPhoneDigits } from "./phone";

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
 * no cadastro. É essa comparação, feita no servidor, que impede alguém de
 * confirmar o próprio celular e anunciar o número de outra pessoa.
 */

/** O Auth exige formato internacional; o formulário guarda como se escreve aqui. */
export function paraFormatoInternacional(telefone: string): string {
  const d = onlyPhoneDigits(telefone);
  return `+55${d}`;
}

/**
 * A conta já tem este número confirmado?
 *
 * Precisa ser perguntado ANTES de pedir código, por causa de como o Auth se
 * comporta: mandar `updateUser({ phone })` com o telefone que já está lá e
 * já confirmado não é uma mudança — ele responde 200, não gera código e não
 * manda mensagem nenhuma. Sem erro em lugar nenhum.
 *
 * Do lado de quem esperava, isso era o pior tipo de defeito: o botão dizia
 * "Enviando…", a tela pedia os seis dígitos e o código nunca vinha. Dava
 * para apertar "enviar de novo" cinco vezes seguidas e receber cinco
 * respostas de sucesso, porque cada uma delas de fato deu certo — só não
 * fazia o que a pessoa achava que estava pedindo.
 *
 * Acontece com quem já confirmou o número uma vez (num cadastro anterior,
 * ou numa tentativa que travou depois do código) e volta para confirmar
 * outro cadastro com o mesmo telefone. Aí não falta código nenhum: falta
 * dizer ao cadastro que o número já é confirmado, que é o que a RPC faz.
 *
 * A comparação ignora o `+55` e a pontuação dos dois lados, do mesmo jeito
 * que a RPC `confirmar_whatsapp` faz no servidor — é ela quem decide de
 * verdade; aqui é só para saber se dá para pular o código.
 */
export async function numeroJaConfirmadoNaConta(telefone: string): Promise<boolean> {
  const client = supabase();
  if (!client) return false;
  const { data } = await client.auth.getUser();
  const usuario = data.user;
  if (!usuario?.phone || !usuario.phone_confirmed_at) return false;

  const semPais = (valor: string) => onlyPhoneDigits(valor.replace(/^\+?55/, ""));
  return semPais(usuario.phone) === semPais(telefone) && semPais(telefone) !== "";
}

export async function enviarCodigoWhatsApp(telefone: string): Promise<void> {
  const client = supabase();
  if (!client) throw new Error("Sem conexão com o banco.");

  const digitos = onlyPhoneDigits(telefone);
  if (digitos.length !== 10 && digitos.length !== 11) {
    throw new Error("Confira o número: precisa ter DDD e 8 ou 9 dígitos.");
  }
  /* Barra o telefone fixo aqui, e não depois. O provedor aceita o pedido de
     mandar SMS para um fixo, responde "enviado" e cobra — e a mensagem não
     chega, porque não há para onde chegar. Sem esta checagem, quem tem fixo
     no cadastro apertava "Enviar código", via a tela pedir os seis dígitos e
     esperava para sempre por algo que ninguém mandou. Nenhum erro em lugar
     nenhum: nem na tela, nem no log do servidor. */
  if (!ehCelular(digitos)) {
    throw new Error(
      "Esse número parece ser de telefone fixo, e o código só chega em celular. " +
        "Coloque um celular no campo WhatsApp do seu cadastro e tente de novo."
    );
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

/** Marca o cadastro como confirmado — o servidor confere tudo de novo. */
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
  /* "Unable to get SMS provider" é o que o Auth responde quando não há
     serviço de SMS configurado no projeto. A frase escapava da tradução por
     não conter "phone provider", e chegava em inglês a quem só queria
     anunciar. */
  if (m.includes("sms provider") || m.includes("phone provider") || m.includes("not enabled") || m.includes("unsupported")) {
    return "O envio por WhatsApp ainda não está ligado no servidor. Fale com a administração.";
  }
  if (m.includes("already been registered") || m.includes("already exists")) {
    return "Esse número já está confirmado em outra conta.";
  }
  return mensagem;
}
