/**
 * O cartão da oportunidade que chegou.
 *
 * É a tela mais importante do app para quem paga, então ela responde
 * quatro perguntas na ordem em que a pessoa faz, sem precisar tocar em
 * nada:
 *
 *   1. É do que eu faço?      -> a categoria, no topo
 *   2. É perto?               -> bairro e cidade
 *   3. Quanto tempo eu tenho? -> o prazo, e ele é o que aperta
 *   4. O que a pessoa quer?   -> a descrição
 *
 * O prazo aparece com destaque porque é o que muda o comportamento. Sem
 * ele visível, a oportunidade é "algo para ver depois" — e depois ela
 * venceu.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Botao, Cartao, Etiqueta } from './Base';
import { cores, espaco, tipo } from '../tema';
import type { Oportunidade } from '../tipos/dominio';

/**
 * Quanto falta, em português de gente.
 *
 * "expira em 5400 segundos" não diz nada. "1h30 restante" diz. E abaixo de
 * uma hora o texto vira vermelho, porque aí já é urgência e não informação.
 */
function tempoRestante(expiraEm: string): { texto: string; apertado: boolean } {
  const faltamMs = new Date(expiraEm).getTime() - Date.now();
  if (faltamMs <= 0) return { texto: 'Prazo encerrado', apertado: true };

  const minutos = Math.floor(faltamMs / 60000);
  if (minutos < 60) return { texto: `${minutos} min restantes`, apertado: true };

  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return { texto: resto ? `${horas}h${resto} restantes` : `${horas}h restantes`, apertado: horas < 2 };
  }
  const dias = Math.floor(horas / 24);
  return { texto: `${dias} ${dias === 1 ? 'dia' : 'dias'} restantes`, apertado: false };
}

/** Há quanto tempo chegou. */
function chegouHa(enviadoEm: string): string {
  const minutos = Math.floor((Date.now() - new Date(enviadoEm).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

export function CartaoDeOportunidade({
  oportunidade,
  aoAceitar,
  aoRecusar,
  respondendo = false,
}: {
  oportunidade: Oportunidade;
  aoAceitar: () => void;
  aoRecusar: () => void;
  respondendo?: boolean;
}) {
  const { pedido } = oportunidade;
  const prazo = tempoRestante(pedido.expira_em);
  const ondaUm = oportunidade.onda === 1;

  return (
    <View style={e.espacamento}>
      <Cartao destacado={ondaUm}>
        <View style={e.linhaDoTopo}>
          <Etiqueta>{pedido.categoria_nome}</Etiqueta>
          <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
            {chegouHa(oportunidade.enviado_em)}
          </Text>
        </View>

        {/* Só quem está na primeira onda vê este selo. Ele é metade do
            motivo de alguém assinar o plano de cima: a prova visível de
            que chegou antes. */}
        {ondaUm ? (
          <View style={e.selo}>
            <Etiqueta cor="destaque">Você recebeu primeiro</Etiqueta>
          </View>
        ) : null}

        <Text style={[tipo.corpoForte, e.descricao]} numberOfLines={3}>
          {pedido.descricao}
        </Text>

        <Text style={[tipo.apoio, { color: cores.textoApagado }]}>
          {[pedido.bairro, 'Itabirito'].filter(Boolean).join(' · ')}
        </Text>

        <View style={e.linhaDoPrazo}>
          <Etiqueta cor={prazo.apertado ? 'erro' : 'neutra'}>{prazo.texto}</Etiqueta>
        </View>

        <View style={e.botoes}>
          <View style={e.botaoEsquerda}>
            <Botao variante="contorno" onPress={aoRecusar} desabilitado={respondendo}>
              Não posso
            </Botao>
          </View>
          <View style={e.botaoDireita}>
            <Botao onPress={aoAceitar} carregando={respondendo}>
              Tenho interesse
            </Botao>
          </View>
        </View>
      </Cartao>
    </View>
  );
}

const e = StyleSheet.create({
  espacamento: { marginBottom: espaco.md },
  linhaDoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selo: { marginTop: espaco.sm },
  descricao: { color: cores.texto, marginTop: espaco.md, marginBottom: espaco.xs },
  linhaDoPrazo: { marginTop: espaco.md },
  botoes: { flexDirection: 'row', marginTop: espaco.lg, gap: espaco.sm },
  botaoEsquerda: { flex: 1 },
  botaoDireita: { flex: 1.4 },
});
