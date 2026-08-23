/**
 * Entrar no app.
 *
 * **O login é o telefone, e não existe senha.** A decisão não é preguiça,
 * é consequência: o número precisa ser confirmado de qualquer jeito — é
 * ele que libera aparecer na busca e receber oportunidade. Pedir uma senha
 * ALÉM disso seria exigir duas provas para o mesmo fato, e uma delas é a
 * que as pessoas esquecem. Senha esquecida é a maior fonte de conta
 * abandonada que existe, e aqui ela não compraria nada.
 *
 * O caminho é: digita o número, recebe um código por SMS, digita o código.
 * Quem escreve `phone_confirmed_at` no `auth.users` é o Supabase Auth,
 * depois de conferir o código com o Twilio — e é justamente por isso que
 * aquela coluna serve de fonte da verdade para a confirmação (ver a
 * migration 0004). O app não alcança aquilo, e é o que impede a forja.
 */

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ErroDeDados, mensagemDeErro } from './erros';
import { paraE164 } from './telefone';

/**
 * O estado da sessão tem TRÊS valores, e o do meio é o que costuma ser
 * esquecido:
 *
 *   carregando — ainda estamos lendo o que está guardado no aparelho
 *   entrou     — tem sessão
 *   fora       — não tem
 *
 * Sem o `carregando`, o app trata "ainda não li" como "não entrou" e
 * mostra a tela de login por um instante toda vez que abre — inclusive
 * para quem está logado há meses. O piscar dura poucos quadros e é o
 * suficiente para o app parecer quebrado.
 */
export type EstadoDaSessao =
  | { fase: 'carregando' }
  | { fase: 'entrou'; sessao: Session }
  | { fase: 'fora' };

export function useSessao(): EstadoDaSessao {
  const [estado, setEstado] = useState<EstadoDaSessao>({ fase: 'carregando' });

  useEffect(() => {
    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setEstado(data.session ? { fase: 'entrou', sessao: data.session } : { fase: 'fora' });
    });

    // Mantém a tela em dia quando o token renova sozinho, quando a pessoa
    // sai em outra aba, ou quando a sessão expira de vez.
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (!vivo) return;
      setEstado(sessao ? { fase: 'entrou', sessao } : { fase: 'fora' });
    });

    return () => {
      vivo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  return estado;
}

/**
 * Manda o código por SMS.
 *
 * Devolve o número em E.164 para a tela seguinte usar — ela precisa mandar
 * EXATAMENTE o mesmo número na hora de conferir, e deixar cada tela
 * formatar por conta própria é como os dois deixam de bater.
 */
export async function pedirCodigo(telefoneDigitado: string): Promise<string> {
  const conferido = paraE164(telefoneDigitado);
  if (!conferido.valido) throw new ErroDeDados(conferido.motivo);

  const { error } = await supabase.auth.signInWithOtp({ phone: conferido.e164 });

  if (error) {
    // O Auth tem limite de envio por número, e bater nesse limite é comum
    // quando a pessoa acha que o SMS não chegou e toca de novo. O recado
    // padrão vem em inglês e falando de "rate limit", que não diz nada
    // para quem só quer entrar.
    if (/rate|limit|too many|segundos|seconds/i.test(error.message ?? '')) {
      throw new ErroDeDados(
        'Você pediu o código várias vezes seguidas. Espere um minuto antes de tentar de novo.',
        error,
      );
    }
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para enviar o código agora.'), error);
  }

  return conferido.e164;
}

/**
 * Confere o código digitado.
 *
 * O `telefoneE164` tem que ser o mesmo devolvido por `pedirCodigo` — por
 * isso ele viaja entre as telas em vez de ser remontado.
 */
export async function conferirCodigo(telefoneE164: string, codigo: string): Promise<void> {
  const limpo = (codigo ?? '').replace(/\D/g, '');
  if (limpo.length < 4) {
    throw new ErroDeDados('Digite o código que chegou por SMS.');
  }

  const { error } = await supabase.auth.verifyOtp({
    phone: telefoneE164,
    token: limpo,
    type: 'sms',
  });

  if (error) {
    if (/expired|expirou/i.test(error.message ?? '')) {
      throw new ErroDeDados('Esse código expirou. Peça um novo.', error);
    }
    if (/invalid|incorrect|token/i.test(error.message ?? '')) {
      throw new ErroDeDados('Código errado. Confira os números do SMS.', error);
    }
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para conferir o código.'), error);
  }
}

export async function sair(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new ErroDeDados(mensagemDeErro(error, 'Não deu para sair da conta.'), error);
  }
}
