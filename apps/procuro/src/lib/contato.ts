/**
 * Falar com o profissional — e o que cada plano libera.
 *
 * O plano de quem ATENDE decide o que quem PROCURA vê:
 *
 *   Básico  — o telefone aparece. Quem quiser liga, copiando o número.
 *   Pro     — botão de WhatsApp e de ligar, num toque.
 *   Premium — o mesmo, mais o chat dentro do app.
 *
 * Vale dizer por que o Básico ainda mostra o telefone: esconder o contato
 * de quem não paga transformaria o app num pedágio, e um cadastro com quem
 * não dá para falar não serve para quem procura — que iria embora. O que o
 * plano compra é a FACILIDADE (um toque em vez de copiar o número) e a
 * visibilidade, não o direito de ser encontrado.
 */

import { Alert, Linking, Platform } from 'react-native';
import { somenteDigitos } from './telefone';

export type MeioDeContato = 'whatsapp' | 'ligacao' | 'chat';

/**
 * Abrir a conversa no WhatsApp.
 *
 * Duas particularidades que custaram tempo em outros apps:
 *
 * 1. O número tem que ir SÓ com dígitos, com o 55 na frente e sem o `+`.
 *    Com `+`, alguns aparelhos abrem o WhatsApp numa tela de erro sem
 *    dizer o que houve.
 * 2. `wa.me` funciona no celular e no navegador; o esquema `whatsapp://`
 *    não funciona na web. Como o mesmo código roda nos três lugares, o
 *    endereço é sempre o `wa.me`.
 */
export async function abrirWhatsApp(telefone: string, mensagem?: string): Promise<void> {
  const numero = somenteDigitos(telefone);
  if (!numero) {
    Alert.alert('Sem número', 'Este profissional ainda não confirmou um telefone.');
    return;
  }

  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
  const endereco = `https://wa.me/${numero}${texto}`;

  try {
    await Linking.openURL(endereco);
  } catch {
    Alert.alert(
      'Não deu para abrir o WhatsApp',
      'Confira se o WhatsApp está instalado neste aparelho.',
    );
  }
}

/**
 * Ligar.
 *
 * No Android o esquema é `tel:` e ele abre o discador com o número
 * digitado — a pessoa ainda decide se liga. É de propósito: um app que
 * disca sozinho assusta, e assustar na primeira vez custa a segunda.
 */
export async function ligar(telefone: string): Promise<void> {
  const numero = somenteDigitos(telefone);
  if (!numero) {
    Alert.alert('Sem número', 'Este profissional ainda não confirmou um telefone.');
    return;
  }
  const endereco = Platform.OS === 'ios' ? `telprompt:+${numero}` : `tel:+${numero}`;
  try {
    await Linking.openURL(endereco);
  } catch {
    Alert.alert('Não deu para abrir o telefone', `O número é +${numero}.`);
  }
}

/**
 * A primeira mensagem, já escrita.
 *
 * Escrever a primeira mensagem é o degrau mais alto do contato: a pessoa
 * abre o WhatsApp, olha a tela em branco e desiste. Um texto pronto que
 * diz de onde veio e o que precisa derruba esse degrau — e ainda faz o
 * profissional entender na hora que o contato veio do procurô.
 */
export function primeiraMensagem(opcoes: {
  nomeDoProfissional: string;
  oQuePrecisa?: string;
}): string {
  const inicio = `Olá, ${opcoes.nomeDoProfissional}! Encontrei seu contato no procurô.`;
  if (!opcoes.oQuePrecisa) return `${inicio} Gostaria de falar sobre um serviço.`;
  return `${inicio} Preciso de: ${opcoes.oQuePrecisa}`;
}

/**
 * O que este plano libera de contato.
 *
 * `destaque` é o peso do plano na busca, e é o único sinal do plano que a
 * view pública expõe — por isso ele é usado aqui para deduzir o resto, em
 * vez de o app perguntar o plano de cada profissional (o que seria uma
 * consulta a mais por cartão da lista, e um vazamento de informação
 * comercial que não interessa a quem procura).
 */
export function contatosLiberados(destaque: number): {
  whatsapp: boolean;
  ligacao: boolean;
  chat: boolean;
} {
  return {
    whatsapp: destaque >= 10, // Pro e Premium
    ligacao: destaque >= 10,
    chat: destaque >= 30, // só Premium
  };
}
